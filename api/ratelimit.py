"""slowapi rate limiting wired to Redis when available, in-memory otherwise."""

from __future__ import annotations

from fastapi import FastAPI, Request
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from api.config import Settings, get_settings

__all__ = ["build_limiter", "limiter", "register_ratelimit"]


def _client_key(request: Request) -> str:
    api_key = request.headers.get("X-API-Key")
    if api_key:
        return f"key:{api_key[:16]}"
    client = request.client
    return f"ip:{client.host if client else 'unknown'}"


def build_limiter(settings: Settings) -> Limiter:
    """Construct a Limiter bound to the configured storage backend."""
    return Limiter(
        key_func=_client_key,
        storage_uri=settings.redis_url or "memory://",
        default_limits=[],
        headers_enabled=True,
    )


def register_ratelimit(app: FastAPI, application_limiter: Limiter) -> None:
    """Attach limiter state, middleware, and JSON 429 handling to *app*."""
    from fastapi.responses import JSONResponse

    app.state.limiter = application_limiter

    @app.exception_handler(RateLimitExceeded)
    async def _rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
        return JSONResponse(
            status_code=429,
            content={"detail": f"rate limit exceeded ({exc.detail})"},
            headers={"Retry-After": "60"},
        )

    app.add_middleware(SlowAPIMiddleware)


limiter: Limiter = build_limiter(get_settings())
