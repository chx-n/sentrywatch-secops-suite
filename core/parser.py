"""Streaming, regex-based log and telemetry parser.

Consumes unbounded line streams (files, sockets, queues) as async or sync
iterators and yields fully typed :class:`ParsedEvent` models. Matching is
performed by precompiled named-group patterns; each rule declares its own
severity inference, so enrichment happens in a single pass with no
intermediate buffering of the whole stream.
"""

from __future__ import annotations

import enum
import re
from collections.abc import AsyncIterable, AsyncIterator, Iterable, Iterator, Sequence
from dataclasses import dataclass
from typing import Final, Literal

from pydantic import AwareDatetime, Field

from core.exceptions import ParserError
from core.schemas import DomainModel, utc_now

__all__: Final[tuple[str, ...]] = (
    "LogRule",
    "ParsedEvent",
    "ParserStats",
    "Severity",
    "StreamingParser",
)

MAX_LINE_LENGTH: Final[int] = 32_768

UnmatchedPolicy = Literal["skip", "event"]


class Severity(enum.StrEnum):
    """Unified severity scale across supported log formats."""

    DEBUG = "debug"
    INFO = "info"
    NOTICE = "notice"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"
    ALERT = "alert"
    EMERGENCY = "emergency"
    UNKNOWN = "unknown"

    @classmethod
    def from_syslog_priority(cls, priority: int) -> Severity:
        """Map an RFC 3164/5424 priority value to a severity."""
        code = priority % 8 if 0 <= priority <= 191 else -1
        mapping: Final[dict[int, Severity]] = {
            0: cls.EMERGENCY,
            1: cls.ALERT,
            2: cls.CRITICAL,
            3: cls.ERROR,
            4: cls.WARNING,
            5: cls.NOTICE,
            6: cls.INFO,
            7: cls.DEBUG,
        }
        return mapping.get(code, cls.UNKNOWN)


@dataclass(frozen=True, slots=True)
class LogRule:
    """A compiled parsing rule: regex with named capture groups."""

    name: str
    pattern: re.Pattern[str]
    infer_severity: bool = False
    multi_match: bool = False

    @classmethod
    def compile(
        cls,
        name: str,
        expression: str,
        *,
        infer_severity: bool = False,
        multi_match: bool = False,
        flags: int = re.DOTALL,
    ) -> LogRule:
        try:
            return cls(
                name=name,
                pattern=re.compile(expression, flags),
                infer_severity=infer_severity,
                multi_match=multi_match,
            )
        except re.error as exc:
            raise ParserError(f"invalid pattern for rule {name!r}: {exc}") from exc


SYSLOG_RULE: Final[LogRule] = LogRule.compile(
    "syslog",
    r"^<(?P<priority>\d{1,3})>(?P<timestamp>[A-Z][a-z]{2}\s+\d{1,2} \d{2}:\d{2}:\d{2}) "
    r"(?P<host>[\w.-]+) (?P<process>[\w\-/.]+)(?:\[(?P<pid>\d+)\])?: (?P<message>.*)$",
    infer_severity=True,
)

APACHE_CLF_RULE: Final[LogRule] = LogRule.compile(
    "apache_clf",
    r"^(?P<remote_addr>\S+) \S+ (?P<remote_user>\S+) \[(?P<timestamp>[^\]]+)\] "
    r'"(?P<method>[A-Z]+) (?P<path>\S+) (?P<protocol>[^"]+)" '
    r"(?P<status>\d{3}) (?P<bytes_sent>\d+|-)",
)

KEY_VALUE_RULE: Final[LogRule] = LogRule.compile(
    "key_value",
    r'(?P<key>[A-Za-z_][\w.\-]*)=(?:"(?P<dq>[^"]*)"|\'(?P<sq>[^\']*)\'|(?P<bare>[^\s,;]+))',
    multi_match=True,
)

DEFAULT_RULES: Final[tuple[LogRule, ...]] = (
    SYSLOG_RULE,
    APACHE_CLF_RULE,
    KEY_VALUE_RULE,
)


class ParsedEvent(DomainModel):
    """Structured result of parsing one input line."""

    raw_line: str = Field(max_length=MAX_LINE_LENGTH)
    source_rule: str | None = None
    severity: Severity = Severity.UNKNOWN
    timestamp: str | None = None
    fields: dict[str, str] = Field(default_factory=dict)
    matched: bool = False
    parsed_at: AwareDatetime = Field(default_factory=utc_now)


@dataclass(slots=True)
class ParserStats:
    """Live counters maintained while a stream is being consumed."""

    lines_in: int = 0
    matched: int = 0
    unmatched: int = 0
    bytes_seen: int = 0
    errors: int = 0

    @property
    def match_ratio(self) -> float:
        if self.lines_in == 0:
            return 0.0
        return round(self.matched / self.lines_in, 4)


class StreamingParser:
    """Stateful streaming parser over line-oriented text.

    Usage::

        parser = StreamingParser()
        async for event in parser.stream(async_lines_iterator):
            handle(event)
    """

    __slots__ = ("_max_line_length", "_on_unmatched", "_rules", "stats")

    def __init__(
        self,
        rules: Sequence[LogRule] = DEFAULT_RULES,
        *,
        on_unmatched: UnmatchedPolicy = "event",
        max_line_length: int = MAX_LINE_LENGTH,
    ) -> None:
        self._rules: tuple[LogRule, ...] = tuple(rules)
        self._on_unmatched: UnmatchedPolicy = on_unmatched
        self._max_line_length = max_line_length
        self.stats = ParserStats()

    def feed_line(self, line: str) -> ParsedEvent | None:
        """Parse one line; returns ``None`` when unmatched and mode is ``skip``."""
        cleaned = _clean_line(line)
        self.stats.bytes_seen += len(cleaned.encode("utf-8"))
        self.stats.lines_in += 1
        if len(cleaned) > self._max_line_length:
            self.stats.errors += 1
            return ParsedEvent(
                raw_line=cleaned[: self._max_line_length],
                matched=False,
                fields={"error": "line exceeded max_line_length"},
            )
        for rule in self._rules:
            if rule.multi_match:
                matches = list(rule.pattern.finditer(cleaned))
                if not matches:
                    continue
                self.stats.matched += 1
                return self._event_from_multi(rule, matches, cleaned)
            match = rule.pattern.search(cleaned)
            if match is None:
                continue
            self.stats.matched += 1
            return self._event_from_single(rule, match, cleaned)
        self.stats.unmatched += 1
        if self._on_unmatched == "skip":
            return None
        return ParsedEvent(raw_line=cleaned, matched=False)

    def parse_lines(self, lines: Iterable[str]) -> Iterator[ParsedEvent]:
        """Sync convenience generator over any iterable of lines."""
        for line in lines:
            event = self.feed_line(line)
            if event is not None:
                yield event

    async def stream(self, lines: AsyncIterable[str | bytes]) -> AsyncIterator[ParsedEvent]:
        """Async generator consuming raw or decoded lines without buffering."""
        async for line in lines:
            if isinstance(line, bytes):
                try:
                    line = line.decode("utf-8", errors="replace")
                except UnicodeError as exc:
                    self.stats.errors += 1
                    raise ParserError(f"undecodable chunk: {exc}") from exc
            event = self.feed_line(line)
            if event is not None:
                yield event

    def _event_from_single(
        self, rule: LogRule, match: re.Match[str], cleaned: str
    ) -> ParsedEvent:
        groups = {k: v for k, v in match.groupdict().items() if v is not None}
        severity = _infer_severity(groups)
        timestamp = groups.get("timestamp")
        fields = dict(groups)
        fields.pop("priority", None)
        fields.pop("timestamp", None)
        return ParsedEvent(
            raw_line=cleaned,
            source_rule=rule.name,
            severity=severity,
            timestamp=timestamp,
            fields=fields,
        )

    def _event_from_multi(
        self, rule: LogRule, matches: Sequence[re.Match[str]], cleaned: str
    ) -> ParsedEvent:
        fields: dict[str, str] = {}
        for match in matches:
            for key, value in match.groupdict().items():
                if value is not None and key != "key":
                    fields[match.group("key")] = value
                    break
        level = fields.get("level", "").lower()
        try:
            severity = Severity(level) if level else Severity.UNKNOWN
        except ValueError:
            severity = Severity.UNKNOWN
        return ParsedEvent(
            raw_line=cleaned,
            source_rule=rule.name,
            severity=severity,
            timestamp=None,
            fields=fields,
        )

    def snapshot(self) -> dict[str, int | float]:
        """Point-in-time copy of the counters."""
        return {
            "lines_in": self.stats.lines_in,
            "matched": self.stats.matched,
            "unmatched": self.stats.unmatched,
            "bytes_seen": self.stats.bytes_seen,
            "errors": self.stats.errors,
            "match_ratio": self.stats.match_ratio,
        }


def _clean_line(line: str) -> str:
    stripped = line.rstrip("\r\n").replace("\x00", "")
    return stripped[:MAX_LINE_LENGTH]


def _infer_severity(groups: dict[str, str]) -> Severity:
    if "priority" in groups:
        try:
            return Severity.from_syslog_priority(int(groups["priority"]))
        except ValueError:
            return Severity.UNKNOWN
    if "status" in groups:
        status = int(groups["status"])
        if status >= 500:
            return Severity.ERROR
        if status >= 400:
            return Severity.WARNING
        return Severity.INFO
    if "level" in groups:
        try:
            return Severity(groups["level"].lower())
        except ValueError:
            return Severity.UNKNOWN
    return Severity.UNKNOWN
