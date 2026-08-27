"""Application settings loaded from environment variables (``SENTRYWATCH_*``)."""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration for the API process."""

    model_config = SettingsConfigDict(
        env_prefix="SENTRYWATCH_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "SentryWatch SecOps API"
    debug: bool = False
    api_keys: frozenset[str] = frozenset({"dev-key-change-me"})
    allowed_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    rate_limit: str = "60/minute"
    redis_url: str | None = None
    allow_private_networks: bool = False
    max_concurrent_scans: int = Field(default=8, ge=1, le=256)
    scan_history_size: int = Field(default=128, ge=1, le=10_000)
    ws_heartbeat_s: float = Field(default=15.0, gt=0.0, le=120.0)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached settings accessor; call ``.cache_clear()`` between test cases."""
    return Settings()
