"""SentryWatch CLI package."""

from __future__ import annotations

from typing import Final

from core import __version__

__all__: Final[tuple[str, ...]] = ("__version__", "app")


def __getattr__(name: str) -> object:
    if name == "app":
        from cli.cli import app

        return app
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
