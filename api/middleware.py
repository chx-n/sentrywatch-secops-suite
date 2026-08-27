"""CORS restriction and constant-time API-key authentication middleware."""

from __future__ import annotations

import hmac
from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from api.config import Settings

API_KEY_HEADER: str = "X-API-Key"
EXEMPT_PATHS: frozenset[str] = frozenset(
    {"/", "/healthz", "/readyz", "/docs", "/redoc", "/openapi.json"}
)


def is_authorized(provided: str | None, keys: frozenset[str]) -> bool:
    """Constant-time comparison of *provided* against every configured key."""
    if not keys or not provided:
        return False
    return any(hmac.compare_digest(provided.encode(), key.encode()) for key in keys)


class APIKeyMiddleware(BaseHTTPMiddleware):
    """Reject requests missing a valid ``X-API-Key`` header.

    WebSockets bypass HTTP middleware in Starlette; telemetry sockets are
    authenticated separately via a ``token`` query parameter.
    """

    def __init__(self, app: ASGIApp, keys: frozenset[str]) -> None:
        super().__init__(app)
        self._keys = keys

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        if request.url.path in EXEMPT_PATHS or is_authorized(
            request.headers.get(API_KEY_HEADER), self._keys
        ):
            return await call_next(request)
        return JSONResponse(status_code=401, content={"detail": "missing or invalid API key"})


def install_middleware(app: FastAPI, settings: Settings) -> None:
    """Register CORS (outermost) and API-key auth on *app*."""
    from fastapi.middleware.cors import CORSMiddleware

    app.add_middleware(APIKeyMiddleware, keys=settings.api_keys)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.allowed_origins),
        allow_credentials=False,
        allow_methods=["GET", "POST", "DELETE"],
        allow_headers=[API_KEY_HEADER, "Content-Type"],
        expose_headers=[
            "Retry-After",
            "X-RateLimit-Limit",
            "X-RateLimit-Remaining",
            "X-RateLimit-Reset",
        ],
        max_age=600,
    )
