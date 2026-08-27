"""Unit tests for SSRF-hardened target validation and DNS pinning."""

from __future__ import annotations

import pytest

from core.exceptions import (
    CidrTooLargeError,
    DisallowedTargetError,
    TargetValidationError,
)
from core.security import (
    TargetKind,
    prepare_targets,
    validate_target,
)


class TestTargetValidation:
    """Test suite for target validation rules and SSRF guards."""

    def test_valid_public_ipv4(self) -> None:
        target = validate_target("93.184.216.34")
        assert target.kind == TargetKind.ADDRESS
        assert str(target.primary_address) == "93.184.216.34"

    def test_valid_public_cidr(self) -> None:
        target = validate_target("93.184.216.0/28")
        assert target.kind == TargetKind.NETWORK
        assert len(target.addresses) == 14  # usable hosts in /28

    def test_loopback_blocked_by_default(self) -> None:
        with pytest.raises(DisallowedTargetError):
            validate_target("127.0.0.1", allow_private_networks=False)

    def test_ipv6_loopback_blocked(self) -> None:
        with pytest.raises(DisallowedTargetError):
            validate_target("::1", allow_private_networks=False)

    def test_cloud_metadata_always_blocked(self) -> None:
        with pytest.raises(DisallowedTargetError):
            validate_target("169.254.169.254", allow_private_networks=True)

    def test_google_cloud_metadata_hostname_blocked(self) -> None:
        with pytest.raises(DisallowedTargetError):
            validate_target("metadata.google.internal", allow_private_networks=True)

    def test_rfc1918_private_blocked_by_default(self) -> None:
        for ip in ("10.0.0.1", "172.16.0.1", "192.168.1.1"):
            with pytest.raises(DisallowedTargetError):
                validate_target(ip, allow_private_networks=False)

    def test_rfc1918_private_allowed_when_opted_in(self) -> None:
        target = validate_target("192.168.1.1", allow_private_networks=True)
        assert target.kind == TargetKind.ADDRESS
        assert str(target.primary_address) == "192.168.1.1"

    @pytest.mark.parametrize(
        "invalid_target",
        [
            "http://example.com",
            "https://target.com",
            "admin:secret@target.com",
            "target.com#fragment",
            "target.com?param=val",
            "target.com;cat /etc/passwd",
            "target.com\n127.0.0.1",
            "a" * 260,
        ],
    )
    def test_malformed_targets_rejected(self, invalid_target: str) -> None:
        with pytest.raises(TargetValidationError):
            validate_target(invalid_target)

    def test_cidr_too_large_rejected(self) -> None:
        with pytest.raises(CidrTooLargeError):
            validate_target("93.0.0.0/8")

    def test_prepare_targets_deduplication(self) -> None:
        raw_list = ["93.184.216.34", "93.184.216.34", "93.184.216.35"]
        validated = prepare_targets(raw_list)
        assert len(validated) == 2
