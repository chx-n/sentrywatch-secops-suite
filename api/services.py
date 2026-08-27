"""Scan orchestration service with bounded concurrency and telemetry fan-out."""

from __future__ import annotations

import asyncio
import logging
from collections import OrderedDict
from enum import StrEnum
from typing import Any, Final, Literal
from uuid import UUID, uuid4

from core.exceptions import SentryWatchError
from core.scanner import AsyncServiceScanner, aggregate_report
from core.schemas import (
    DomainModel,
    HostScanResult,
    ScanReport,
    ScanRequest,
    utc_now,
)
from pydantic import AwareDatetime, Field

_LOGGER: Final[logging.Logger] = logging.getLogger(__name__)

_QUEUE_MAX_SIZE: Final[int] = 512


class JobStatus(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ScanCapacityError(SentryWatchError):
    """Raised when the server already runs its maximum number of scan jobs."""


class UnknownScanError(LookupError):
    """Raised when referencing a scan id that was never submitted."""


class TelemetryEvent(DomainModel):
    """One fan-out message pushed to every subscribed WebSocket."""

    type: Literal["status", "host_result", "complete", "failed", "cancelled"]
    scan_id: UUID
    timestamp: AwareDatetime = Field(default_factory=utc_now)
    payload: dict[str, Any] = Field(default_factory=dict)


class ScanJob:
    """Mutable server-side state for one submitted scan."""

    __slots__ = (
        "_subscribers",
        "created_at",
        "error",
        "hosts",
        "id",
        "report",
        "request",
        "status",
        "task",
    )

    def __init__(self, request: ScanRequest) -> None:
        self.id: UUID = uuid4()
        self.request: ScanRequest = request
        self.status: JobStatus = JobStatus.PENDING
        self.created_at = utc_now()
        self.report: ScanReport | None = None
        self.error: str | None = None
        self.hosts: list[HostScanResult] = []
        self.task: asyncio.Task[None] | None = None
        self._subscribers: OrderedDict[UUID, asyncio.Queue[TelemetryEvent]] = OrderedDict()

    @property
    def active(self) -> bool:
        return self.status in (JobStatus.PENDING, JobStatus.RUNNING)


class ScanService:
    """Owns all scan jobs for this API process."""

    def __init__(self, max_concurrent_scans: int, history_size: int) -> None:
        self._max_concurrent = max_concurrent_scans
        self._history_size = history_size
        self._jobs: OrderedDict[UUID, ScanJob] = OrderedDict()
        self._lock = asyncio.Lock()

    def get(self, scan_id: UUID) -> ScanJob | None:
        return self._jobs.get(scan_id)

    def list_jobs(self) -> list[ScanJob]:
        return list(reversed(self._jobs.values()))

    async def submit(self, request: ScanRequest) -> ScanJob:
        async with self._lock:
            self._evict_finished_locked()
            active = sum(1 for job in self._jobs.values() if job.active)
            if active >= self._max_concurrent:
                raise ScanCapacityError(
                    f"server busy: {active}/{self._max_concurrent} scans already running"
                )
            job = ScanJob(request)
            self._jobs[job.id] = job
            job.task = asyncio.create_task(self._run(job), name=f"scan-{job.id}")
            return job

    def cancel(self, scan_id: UUID) -> bool:
        job = self._jobs.get(scan_id)
        if job is None or not job.active or job.task is None or job.task.done():
            return False
        job.task.cancel()
        return True

    async def subscribe(self, scan_id: UUID) -> asyncio.Queue[TelemetryEvent]:
        job = self._jobs.get(scan_id)
        if job is None:
            raise UnknownScanError(str(scan_id))
        queue: asyncio.Queue[TelemetryEvent] = asyncio.Queue(maxsize=_QUEUE_MAX_SIZE)
        job._subscribers[uuid4()] = queue
        return queue

    def unsubscribe(self, scan_id: UUID, queue: asyncio.Queue[TelemetryEvent]) -> None:
        job = self._jobs.get(scan_id)
        if job is None:
            return
        for key, candidate in list(job._subscribers.items()):
            if candidate is queue:
                del job._subscribers[key]

    async def shutdown(self) -> None:
        tasks = [job.task for job in self._jobs.values() if job.task and not job.task.done()]
        for task in tasks:
            task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
        _LOGGER.info("scan service shut down; %d jobs discarded", len(tasks))

    def replay(self, job: ScanJob) -> list[TelemetryEvent]:
        events = [
            TelemetryEvent(type="status", scan_id=job.id, payload={"status": job.status.value})
        ]
        for host in job.hosts:
            events.append(
                TelemetryEvent(type="host_result", scan_id=job.id, payload=_host_payload(host))
            )
        if job.status is JobStatus.COMPLETED and job.report is not None:
            events.append(_complete_event(job))
        elif job.status is JobStatus.FAILED:
            events.append(
                TelemetryEvent(type="failed", scan_id=job.id, payload={"error": job.error})
            )
        elif job.status is JobStatus.CANCELLED:
            events.append(TelemetryEvent(type="cancelled", scan_id=job.id, payload={}))
        return events

    async def _run(self, job: ScanJob) -> None:
        job.status = JobStatus.RUNNING
        await self._broadcast(
            job,
            TelemetryEvent(type="status", scan_id=job.id, payload={"status": "running"}),
        )
        started_at = utc_now()
        scanner = AsyncServiceScanner(job.request)
        try:
            async for host in scanner.stream_hosts():
                job.hosts.append(host)
                await self._broadcast(
                    job,
                    TelemetryEvent(type="host_result", scan_id=job.id, payload=_host_payload(host)),
                )
        except asyncio.CancelledError:
            job.status = JobStatus.CANCELLED
            await self._broadcast(job, TelemetryEvent(type="cancelled", scan_id=job.id))
            raise
        except SentryWatchError as exc:
            job.status = JobStatus.FAILED
            job.error = str(exc)
            await self._broadcast(
                job,
                TelemetryEvent(type="failed", scan_id=job.id, payload={"error": str(exc)}),
            )
            return
        completed_at = utc_now()
        job.report = aggregate_report(
            targets=job.request.targets,
            ports_scanned=job.request.ports,
            hosts=tuple(job.hosts),
            started_at=started_at,
            completed_at=completed_at,
        )
        job.status = JobStatus.COMPLETED
        await self._broadcast(job, _complete_event(job))

    async def _broadcast(self, job: ScanJob, event: TelemetryEvent) -> None:
        for queue in list(job._subscribers.values()):
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                _LOGGER.warning("telemetry queue overflow on scan %s; dropping event", job.id)

    def _evict_finished_locked(self) -> None:
        finished = [jid for jid, job in self._jobs.items() if not job.active]
        while len(finished) > self._history_size:
            oldest = finished.pop(0)
            del self._jobs[oldest]


def _host_payload(host: HostScanResult) -> dict[str, Any]:
    return host.model_dump(mode="json")


def _complete_event(job: ScanJob) -> TelemetryEvent:
    report = job.report
    assert report is not None
    summary: dict[str, Any] = {
        "open_port_count": report.open_port_count,
        "hosts_scanned": report.hosts_scanned,
        "hosts_failed": report.hosts_failed,
        "duration_ms": report.duration_ms,
    }
    return TelemetryEvent(type="complete", scan_id=job.id, payload=summary)
