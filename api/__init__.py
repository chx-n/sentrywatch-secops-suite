"""SentryWatch FastAPI backend package."""

from __future__ import annotations

from typing import Final

from core import __version__ as _core_version

__version__: Final[str] = _core_version

__all__: Final[tuple[str, ...]] = ("__version__", "create_app")


def __getattr__(name: str) -> object:
    if name == "create_app":
        from api.main import create_app

        return create_app
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
