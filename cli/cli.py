"""SentryWatch command-line interface built on typer + rich."""

from __future__ import annotations

import asyncio
import csv
import io
from enum import StrEnum
from pathlib import Path
from typing import Annotated, Final

import typer
from pydantic import ValidationError
from core import __version__
from core.exceptions import SentryWatchError, TargetValidationError
from core.scanner import run_scan
from core.schemas import DEFAULT_SCAN_PORTS, ScanReport, parse_port_spec
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

app = typer.Typer(
    name="sentrywatch",
    help="SentryWatch SecOps Suite - async network scanning toolkit.",
    no_args_is_help=True,
    add_completion=False,
)

console: Final[Console] = Console()
err_console: Final[Console] = Console(stderr=True)


class OutputFormat(StrEnum):
    TABLE = "table"
    JSON = "json"
    CSV = "csv"


def _version_callback(value: bool) -> None:
    if value:
        console.print(f"sentrywatch {__version__}")
        raise typer.Exit


@app.callback()
def main(
    version: Annotated[
        bool,
        typer.Option(
            "--version",
            "-V",
            callback=_version_callback,
            is_eager=True,
            help="Show version and exit.",
        ),
    ] = False,
) -> None:
    """SentryWatch SecOps Suite."""


_STATE_STYLES: Final[dict[str, str]] = {
    "open": "bold green",
    "closed": "dim red",
    "filtered": "yellow",
    "error": "bold red",
}


def _render_table(report: ScanReport) -> None:
    table = Table(title=f"Scan {report.id}", header_style="bold cyan")
    table.add_column("Target", style="bold")
    table.add_column("Address", style="dim")
    table.add_column("Port", justify="right")
    table.add_column("State")
    table.add_column("Latency (ms)", justify="right")
    table.add_column("Banner / Detail", max_width=48, overflow="ellipsis")
    for host in report.hosts:
        if host.error is not None:
            table.add_row(host.target, "-", "-", "[red]error[/]", "-", host.error)
            continue
        address = str(host.address) if host.address else "-"
        for probe in host.probes:
            style = _STATE_STYLES.get(probe.state.value, "white")
            latency = f"{probe.latency_ms:.2f}" if probe.latency_ms is not None else "-"
            table.add_row(
                host.target,
                address,
                str(probe.port),
                f"[{style}]{probe.state.value}[/]",
                latency,
                probe.banner or probe.detail or "",
            )
    console.print(table)
    summary = (
        f"[green]{report.open_port_count} open[/] | "
        f"{report.hosts_scanned} hosts scanned, {report.hosts_failed} failed | "
        f"{report.duration_ms:.1f} ms total"
    )
    console.print(Panel(summary, title="Summary", expand=False))


def _report_to_csv(report: ScanReport) -> str:
    buffer = io.StringIO(newline="")
    writer = csv.writer(buffer, quoting=csv.QUOTE_MINIMAL)
    writer.writerow(["target", "address", "port", "state", "latency_ms", "banner", "detail"])
    for host in report.hosts:
        address = str(host.address) if host.address else ""
        if host.error is not None:
            writer.writerow([host.target, address, "", "error", "", "", host.error])
            continue
        for probe in host.probes:
            writer.writerow(
                [
                    host.target,
                    address,
                    probe.port,
                    probe.state.value,
                    "" if probe.latency_ms is None else f"{probe.latency_ms:.3f}",
                    probe.banner or "",
                    probe.detail or "",
                ]
            )
    return buffer.getvalue()


def _emit(report: ScanReport, fmt: OutputFormat, output: Path | None) -> None:
    match fmt:
        case OutputFormat.TABLE:
            _render_table(report)
            return
        case OutputFormat.JSON:
            payload = report.model_dump_json(indent=2)
        case OutputFormat.CSV:
            payload = _report_to_csv(report)
    if output is not None:
        output.parent.mkdir(parents=True, exist_ok=True)
        with output.open("w", encoding="utf-8", newline="") as handle:
            handle.write(payload + "\n")
        err_console.print(f"[green]Wrote {fmt.value} output to {output}[/]")
    else:
        console.print(payload)


@app.command()
def scan(
    targets: Annotated[list[str], typer.Argument(help="IPs, CIDRs, or hostnames to scan.")],
    ports: Annotated[
        str,
        typer.Option("--ports", "-p", help="Ports/ranges, e.g. 22,80,443,8000-8100."),
    ] = DEFAULT_SCAN_PORTS,
    concurrency: Annotated[int, typer.Option("--concurrency", "-c", min=1, max=4096)] = 256,
    timeout: Annotated[
        float,
        typer.Option("--timeout", "-t", min=0.1, max=30.0, help="TCP connect timeout (seconds)."),
    ] = 3.0,
    retries: Annotated[int, typer.Option("--retries", "-r", min=0, max=3)] = 1,
    no_banners: Annotated[
        bool, typer.Option("--no-banners", help="Disable banner grabbing.")
    ] = False,
    allow_private: Annotated[
        bool,
        typer.Option("--allow-private", help="DANGEROUS: permit RFC1918/loopback targets."),
    ] = False,
    fmt: Annotated[
        OutputFormat,
        typer.Option("--format", "-f", case_sensitive=False, help="Output format."),
    ] = OutputFormat.TABLE,
    output: Annotated[
        Path | None,
        typer.Option("--output", "-o", help="Write export to this file instead of stdout."),
    ] = None,
) -> None:
    """Scan one or more targets and print or export the results."""
    try:
        parse_port_spec(ports)
    except ValueError as exc:
        err_console.print(f"[red]Invalid --ports:[/] {exc}")
        raise typer.Exit(code=2) from exc
    if allow_private:
        err_console.print("[yellow]WARNING:[/] private-network guard disabled (--allow-private)")
    try:
        report = asyncio.run(
            run_scan(
                targets,
                ports=ports,
                max_concurrency=concurrency,
                connect_timeout_s=timeout,
                grab_banners=not no_banners,
                allow_private_networks=allow_private,
                max_retries=retries,
            )
        )
    except (TargetValidationError, ValidationError) as exc:
        err_console.print(f"[red]Target rejected by SSRF guard:[/] {exc}")
        raise typer.Exit(code=2) from exc
    except SentryWatchError as exc:
        err_console.print(f"[red]Scan failed:[/] {exc}")
        raise typer.Exit(code=1) from exc
    except OSError as exc:
        err_console.print(f"[red]Network error:[/] {exc}")
        raise typer.Exit(code=1) from exc
    _emit(report, fmt, output)


def run() -> None:
    """Console-script entry point."""
    app()


if __name__ == "__main__":
    run()
