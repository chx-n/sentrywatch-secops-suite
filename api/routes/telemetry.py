"""WebSocket endpoint streaming live scan telemetry with heartbeats."""

from __future__ import annotations

import asyncio
import time
from collections import defaultdict
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
from slowapi import Limiter
from slowapi.util import get_remote_address

from api.config import get_settings
from api.middleware import is_authorized
from api.services import ScanService, TelemetryEvent, UnknownScanError

router = APIRouter(tags=["telemetry"])

_CLOSE_UNAUTHORIZED = 4401
_CLOSE_NOT_FOUND = 4404
_CLOSE_RATE_LIMITED = 4429

_WS_RATE_LIMITER: dict[str, list[float]] = defaultdict(list)
_WS_RATE_LIMIT_WINDOW = 60.0  # 1 minute
_WS_RATE_LIMIT_MAX = 30  # 30 connections per minute per IP


def _check_ws_rate_limit(websocket: WebSocket) -> bool:
    client = websocket.client
    if not client:
        return True
    key = f"ws:ip:{client.host}"
    now = time.time()
    _WS_RATE_LIMITER[key] = [t for t in _WS_RATE_LIMITER[key] if now - t < _WS_RATE_LIMIT_WINDOW]
    if len(_WS_RATE_LIMITER[key]) >= _WS_RATE_LIMIT_MAX:
        return False
    _WS_RATE_LIMITER[key].append(now)
    return True


async def _recv_loop(socket: WebSocket) -> str | None:
    return await socket.receive_text()


def _extract_bearer_token(websocket: WebSocket) -> str | None:
    auth = websocket.headers.get("Authorization") or websocket.headers.get("authorization")
    if auth and auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return None


@router.websocket("/api/v1/ws/telemetry/{scan_id}")
async def telemetry_socket(
    websocket: WebSocket,
    scan_id: UUID,
) -> None:
    settings = get_settings()
    
    if not _check_ws_rate_limit(websocket):
        await websocket.close(code=_CLOSE_RATE_LIMITED, reason="WebSocket rate limit exceeded")
        return
    
    token = _extract_bearer_token(websocket) or websocket.query_params.get("token")
    if not token:
        await websocket.close(code=_CLOSE_UNAUTHORIZED, reason="Missing API key in Authorization header or ?token= query parameter")
        return
    
    if not is_authorized(token, settings):
        await websocket.close(code=_CLOSE_UNAUTHORIZED, reason="Invalid API key")
        return

    service: ScanService | None = getattr(websocket.app.state, "scan_service", None)
    if service is None:
        await websocket.close(code=_CLOSE_NOT_FOUND)
        return
    job = service.get(scan_id)
    if job is None:
        await websocket.close(code=_CLOSE_NOT_FOUND)
        return

    try:
        queue = await service.subscribe(scan_id)
    except UnknownScanError:
        await websocket.close(code=_CLOSE_NOT_FOUND)
        return

    await websocket.accept()
    for event in service.replay(job):
        await websocket.send_text(event.model_dump_json())
    if not job.active:
        service.unsubscribe(scan_id, queue)
        await websocket.close()
        return

    recv_task: asyncio.Task[str | None] = asyncio.create_task(_recv_loop(websocket))
    getter_task: asyncio.Task[TelemetryEvent] | None = None
    try:
        while True:
            if getter_task is None:
                getter_task = asyncio.create_task(queue.get())
            done, _pending = await asyncio.wait(
                {getter_task, recv_task},
                timeout=settings.ws_heartbeat_s,
                return_when=asyncio.FIRST_COMPLETED,
            )
            if recv_task in done:
                break
            if getter_task in done:
                event = getter_task.result()
                getter_task = None
                await websocket.send_text(event.model_dump_json())
                if event.type in ("complete", "failed", "cancelled"):
                    break
            else:
                await websocket.send_text('{"type":"heartbeat"}')
    except WebSocketDisconnect:
        pass
    finally:
        if getter_task is not None and not getter_task.done():
            getter_task.cancel()
        recv_task.cancel()
        await asyncio.gather(recv_task, return_exceptions=True)
        service.unsubscribe(scan_id, queue)
