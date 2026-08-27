"""Unit tests for the streaming regex log parser."""

from __future__ import annotations

import pytest

from core.parser import (
    APACHE_CLF_RULE,
    KEY_VALUE_RULE,
    SYSLOG_RULE,
    LogRule,
    ParsedEvent,
    Severity,
    StreamingParser,
)


class TestStreamingParser:
    """Test suite for log parsing rules and stream ingestion."""

    def test_parse_syslog_line(self) -> None:
        parser = StreamingParser([SYSLOG_RULE])
        raw = "<34>Oct 11 22:14:15 myhost sshd[12345]: Failed password for root from 192.0.2.1 port 22 ssh2"
        event = parser.feed_line(raw)

        assert event is not None
        assert event.source_rule == "syslog"
        assert event.fields["host"] == "myhost"
        assert event.fields["process"] == "sshd"
        assert event.fields["pid"] == "12345"
        assert "Failed password" in event.fields["message"]
        assert parser.stats.matched == 1

    def test_parse_apache_clf_line(self) -> None:
        parser = StreamingParser([APACHE_CLF_RULE])
        raw = '198.51.100.4 - frank [10/Oct/2000:13:55:36 -0700] "GET /admin HTTP/1.1" 403 2326'
        event = parser.feed_line(raw)

        assert event is not None
        assert event.source_rule == "apache_clf"
        assert event.fields["remote_addr"] == "198.51.100.4"
        assert event.fields["method"] == "GET"
        assert event.fields["path"] == "/admin"
        assert event.fields["status"] == "403"
        assert event.fields["bytes_sent"] == "2326"

    def test_parse_key_value_line(self) -> None:
        parser = StreamingParser([KEY_VALUE_RULE])
        raw = 'src_ip=192.0.2.5 dst_port=443 action="BLOCK" reason=\'SSRF detected\''
        event = parser.feed_line(raw)

        assert event is not None
        assert event.source_rule == "key_value"
        assert event.fields["src_ip"] == "192.0.2.5"
        assert event.fields["dst_port"] == "443"
        assert event.fields["action"] == "BLOCK"
        assert event.fields["reason"] == "SSRF detected"

    def test_unmatched_policy_event(self) -> None:
        parser = StreamingParser([SYSLOG_RULE], on_unmatched="event")
        raw = "Random unstructured noise"
        event = parser.feed_line(raw)

        assert event is not None
        assert event.matched is False
        assert event.source_rule is None
        assert parser.stats.unmatched == 1

    def test_unmatched_policy_skip(self) -> None:
        parser = StreamingParser([SYSLOG_RULE], on_unmatched="skip")
        raw = "Random unstructured noise"
        event = parser.feed_line(raw)

        assert event is None
        assert parser.stats.unmatched == 1

    def test_batch_parse_lines(self) -> None:
        parser = StreamingParser()
        lines = [
            "<34>Oct 11 22:14:15 host1 su[10]: Successful su",
            '192.0.2.1 - - [10/Oct/2000:13:55:36 -0700] "GET / HTTP/1.0" 200 100',
            "user=alice role=admin",
        ]
        events = list(parser.parse_lines(lines))
        assert len(events) == 3
        assert parser.stats.lines_in == 3
        assert parser.stats.matched == 3
        assert parser.stats.match_ratio == 1.0

    @pytest.mark.asyncio
    async def test_async_stream_parsing(self) -> None:
        parser = StreamingParser()

        async def line_gen():
            yield "<13>Jan 1 00:00:00 server kernel: firewall drop"
            yield b"src_ip=10.0.0.1 status=alert"

        results: list[ParsedEvent] = []
        async for event in parser.stream(line_gen()):
            results.append(event)

        assert len(results) == 2
        assert parser.stats.matched == 2
