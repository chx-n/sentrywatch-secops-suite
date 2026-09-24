"""REST endpoints for parsing security log streams and reading host security logs."""

from __future__ import annotations

import logging
import os
import subprocess
from typing import Any

from core.parser import StreamingParser, UnmatchedPolicy
from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/v1/logs", tags=["logs"])
_LOGGER = logging.getLogger(__name__)


class ParseLogsPayload(BaseModel):
    lines: list[str] = Field(default_factory=list)
    text: str | None = None
    unmatched_policy: UnmatchedPolicy = "event"


@router.post("/parse")
async def parse_logs(payload: ParseLogsPayload) -> dict[str, Any]:
    """Parse security log lines with signature matching."""
    parser = StreamingParser(on_unmatched=payload.unmatched_policy)

    raw_lines: list[str] = []
    if payload.text:
        raw_lines.extend(payload.text.splitlines())
    if payload.lines:
        raw_lines.extend(payload.lines)

    events = list(parser.parse_lines(raw_lines))

    matched_count = sum(1 for e in events if e.matched)

    return {
        "events": [e.model_dump(mode="json") for e in events],
        "stats": {
            "lines_in": len(raw_lines),
            "events_out": len(events),
            "matched_threats": matched_count,
            "recognition_rate": round(matched_count / max(len(events), 1) * 100, 1),
        },
    }


@router.get("/system")
async def get_system_logs(limit: int = 50) -> dict[str, Any]:
    """Fetch and parse live host system security logs."""
    raw_lines: list[str] = []

    # Try journalctl first
    try:
        proc = subprocess.run(
            ["journalctl", "-n", str(min(limit, 100)), "--no-pager", "-o", "short-iso"],
            capture_output=True,
            text=True,
            timeout=3,
        )
        if proc.returncode == 0 and proc.stdout.strip():
            raw_lines = proc.stdout.strip().splitlines()
    except Exception:
        pass

    # Fallback to standard log files
    if not raw_lines:
        for candidate in ["/var/log/auth.log", "/var/log/secure", "/var/log/syslog", "/var/log/messages"]:
            if os.path.exists(candidate) and os.access(candidate, os.R_OK):
                try:
                    with open(candidate, "r", encoding="utf-8", errors="ignore") as f:
                        raw_lines = [line.strip() for line in f.readlines()[-limit:]]
                    if raw_lines:
                        break
                except OSError:
                    continue

    parser = StreamingParser(on_unmatched="event")
    valid_events = list(parser.parse_lines(raw_lines))
    matched_count = sum(1 for e in valid_events if e.matched)

    return {
        "raw_count": len(raw_lines),
        "events": [e.model_dump(mode="json") for e in valid_events],
        "stats": {
            "lines_in": len(raw_lines),
            "events_out": len(valid_events),
            "matched_threats": matched_count,
            "recognition_rate": round(matched_count / max(len(valid_events), 1) * 100, 1),
        },
    }
