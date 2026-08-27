import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  Trash2,
  Download,
  Search,
  Terminal,
  Zap,
  HelpCircle,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { ParsedEvent, ParserStats, Severity } from '../types';
import { apiService } from '../services/api';

interface LogParserProps {
  onEventsUpdated?: (evts: ParsedEvent[]) => void;
}

const SEVERITIES: Array<{ id: Severity | 'all'; label: string }> = [
  { id: 'all', label: 'All Logs' },
  { id: 'critical', label: 'Critical' },
  { id: 'error', label: 'Errors' },
  { id: 'warning', label: 'Warnings' },
  { id: 'info', label: 'Info' },
];

const ATTACK_SAMPLES = [
  {
    label: 'SSH Brute Force',
    category: 'Authentication',
    log: '<154>Aug 26 23:45:00 sentry-node-01 sshd[4912]: Failed password for invalid user root from 198.51.100.42 port 44122 ssh2',
  },
  {
    label: 'SQL Injection',
    category: 'Web Exploit',
    log: '203.0.113.88 - admin [26/Aug/2026:23:45:01 +0000] "POST /api/v1/users?id=1%27%20OR%201=1-- HTTP/1.1" 403 240',
  },
  {
    label: 'Firewall SMB Block',
    category: 'Network',
    log: 'action="FIREWALL_DROP" src_ip="185.220.101.5" dst_ip="192.168.1.1" dst_port="445" proto="TCP" interface="eth0"',
  },
  {
    label: 'Nmap Port Scan Probe',
    category: 'Reconnaissance',
    log: 'event="SURICATA_ALERT" gid="1" sid="2010935" msg="ET SCAN Potential Nmap OS Detection Probe" src_ip="45.33.32.156" dst_ip="10.0.0.5"',
  },
];

const translateLogDetails = (raw: string, sev: string) => {
  const l = raw.toLowerCase();
  if (l.includes('failed password') || l.includes('auth-fail')) {
    return {
      title: 'Password Guessing (Brute Force Attack)',
      explanation: 'An attacker or automated bot is trying password guesses to gain unauthorized access via SSH.',
      recommendation: 'Block this IP address (198.51.100.42) and enforce SSH Key authentication.',
    };
  }
  if (l.includes('or 1=1') || l.includes('sqli') || l.includes('modsecurity')) {
    return {
      title: 'Database Exploit Attempt (SQL Injection)',
      explanation: 'Malicious database commands were entered into a web parameter to attempt unauthorized data extraction.',
      recommendation: 'Ensure all API inputs use parameterized SQL queries and WAF rules are enabled.',
    };
  }
  if (l.includes('firewall_drop')) {
    return {
      title: 'Firewall Blocked Connection',
      explanation: 'The server firewall intercepted and dropped an unsolicited connection attempt on port 445.',
      recommendation: 'No action required — firewall successfully blocked the probe.',
    };
  }
  if (l.includes('suricata_alert') || l.includes('nmap')) {
    return {
      title: 'Automated Network Scanner Detected',
      explanation: 'A remote system is scanning network ports looking for vulnerable exposed services.',
      recommendation: 'Monitor traffic from this source IP and rate-limit probe requests.',
    };
  }
  return {
    title: `Log Event [${sev.toUpperCase()}]`,
    explanation: 'A standard system log event was parsed and analyzed against detection rules.',
    recommendation: 'Review extracted token fields below.',
  };
};

export const LogParser: React.FC<LogParserProps> = ({ onEventsUpdated }) => {
  const [events, setEvents] = useState<ParsedEvent[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [speed, setSpeed] = useState(1400);
  const [filter, setFilter] = useState<Severity | 'all'>('all');
  const [query, setQuery] = useState('');
  const [input, setInput] = useState('');
  const [inputTab, setInputTab] = useState<'paste' | 'samples'>('paste');
  const [selected, setSelected] = useState<ParsedEvent | null>(null);
  const [stats, setStats] = useState<ParserStats>({
    lines_in: 0,
    matched: 0,
    unmatched: 0,
    bytes_seen: 0,
    errors: 0,
    match_ratio: 1,
  });

  const timerRef = useRef<number | null>(null);

  const recalc = (evts: ParsedEvent[]) => {
    const m = evts.filter(e => e.matched).length;
    setStats({
      lines_in: evts.length,
      matched: m,
      unmatched: evts.length - m,
      bytes_seen: evts.reduce((a, e) => a + e.raw_line.length, 0),
      errors: 0,
      match_ratio: evts.length ? m / evts.length : 1,
    });
  };

  useEffect(() => {
    if (!isSimulating) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const samples = apiService.getSampleLogs();
    timerRef.current = window.setInterval(() => {
      const raw = samples[Math.floor(Math.random() * samples.length)];
      const parsed = apiService.parseLine(raw);
      parsed.is_simulated = true;

      setEvents(prev => {
        const next = [parsed, ...prev.slice(0, 199)];
        recalc(next);
        onEventsUpdated?.(next);
        return next;
      });
    }, speed);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isSimulating, speed]);

  const toggleSimulation = () => {
    if (!isSimulating) {
      if (events.length === 0) {
        const initial = apiService.getSampleLogs().map(l => {
          const p = apiService.parseLine(l);
          p.is_simulated = true;
          return p;
        });
        setEvents(initial);
        recalc(initial);
        setSelected(initial[0]);
        onEventsUpdated?.(initial);
      }
      setIsSimulating(true);
    } else {
      setIsSimulating(false);
    }
  };

  const handleIngest = () => {
    if (!input.trim()) return;
    const lines = input.split('\n').map(l => l.trim()).filter(Boolean);
    const parsed = lines.map(l => {
      const ev = apiService.parseLine(l);
      ev.is_simulated = false;
      return ev;
    });

    setEvents(prev => {
      const next = [...parsed, ...prev];
      recalc(next);
      onEventsUpdated?.(next);
      return next;
    });

    if (parsed.length > 0) {
      setSelected(parsed[0]);
    }
    setInput('');
  };

  const injectSample = (rawLog: string) => {
    const parsed = apiService.parseLine(rawLog);
    parsed.is_simulated = true;
    setEvents(prev => {
      const next = [parsed, ...prev];
      recalc(next);
      onEventsUpdated?.(next);
      return next;
    });
    setSelected(parsed);
  };

  const handleClear = () => {
    setIsSimulating(false);
    setEvents([]);
    recalc([]);
    setSelected(null);
    onEventsUpdated?.([]);
  };

  const clearSimulatedOnly = () => {
    setIsSimulating(false);
    setEvents(prev => {
      const realOnly = prev.filter(e => !e.is_simulated);
      recalc(realOnly);
      onEventsUpdated?.(realOnly);
      if (selected?.is_simulated) {
        setSelected(realOnly[0] || null);
      }
      return realOnly;
    });
  };

  const exportEvts = () => {
    const b = new Blob([JSON.stringify(visible, null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(b),
      download: `sentrywatch-logs-${Date.now()}.json`,
    });
    a.click();
  };

  const visible = events.filter(e => {
    const ok = filter === 'all' || e.severity === filter;
    const q =
      !query ||
      e.raw_line.toLowerCase().includes(query.toLowerCase()) ||
      Object.entries(e.fields).some(([k, v]) => (k + v).toLowerCase().includes(query.toLowerCase()));
    return ok && q;
  });

  const selectedInfo = selected ? translateLogDetails(selected.raw_line, selected.severity) : null;
  const simulatedCount = events.filter(e => e.is_simulated).length;
  const realCount = events.filter(e => !e.is_simulated).length;

  return (
    <div className="flex flex-col w-full h-full p-4 lg:p-6 gap-4 bg-[#0A0A0A] text-[#E8E6E3] overflow-y-auto">

      {/* ── TOP HEADER ── */}
      <div className="p-4 lg:px-5 flex flex-col md:flex-row md:items-center justify-between gap-3 border border-[#1E1E1E] bg-[#111111] rounded-lg">
        <div>
          <div className="flex items-center gap-2.5">
            <span
              className={`w-2 h-2 rounded-full ${isSimulating ? 'bg-[#C4963A]' : realCount > 0 ? 'bg-[#6B8F71]' : 'bg-[#3A3A3A]'}`}
            />
            <h1 className="font-semibold text-sm text-[#E8E6E3] flex items-center gap-2">
              Security Log & Threat Analyzer
              {isSimulating ? (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#C4963A]/10 text-[#D4A64A] border border-[#C4963A]/20 uppercase font-semibold">
                  SIMULATION ACTIVE
                </span>
              ) : (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1A1A1A] text-[#5A5A5A] border border-[#1E1E1E] uppercase">
                  READY
                </span>
              )}
            </h1>
          </div>
          <p className="text-xs text-[#8A8A8A] mt-0.5">
            Analyzes Syslog, Nginx, Apache, and Firewall streams to extract attacker IPs, match threat signatures, and recommend remediation steps.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={toggleSimulation}
            className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-all ${
              isSimulating
                ? 'bg-[#C4963A]/15 text-[#D4A64A] border border-[#C4963A]/30 hover:bg-[#C4963A]/25'
                : 'bg-[#6B8F71] text-[#0A0A0A] hover:bg-[#7DA385]'
            }`}
          >
            {isSimulating ? (
              <>
                <Pause size={12} />
                <span>Stop Simulation</span>
              </>
            ) : (
              <>
                <Play size={12} />
                <span>Start Simulation (Demo)</span>
              </>
            )}
          </button>

          {isSimulating && (
            <div className="flex items-center gap-1 bg-[#141414] px-2 py-1 rounded border border-[#1E1E1E] text-xs">
              <span className="text-[#5A5A5A] text-[11px]">Speed:</span>
              {[
                { label: 'Slow', ms: 2400 },
                { label: 'Normal', ms: 1400 },
                { label: 'Fast', ms: 600 },
              ].map(s => (
                <button
                  key={s.label}
                  onClick={() => setSpeed(s.ms)}
                  className={`px-1.5 py-0.5 rounded text-[11px] ${
                    speed === s.ms ? 'bg-[#6B8F71] text-[#0A0A0A] font-semibold' : 'text-[#5A5A5A] hover:text-[#8A8A8A]'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {events.length > 0 && (
            <button
              onClick={handleClear}
              className="px-2.5 py-1 text-xs rounded bg-[#141414] border border-[#1E1E1E] text-[#5A5A5A] hover:text-[#C45C5C] flex items-center gap-1"
            >
              <Trash2 size={13} />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}

          <button
            onClick={exportEvts}
            disabled={events.length === 0}
            className="px-2.5 py-1 text-xs rounded bg-[#141414] border border-[#1E1E1E] text-[#8A8A8A] hover:text-[#E8E6E3] flex items-center gap-1 disabled:opacity-40"
          >
            <Download size={13} />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* ── SIMULATION BANNER ── */}
      {isSimulating && (
        <div className="p-3 rounded bg-[#C4963A]/8 border border-[#C4963A]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2.5 text-[#D4A64A]">
            <AlertTriangle size={15} className="shrink-0" />
            <div>
              <span className="font-semibold text-[#D4A64A] mr-1.5 uppercase tracking-wider text-[11px]">
                Demo Mode Active:
              </span>
              <span className="text-[#A89060]">
                Streaming synthetic attack scenarios. Click <strong>Stop Simulation</strong> anytime to paste real server logs.
              </span>
            </div>
          </div>
          <button
            onClick={() => setIsSimulating(false)}
            className="px-2.5 py-1 rounded bg-[#C4963A]/15 text-[#D4A64A] hover:bg-[#C4963A]/25 font-semibold text-[11px] self-end sm:self-auto shrink-0 cursor-pointer"
          >
            Stop Demo
          </button>
        </div>
      )}

      {/* ── METRIC STATS RIBBON ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
        {[
          { label: 'TOTAL LOGS', value: stats.lines_in, sub: `${realCount} real · ${simulatedCount} demo` },
          { label: 'MATCHED THREATS', value: stats.matched, sub: 'Recognized signatures', highlight: true },
          { label: 'BUFFER MEMORY', value: `${(stats.bytes_seen / 1024).toFixed(1)} KB`, sub: 'Active memory usage' },
          { label: 'DETECTION RULES', value: '4 Rules Active', sub: 'SSH, SQLi, Firewall, Scans' },
          { label: 'RECOGNITION RATE', value: `${(stats.match_ratio * 100).toFixed(0)}%`, sub: 'Schema match score' },
        ].map(s => (
          <div key={s.label} className="p-3 bg-[#111111] border border-[#1E1E1E] rounded-lg">
            <div className="text-[10px] font-semibold text-[#5A5A5A] mb-0.5">{s.label}</div>
            <div
              className={`text-lg font-bold ${s.highlight ? 'text-[#6B8F71]' : 'text-[#E8E6E3]'}`}
            >
              {s.value}
            </div>
            <div className="text-[10px] text-[#5A5A5A]">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ── 2-COLUMN WORKSPACE ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-[500px]">

        {/* LEFT PANE: Log Waterfall (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          <div className="p-4 flex flex-col bg-[#111111] border border-[#1E1E1E] rounded-lg flex-1">

            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-[#1E1E1E] mb-3">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5A5A5A]" />
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Filter logs by IP, attack type, or message..."
                  className="w-full h-8 text-xs pl-7 pr-3 bg-[#0D0D0D] border border-[#1E1E1E] rounded text-[#E8E6E3] placeholder-[#5A5A5A] focus:border-[#6B8F71]/40 focus:outline-none"
                />
              </div>

              {/* Severity filter buttons */}
              <div className="flex items-center gap-1 bg-[#0D0D0D] p-0.5 rounded border border-[#1A1A1A] overflow-x-auto">
                {SEVERITIES.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setFilter(s.id)}
                    className={`text-[11px] px-2 py-0.5 rounded transition-all cursor-pointer font-medium ${
                      filter === s.id
                        ? 'bg-[#6B8F71] text-[#0A0A0A] font-semibold'
                        : 'text-[#5A5A5A] hover:text-[#8A8A8A]'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Log Waterfall List */}
            <div className="flex flex-col gap-2 flex-1 overflow-y-auto max-h-[480px] pr-1">
              {visible.map((evt, i) => {
                const isSelected = selected?.id === evt.id || (selected?.raw_line === evt.raw_line && selected?.timestamp === evt.timestamp);
                const isCrit = evt.severity === 'critical' || evt.severity === 'emergency' || evt.severity === 'alert';
                const isWarn = evt.severity === 'warning' || evt.severity === 'error';
                const details = translateLogDetails(evt.raw_line, evt.severity);

                return (
                  <div
                    key={evt.id || `${evt.raw_line}-${i}`}
                    onClick={() => setSelected(evt)}
                    className={`p-2.5 rounded text-xs flex flex-col gap-1 border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#6B8F71]/10 border-[#6B8F71]/40 text-[#E8E6E3]'
                        : isCrit
                        ? 'bg-[#C45C5C]/5 border-[#C45C5C]/20 text-[#8A8A8A] hover:border-[#C45C5C]/40'
                        : isWarn
                        ? 'bg-[#C4963A]/5 border-[#C4963A]/20 text-[#8A8A8A] hover:border-[#C4963A]/40'
                        : 'bg-[#0D0D0D] border-[#1A1A1A] text-[#8A8A8A] hover:border-[#222222]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                            isCrit
                              ? 'bg-[#C45C5C]/20 text-[#D47070]'
                              : isWarn
                              ? 'bg-[#C4963A]/20 text-[#D4A64A]'
                              : 'bg-[#1E1E1E] text-[#8A8A8A]'
                          }`}
                        >
                          {evt.severity.toUpperCase()}
                        </span>

                        {evt.is_simulated ? (
                          <span className="text-[9px] px-1.5 py-0.2 rounded font-mono bg-[#C4963A]/10 text-[#D4A64A] border border-[#C4963A]/20 uppercase">
                            DEMO
                          </span>
                        ) : (
                          <span className="text-[9px] px-1.5 py-0.2 rounded font-mono bg-[#6B8F71]/10 text-[#7DA385] border border-[#6B8F71]/20 uppercase font-semibold">
                            REAL
                          </span>
                        )}

                        <span className="font-semibold text-[#E8E6E3] text-xs">
                          {details.title}
                        </span>
                      </div>

                      <span className="text-[10.5px] text-[#5A5A5A] font-mono shrink-0">
                        {evt.timestamp ? new Date(evt.timestamp).toLocaleTimeString() : 'Live'}
                      </span>
                    </div>

                    <p className="text-[11px] text-[#5A5A5A] leading-relaxed">
                      {details.explanation}
                    </p>

                    <div className="text-[10px] text-[#5A5A5A] font-mono bg-[#080808] p-1.5 rounded truncate mt-0.5 border border-[#141414]">
                      {evt.raw_line}
                    </div>
                  </div>
                );
              })}

              {events.length === 0 && (
                <div className="flex flex-col items-center justify-center p-10 text-center text-xs text-[#5A5A5A] gap-3 my-auto border border-dashed border-[#1E1E1E] rounded-lg bg-[#0D0D0D]">
                  <div className="w-10 h-10 rounded-full bg-[#1A1A1A] flex items-center justify-center text-[#8A8A8A]">
                    <Terminal size={18} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#E8E6E3] text-sm mb-1">
                      Log Stream Ready
                    </h3>
                    <p className="text-[#5A5A5A] max-w-md text-xs leading-relaxed">
                      Paste real server logs on the right, or launch the attack simulator to test detection rules.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={toggleSimulation}
                      className="px-3 py-1.5 rounded text-xs bg-[#6B8F71] text-[#0A0A0A] font-semibold flex items-center gap-1.5"
                    >
                      <Play size={12} />
                      <span>Start Simulation (Demo)</span>
                    </button>
                    <button
                      onClick={() => injectSample(ATTACK_SAMPLES[0].log)}
                      className="px-3 py-1.5 rounded text-xs bg-[#141414] border border-[#1E1E1E] text-[#8A8A8A] hover:text-[#E8E6E3] flex items-center gap-1.5"
                    >
                      <Zap size={12} className="text-[#6B8F71]" />
                      <span>Inject 1 Test Log</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {events.length > 0 && (
              <div className="mt-3 pt-2 border-t border-[#1E1E1E] flex items-center justify-between text-xs text-[#5A5A5A]">
                <span>
                  Showing {visible.length} of {events.length} logs ({realCount} real, {simulatedCount} demo)
                </span>
                {simulatedCount > 0 && (
                  <button
                    onClick={clearSimulatedOnly}
                    className="text-[#D4A64A] hover:underline text-[11px] cursor-pointer"
                  >
                    Clear demo logs
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANE: Insight Deck & Ingestion (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-3">

          {/* 1. Security Insight & Advice */}
          <div className="p-4 flex flex-col bg-[#111111] border border-[#1E1E1E] rounded-lg">
            <div className="flex items-center justify-between pb-2.5 border-b border-[#1E1E1E] mb-3">
              <span className="text-xs font-semibold text-[#E8E6E3] flex items-center gap-2">
                <HelpCircle size={14} className="text-[#6B8F71]" />
                Security Insight & Advice
              </span>
              {selected && (
                <div className="flex items-center gap-1">
                  <span
                    className={`text-[9.5px] font-bold px-2 py-0.5 rounded uppercase ${
                      selected.severity === 'critical' ? 'bg-[#C45C5C]/20 text-[#D47070]' : 'bg-[#6B8F71]/20 text-[#7DA385]'
                    }`}
                  >
                    {selected.severity.toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            {selected && selectedInfo ? (
              <div className="flex flex-col gap-3 text-xs">
                <div>
                  <div className="text-xs font-semibold text-[#E8E6E3] mb-1">{selectedInfo.title}</div>
                  <p className="text-[11.5px] text-[#8A8A8A] leading-relaxed bg-[#0D0D0D] p-2.5 rounded border border-[#1E1E1E]">
                    {selectedInfo.explanation}
                  </p>
                </div>

                <div>
                  <div className="text-[11px] font-semibold text-[#7DA385] mb-1">Recommended Action:</div>
                  <p className="text-[11px] text-[#8A8A8A] bg-[#6B8F71]/5 p-2.5 rounded border border-[#6B8F71]/20 leading-relaxed">
                    {selectedInfo.recommendation}
                  </p>
                </div>

                {/* Extracted tokens */}
                <div>
                  <div className="text-[10.5px] font-semibold text-[#5A5A5A] mb-1 uppercase">
                    Extracted Fields:
                  </div>
                  <div className="flex flex-col gap-1 max-h-[130px] overflow-y-auto pr-1">
                    {Object.entries(selected.fields).map(([k, v]) => (
                      <div
                        key={k}
                        className="p-1.5 rounded bg-[#0D0D0D] border border-[#1A1A1A] flex justify-between text-xs font-mono"
                      >
                        <span className="text-[#7DA385] font-medium">{k}:</span>
                        <span className="text-[#8A8A8A] truncate max-w-[190px]">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-[#5A5A5A]">
                Select any log event on the left to view parsed fields, root-cause explanation, and actionable remediation steps.
              </div>
            )}
          </div>

          {/* 2. Ingestion & Test Bed Workspace */}
          <div className="p-4 flex flex-col bg-[#111111] border border-[#1E1E1E] rounded-lg flex-1">
            <div className="flex items-center justify-between pb-2 border-b border-[#1E1E1E] mb-3">
              <div className="flex items-center gap-1 bg-[#0D0D0D] p-0.5 rounded border border-[#1A1A1A]">
                <button
                  onClick={() => setInputTab('paste')}
                  className={`text-[11px] px-2.5 py-1 rounded transition-all cursor-pointer font-medium flex items-center gap-1.5 ${
                    inputTab === 'paste'
                      ? 'bg-[#6B8F71] text-[#0A0A0A] font-semibold'
                      : 'text-[#5A5A5A] hover:text-[#8A8A8A]'
                  }`}
                >
                  <FileText size={12} />
                  <span>Paste Real Logs</span>
                </button>
                <button
                  onClick={() => setInputTab('samples')}
                  className={`text-[11px] px-2.5 py-1 rounded transition-all cursor-pointer font-medium flex items-center gap-1.5 ${
                    inputTab === 'samples'
                      ? 'bg-[#6B8F71] text-[#0A0A0A] font-semibold'
                      : 'text-[#5A5A5A] hover:text-[#8A8A8A]'
                  }`}
                >
                  <Zap size={12} />
                  <span>Test Samples</span>
                </button>
              </div>

              <span className="text-[10px] text-[#5A5A5A] uppercase font-mono">
                {inputTab === 'paste' ? 'Ingest' : 'Test Bed'}
              </span>
            </div>

            {inputTab === 'paste' ? (
              <div className="flex flex-col gap-2">
                <p className="text-[11px] text-[#5A5A5A]">
                  Paste raw lines from Linux Syslog, Apache/Nginx, or firewall logs:
                </p>
                <textarea
                  rows={4}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder={`<154>Aug 26 23:45:00 myhost sshd[123]: Failed password for root from 198.51.100.42\n192.0.2.1 - - [10/Oct/2026:13:55:36 +0000] "GET /admin HTTP/1.1" 403 240`}
                  className="w-full text-xs leading-relaxed bg-[#0D0D0D] border border-[#1E1E1E] rounded p-2.5 text-[#E8E6E3] resize-none font-mono focus:border-[#6B8F71]/40 focus:outline-none"
                />
                <div className="flex justify-between items-center mt-1">
                  <span className="text-[10.5px] text-[#5A5A5A]">Multi-line batch ingestion supported</span>
                  <button
                    onClick={handleIngest}
                    disabled={!input.trim()}
                    className="px-3.5 py-1.5 rounded text-xs font-semibold bg-[#6B8F71] text-[#0A0A0A] hover:bg-[#7DA385] disabled:opacity-40"
                  >
                    Ingest & Analyze
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-[11px] text-[#5A5A5A]">
                  Click any scenario below to inject a single test event into the analyzer:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ATTACK_SAMPLES.map(s => (
                    <button
                      key={s.label}
                      onClick={() => injectSample(s.log)}
                      className="p-2.5 rounded bg-[#0D0D0D] border border-[#1A1A1A] text-left hover:border-[#6B8F71]/40 transition-all cursor-pointer flex flex-col gap-0.5 group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[#E8E6E3] text-xs group-hover:text-[#7DA385] transition-colors">
                          {s.label}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#141414] text-[#5A5A5A] uppercase">
                          {s.category}
                        </span>
                      </div>
                      <span className="text-[10px] text-[#5A5A5A] font-mono truncate">
                        {s.log}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
};
