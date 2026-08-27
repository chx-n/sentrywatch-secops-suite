"""WebSocket endpoint streaming live scan telemetry with heartbeats."""

from __future__ import annotations

import asyncio
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from api.config import get_settings
from api.middleware import is_authorized
from api.services import ScanService, TelemetryEvent, UnknownScanError

router = APIRouter(tags=["telemetry"])

_CLOSE_UNAUTHORIZED = 4401
_CLOSE_NOT_FOUND = 4404


async def _recv_loop(socket: WebSocket) -> str | None:
    return await socket.receive_text()


@router.websocket("/api/v1/ws/telemetry/{scan_id}")
async def telemetry_socket(
    websocket: WebSocket,
    scan_id: UUID,
    token: str = "",
) -> None:
    settings = get_settings()
    if not is_authorized(token or websocket.query_params.get("token"), settings.api_keys):
        await websocket.close(code=_CLOSE_UNAUTHORIZED)
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
