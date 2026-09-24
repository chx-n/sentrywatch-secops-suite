"""Shared types for scan service."""

from __future__ import annotations

import asyncio
from collections import OrderedDict
from enum import StrEnum
from typing import Any
from uuid import UUID, uuid4

from core.schemas import (
    HostScanResult,
    ScanReport,
    ScanRequest,
    utc_now,
)


class JobStatus(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ScanJob:
    """Mutable server-side state for one submitted scan."""

    __slots__ = (
        "_subscribers",
        "completed_at",
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
        self.completed_at: Any = None
        self.report: ScanReport | None = None
        self.error: str | None = None
        self.hosts: list[HostScanResult] = []
        self.task: asyncio.Task[None] | None = None
        self._subscribers: OrderedDict[UUID, asyncio.Queue[Any]] = OrderedDict()

    @property
    def active(self) -> bool:
        return self.status in (JobStatus.PENDING, JobStatus.RUNNING)