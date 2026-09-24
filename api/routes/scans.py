"""REST endpoints for submitting and inspecting scans."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from core.exceptions import DisallowedTargetError, TargetValidationError
from core.schemas import ScanRequest
from core.security import prepare_targets
from fastapi import APIRouter, HTTPException, Request, Response, status

from api.config import get_settings
from api.dependencies import ScanServiceDep, SettingsDep
from api.ratelimit import limiter
from api.services import ScanCapacityError, ScanJob

router = APIRouter(prefix="/api/v1/scans", tags=["scans"])


def _job_snapshot(job: ScanJob, *, include_report: bool = True) -> dict[str, Any]:
    snapshot: dict[str, Any] = {
        "scan_id": str(job.id),
        "status": job.status.value,
        "created_at": job.created_at.isoformat(),
        "targets": list(job.request.targets),
        "ports_scanned": len(job.request.ports),
        "hosts_reported": len(job.hosts),
        "error": job.error,
    }
    if include_report and job.report is not None:
        snapshot["report"] = job.report.model_dump(mode="json")
    return snapshot


@router.post("", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit(get_settings().rate_limit)
async def submit_scan(
    request: Request,
    response: Response,
    payload: ScanRequest,
    service: ScanServiceDep,
    settings: SettingsDep,
) -> dict[str, Any]:
    """Accept a scan request; runs asynchronously, results pollable/streamable."""
    effective = payload.model_copy(
        update={
            "allow_private_networks": payload.allow_private_networks
            and settings.allow_private_networks
        }
    )
    try:
        prepare_targets(effective.targets, allow_private_networks=effective.allow_private_networks)
    except DisallowedTargetError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except TargetValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    try:
        job = await service.submit(effective)
    except ScanCapacityError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
            headers={"Retry-After": "30"},
        ) from exc
    return {
        "scan_id": str(job.id),
        "status": job.status.value,
        "poll": f"/api/v1/scans/{job.id}",
        "telemetry_ws": f"/api/v1/ws/telemetry/{job.id}",
    }


@router.get("")
async def list_scans(service: ScanServiceDep) -> list[dict[str, Any]]:
    jobs = await service.list_jobs()
    return [_job_snapshot(job, include_report=False) for job in jobs]


@router.get("/{scan_id}")
async def get_scan(scan_id: UUID, service: ScanServiceDep) -> dict[str, Any]:
    job = service.get(scan_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="unknown scan id")
    return _job_snapshot(job)


@router.delete("/{scan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_scan(scan_id: UUID, service: ScanServiceDep) -> Response:
    cancelled = service.cancel(scan_id)
    if not cancelled:
        job = service.get(scan_id)
        if job is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="unknown scan id")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"scan is {job.status.value}; cannot cancel",
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
