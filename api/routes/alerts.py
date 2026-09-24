"""REST endpoints for security alerts, incidents, and threat response actions."""

from __future__ import annotations

from datetime import datetime, timezone
import logging
from typing import Any
from uuid import uuid4

from fastapi import APIRouter
from pydantic import BaseModel, Field

from api.routes.system import get_network_apps

router = APIRouter(prefix="/api/v1/alerts", tags=["alerts"])
_LOGGER = logging.getLogger(__name__)

# State stores
_ACKNOWLEDGED_IDS: set[str] = set()
_BLOCKED_IPS: set[str] = {"198.51.100.42"}
_CUSTOM_ALERTS: list[dict[str, Any]] = []

HIGH_RISK_PORTS: dict[int, tuple[str, str, str]] = {
    21: ("Insecure FTP Port Exposed", "FTP transmits credentials and data in plaintext.", "critical"),
    23: ("Telnet Daemon Detected", "Telnet provides unencrypted remote access vulnerable to sniffing.", "critical"),
    80: ("Plaintext HTTP Web Server", "Web server listening on unencrypted port 80 without TLS.", "warning"),
    445: ("SMB File Sharing Port Exposed", "SMB (port 445) exposed; frequent target for ransomware and lateral movement.", "critical"),
    3306: ("MySQL Database Exposed", "Database port 3306 exposed on host network.", "warning"),
    5432: ("PostgreSQL Database Exposed", "PostgreSQL port 5432 accessible on network interface.", "warning"),
    6379: ("Redis Server Exposed", "Redis instance exposed without encryption; risk of unauthenticated RCE.", "critical"),
}


class AcknowledgePayload(BaseModel):
    alert_id: str | None = None
    all: bool = False


class BlockIpPayload(BaseModel):
    ip: str


@router.get("")
async def get_alerts() -> list[dict[str, Any]]:
    """Generate dynamic security alerts from live host socket inspection and threats."""
    alerts: list[dict[str, Any]] = []

    # 1. Inspect live system applications for open high-risk ports
    try:
        apps = await get_network_apps()
        for app in apps:
            for port in app.get("ports", []):
                if port in HIGH_RISK_PORTS and app.get("listening", False):
                    title, desc, severity = HIGH_RISK_PORTS[port]
                    alert_id = f"risk-port-{port}-{app['id']}"
                    alerts.append({
                        "id": alert_id,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "timeAgo": "Active Now",
                        "severity": severity,
                        "title": f"{title} ({app['name']})",
                        "description": f"{desc} Process '{app['name']}' (PID {app['pid']}) is listening on port {port}.",
                        "sourceApp": app["name"],
                        "sourceIp": "127.0.0.1",
                        "targetPort": port,
                        "country": "LOCAL",
                        "countryCode": "🛡️",
                        "status": "acknowledged" if alert_id in _ACKNOWLEDGED_IDS else "active",
                        "ruleMatched": f"PORT_EXPOSURE_RULE_{port}",
                    })
    except Exception as exc:
        _LOGGER.warning("Failed inspecting apps for alerts: %s", exc)

    # 2. Add recorded blocked IP alerts
    for ip in sorted(_BLOCKED_IPS):
        alert_id = f"blocked-ip-{ip.replace('.', '_')}"
        alerts.append({
            "id": alert_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "timeAgo": "Recently",
            "severity": "critical" if ip.startswith("198.51") else "warning",
            "title": f"Threat Actor IP {ip} Blocked",
            "description": f"Host connection attempts from {ip} dropped by SecOps defense rule.",
            "sourceApp": "SentryWatch Firewall",
            "sourceIp": ip,
            "targetPort": 443,
            "country": "WAN",
            "countryCode": "🚫",
            "status": "blocked",
            "ruleMatched": "IP_REPUTATION_BLOCK",
        })

    # 3. Add any custom logged incidents
    for ca in _CUSTOM_ALERTS:
        alerts.append(ca)

    return alerts


@router.post("/acknowledge")
async def acknowledge_alert(payload: AcknowledgePayload) -> dict[str, Any]:
    """Acknowledge an alert or all alerts."""
    if payload.all:
        # Mark all known
        current = await get_alerts()
        for a in current:
            _ACKNOWLEDGED_IDS.add(a["id"])
    elif payload.alert_id:
        _ACKNOWLEDGED_IDS.add(payload.alert_id)
    return {"status": "ok", "acknowledged_count": len(_ACKNOWLEDGED_IDS)}


@router.post("/block-ip")
async def block_ip(payload: BlockIpPayload) -> dict[str, Any]:
    """Add IP to active blocked list."""
    _BLOCKED_IPS.add(payload.ip)
    return {"status": "blocked", "ip": payload.ip, "total_blocked": len(_BLOCKED_IPS)}


@router.get("/blocked-ips")
async def get_blocked_ips() -> list[str]:
    """Return all currently blocked IP addresses."""
    return sorted(list(_BLOCKED_IPS))
