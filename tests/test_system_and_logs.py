"""Tests for system inspection, log parsing, and security alerts API endpoints."""

import pytest
from fastapi.testclient import TestClient

from api.config import Settings
from api.main import create_app



def test_get_network_apps(client: TestClient, auth_headers: dict[str, str]) -> None:
    response = client.get("/api/v1/system/network-apps", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    if data:
        app = data[0]
        assert "id" in app
        assert "name" in app
        assert "ports" in app
        assert "connections" in app


def test_get_connections(client: TestClient, auth_headers: dict[str, str]) -> None:
    response = client.get("/api/v1/system/connections", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


def test_parse_logs_endpoint(client: TestClient, auth_headers: dict[str, str]) -> None:
    sample_log = '<154>Aug 26 23:45:00 myhost sshd[123]: Failed password for root from 198.51.100.42 port 49212 ssh2'
    response = client.post("/api/v1/logs/parse", headers=auth_headers, json={"lines": [sample_log]})
    assert response.status_code == 200
    body = response.json()
    assert "events" in body
    assert len(body["events"]) == 1
    event = body["events"][0]
    assert event["matched"] is True
    assert event["source_rule"] == "syslog"
    assert "process" in event["fields"]
    assert body["stats"]["matched_threats"] == 1


def test_system_logs_endpoint(client: TestClient, auth_headers: dict[str, str]) -> None:
    response = client.get("/api/v1/logs/system?limit=5", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "events" in data
    assert "stats" in data


def test_alerts_endpoints(client: TestClient, auth_headers: dict[str, str]) -> None:
    # Get alerts
    res = client.get("/api/v1/alerts", headers=auth_headers)
    assert res.status_code == 200
    alerts = res.json()
    assert isinstance(alerts, list)

    # Block IP
    res_block = client.post("/api/v1/alerts/block-ip", headers=auth_headers, json={"ip": "203.0.113.99"})
    assert res_block.status_code == 200
    assert res_block.json()["status"] == "blocked"

    # Verify blocked IP appears in list
    res_blocked_list = client.get("/api/v1/alerts/blocked-ips", headers=auth_headers)
    assert res_blocked_list.status_code == 200
    assert "203.0.113.99" in res_blocked_list.json()

    # Acknowledge
    res_ack = client.post("/api/v1/alerts/acknowledge", headers=auth_headers, json={"all": True})
    assert res_ack.status_code == 200
