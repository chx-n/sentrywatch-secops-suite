import React, { useState } from 'react';
import { 
  Bell, 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle2, 
  Filter, 
  Search, 
  Trash2, 
  Download, 
  ExternalLink,
  Shield,
  Radio,
  Check
} from 'lucide-react';

export interface SecurityAlert {
  id: string;
  timestamp: string;
  timeAgo: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  sourceApp: string;
  sourceIp: string;
  targetPort: number;
  country: string;
  countryCode: string;
  status: 'active' | 'acknowledged' | 'blocked';
  ruleMatched: string;
}

const INITIAL_ALERTS: SecurityAlert[] = [
  {
    id: 'alt-101',
    timestamp: '2026-08-28T02:14:22Z',
    timeAgo: '4 min ago',
    severity: 'critical',
    title: 'Repeated SSH Password Spray Attack',
    description: '14 consecutive failed authentication attempts detected for user "root" from untrusted external IP.',
    sourceApp: 'Language Server Windows X64',
    sourceIp: '198.51.100.42',
    targetPort: 22,
    country: 'US',
    countryCode: '🇺🇸',
    status: 'active',
    ruleMatched: 'AUTH_BRUTE_FORCE_01'
  },
  {
    id: 'alt-102',
    timestamp: '2026-08-28T02:10:05Z',
    timeAgo: '8 min ago',
    severity: 'warning',
    title: 'SQL Injection Payload in Web Query',
    description: 'Incoming HTTP POST parameter contained SQL escape characters (1%27%20OR%201=1--). Dropped by filter.',
    sourceApp: 'Antigravity IDE',
    sourceIp: '203.0.113.88',
    targetPort: 443,
    country: 'DE',
    countryCode: '🇩🇪',
    status: 'active',
    ruleMatched: 'WAF_SQLI_RULESET'
  },
  {
    id: 'alt-103',
    timestamp: '2026-08-28T02:05:12Z',
    timeAgo: '13 min ago',
    severity: 'warning',
    title: 'SMB Probe Intercepted on Port 445',
    description: 'Remote host attempted uninvited TCP connection on Windows file sharing port. Dropped by firewall.',
    sourceApp: 'Windows Service: Appinfo',
    sourceIp: '185.220.101.5',
    targetPort: 445,
    country: 'NL',
    countryCode: '🇳🇱',
    status: 'blocked',
    ruleMatched: 'FIREWALL_DROP_SMB'
  },
  {
    id: 'alt-104',
    timestamp: '2026-08-28T01:58:30Z',
    timeAgo: '20 min ago',
    severity: 'info',
    title: 'OISD Threat Filter List Synchronized',
    description: 'SecOps intelligence engine completed periodic background hash verification (248,190 rules active).',
    sourceApp: 'SentryWatch Core Daemon',
    sourceIp: '127.0.0.1',
    targetPort: 8000,
    country: 'LOCAL',
    countryCode: '🛡️',
    status: 'acknowledged',
    ruleMatched: 'INTEL_FEED_UPDATE'
  },
  {
    id: 'alt-105',
    timestamp: '2026-08-28T01:45:00Z',
    timeAgo: '33 min ago',
    severity: 'warning',
    title: 'Nmap TCP SYN Port Sweep Detected',
    description: 'Rapid sequential probing of ports 21, 22, 80, 443, 8080 detected within 250ms window.',
    sourceApp: 'Node.js Runtime',
    sourceIp: '45.33.32.156',
    targetPort: 8080,
    country: 'US',
    countryCode: '🇺🇸',
    status: 'blocked',
    ruleMatched: 'RECON_SCAN_SWEEP'
  }
];

interface AlertsViewProps {
  onNavigateToLogs?: () => void;
  onNavigateToApps?: () => void;
}

export const AlertsView: React.FC<AlertsViewProps> = ({
  onNavigateToLogs,
  onNavigateToApps,
}) => {
  const [alerts, setAlerts] = useState<SecurityAlert[]>(INITIAL_ALERTS);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'blocked'>('all');
  const [selectedAlert, setSelectedAlert] = useState<SecurityAlert | null>(null);

  const activeCount = alerts.filter(a => a.status === 'active').length;
  const criticalCount = alerts.filter(a => a.severity === 'critical').length;

  const handleAcknowledgeAll = () => {
    setAlerts(alerts.map(a => ({ ...a, status: 'acknowledged' })));
  };

  const handleBlockIp = (id: string) => {
    setAlerts(alerts.map(a => a.id === id ? { ...a, status: 'blocked' } : a));
  };

  const handleDismiss = (id: string) => {
    setAlerts(alerts.filter(a => a.id !== id));
    if (selectedAlert?.id === id) setSelectedAlert(null);
  };

  const exportAlerts = () => {
    const b = new Blob([JSON.stringify(alerts, null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(b),
      download: `sentrywatch-alerts-${Date.now()}.json`
    });
    a.click();
  };

  const filteredAlerts = alerts.filter(a => {
    const matchSev = severityFilter === 'all' || a.severity === severityFilter;
    const matchStatus = statusFilter === 'all' || a.status === statusFilter;
    const matchQuery = !search || 
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.sourceIp.toLowerCase().includes(search.toLowerCase()) ||
      a.sourceApp.toLowerCase().includes(search.toLowerCase()) ||
      a.ruleMatched.toLowerCase().includes(search.toLowerCase());
    return matchSev && matchStatus && matchQuery;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0A0A0A] text-[#E8E6E3] overflow-hidden select-none font-sans">
      
      {/* ── TOP TITLE & ACTION BAR ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E1E1E] bg-[#0D0D0D]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#141414] border border-[#1E1E1E] flex items-center justify-center">
            <Bell size={16} className="text-[#C4963A]" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-[#E8E6E3] flex items-center gap-2">
              Security Alerts & Incidents
              {activeCount > 0 && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#C4963A]/10 text-[#D4A64A] border border-[#C4963A]/20 uppercase font-semibold">
                  {activeCount} Unresolved
                </span>
              )}
            </h1>
            <p className="text-[11px] text-[#5A5A5A]">Real-time threat telemetry, unauthorized connection drops, and rule triggers.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <button
              onClick={handleAcknowledgeAll}
              className="px-3 py-1.5 text-xs rounded bg-[#141414] border border-[#1E1E1E] text-[#8A8A8A] hover:text-[#E8E6E3] hover:bg-[#1A1A1A] flex items-center gap-1.5 transition-colors"
            >
              <Check size={13} />
              <span>Acknowledge All</span>
            </button>
          )}

          <button
            onClick={exportAlerts}
            className="px-3 py-1.5 text-xs rounded bg-[#141414] border border-[#1E1E1E] text-[#8A8A8A] hover:text-[#E8E6E3] hover:bg-[#1A1A1A] flex items-center gap-1.5 transition-colors"
          >
            <Download size={13} />
            <span>Export Incident Log</span>
          </button>
        </div>
      </div>

      {/* ── STATS STRIP ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-6 pb-3">
        <div className="p-3 rounded-lg bg-[#111111] border border-[#1E1E1E]">
          <span className="text-[10px] uppercase font-mono text-[#5A5A5A] block mb-1">TOTAL INCIDENTS</span>
          <span className="text-lg font-bold text-[#E8E6E3]">{alerts.length}</span>
        </div>
        <div className="p-3 rounded-lg bg-[#111111] border border-[#1E1E1E]">
          <span className="text-[10px] uppercase font-mono text-[#5A5A5A] block mb-1">CRITICAL ATTACKS</span>
          <span className="text-lg font-bold text-[#C45C5C]">{criticalCount}</span>
        </div>
        <div className="p-3 rounded-lg bg-[#111111] border border-[#1E1E1E]">
          <span className="text-[10px] uppercase font-mono text-[#5A5A5A] block mb-1">BLOCKED THREATS</span>
          <span className="text-lg font-bold text-[#6B8F71]">{alerts.filter(a => a.status === 'blocked').length}</span>
        </div>
        <div className="p-3 rounded-lg bg-[#111111] border border-[#1E1E1E]">
          <span className="text-[10px] uppercase font-mono text-[#5A5A5A] block mb-1">THREAT POSTURE</span>
          <span className="text-xs font-semibold text-[#D4A64A] flex items-center gap-1.5 mt-1">
            <span className="w-2 h-2 rounded-full bg-[#C4963A]" />
            <span>Elevated Monitoring</span>
          </span>
        </div>
      </div>

      {/* ── FILTER CONTROLS ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 pb-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5A5A]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by IP, application, signature rule..."
            className="w-full h-8 pl-8 pr-3 text-xs bg-[#111111] border border-[#1E1E1E] rounded text-[#E8E6E3] placeholder-[#5A5A5A] focus:border-[#6B8F71]/40 focus:outline-none"
          />
        </div>

        {/* Severity Pills */}
        <div className="flex items-center gap-1 bg-[#111111] p-0.5 rounded border border-[#1E1E1E] overflow-x-auto">
          {(['all', 'critical', 'warning', 'info'] as const).map(sev => (
            <button
              key={sev}
              onClick={() => setSeverityFilter(sev)}
              className={`text-[11px] px-2.5 py-1 rounded transition-colors uppercase font-mono font-medium ${
                severityFilter === sev
                  ? 'bg-[#1A1A1A] text-[#E8E6E3] border border-[#2A2A2A]'
                  : 'text-[#5A5A5A] hover:text-[#8A8A8A]'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      {/* ── ALERT WATERFALL STREAM ── */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-2">
        {filteredAlerts.map((alert) => {
          const isCritical = alert.severity === 'critical';
          const isWarning = alert.severity === 'warning';
          const isBlocked = alert.status === 'blocked';

          return (
            <div
              key={alert.id}
              onClick={() => setSelectedAlert(alert)}
              className={`p-4 rounded-lg border transition-all cursor-pointer ${
                selectedAlert?.id === alert.id
                  ? 'bg-[#161616] border-[#6B8F71]/40'
                  : 'bg-[#111111] border-[#1E1E1E] hover:bg-[#141414] hover:border-[#2A2A2A]'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  {/* Severity Badge */}
                  <span
                    className={`text-[9px] px-2 py-0.5 rounded font-mono font-bold uppercase shrink-0 mt-0.5 ${
                      isCritical
                        ? 'bg-[#C45C5C]/15 text-[#D47070] border border-[#C45C5C]/30'
                        : isWarning
                        ? 'bg-[#C4963A]/15 text-[#D4A64A] border border-[#C4963A]/30'
                        : 'bg-[#6B8F71]/15 text-[#7DA385] border border-[#6B8F71]/30'
                    }`}
                  >
                    {alert.severity}
                  </span>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-semibold text-[#E8E6E3] truncate">
                        {alert.title}
                      </h3>
                      {isBlocked && (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#6B8F71]/10 text-[#7DA385] border border-[#6B8F71]/20 uppercase">
                          BLOCKED
                        </span>
                      )}
                    </div>
                    <p className="text-[11.5px] text-[#8A8A8A] mt-1 leading-relaxed">
                      {alert.description}
                    </p>

                    {/* Metadata tags */}
                    <div className="flex items-center gap-3 mt-2 text-[10.5px] font-mono text-[#5A5A5A]">
                      <span>Source: <strong className="text-[#8A8A8A] font-normal">{alert.sourceApp}</strong></span>
                      <span>•</span>
                      <span>Target: <strong className="text-[#8A8A8A] font-normal">{alert.sourceIp}:{alert.targetPort}</strong> ({alert.countryCode} {alert.country})</span>
                      <span>•</span>
                      <span>Rule: <strong className="text-[#6B8F71] font-normal">{alert.ruleMatched}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Right time & quick actions */}
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className="text-[11px] font-mono text-[#5A5A5A]">
                    {alert.timeAgo}
                  </span>

                  <div className="flex items-center gap-1.5">
                    {!isBlocked && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleBlockIp(alert.id); }}
                        className="px-2 py-0.5 text-[10.5px] rounded bg-[#C45C5C]/10 text-[#D47070] border border-[#C45C5C]/20 hover:bg-[#C45C5C]/20"
                      >
                        Block Source IP
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDismiss(alert.id); }}
                      className="text-[#5A5A5A] hover:text-[#E8E6E3] p-1"
                      title="Dismiss alert"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {filteredAlerts.length === 0 && (
          <div className="p-12 text-center text-xs text-[#5A5A5A] border border-dashed border-[#1E1E1E] rounded-lg bg-[#0D0D0D]">
            <CheckCircle2 size={24} className="mx-auto mb-2 text-[#6B8F71]" />
            <span className="text-[#8A8A8A] font-semibold block">All clear — no alerts matching criteria</span>
            <span className="text-[11px] mt-1 block">Your network and monitored endpoints are operating under active policy protection.</span>
          </div>
        )}
      </div>

      {/* ── ALERT INSPECTION MODAL ── */}
      {selectedAlert && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-lg bg-[#141414] border border-[#222222] rounded-xl p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#1E1E1E] mb-4">
              <div className="flex items-center gap-2">
                <span className={`text-[9px] px-2 py-0.5 rounded font-mono font-bold uppercase ${
                  selectedAlert.severity === 'critical' ? 'bg-[#C45C5C]/20 text-[#D47070]' : 'bg-[#C4963A]/20 text-[#D4A64A]'
                }`}>
                  {selectedAlert.severity}
                </span>
                <h3 className="text-sm font-semibold text-[#E8E6E3]">{selectedAlert.title}</h3>
              </div>

              <button onClick={() => setSelectedAlert(null)} className="text-[#5A5A5A] hover:text-white p-1">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs mb-5">
              <div className="p-3 rounded bg-[#0D0D0D] border border-[#1E1E1E]">
                <div className="text-[#5A5A5A] mb-1 font-mono text-[10px] uppercase">Incident Narrative:</div>
                <div className="text-[#E8E6E3] leading-relaxed">{selectedAlert.description}</div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-[#8A8A8A]">
                <div className="p-2.5 rounded bg-[#0D0D0D] border border-[#1E1E1E]">
                  <span className="text-[#5A5A5A] block text-[10px]">Source Node:</span>
                  <span className="text-[#E8E6E3]">{selectedAlert.sourceApp}</span>
                </div>
                <div className="p-2.5 rounded bg-[#0D0D0D] border border-[#1E1E1E]">
                  <span className="text-[#5A5A5A] block text-[10px]">IP & Port:</span>
                  <span className="text-[#E8E6E3]">{selectedAlert.sourceIp}:{selectedAlert.targetPort}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <button
                onClick={() => {
                  setSelectedAlert(null);
                  onNavigateToLogs?.();
                }}
                className="text-[11px] text-[#6B8F71] hover:underline flex items-center gap-1"
              >
                <ExternalLink size={12} />
                <span>Inspect in Log Analyzer</span>
              </button>

              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedAlert(null)}
                  className="px-3 py-1.5 text-xs rounded bg-[#1A1A1A] text-[#8A8A8A] hover:text-[#E8E6E3] border border-[#222222]"
                >
                  Close
                </button>
                <button
                  onClick={() => { handleBlockIp(selectedAlert.id); setSelectedAlert(null); }}
                  className="px-3 py-1.5 text-xs rounded bg-[#C45C5C] text-[#0A0A0A] font-semibold hover:bg-[#D47070]"
                >
                  Block IP Address
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
