"""Typed Pydantic v2 domain models shared across the SentryWatch stack."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime
from enum import StrEnum
from typing import Annotated, Any, Final, Self
from uuid import UUID, uuid4

from pydantic import (
    AwareDatetime,
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    IPvAnyAddress,
    field_validator,
    model_validator,
)

__all__: Final[tuple[str, ...]] = (
    "DEFAULT_SCAN_PORTS",
    "DomainModel",
    "HostScanResult",
    "PortNumber",
    "PortProbe",
    "PortState",
    "ScanReport",
    "ScanRequest",
    "parse_port_spec",
    "utc_now",
)

DEFAULT_SCAN_PORTS: Final[str] = (
    "21,22,23,25,53,80,110,143,443,445,993,995,3306,3389,5432,6379,8080,8443,9092"
)
MAX_PORT_VALUE: Final[int] = 65_535
MAX_PROBE_BUDGET: Final[int] = 50_000


def utc_now() -> datetime:
    """Timezone-aware UTC timestamp used by all domain models."""
    return datetime.now(UTC)


PortNumber = Annotated[int, Field(ge=1, le=MAX_PORT_VALUE)]

_FORBIDDEN_TARGET_TOKENS: Final[tuple[str, ...]] = (
    "://", "@", "%", "#", "?", "&", "=", ";", ",", " ", "\t", "\n", "\r", '"', "'", "\\",
)


def _strip_target(value: object) -> str:
    if not isinstance(value, str):
        raise ValueError("target must be a string")
    cleaned = value.strip().lower()
    if not cleaned:
        raise ValueError("target must not be empty")
    if len(cleaned) > 253:
        raise ValueError("target exceeds 253 characters")
    for token in _FORBIDDEN_TARGET_TOKENS:
        if token in cleaned:
            raise ValueError(f"target contains forbidden sequence {token!r}")
    return cleaned


SanitizedTarget = Annotated[str, BeforeValidator(_strip_target)]


def parse_port_spec(raw: str | int | Sequence[int] | Sequence[str]) -> tuple[int, ...]:
    """Normalise a port spec (``"22,80,1000-2000"``, ``80``, or an iterable) to sorted ports."""
    if isinstance(raw, int):
        tokens: list[str] = [str(raw)]
    elif isinstance(raw, str):
        tokens = raw.split(",")
    else:
        tokens = []
        for item in raw:
            if isinstance(item, int):
                tokens.append(str(item))
            elif isinstance(item, str):
                tokens.append(item)
            else:
                raise ValueError(f"port entries must be int or str, got {type(item).__name__}")
    ports: set[int] = set()
    for token in tokens:
        piece = token.strip()
        if not piece:
            raise ValueError("empty port token")
        start_text, separator, end_text = piece.partition("-")
        if separator:
            if not (start_text.isdigit() and end_text.isdigit()):
                raise ValueError(f"invalid port range {piece!r}")
            start, end = int(start_text), int(end_text)
            if start > end:
                raise ValueError(f"inverted port range {piece!r}")
        else:
            if not piece.isdigit():
                raise ValueError(f"invalid port {piece!r}")
            start = end = int(piece)
        for port in range(start, end + 1):
            if not 1 <= port <= MAX_PORT_VALUE:
                raise ValueError(f"port {port} outside 1-{MAX_PORT_VALUE}")
            ports.add(port)
    if not ports:
        raise ValueError("no ports supplied")
    return tuple(sorted(ports))


class DomainModel(BaseModel):
    """Base config for every SentryWatch payload: immutable and strict."""

    model_config = ConfigDict(
        frozen=True,
        extra="forbid",
        str_strip_whitespace=True,
        validate_default=True,
        ser_json_timedelta="float",
    )


class PortState(StrEnum):
    """Outcome classification for a single TCP probe."""

    OPEN = "open"
    CLOSED = "closed"
    FILTERED = "filtered"
    ERROR = "error"


class ScanRequest(DomainModel):
    """Validated scan request; doubles as scanner engine settings."""

    targets: tuple[SanitizedTarget, ...] = Field(min_length=1, max_length=256)
    ports: tuple[PortNumber, ...] = Field(
        default_factory=lambda: parse_port_spec(DEFAULT_SCAN_PORTS),
        min_length=1,
        max_length=MAX_PORT_VALUE,
    )
    max_concurrency: int = Field(default=256, ge=1, le=4096)
    connect_timeout_s: float = Field(default=3.0, gt=0.0, le=30.0)
    banner_timeout_s: float = Field(default=2.0, gt=0.0, le=30.0)
    grab_banners: bool = True
    max_retries: int = Field(default=1, ge=0, le=3)
    allow_private_networks: bool = False
    validate_at_connect: bool = True

    @field_validator("targets", mode="before")
    @classmethod
    def _coerce_single_target(cls, value: object) -> object:
        if isinstance(value, str):
            return (value,)
        return value

    @field_validator("ports", mode="before")
    @classmethod
    def _coerce_port_spec(cls, value: object) -> object:
        if isinstance(value, str):
            return parse_port_spec(value)
        return value

    @model_validator(mode="after")
    def _dedupe_targets(self) -> Self:
        deduped = tuple(dict.fromkeys(self.targets))
        if len(deduped) != len(self.targets):
            return self.model_copy(update={"targets": deduped})
        return self

    @model_validator(mode="after")
    def _probe_budget(self) -> Self:
        probe_count = len(self.targets) * len(self.ports)
        if probe_count > MAX_PROBE_BUDGET:
            raise ValueError(
                f"probe budget exceeded: {len(self.targets)} targets × {len(self.ports)} ports = {probe_count} > {MAX_PROBE_BUDGET}"
            )
        return self


class PortProbe(DomainModel):
    """Result of one TCP connect attempt against a single port."""

    port: PortNumber
    state: PortState
    latency_ms: float | None = Field(default=None, ge=0.0)
    banner: str | None = Field(default=None, max_length=512)
    detail: str | None = Field(default=None, max_length=512)


class HostScanResult(DomainModel):
    """Aggregated probe results for a single target address."""

    target: SanitizedTarget
    address: IPvAnyAddress | None = None
    probes: tuple[PortProbe, ...] = Field(default_factory=tuple)
    started_at: AwareDatetime = Field(default_factory=utc_now)
    completed_at: AwareDatetime = Field(default_factory=utc_now)
    duration_ms: float = Field(default=0.0, ge=0.0)
    open_ports: tuple[PortNumber, ...] = Field(default_factory=tuple)
    open_port_count: int = Field(default=0, ge=0)
    error: str | None = Field(default=None, max_length=512)

    @model_validator(mode="before")
    @classmethod
    def _compute_open_ports(cls, data: Any) -> Any:
        if isinstance(data, dict):
            probes = data.get("probes", ())
            if not data.get("open_ports") and probes:
                open_ports = tuple(
                    p.port if hasattr(p, "port") else p["port"]
                    for p in probes
                    if (p.state if hasattr(p, "state") else p.get("state")) in (PortState.OPEN, "open")
                )
                data["open_ports"] = open_ports
                data["open_port_count"] = len(open_ports)
        return data


class ScanReport(DomainModel):
    """Immutable top-level report produced by :mod:`core.scanner`."""

    id: UUID = Field(default_factory=uuid4)
    targets: tuple[SanitizedTarget, ...]
    ports_scanned: tuple[PortNumber, ...]
    hosts: tuple[HostScanResult, ...] = Field(default_factory=tuple)
    started_at: AwareDatetime = Field(default_factory=utc_now)
    completed_at: AwareDatetime = Field(default_factory=utc_now)
    duration_ms: float = Field(default=0.0, ge=0.0)
    hosts_scanned: int = Field(default=0, ge=0)
    hosts_failed: int = Field(default=0, ge=0)
    open_port_count: int = Field(default=0, ge=0)

    @property
    def successful(self) -> bool:
        return self.hosts_failed == 0
