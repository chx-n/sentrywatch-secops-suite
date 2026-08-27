"""Shared FastAPI dependency callables."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Request

from api.config import Settings, get_settings
from api.services import ScanService

SettingsDep = Annotated[Settings, Depends(get_settings)]


def get_scan_service(request: Request) -> ScanService:
    service: ScanService | None = getattr(request.app.state, "scan_service", None)
    if service is None:
        raise RuntimeError("scan service not initialised; app factory misconfigured")
    return service


ScanServiceDep = Annotated[ScanService, Depends(get_scan_service)]
