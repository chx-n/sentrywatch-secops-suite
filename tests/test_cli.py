"""Unit tests for the Typer + Rich command-line interface."""

from __future__ import annotations

import pytest
from typer.testing import CliRunner

from cli.cli import app

runner = CliRunner()


class TestCliCommands:
    """Test suite for CLI commands and argument validation."""

    def test_version_flag(self) -> None:
        result = runner.invoke(app, ["--version"])
        assert result.exit_code == 0
        assert "sentrywatch" in result.stdout

    def test_help_flag(self) -> None:
        result = runner.invoke(app, ["--help"])
        assert result.exit_code == 0
        assert "SentryWatch SecOps Suite" in result.stdout
        assert "scan" in result.stdout

    def test_scan_invalid_port_spec(self) -> None:
        result = runner.invoke(app, ["scan", "93.184.216.34", "--ports", "invalid-port"])
        assert result.exit_code == 2

    def test_scan_ssrf_target_rejected(self) -> None:
        result = runner.invoke(app, ["scan", "127.0.0.1"])
        assert result.exit_code == 2

    def test_scan_invalid_hostname_syntax(self) -> None:
        result = runner.invoke(app, ["scan", "http://example.com"])
        assert result.exit_code == 2
