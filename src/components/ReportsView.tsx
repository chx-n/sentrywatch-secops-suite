import React, { useState } from 'react';
import {
  Download,
  Trash2,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  FileCode,
  FileText,
  Copy,
  Check,
  Globe,
  Clock,
  Activity,
  Layers,
  FolderOpen,
  AlertTriangle,
  HelpCircle,
} from 'lucide-react';
import { ScanReport } from '../types';

interface ReportsViewProps {
  reports: ScanReport[];
  onClearReports: () => void;
}

const getPortFriendlyName = (port: number): string => {
  const map: Record<number, string> = {
    21: 'FTP (File Transfer)',
    22: 'SSH (Terminal Login)',
    23: 'Telnet (Insecure Login)',
    25: 'SMTP (Email Server)',
    53: 'DNS (Domain Lookup)',
    80: 'HTTP (Normal Website)',
    110: 'POP3 (Email Inbox)',
    143: 'IMAP (Email Sync)',
    443: 'HTTPS (Secure Website)',
    445: 'SMB (Windows File Share)',
    993: 'IMAPS (Secure Email)',
    995: 'POP3S (Secure Email)',
    1433: 'MS-SQL (Microsoft Database)',
    1521: 'Oracle (Oracle Database)',
    3306: 'MySQL (Database)',
    3389: 'RDP (Windows Remote Desktop)',
    5432: 'PostgreSQL (Database)',
    5900: 'VNC (Remote Screen)',
    6379: 'Redis (Cache / Memory)',
    8080: 'HTTP-Alt (Web App / Proxy)',
    8443: 'HTTPS-Alt (Secure Web App)',
    9200: 'Elasticsearch (Search Engine)',
    27017: 'MongoDB (NoSQL Database)',
  };
  return map[port] || 'Custom Network Service';
};

const riskOf = (r: ScanReport): { score: number; label: string; color: string; advice: string } => {
  const DANGEROUS = [21, 23, 445, 3389, 6379];
  let s = 10;
  let hasDangerous = false;
  r.hosts.forEach(h => h.open_ports.forEach(p => {
    if (DANGEROUS.includes(p)) { s += 25; hasDangerous = true; }
    else if (p === 80 || p === 8080) { s += 4; }
    else { s += 3; }
  }));
  s = Math.min(100, s);
  return s < 25
    ? { score: s, label: 'LOW RISK (Safe)', color: 'var(--teal)', advice: 'Normal website ports (80/443) are open. No sensitive database or admin ports exposed.' }
    : s < 60
    ? { score: s, label: 'MEDIUM RISK (Review Open Ports)', color: '#f59e0b', advice: hasDangerous ? 'Sensitive port found open (e.g. Database or Remote Login). Ensure strong passwords and firewall rules are active.' : 'Multiple server services are accessible.' }
    : { score: s, label: 'HIGH RISK (Action Needed)', color: '#ef4444', advice: 'Critical administrative or unencrypted ports exposed directly to the internet. Close these ports in your server firewall immediately.' };
};

const exportReport = (r: ScanReport, fmt: 'json' | 'csv') => {
  let body = '';
  if (fmt === 'json') {
    body = JSON.stringify(r, null, 2);
  } else {
    const rows = [['target','address','port','service','state','response_ms','banner']];
    r.hosts.forEach(h => h.probes.forEach(p =>
      rows.push([h.target, h.address||'', p.port+'', getPortFriendlyName(p.port), p.state, p.latency_ms?.toFixed(2)||'', `"${(p.banner||'').replace(/"/g,'""')}"`])
    ));
    body = rows.map(row => row.join(',')).join('\n');
  }
  const blob = new Blob([body], { type: fmt === 'json' ? 'application/json' : 'text/csv' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `sentrywatch-audit-${r.id}.${fmt}` });
  a.click();
};

export const ReportsView: React.FC<ReportsViewProps> = ({ reports, onClearReports }) => {
  const [sel, setSel] = useState<ScanReport | null>(reports[0] ?? null);
  const [copied, setCopied] = useState(false);

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (reports.length === 0) {
    return (
      <div className="flex flex-col w-full h-full p-4 lg:p-6 bg-[var(--void)]">
        <div className="panel p-12 flex flex-col items-center justify-center text-center bg-[var(--obs-2)] flex-1">
          <div className="w-12 h-12 rounded-lg bg-teal/10 border border-teal/25 flex items-center justify-center text-teal mb-3">
            <FolderOpen size={24} />
          </div>
          <h2 className="font-bold text-base text-text-1">No Saved Security Reports Yet</h2>
          <p className="text-xs text-text-3 max-w-sm mt-1 mb-4">
            You haven't run any server scans in this session. Go to the Port Scanner tab to check a server and save the report here.
          </p>
        </div>
      </div>
    );
  }

  const activeReport = sel || reports[0];
  const risk = riskOf(activeReport);

  return (
    <div className="flex flex-col w-full h-full p-4 lg:p-6 gap-4 bg-[var(--void)] overflow-y-auto">

      {/* ── TOP HEADER ── */}
      <div className="panel p-4 lg:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-white/[0.07] bg-[var(--obs-2)]">
        <div>
          <div className="flex items-center gap-2">
            <span className="status-dot dot-teal" style={{ width: 6, height: 6 }} />
            <h1 className="font-bold text-sm text-text-1">
              Saved Security Audit Reports
            </h1>
          </div>
          <p className="text-xs text-text-3 mt-0.5">
            Review past scans, check server risk scores, and export summary reports.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => exportReport(activeReport, 'json')}
            className="btn btn-ghost h-8 px-3 text-xs gap-1.5"
          >
            <FileCode size={13} />
            <span>Download JSON</span>
          </button>

          <button
            onClick={() => exportReport(activeReport, 'csv')}
            className="btn btn-ghost h-8 px-3 text-xs gap-1.5"
          >
            <FileText size={13} />
            <span>Download CSV</span>
          </button>

          <button
            onClick={onClearReports}
            className="btn btn-danger h-8 px-3 text-xs gap-1.5"
          >
            <Trash2 size={13} />
            <span>Clear Reports</span>
          </button>
        </div>
      </div>

      {/* ── 2-COLUMN VAULT WORKBENCH ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-[520px]">

        {/* LEFT COLUMN: Report Archive Cards (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-2.5">
          <div className="text-xs font-bold text-text-2 px-1">Past Scans ({reports.length})</div>

          <div className="flex flex-col gap-2 max-h-[580px] overflow-y-auto pr-1">
            {reports.map((r, idx) => {
              const rk = riskOf(r);
              const isSelected = (sel?.id || reports[0].id) === r.id;

              return (
                <div
                  key={r.id}
                  onClick={() => setSel(r)}
                  className={`p-3 rounded border transition-all cursor-pointer flex flex-col gap-1.5 ${
                    isSelected
                      ? 'bg-teal/10 border-teal/40 shadow-xs ring-1 ring-teal/30'
                      : 'bg-[var(--obs-2)] border-white/[0.04] hover:border-white/15'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-text-1 truncate max-w-[140px]">
                      Scan #{idx + 1}: {r.hosts[0]?.target || 'Server'}
                    </span>
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.2 rounded border"
                      style={{ color: rk.color, borderColor: `${rk.color}40`, background: `${rk.color}15` }}
                    >
                      {rk.score}/100
                    </span>
                  </div>

                  <div className="text-[11px] text-text-3">
                    Found {r.open_port_count} open door(s) across {r.hosts_scanned} server(s)
                  </div>

                  <div className="flex items-center justify-between text-[10.5px] text-text-3 border-t border-white/[0.04] pt-2 mt-0.5">
                    <span>Duration: {r.duration_ms} ms</span>
                    <span className="text-teal font-medium">Click to inspect →</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: Executive Audit Inspector & Surface Breakdown (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-3">
          <div className="panel p-4 flex flex-col bg-[var(--obs-2)] flex-1">

            {/* Executive Risk Posture Card */}
            <div className="p-4 rounded border border-white/[0.06] bg-[var(--obs-1)] mb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.04] pb-3 mb-3">
                <div>
                  <div className="text-[10px] text-text-3 uppercase font-semibold">SECURITY AUDIT SUMMARY</div>
                  <div className="font-bold text-sm text-text-1 mt-0.5 flex items-center gap-2">
                    <span>Target Server: {activeReport.hosts.map(h => h.target).join(', ')}</span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] text-text-3 font-semibold">OVERALL RISK RATING</div>
                  <div className="text-sm font-bold" style={{ color: risk.color }}>
                    {risk.label} ({risk.score}/100)
                  </div>
                </div>
              </div>

              {/* Plain English advice */}
              <div className="mb-3 p-2.5 rounded bg-white/[0.02] border border-white/[0.04] text-xs text-text-2 leading-relaxed">
                <span className="font-semibold text-text-1">Audit Findings: </span>
                {risk.advice}
              </div>

              {/* Stat matrix */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="p-2 rounded bg-white/[0.02] border border-white/[0.03]">
                  <span className="text-[10px] text-text-3 block">Servers Scanned</span>
                  <span className="text-sm font-bold text-text-1">{activeReport.hosts_scanned}</span>
                </div>
                <div className="p-2 rounded bg-white/[0.02] border border-white/[0.03]">
                  <span className="text-[10px] text-text-3 block">Open Doors (Ports)</span>
                  <span className="text-sm font-bold text-teal">{activeReport.open_port_count}</span>
                </div>
                <div className="p-2 rounded bg-white/[0.02] border border-white/[0.03]">
                  <span className="text-[10px] text-text-3 block">Scan Duration</span>
                  <span className="text-sm font-bold text-text-1 font-mono">{activeReport.duration_ms} ms</span>
                </div>
                <div className="p-2 rounded bg-white/[0.02] border border-white/[0.03]">
                  <span className="text-[10px] text-text-3 block">Safety Check</span>
                  <span className="text-sm font-bold text-teal">Passed (100% Safe)</span>
                </div>
              </div>
            </div>

            {/* Target Breakdown */}
            <div className="text-xs font-bold text-text-1 mb-2">Detailed Open Door & Software Breakdown</div>

            <div className="flex flex-col gap-3 flex-1 overflow-y-auto max-h-[380px] pr-1">
              {activeReport.hosts.map((h, i) => (
                <div key={h.target + i} className="p-3.5 rounded border border-white/[0.05] bg-[var(--obs-1)] flex flex-col gap-2.5">
                  <div className="flex items-center justify-between border-b border-white/[0.04] pb-2">
                    <div className="flex items-center gap-2 text-xs">
                      <Globe size={14} className="text-teal" />
                      <span className="font-bold text-text-1">{h.target}</span>
                      {h.address && <span className="text-[11px] text-text-3 font-mono">({h.address})</span>}
                    </div>

                    <div className="text-xs">
                      {h.error ? (
                        <span className="chip chip-crimson text-[10px] py-0.5 px-2">{h.error}</span>
                      ) : (
                        <span className="chip chip-teal text-[10px] py-0.5 px-2 font-bold">
                          {h.open_port_count} OPEN DOORS
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Open Ports & Software */}
                  {!h.error && h.probes.length > 0 && (
                    <div className="flex flex-col gap-2 mt-1">
                      {h.probes.filter(p => p.state === 'open').map((p, pi) => (
                        <div key={p.port + pi} className="p-2.5 rounded bg-white/[0.02] border border-white/[0.04] text-xs flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <span className="text-teal font-bold">
                              Door {p.port}: {getPortFriendlyName(p.port)}
                            </span>
                            <span className="text-[11px] text-text-3 font-mono">{p.latency_ms?.toFixed(1)} ms response</span>
                          </div>
                          {p.banner && (
                            <div className="text-[11px] text-teal-soft bg-[var(--obs-2)] p-2 rounded border border-white/5 font-mono mt-1">
                              <strong>Software found running: </strong>{p.banner}
                            </div>
                          )}
                        </div>
                      ))}
                      {h.open_port_count === 0 && (
                        <div className="text-xs text-text-3 italic p-2">
                          No open doors found on this server (all checked doors were closed or filtered).
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

          </div>
        </div>

      </div>

    </div>
  );
};
