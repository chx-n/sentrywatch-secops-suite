"""Liveness and readiness probes (unauthenticated by design)."""

from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, Response

router = APIRouter(tags=["health"])


@router.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/readyz")
async def readyz(request: Request) -> Response:
    components: dict[str, bool | None] = {"api": True}
    redis_url: str | None = getattr(request.app.state.settings, "redis_url", None)
    if redis_url:
        components["redis"] = await _ping_redis(redis_url)
    ready = all(value is not False for value in components.values())
    return JSONResponse(
        status_code=200 if ready else 503,
        content={
            "status": "ready" if ready else "degraded",
            "components": components,
        },
    )


async def _ping_redis(url: str) -> bool | None:
    try:
        import redis.asyncio as aioredis
    except ImportError:
        return None
    try:
        client = aioredis.from_url(url, socket_connect_timeout=2.0)
    except Exception:
        return False
    try:
        await client.ping()
        return True
    except Exception:
        return False
    finally:
        await client.aclose()
