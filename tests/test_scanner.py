"""Unit and integration tests for the asynchronous TCP port scanner."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import pytest

from core.schemas import HostScanResult, PortProbe, PortState, ScanRequest
from core.scanner import (
    AsyncServiceScanner,
    ProbeOutcome,
    _sanitize_banner,
    aggregate_report,
    run_scan,
)


class TestScannerLogic:
    """Tests for scanner helper functions and aggregation."""

    def test_sanitize_banner_strips_unprintable(self) -> None:
        raw_banner = b"SSH-2.0-OpenSSH_8.9p1\x00\x01\r\n\xff"
        sanitized = _sanitize_banner(raw_banner)
        assert "SSH-2.0-OpenSSH_8.9p1" in sanitized
        assert "\x00" not in sanitized

    def test_sanitize_banner_empty(self) -> None:
        assert _sanitize_banner(b"") == ""

    def test_aggregate_report_calculation(self) -> None:
        now = datetime.now(timezone.utc)
        probe1 = PortProbe(
            port=80,
            state=PortState.OPEN,
            latency_ms=12.5,
            banner="Apache/2.4.52",
        )
        probe2 = PortProbe(
            port=443,
            state=PortState.CLOSED,
            latency_ms=5.0,
        )
        host = HostScanResult(
            target="93.184.216.34",
            address="93.184.216.34",
            probes=[probe1, probe2],
        )

        report = aggregate_report(
            targets=["93.184.216.34"],
            ports_scanned=[80, 443],
            hosts=[host],
            started_at=now,
            completed_at=now,
        )

        assert len(report.hosts) == 1
        assert report.open_port_count == 1
        assert report.hosts_scanned == 1


@pytest.mark.asyncio
class TestAsyncServiceScanner:
    """Async tests against local mock TCP servers."""

    async def test_scanner_detects_open_port_and_banner(self) -> None:
        # Start a local TCP echo/banner server
        server_banner = b"SSH-2.0-TestServer_1.0\r\n"

        async def handle_client(
            reader: asyncio.StreamReader, writer: asyncio.StreamWriter
        ) -> None:
            writer.write(server_banner)
            await writer.drain()
            writer.close()
            await writer.wait_closed()

        server = await asyncio.start_server(handle_client, "127.0.0.1", 0)
        port = server.sockets[0].getsockname()[1]

        async with server:
            report = await run_scan(
                ["127.0.0.1"],
                ports=str(port),
                allow_private_networks=True,
                connect_timeout_s=2.0,
            )

            assert report.hosts_scanned == 1
            assert len(report.hosts) == 1
            host_res = report.hosts[0]
            assert len(host_res.probes) == 1
            probe = host_res.probes[0]
            assert probe.port == port
            assert probe.state == PortState.OPEN
            assert "SSH-2.0-TestServer_1.0" in (probe.banner or "")

    async def test_scanner_handles_closed_port(self) -> None:
        report = await run_scan(
            ["127.0.0.1"],
            ports="59999",
            allow_private_networks=True,
            connect_timeout_s=0.5,
        )
        assert len(report.hosts) == 1
        assert report.hosts[0].probes[0].state in (PortState.CLOSED, PortState.FILTERED)
