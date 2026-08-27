"""Shared fixtures and test configuration for SentryWatch."""

from __future__ import annotations

import os
import pytest
from fastapi.testclient import TestClient

from api.config import Settings
from api.main import create_app


@pytest.fixture
def test_settings() -> Settings:
    """Fixture providing isolated test settings with deterministic API keys."""
    return Settings(
        api_keys=["test-secret-key-12345"],
        allowed_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        rate_limit="1000/minute",
        allow_private_networks=False,
        max_concurrent_scans=16,
    )


@pytest.fixture
def test_app(test_settings: Settings):
    """Fixture providing a FastAPI application instance configured for testing."""
    return create_app(settings=test_settings)


@pytest.fixture
def client(test_app) -> TestClient:
    """Fixture providing a synchronous HTTP test client."""
    return TestClient(test_app)


@pytest.fixture
def auth_headers() -> dict[str, str]:
    """Fixture providing valid authentication headers for API requests."""
    return {"X-API-Key": "test-secret-key-12345"}
