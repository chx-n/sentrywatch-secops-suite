"""Asynchronous, non-blocking TCP service scanner.

Every socket operation multiplexes over a single event loop via
:func:`asyncio.open_connection`; no threads or processes are spawned for
I/O. One :class:`asyncio.Semaphore` bounds concurrent sockets, and each
phase (connect, banner read) carries an explicit deadline enforced with
:func:`asyncio.wait_for`, so unresponsive peers can never stall a scan.
Targets are SSRF-screened by :mod:`core.security` before dialing; the
scanner connects to literal IPs only.

Example::

    from core.scanner import AsyncServiceScanner, run_scan
    from core.schemas import ScanRequest

    async def main() -> None:
        request = ScanRequest(targets=["example.com"], ports="80,443")
        async with AsyncServiceScanner(request) as scanner:
            report = await scanner.scan()
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
from collections.abc import AsyncIterator, Sequence
from dataclasses import dataclass
from datetime import datetime
from time import perf_counter
from typing import ClassVar, Final, Self
from uuid import uuid4

from core.exceptions import SentryWatchError
from core.schemas import (
    DEFAULT_SCAN_PORTS,
    HostScanResult,
    PortNumber,
    PortProbe,
    PortState,
    ScanReport,
    ScanRequest,
    parse_port_spec,
    utc_now,
)
from core.security import IPAddress, TargetKind, ValidatedTarget, prepare_targets

__all__: Final[tuple[str, ...]] = (
    "AsyncServiceScanner",
    "BannerReader",
    "ProbeOutcome",
    "aggregate_report",
    "run_scan",
)

_LOGGER: Final[logging.Logger] = logging.getLogger(__name__)

BANNER_READ_BYTES: Final[int] = 1024
BANNER_MAX_CHARS: Final[int] = 512
_RETRY_BACKOFF_CAP_S: Final[float] = 1.0
_RETRY_BACKOFF_STEP_S: Final[float] = 0.25


@dataclass(frozen=True, slots=True)
class ProbeOutcome:
    """Raw result of a single TCP probe before schema conversion."""

    port: int
    state: PortState
    latency_ms: float | None = None
    banner: str | None = None
    detail: str | None = None


def _sanitize_banner(raw: bytes) -> str:
    text = raw.decode("utf-8", errors="replace")
    printable = "".join(char if char.isprintable() else "." for char in text[:BANNER_MAX_CHARS])
    return printable.strip()


def aggregate_report(
    *,
    targets: Sequence[str],
    ports_scanned: Sequence[PortNumber],
    hosts: Sequence[HostScanResult],
    started_at: datetime,
    completed_at: datetime,
) -> ScanReport:
    """Build a :class:`ScanReport` from streamed host results (shared by scanner and API)."""
    host_tuple = tuple(hosts)
    duration_ms = round((completed_at.timestamp() - started_at.timestamp()) * 1000.0, 3)
    return ScanReport(
        id=uuid4(),
        targets=tuple(targets),
        ports_scanned=tuple(ports_scanned),
        hosts=host_tuple,
        started_at=started_at,
        completed_at=completed_at,
        duration_ms=duration_ms,
        hosts_scanned=sum(1 for host in host_tuple if host.error is None),
        hosts_failed=sum(1 for host in host_tuple if host.error is not None),
        open_port_count=sum(len(host.open_ports) for host in host_tuple),
    )


class BannerReader:
    """Best-effort banner collector for freshly opened connections."""

    __slots__ = ("_timeout_s",)

    def __init__(self, timeout_s: float) -> None:
        self._timeout_s = timeout_s

    async def read(self, reader: asyncio.StreamReader) -> str | None:
        try:
            raw = await asyncio.wait_for(reader.read(BANNER_READ_BYTES), timeout=self._timeout_s)
        except (TimeoutError, OSError):
            return None
        if not raw:
            return None
        return _sanitize_banner(raw)


class AsyncServiceScanner:
    """Bounded-concurrency asynchronous TCP scanner.

    Usage::

        request = ScanRequest(targets=["example.com"], ports="80,443")
        async with AsyncServiceScanner(request) as scanner:
            report = await scanner.scan()

    Concurrency model: every connect and banner phase executes inside a
    shared semaphore sized by ``ScanRequest.max_concurrency``, capping
    in-flight file descriptors regardless of fan-out width. Cancellation
    is honoured at every ``await`` point.
    """

    MIN_CONCURRENCY: ClassVar[int] = 1
    MAX_CONCURRENCY: ClassVar[int] = 4096

    def __init__(self, request: ScanRequest) -> None:
        self._request = request
        self._semaphore = asyncio.Semaphore(request.max_concurrency)
        self._banner_reader: BannerReader | None = (
            BannerReader(request.banner_timeout_s) if request.grab_banners else None
        )
        self._prepared: tuple[ValidatedTarget, ...] | None = None

    async def __aenter__(self) -> Self:
        return self

    async def __aexit__(self, *_exc_info: object) -> None:
        return None

    @property
    def request(self) -> ScanRequest:
        return self._request

    async def scan(self) -> ScanReport:
        """Run the full scan and return an aggregated :class:`ScanReport`."""
        started_at = utc_now()
        hosts: list[HostScanResult] = [host async for host in self.stream_hosts()]
        completed_at = utc_now()
        return aggregate_report(
            targets=self._request.targets,
            ports_scanned=self._request.ports,
            hosts=tuple(hosts),
            started_at=started_at,
            completed_at=completed_at,
        )

    async def stream_hosts(self) -> AsyncIterator[HostScanResult]:
        """Yield :class:`HostScanResult` objects as each host completes."""
        validated = await self._prepare()
        tasks = [asyncio.ensure_future(self._scan_host(target)) for target in validated]
        try:
            for pending in asyncio.as_completed(tasks):
                yield await pending
        finally:
            running = [task for task in tasks if not task.done()]
            for task in running:
                task.cancel()
            if running:
                with contextlib.suppress(asyncio.CancelledError):
                    await asyncio.gather(*running, return_exceptions=True)

    async def _prepare(self) -> tuple[ValidatedTarget, ...]:
        if self._prepared is None:
            try:
                validated = await asyncio.to_thread(
                    prepare_targets,
                    self._request.targets,
                    allow_private_networks=self._request.allow_private_networks,
                )
            except SentryWatchError:
                raise
            expanded: list[ValidatedTarget] = []
            for target in validated:
                if target.kind is TargetKind.NETWORK or len(target.addresses) > 1:
                    expanded.extend(
                        ValidatedTarget(
                            raw=str(address), kind=TargetKind.ADDRESS, addresses=(address,)
                        )
                        for address in target.addresses
                    )
                else:
                    expanded.append(target)
            self._prepared = tuple(expanded)
        assert self._prepared is not None
        return self._prepared

    async def _scan_host(self, target: ValidatedTarget) -> HostScanResult:
        started_at = utc_now()
        clock = perf_counter()
        probes: tuple[PortProbe, ...] = ()
        error: str | None = None
        address = target.primary_address
        try:
            outcomes = await asyncio.gather(
                *(self._probe(address, port) for port in self._request.ports)
            )
            probes = tuple(
                sorted(
                    (
                        PortProbe(
                            port=outcome.port,
                            state=outcome.state,
                            latency_ms=outcome.latency_ms,
                            banner=outcome.banner,
                            detail=outcome.detail,
                        )
                        for outcome in outcomes
                    ),
                    key=lambda probe: probe.port,
                )
            )
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            _LOGGER.exception("host scan crashed for %s", target.raw)
            error = f"{type(exc).__name__}: {exc}"
        completed_at = utc_now()
        duration_ms = round((perf_counter() - clock) * 1000.0, 3)
        open_ports = tuple(probe.port for probe in probes if probe.state is PortState.OPEN)
        return HostScanResult(
            target=target.raw,
            address=address,
            probes=probes,
            started_at=started_at,
            completed_at=completed_at,
            duration_ms=duration_ms,
            open_ports=open_ports,
            open_port_count=len(open_ports),
            error=error,
        )

    async def _probe(self, address: IPAddress, port: PortNumber) -> ProbeOutcome:
        retries = self._request.max_retries
        detail: str | None = None
        for attempt in range(retries + 1):
            clock = perf_counter()
            try:
                async with self._semaphore:
                    connect_coro = asyncio.open_connection(str(address), port)
                    reader, writer = await asyncio.wait_for(
                        connect_coro, timeout=self._request.connect_timeout_s
                    )
                    latency_ms = round((perf_counter() - clock) * 1000.0, 3)
                    try:
                        banner = (
                            await self._banner_reader.read(reader)
                            if self._banner_reader is not None
                            else None
                        )
                    finally:
                        writer.close()
                        with contextlib.suppress(OSError):
                            await writer.wait_closed()
                    return ProbeOutcome(port, PortState.OPEN, latency_ms, banner)
            except asyncio.CancelledError:
                raise
            except TimeoutError:
                detail = f"connect timed out after {self._request.connect_timeout_s:g}s"
            except ConnectionRefusedError:
                refused_latency = round((perf_counter() - clock) * 1000.0, 3)
                return ProbeOutcome(port, PortState.CLOSED, refused_latency)
            except OSError as exc:
                detail = exc.strerror or type(exc).__name__
            if attempt < retries:
                backoff = min(_RETRY_BACKOFF_STEP_S * (attempt + 1), _RETRY_BACKOFF_CAP_S)
                await asyncio.sleep(backoff)
        return ProbeOutcome(port, PortState.FILTERED, None, None, detail)


async def run_scan(
    targets: Sequence[str],
    *,
    ports: str | int | Sequence[int] | Sequence[str] = DEFAULT_SCAN_PORTS,
    max_concurrency: int = 256,
    connect_timeout_s: float = 3.0,
    banner_timeout_s: float = 2.0,
    grab_banners: bool = True,
    allow_private_networks: bool = False,
    max_retries: int = 1,
) -> ScanReport:
    """One-shot convenience wrapper building a :class:`ScanRequest` internally."""
    request = ScanRequest(
        targets=tuple(targets),
        ports=parse_port_spec(ports),
        max_concurrency=max_concurrency,
        connect_timeout_s=connect_timeout_s,
        banner_timeout_s=banner_timeout_s,
        grab_banners=grab_banners,
        allow_private_networks=allow_private_networks,
        max_retries=max_retries,
    )
    async with AsyncServiceScanner(request) as scanner:
        return await scanner.scan()
