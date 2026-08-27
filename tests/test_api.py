"""Integration tests for FastAPI REST endpoints."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


class TestHealthEndpoints:
    """Tests for unauthenticated health probes."""

    def test_healthz(self, client: TestClient) -> None:
        response = client.get("/healthz")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}

    def test_readyz(self, client: TestClient) -> None:
        response = client.get("/readyz")
        assert response.status_code in (200, 503)
        data = response.json()
        assert "status" in data
        assert "components" in data


class TestScanEndpointsAuthAndValidation:
    """Tests for authentication, SSRF rejection, and scan submission."""

    def test_unauthenticated_scan_request_rejected(self, client: TestClient) -> None:
        response = client.post(
            "/api/v1/scans",
            json={"targets": ["93.184.216.34"], "ports": "80,443"},
        )
        assert response.status_code == 401

    def test_invalid_api_key_rejected(self, client: TestClient) -> None:
        response = client.post(
            "/api/v1/scans",
            headers={"X-API-Key": "wrong-key"},
            json={"targets": ["93.184.216.34"], "ports": "80,443"},
        )
        assert response.status_code == 401

    def test_authenticated_valid_scan_accepted(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        response = client.post(
            "/api/v1/scans",
            headers=auth_headers,
            json={"targets": ["93.184.216.34"], "ports": "80"},
        )
        assert response.status_code == 202
        data = response.json()
        assert "scan_id" in data
        assert data["status"] in ("pending", "running", "completed")
        assert "poll" in data

    def test_ssrf_target_rejected_with_403(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        response = client.post(
            "/api/v1/scans",
            headers=auth_headers,
            json={"targets": ["127.0.0.1"], "ports": "80"},
        )
        assert response.status_code == 403

    def test_list_scans_authenticated(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        response = client.get("/api/v1/scans", headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_get_nonexistent_scan_returns_404(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        response = client.get(
            "/api/v1/scans/00000000-0000-0000-0000-000000000000",
            headers=auth_headers,
        )
        assert response.status_code == 404
