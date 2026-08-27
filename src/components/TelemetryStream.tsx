import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  Radio,
  Activity,
  Server,
  Zap,
  Clock,
  Layers,
  ArrowRight,
  Code,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from 'lucide-react';
import { TelemetryEvent } from '../types';

const TARGETS = ['scanme.nmap.org', 'api.internal', 'secops-gw', 'db-shard-1', 'auth-srv', 'redis-prod'];
const PORTS   = [22, 80, 443, 8080, 8443, 3306, 5432, 6379];

const getPortName = (p: number) => {
  const map: Record<number, string> = {
    22: 'SSH (Terminal Login)',
    80: 'HTTP (Normal Web)',
    443: 'HTTPS (Secure Web)',
    3306: 'MySQL (Database)',
    5432: 'PostgreSQL (Database)',
    6379: 'Redis (Cache / Memory)',
    8080: 'Web App Port',
    8443: 'Secure Web App',
  };
  return map[p] || `Door ${p}`;
};

const randItem = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const randNum  = (lo: number, hi: number) => Math.round((lo + Math.random() * (hi - lo)) * 10) / 10;

export const TelemetryStream: React.FC = () => {
  const [packets,  setPackets]  = useState<TelemetryEvent[]>([]);
  const [live,     setLive]     = useState(true);
  const [selected, setSelected] = useState<TelemetryEvent | null>(null);
  const [latHist,  setLatHist]  = useState<number[]>(
    Array.from({ length: 32 }, () => randNum(12, 42))
  );

  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => {
      const target  = randItem(TARGETS);
      const port    = randItem(PORTS);
      const lat     = randNum(8, 58);
      const isOpen  = Math.random() > 0.42;
      const ev: TelemetryEvent = {
        type: 'probe',
        scan_id: crypto.randomUUID?.() ?? `sid-${Date.now()}`,
        timestamp: new Date().toISOString(),
        data: { target, port, state: isOpen ? 'open' : 'closed', latency_ms: lat },
      };
      setPackets(p => [ev, ...p.slice(0, 149)]);
      setLatHist(h => [...h.slice(1), lat]);
    }, 900);
    return () => clearInterval(t);
  }, [live]);

  const avg = latHist.reduce((a, b) => a + b, 0) / latHist.length;
  const max = Math.max(...latHist);
  const min = Math.min(...latHist);

  // Compute port counts
  const portCounts: Record<number, number> = {};
  packets.forEach(p => {
    const pt = p.data?.port;
    if (pt) portCounts[pt] = (portCounts[pt] || 0) + 1;
  });

  return (
    <div className="flex flex-col w-full h-full p-4 lg:p-6 gap-4 bg-[var(--void)] overflow-y-auto">

      {/* ── TOP HEADER ── */}
      <div className="panel p-4 lg:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-white/[0.07] bg-[var(--obs-2)]">
        <div>
          <div className="flex items-center gap-2">
            <span className={`status-dot ${live ? 'dot-teal animate-ping-teal' : 'dot-slate'}`} style={{ width: 6, height: 6 }} />
            <h1 className="font-bold text-sm text-text-1">
              Live Network & Server Speed Monitor
            </h1>
          </div>
          <p className="text-xs text-text-3 mt-0.5">
            Real-time feed showing live server response times, connection tests, and active door traffic.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="chip chip-teal text-xs py-1 px-3">
            <span className="status-dot dot-teal" />
            <span>Live Stream Connected</span>
          </div>

          <button
            onClick={() => setLive(!live)}
            className={`btn h-8 px-3.5 text-xs font-semibold gap-1.5 ${live ? 'btn-ghost' : 'btn-primary'}`}
          >
            {live ? <><Pause size={13} /> Pause Stream</> : <><Play size={13} /> Resume Stream</>}
          </button>
        </div>
      </div>

      {/* ── 2-COLUMN TELEMETRY GRID ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-[500px]">

        {/* LEFT COLUMN: Latency & Port Distribution (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-3">

          {/* Response Speed Graph */}
          <div className="panel p-4 flex flex-col bg-[var(--obs-2)]">
            <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.06] mb-3">
              <span className="text-xs font-bold text-text-1 flex items-center gap-2">
                <Activity size={14} className="text-teal" />
                Server Response Speed (Latency)
              </span>
              <span className="text-xs text-teal font-semibold">
                Average: {avg.toFixed(1)} ms
              </span>
            </div>

            {/* Min / Avg / Peak stats */}
            <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
              <div className="p-2 rounded bg-[var(--obs-1)] border border-white/[0.03]">
                <div className="text-[10px] text-text-3">Fastest Response</div>
                <div className="text-sm font-bold text-teal font-mono">{min.toFixed(1)} ms</div>
              </div>
              <div className="p-2 rounded bg-[var(--obs-1)] border border-white/[0.03]">
                <div className="text-[10px] text-text-3">Average Speed</div>
                <div className="text-sm font-bold text-text-1 font-mono">{avg.toFixed(1)} ms</div>
              </div>
              <div className="p-2 rounded bg-[var(--obs-1)] border border-white/[0.03]">
                <div className="text-[10px] text-text-3">Slowest Peak</div>
                <div className="text-sm font-bold text-amber font-mono">{max.toFixed(1)} ms</div>
              </div>
            </div>

            {/* Bar Chart */}
            <div className="h-28 flex items-end gap-1.5 p-2 rounded bg-[var(--obs-1)] border border-white/[0.04] mb-2">
              {latHist.map((v, i) => {
                const pct = Math.max(10, (v / max) * 100);
                const isLatest = i === latHist.length - 1;
                return (
                  <div
                    key={i}
                    title={`${v} ms response time`}
                    style={{
                      flex: 1,
                      height: `${pct}%`,
                      borderRadius: '2px 2px 0 0',
                      background: isLatest ? 'var(--teal)' : `rgba(0,212,170,${0.25 + (i / latHist.length) * 0.55})`,
                      transition: 'height 0.25s ease',
                    }}
                  />
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] text-text-3">
              <span>← Past 32 checks</span>
              <span>Latest response →</span>
            </div>
          </div>

          {/* Active Door Distribution */}
          <div className="panel p-4 flex flex-col bg-[var(--obs-2)] flex-1">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.06] mb-3">
              <span className="text-xs font-bold text-text-1 flex items-center gap-2">
                <Server size={14} className="text-teal" />
                Active Server Doors (Traffic Share)
              </span>
              <span className="text-[10.5px] text-text-3">{packets.length} checks</span>
            </div>

            <div className="flex flex-col gap-2.5 text-xs">
              {PORTS.map(port => {
                const count = portCounts[port] || 0;
                const pct = packets.length ? (count / packets.length) * 100 : 0;
                return (
                  <div key={port} className="flex flex-col gap-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-text-1 font-medium">{getPortName(port)} (:{port})</span>
                      <span className="text-text-3">{count} checks ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-teal h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(2, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Realtime Packet Stream (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          <div className="panel p-4 flex flex-col bg-[var(--obs-2)] flex-1">
            <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.06] mb-3">
              <div className="flex items-center gap-2">
                <Radio size={14} className="text-teal" />
                <span className="text-xs font-bold text-text-1">Live Connection Probe Stream</span>
              </div>
              <span className="text-xs text-text-3">Click any row to inspect details</span>
            </div>

            {/* Packet Table Stream */}
            <div className="flex flex-col gap-1.5 flex-1 overflow-y-auto max-h-[440px] pr-1">
              {packets.map((p, i) => {
                const isOpen = p.data?.state === 'open';
                const isSelected = selected?.scan_id === p.scan_id && selected?.timestamp === p.timestamp;

                return (
                  <div
                    key={(p.scan_id || 'pkt') + i}
                    onClick={() => setSelected(p)}
                    className={`p-2 rounded text-xs flex items-center justify-between border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-teal/10 border-teal/40 text-text-1'
                        : isOpen
                        ? 'bg-teal/[0.03] border-white/[0.04] text-text-2 hover:border-teal/30'
                        : 'bg-[var(--obs-1)] border-white/[0.03] text-text-3 hover:border-white/15'
                    }`}
                  >
                    {/* Status icon and door */}
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`status-dot ${isOpen ? 'dot-teal' : 'dot-slate'}`} />
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${isOpen ? 'bg-teal/20 text-teal-soft' : 'bg-white/5 text-text-3'}`}>
                        {isOpen ? 'OPEN' : 'CLOSED'}
                      </span>
                      <span className="font-semibold text-text-1 truncate">{p.data?.target}</span>
                      <span className="text-text-3 text-[11px]">({getPortName(p.data?.port || 0)})</span>
                    </div>

                    <div className="flex items-center gap-3 text-xs shrink-0 font-mono">
                      <span className="text-teal-soft">{p.data?.latency_ms} ms</span>
                      <span className="text-[10px] text-text-3">{p.timestamp?.substring(11, 19)}</span>
                    </div>
                  </div>
                );
              })}

              {packets.length === 0 && (
                <div className="flex flex-col items-center justify-center p-12 text-center text-xs text-text-3">
                  <Activity size={24} className="mb-2 text-text-3/30" />
                  <span>Connecting to live server stream...</span>
                </div>
              )}
            </div>

            {/* Selected Frame Detail Inspector */}
            {selected && (
              <div className="mt-3 p-3 rounded border border-teal/30 bg-teal/[0.03] flex flex-col gap-1.5 text-xs">
                <div className="flex items-center justify-between border-b border-teal/20 pb-1">
                  <span className="font-bold text-text-1">Connection Details for {selected.data?.target}:{selected.data?.port}</span>
                  <button onClick={() => setSelected(null)} className="text-text-3 hover:text-text-1">
                    ✕
                  </button>
                </div>
                <div className="text-text-2 leading-relaxed">
                  <strong>Status: </strong>
                  {selected.data?.state === 'open' ? 'Door is open and responded to connection in ' + selected.data?.latency_ms + 'ms.' : 'Door is closed.'}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
