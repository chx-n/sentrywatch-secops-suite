"""REST endpoints for inspecting host network sockets, active processes, and interfaces."""

from __future__ import annotations

import glob
import logging
import os
import socket
import struct
from typing import Any

from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/system", tags=["system"])
_LOGGER = logging.getLogger(__name__)


def _hex_to_ipv4(hex_str: str) -> str:
    try:
        ip_int = int(hex_str, 16)
        return socket.inet_ntoa(struct.pack("<I", ip_int))
    except Exception:
        return hex_str


def _hex_to_ipv6(hex_str: str) -> str:
    try:
        words = [int(hex_str[i : i + 8], 16) for i in range(0, 32, 8)]
        packed = struct.pack("<IIII", *words)
        return socket.inet_ntop(socket.AF_INET6, packed)
    except Exception:
        return hex_str


def _decode_ip(hex_str: str) -> str:
    if len(hex_str) == 8:
        return _hex_to_ipv4(hex_str)
    elif len(hex_str) == 32:
        return _hex_to_ipv6(hex_str)
    return hex_str


TCP_STATES: dict[str, str] = {
    "01": "ESTABLISHED",
    "02": "SYN_SENT",
    "03": "SYN_RECV",
    "04": "FIN_WAIT1",
    "05": "FIN_WAIT2",
    "06": "TIME_WAIT",
    "07": "CLOSE",
    "08": "CLOSE_WAIT",
    "09": "LAST_ACK",
    "0A": "LISTEN",
    "0B": "CLOSING",
}


def _get_socket_inode_map() -> dict[str, tuple[str, str]]:
    """Map socket inodes to (pid, process_name) via /proc/[pid]/fd/*."""
    inode_map: dict[str, tuple[str, str]] = {}
    if not os.path.exists("/proc"):
        return inode_map

    for fd_path in glob.glob("/proc/[0-9]*/fd/*"):
        try:
            target = os.readlink(fd_path)
            if target.startswith("socket:["):
                inode = target[8:-1]
                pid = fd_path.split("/")[2]
                comm_path = f"/proc/{pid}/comm"
                if os.path.exists(comm_path):
                    with open(comm_path, "r", encoding="utf-8", errors="ignore") as f:
                        name = f.read().strip()
                else:
                    name = f"pid-{pid}"
                inode_map[inode] = (pid, name)
        except (OSError, UnicodeDecodeError):
            continue

    return inode_map


@router.get("/network-apps")
async def get_network_apps() -> list[dict[str, Any]]:
    """Discover real active host applications and services holding network sockets."""
    inode_map = _get_socket_inode_map()
    apps_by_name: dict[str, dict[str, Any]] = {}

    socket_files = [
        ("/proc/net/tcp", "tcp"),
        ("/proc/net/tcp6", "tcp6"),
        ("/proc/net/udp", "udp"),
        ("/proc/net/udp6", "udp6"),
    ]

    for file_path, proto in socket_files:
        if not os.path.exists(file_path):
            continue
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                lines = f.readlines()[1:]
        except OSError:
            continue

        for line in lines:
            parts = line.strip().split()
            if len(parts) < 10:
                continue

            local_addr = parts[1]
            remote_addr = parts[2]
            state_hex = parts[3]
            inode = parts[9]

            try:
                local_ip_hex, local_port_hex = local_addr.split(":")
                local_port = int(local_port_hex, 16)
                local_ip = _decode_ip(local_ip_hex)
            except Exception:
                continue

            try:
                remote_ip_hex, remote_port_hex = remote_addr.split(":")
                remote_port = int(remote_port_hex, 16)
                remote_ip = _decode_ip(remote_ip_hex)
            except Exception:
                remote_port = 0
                remote_ip = "0.0.0.0"

            state = TCP_STATES.get(state_hex, "UNKNOWN") if proto.startswith("tcp") else "ACTIVE"

            pid, name = inode_map.get(inode, ("-", "System / Kernel Service"))
            app_id = name.lower().replace(" ", "_")

            if app_id not in apps_by_name:
                char_sum = sum(ord(c) for c in name)
                colors = ["#7A9EB0", "#5A8A5A", "#B8845A", "#7A7A99", "#5A7A8A", "#6B8F71", "#8A7A4A", "#6A5A7A"]
                color = colors[char_sum % len(colors)]
                category = "System Service" if pid == "-" else "User Application"

                apps_by_name[app_id] = {
                    "id": app_id,
                    "name": name,
                    "pid": pid,
                    "category": "active",
                    "appType": category,
                    "iconColor": color,
                    "iconLetter": name[0].upper() if name else "S",
                    "ports": set(),
                    "connections": 0,
                    "blocked": 0,
                    "listening": False,
                    "remote_endpoints": set(),
                }

            app_entry = apps_by_name[app_id]
            app_entry["connections"] += 1
            if local_port > 0:
                app_entry["ports"].add(local_port)
            if state == "LISTEN":
                app_entry["listening"] = True
            if remote_port > 0 and remote_ip not in ("0.0.0.0", "127.0.0.1", "::", "::1"):
                app_entry["remote_endpoints"].add(f"{remote_ip}:{remote_port}")

    if not apps_by_name:
        return [
            {
                "id": "sentrywatch_api",
                "name": "SentryWatch SecOps API",
                "pid": str(os.getpid()),
                "category": "active",
                "iconColor": "#6B8F71",
                "iconLetter": "S",
                "ports": [8000],
                "connections": 1,
                "blocked": 0,
            }
        ]

    results = []
    for app in apps_by_name.values():
        results.append({
            "id": app["id"],
            "name": app["name"],
            "pid": app["pid"],
            "category": "active",
            "iconColor": app["iconColor"],
            "iconLetter": app["iconLetter"],
            "ports": sorted(list(app["ports"]))[:10],
            "connections": app["connections"],
            "blocked": app["blocked"],
            "listening": app["listening"],
        })

    results.sort(key=lambda a: (a["listening"], a["connections"]), reverse=True)
    return results


@router.get("/connections")
async def get_connections() -> list[dict[str, Any]]:
    """List active socket connections with endpoints and states."""
    inode_map = _get_socket_inode_map()
    conns: list[dict[str, Any]] = []

    for file_path, proto in [("/proc/net/tcp", "TCP"), ("/proc/net/tcp6", "TCP6")]:
        if not os.path.exists(file_path):
            continue
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                lines = f.readlines()[1:]
        except OSError:
            continue

        for line in lines:
            parts = line.strip().split()
            if len(parts) < 10:
                continue

            local_addr = parts[1]
            remote_addr = parts[2]
            state_hex = parts[3]
            inode = parts[9]

            try:
                local_ip_hex, local_port_hex = local_addr.split(":")
                local_port = int(local_port_hex, 16)
                local_ip = _decode_ip(local_ip_hex)

                remote_ip_hex, remote_port_hex = remote_addr.split(":")
                remote_port = int(remote_port_hex, 16)
                remote_ip = _decode_ip(remote_ip_hex)
            except Exception:
                continue

            state = TCP_STATES.get(state_hex, "UNKNOWN")
            _, name = inode_map.get(inode, ("-", "System Kernel"))

            is_local = remote_ip in ("0.0.0.0", "127.0.0.1", "::", "::1")
            conns.append({
                "proto": proto,
                "local_address": f"{local_ip}:{local_port}",
                "remote_address": f"{remote_ip}:{remote_port}" if not is_local else "LOCAL",
                "remote_ip": remote_ip if not is_local else local_ip,
                "remote_port": remote_port,
                "state": state,
                "app": name,
                "status": "allowed",
                "country": "LOCAL" if is_local else "WAN",
                "countryCode": "🖥️" if is_local else "🌐",
            })

    return conns[:100]
