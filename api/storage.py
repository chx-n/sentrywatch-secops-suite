"""SQLite-backed scan history persistence."""

from __future__ import annotations

import json
import sqlite3
from collections import OrderedDict
from contextlib import closing
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import UUID

from core.schemas import ScanReport, ScanRequest
from api.types import ScanJob, JobStatus


@dataclass(slots=True)
class StoredScan:
    id: UUID
    request: ScanRequest
    report: ScanReport | None
    status: JobStatus
    created_at: str
    completed_at: str | None


class ScanStorage:
    """Abstract storage interface for scan jobs."""

    async def init(self) -> None:
        pass

    async def save(self, job: ScanJob) -> None:
        raise NotImplementedError

    async def get(self, scan_id: UUID) -> ScanJob | None:
        raise NotImplementedError

    async def list_jobs(self) -> list[ScanJob]:
        raise NotImplementedError

    async def delete_old(self, keep: int) -> None:
        raise NotImplementedError

    async def close(self) -> None:
        pass


class InMemoryScanStorage(ScanStorage):
    """In-memory storage (default for development)."""

    def __init__(self):
        self._jobs: OrderedDict[UUID, ScanJob] = OrderedDict()

    async def save(self, job: ScanJob) -> None:
        self._jobs[job.id] = job

    async def get(self, scan_id: UUID) -> ScanJob | None:
        return self._jobs.get(scan_id)

    async def list_jobs(self) -> list[ScanJob]:
        return list(reversed(self._jobs.values()))

    async def delete_old(self, keep: int) -> None:
        finished = [jid for jid, job in self._jobs.items() if not job.active]
        while len(finished) > keep:
            oldest = finished.pop(0)
            del self._jobs[oldest]


class SQLiteScanStorage(ScanStorage):
    """SQLite-backed persistent storage."""

    def __init__(self, db_path: str):
        self._db_path = db_path
        self._conn: sqlite3.Connection | None = None

    async def init(self) -> None:
        Path(self._db_path).parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(self._db_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        with closing(self._conn.cursor()) as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS scans (
                    id TEXT PRIMARY KEY,
                    request TEXT NOT NULL,
                    report TEXT,
                    status TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    completed_at TEXT
                )
            """)
            cur.execute("CREATE INDEX IF NOT EXISTS idx_scans_created_at ON scans(created_at)")
            self._conn.commit()

    def _job_from_row(self, row: sqlite3.Row) -> ScanJob:
        request = ScanRequest.model_validate_json(row["request"])
        job = ScanJob(request)
        job.id = UUID(row["id"])
        job.status = JobStatus(row["status"])
        try:
            job.created_at = datetime.fromisoformat(row["created_at"])
        except (ValueError, TypeError):
            job.created_at = row["created_at"]
        if row["report"]:
            job.report = ScanReport.model_validate_json(row["report"])
        if row["completed_at"]:
            try:
                job.completed_at = datetime.fromisoformat(row["completed_at"])
            except (ValueError, TypeError):
                job.completed_at = row["completed_at"]
        else:
            job.completed_at = None
        return job

    async def save(self, job: ScanJob) -> None:
        if self._conn is None:
            await self.init()
        assert self._conn is not None
        request_json = job.request.model_dump_json()
        report_json = job.report.model_dump_json() if job.report else None
        with closing(self._conn.cursor()) as cur:
            cur.execute(
                """
                INSERT OR REPLACE INTO scans (id, request, report, status, created_at, completed_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    str(job.id),
                    request_json,
                    report_json,
                    job.status.value,
                    job.created_at.isoformat() if hasattr(job.created_at, 'isoformat') else str(job.created_at),
                    job.completed_at.isoformat() if job.completed_at and hasattr(job.completed_at, 'isoformat') else (str(job.completed_at) if job.completed_at else None),
                ),
            )
            self._conn.commit()

    async def get(self, scan_id: UUID) -> ScanJob | None:
        if self._conn is None:
            await self.init()
        assert self._conn is not None
        with closing(self._conn.cursor()) as cur:
            cur.execute("SELECT * FROM scans WHERE id = ?", (str(scan_id),))
            row = cur.fetchone()
            if row:
                return self._job_from_row(row)
        return None

    async def list_jobs(self) -> list[ScanJob]:
        if self._conn is None:
            await self.init()
        assert self._conn is not None
        jobs: list[ScanJob] = []
        with closing(self._conn.cursor()) as cur:
            cur.execute("SELECT * FROM scans ORDER BY created_at DESC")
            for row in cur.fetchall():
                jobs.append(self._job_from_row(row))
        return jobs

    async def delete_old(self, keep: int) -> None:
        if self._conn is None:
            await self.init()
        assert self._conn is not None
        with closing(self._conn.cursor()) as cur:
            cur.execute(
                "DELETE FROM scans WHERE id IN (SELECT id FROM scans WHERE status NOT IN ('pending', 'running') ORDER BY created_at ASC LIMIT -1 OFFSET ?)",
                (keep,),
            )
            self._conn.commit()

    async def close(self) -> None:
        if self._conn:
            self._conn.close()
            self._conn = None


def create_storage(db_url: str | None) -> ScanStorage:
    """Factory to create storage backend from URL."""
    if not db_url or db_url.startswith("redis://"):
        return InMemoryScanStorage()
    if db_url.startswith("sqlite://"):
        path = db_url[len("sqlite://"):]
        return SQLiteScanStorage(path)
    return InMemoryScanStorage()