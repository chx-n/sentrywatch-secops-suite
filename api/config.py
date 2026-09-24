"""Application settings loaded from environment variables (``SENTRYWATCH_*``)."""

from __future__ import annotations

from functools import lru_cache

import bcrypt
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


def _hash_key(key: str) -> str:
    return bcrypt.hashpw(key.encode(), bcrypt.gensalt()).decode()


def _verify_key(provided: str, stored_hash: str) -> bool:
    try:
        return bcrypt.checkpw(provided.encode(), stored_hash.encode())
    except Exception:
        return False


def _migrate_keys(keys: frozenset[str]) -> frozenset[str]:
    """Migrate plaintext keys to bcrypt hashes. Keys already starting with $2b$ are kept."""
    migrated: list[str] = []
    for key in keys:
        if key.startswith("$2b$"):
            migrated.append(key)
        else:
            migrated.append(_hash_key(key))
    return frozenset(migrated)


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
    ws_rate_limit: str = "30/minute"
    force_https: bool = False

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        object.__setattr__(self, "api_keys", _migrate_keys(self.api_keys))

    def verify_key(self, provided: str) -> bool:
        """Constant-time verification of provided key against stored hashes."""
        if not self.api_keys or not provided:
            return False
        for stored in self.api_keys:
            if stored.startswith("$2b$"):
                if _verify_key(provided, stored):
                    return True
            else:
                if provided == stored:
                    return True
        return False


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached settings accessor; call ``.cache_clear()`` between test cases."""
    return Settings()
