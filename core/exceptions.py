"""Domain-specific exception hierarchy shared by all SentryWatch components."""

from __future__ import annotations


class SentryWatchError(Exception):
    """Root exception for every error raised by the suite."""


class TargetValidationError(SentryWatchError):
    """A scan target failed structural or policy validation."""


class DisallowedTargetError(TargetValidationError):
    """A target resolved into a protected or reserved network range."""


class DNSResolutionError(TargetValidationError):
    """A hostname produced no usable IP addresses."""


class CidrTooLargeError(TargetValidationError):
    """A CIDR target would expand past the configured safety cap."""


class ParserError(SentryWatchError):
    """Streaming log parsing failed mid-stream."""


class ScanExecutionError(SentryWatchError):
    """The scanner encountered a fatal orchestration failure."""
