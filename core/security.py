"""SSRF-hardened target parsing, validation, and DNS resolution.

Every user-supplied scan target must pass through :func:`validate_target`
before any socket is opened. The scanner dials the *literal* IP addresses
returned here and never the hostname itself, which closes the classic
DNS-rebinding race window between validation and connection.
"""

from __future__ import annotations

import ipaddress
import re
import socket
from collections.abc import Sequence
from dataclasses import dataclass
from enum import StrEnum
from ipaddress import IPv4Address, IPv4Network, IPv6Address, IPv6Network
from typing import Final

from core.exceptions import (
    CidrTooLargeError,
    DisallowedTargetError,
    DNSResolutionError,
    TargetValidationError,
)

IPAddress = IPv4Address | IPv6Address
IPNetwork = IPv4Network | IPv6Network

FORBIDDEN_SUBSTRINGS: Final[tuple[str, ...]] = (
    "://", "@", "%", "#", "?", "&", "=", ";", ",", " ", "\t", "\n", "\r", '"', "'", "\\",
)
METADATA_HOSTNAMES: Final[frozenset[str]] = frozenset(
    {"metadata.google.internal", "metadata.goog"}
)
HOSTNAME_PATTERN: Final[re.Pattern[str]] = re.compile(
    r"^(?=.{1,253}\.?$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))*\.?$"
)
MAX_TARGET_LENGTH: Final[int] = 253

ALWAYS_BLOCKED_NETWORKS: Final[tuple[IPNetwork, ...]] = (
    ipaddress.ip_network("169.254.0.0/16"),
)
MAX_CANDIDATE_TARGETS: Final[int] = 512
MAX_CIDR_HOSTS: Final[int] = 65_536

RESERVED_NETWORKS: Final[tuple[IPNetwork, ...]] = (
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("100.64.0.0/10"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.0.0.0/24"),
    ipaddress.ip_network("192.0.2.0/24"),
    ipaddress.ip_network("192.88.99.0/24"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("198.18.0.0/15"),
    ipaddress.ip_network("198.51.100.0/24"),
    ipaddress.ip_network("203.0.113.0/24"),
    ipaddress.ip_network("224.0.0.0/4"),
    ipaddress.ip_network("240.0.0.0/4"),
    ipaddress.ip_network("::/128"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("::ffff:0:0/96"),
    ipaddress.ip_network("64:ff9b::/96"),
    ipaddress.ip_network("100::/64"),
    ipaddress.ip_network("2001:db8::/32"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
    ipaddress.ip_network("ff00::/8"),
)


class TargetKind(StrEnum):
    """Classification of a validated scan target."""

    ADDRESS = "address"
    NETWORK = "network"
    HOSTNAME = "hostname"


@dataclass(frozen=True, slots=True)
class ValidatedTarget:
    """An immutable, fully resolved scan target safe to dial."""

    raw: str
    kind: TargetKind
    addresses: tuple[IPAddress, ...]
    network: IPNetwork | None = None

    @property
    def primary_address(self) -> IPAddress:
        if not self.addresses:
            raise TargetValidationError(f"target {self.raw!r} has no resolvable addresses")
        return self.addresses[0]


def _clean(value: str) -> str:
    candidate = value.strip().lower()
    if not candidate:
        raise TargetValidationError("empty scan target")
    if len(candidate) > MAX_TARGET_LENGTH:
        raise TargetValidationError(f"target exceeds {MAX_TARGET_LENGTH} characters")
    for token in FORBIDDEN_SUBSTRINGS:
        if token in candidate:
            raise TargetValidationError(
                f"target contains forbidden sequence {token!r}: {candidate[:64]!r}"
            )
    return candidate


def assert_address_allowed(address: IPAddress, *, allow_private_networks: bool) -> None:
    """Reject protected ranges; link-local/metadata ranges are never permitted."""
    for network in ALWAYS_BLOCKED_NETWORKS:
        if address in network:
            raise DisallowedTargetError(
                f"{address} falls inside always-protected network {network}"
            )
    if allow_private_networks:
        return
    for network in RESERVED_NETWORKS:
        if address in network:
            raise DisallowedTargetError(
                f"{address} falls inside protected network {network} (SSRF guard)"
            )


def parse_literal_address(value: str) -> IPAddress | None:
    """Return an :class:`IPAddress` when *value* is a literal IP, else ``None``."""
    try:
        parsed: IPAddress = ipaddress.ip_address(value)
    except ValueError:
        return None
    return parsed


def parse_network(value: str) -> IPNetwork:
    """Parse a CIDR string with host-count safety checks."""
    if value.count("/") != 1:
        raise TargetValidationError(f"invalid CIDR notation: {value!r}")
    try:
        network: IPNetwork = ipaddress.ip_network(value, strict=False)
    except (ValueError, TypeError) as exc:
        raise TargetValidationError(f"invalid CIDR notation {value!r}: {exc}") from exc
    host_count = network.num_addresses - 2 if network.prefixlen < network.max_prefixlen else 1
    if host_count > MAX_CIDR_HOSTS:
        raise CidrTooLargeError(
            f"CIDR {value!r} would expand to {host_count} hosts (cap {MAX_CIDR_HOSTS})"
        )
    return network


def resolve_hostname(hostname: str) -> tuple[IPAddress, ...]:
    """Resolve *hostname* to unique IPv4/IPv6 addresses via the system resolver."""
    if hostname in METADATA_HOSTNAMES:
        raise DisallowedTargetError(f"{hostname!r} is a blocked cloud metadata endpoint")
    if not HOSTNAME_PATTERN.match(hostname):
        raise TargetValidationError(f"invalid hostname syntax: {hostname!r}")
    try:
        infos = socket.getaddrinfo(
            hostname, None, family=socket.AF_UNSPEC, type=socket.SOCK_STREAM
        )
    except socket.gaierror as exc:
        raise DNSResolutionError(f"DNS lookup failed for {hostname!r}: {exc}") from exc
    except OSError as exc:
        raise DNSResolutionError(f"resolver failure for {hostname!r}: {exc}") from exc
    addresses: list[IPAddress] = []
    seen: set[str] = set()
    for info in infos:
        candidate = str(info[4][0])
        if candidate in seen:
            continue
        seen.add(candidate)
        parsed: IPAddress = ipaddress.ip_address(candidate)
        addresses.append(parsed)
    if not addresses:
        raise DNSResolutionError(f"no usable addresses for {hostname!r}")
    return tuple(addresses)


def validate_target(value: str, *, allow_private_networks: bool = False) -> ValidatedTarget:
    """Fully validate one target string: sanitise, classify, resolve, SSRF-screen."""
    candidate = _clean(value)
    literal = parse_literal_address(candidate)
    if literal is not None:
        assert_address_allowed(literal, allow_private_networks=allow_private_networks)
        return ValidatedTarget(raw=candidate, kind=TargetKind.ADDRESS, addresses=(literal,))
    if "/" in candidate:
        network = parse_network(candidate)
        hosts: list[IPAddress] = []
        for member in network.hosts():
            address: IPAddress = ipaddress.ip_address(str(member))
            assert_address_allowed(address, allow_private_networks=allow_private_networks)
            hosts.append(address)
        return ValidatedTarget(
            raw=candidate, kind=TargetKind.NETWORK, addresses=tuple(hosts), network=network
        )
    addresses = resolve_hostname(candidate)
    for address in addresses:
        assert_address_allowed(address, allow_private_networks=allow_private_networks)
    return ValidatedTarget(raw=candidate, kind=TargetKind.HOSTNAME, addresses=addresses)


def prepare_targets(
    values: Sequence[str], *, allow_private_networks: bool = False
) -> tuple[ValidatedTarget, ...]:
    """Validate a batch of targets, preserving order and dropping duplicates."""
    if len(values) > MAX_CANDIDATE_TARGETS:
        raise TargetValidationError(f"too many targets: {len(values)} > {MAX_CANDIDATE_TARGETS}")
    prepared: dict[str, ValidatedTarget] = {}
    for value in values:
        validated = validate_target(value, allow_private_networks=allow_private_networks)
        prepared.setdefault(validated.raw, validated)
    if not prepared:
        raise TargetValidationError("no valid targets supplied")
    return tuple(prepared.values())
