"""FastAPI application factory for the SentryWatch SecOps API."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from core.exceptions import DisallowedTargetError, SentryWatchError, TargetValidationError
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from api import __version__
from api.config import Settings, get_settings
from api.middleware import install_middleware
from api.ratelimit import limiter, register_ratelimit
from api.routes.health import router as health_router
from api.routes.scans import router as scans_router
from api.routes.telemetry import router as telemetry_router
from api.services import ScanService

_LOGGER = logging.getLogger(__name__)


@asynccontextmanager
async def _lifespan(app: FastAPI) -> AsyncIterator[None]:
    _LOGGER.info("SentryWatch API starting")
    yield
    service: ScanService | None = getattr(app.state, "scan_service", None)
    if service is not None:
        await service.shutdown()
    _LOGGER.info("SentryWatch API stopped")


def create_app(settings: Settings | None = None) -> FastAPI:
    resolved = settings or get_settings()
    app = FastAPI(
        title=resolved.app_name,
        version=__version__,
        lifespan=_lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )
    app.state.settings = resolved
    app.state.scan_service = ScanService(
        max_concurrent_scans=resolved.max_concurrent_scans,
        history_size=resolved.scan_history_size,
    )

    register_ratelimit(app, limiter)
    install_middleware(app, resolved)

    app.include_router(scans_router)
    app.include_router(telemetry_router)
    app.include_router(health_router)

    @app.get("/", include_in_schema=False)
    async def root() -> dict[str, Any]:
        return {
            "name": resolved.app_name,
            "version": __version__,
            "docs": "/docs",
            "health": "/healthz",
        }

    @app.exception_handler(TargetValidationError)
    async def _target_error(_request: Request, exc: TargetValidationError) -> JSONResponse:
        code = 403 if isinstance(exc, DisallowedTargetError) else 422
        return JSONResponse(status_code=code, content={"detail": str(exc)})

    @app.exception_handler(SentryWatchError)
    async def _domain_error(_request: Request, exc: SentryWatchError) -> JSONResponse:
        return JSONResponse(status_code=400, content={"detail": str(exc)})

    @app.middleware("http")
    async def _log_exceptions(request: Request, call_next: Any) -> Any:
        try:
            return await call_next(request)
        except Exception:
            _LOGGER.exception("unhandled error on %s %s", request.method, request.url.path)
            raise

    return app


app = create_app()
