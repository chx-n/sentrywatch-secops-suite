import React, { useState } from 'react';
import {
  Play,
  RotateCw,
  X,
  AlertTriangle,
  Sliders,
  Terminal,
  Copy,
  Check,
  Globe,
  Zap,
  FileCode,
  AlertCircle,
} from 'lucide-react';
import { ScanRequest, ScanReport, PortProbe, TelemetryEvent } from '../types';
import { apiService } from '../services/api';

const PRESETS: Record<string, { label: string; ports: string; desc: string; explanation: string }> = {
  secops: {
    label: 'All Common Server Doors',
    ports: '21,22,23,25,53,80,110,143,443,445,993,995,3306,3389,5432,6379,8080,8443,9092',
    desc: 'Web, Email, SSH login, Database',
    explanation: 'Scans top 20 ports used by websites, mail servers, databases, and login services.',
  },
  web: {
    label: 'Websites & Web Apps',
    ports: '80,443,8000,8080,8443,8888,9000,9443',
    desc: 'HTTP & HTTPS web traffic',
    explanation: 'Checks standard web ports (80 = normal web, 443 = secure SSL website).',
  },
  database: {
    label: 'Database Servers',
    ports: '1433,1521,3306,5432,6379,27017,9200,9042',
    desc: 'MySQL, PostgreSQL, Redis, MongoDB',
    explanation: 'Checks if databases are accidentally exposed to the public internet.',
  },
  remote: {
    label: 'Remote Login & Admin Doors',
    ports: '22,23,3389,5900,5901,5985,5986',
    desc: 'SSH, Windows Remote Desktop, VNC',
    explanation: 'Checks remote control doors that administrators use to log into servers.',
  },
};

const getPortFriendlyName = (port: number): string => {
  const map: Record<number, string> = {
    21: 'FTP (File Transfer)',
    22: 'SSH (Secure Terminal Login)',
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
    6379: 'Redis (Cache / Data Store)',
    8080: 'HTTP-Alt (Web Proxy / App)',
    8443: 'HTTPS-Alt (Secure Web App)',
    9200: 'Elasticsearch (Search Engine)',
    27017: 'MongoDB (NoSQL Database)',
  };
  return map[port] || 'Custom Network Service';
};

interface ScanEngineProps {
  initialTarget?: string;
  onScanComplete: (r: ScanReport) => void;
}

export const ScanEngine: React.FC<ScanEngineProps> = ({
  initialTarget = 'scanme.nmap.org',
  onScanComplete,
}) => {
  const [targets,     setTargets]     = useState(initialTarget);
  const [preset,      setPreset]      = useState('secops');
  const [customPorts, setCustomPorts] = useState(PRESETS.secops.ports);
  const [concurrency, setConcurrency] = useState(256);
  const [timeout,     setTimeout_]    = useState(2.5);
  const [grabBanners, setGrabBanners] = useState(true);
  const [allowPriv,   setAllowPriv]   = useState(false);
  const [scanning,    setScanning]    = useState(false);
  const [progress,    setProgress]    = useState('');
  const [report,      setReport]      = useState<ScanReport | null>(null);
  const [error,       setError]       = useState<string | null>(null);
  const [probe,       setProbe]       = useState<PortProbe | null>(null);
  const [copied,      setCopied]      = useState(false);

  const applyPreset = (key: string) => {
    setPreset(key);
    setCustomPorts(PRESETS[key]?.ports || customPorts);
  };

  const launch = async () => {
    const tgts = targets.split(/[\n,]+/).map(t => t.trim()).filter(Boolean);
    if (!tgts.length) { setError('Please enter at least one server address or website to scan.'); return; }
    setError(null); setReport(null); setProbe(null); setScanning(true);
    setProgress('Connecting to server doors in parallel...');

    const req: ScanRequest = {
      targets: tgts, ports: customPorts, max_concurrency: concurrency,
      connect_timeout_s: timeout, grab_banners: grabBanners, allow_private_networks: allowPriv,
    };

    try {
      const r = await apiService.submitScan(req, (ev: TelemetryEvent) => {
        const d = ev.data || ev.payload;
        if (ev.type === 'probe' && d)
          setProgress(`Checking door ${d.port} on ${d.target} (${d.state})`);
        else if (ev.type === 'host_result' && d)
          setProgress(`Host scanned: ${d.target} (${d.open_port_count ?? 0} open doors)`);
        else if (ev.type === 'status' && d)
          setProgress(`Scan status: ${d.status}`);
        else if (ev.type === 'host_start' && d)
          setProgress(`Scanning server: ${d.target}`);
      });
      setReport(r);
      onScanComplete(r);
      setProgress('Scan complete.');
    } catch (e: any) {
      setError(e.message || 'Scan failed to complete.');
      setProgress('');
    } finally {
      setScanning(false);
    }
  };

  const exportReport = (fmt: 'json' | 'csv') => {
    if (!report) return;
    let body = '';
    const name = `sentrywatch-scan-${report.id}.${fmt}`;
    if (fmt === 'json') {
      body = JSON.stringify(report, null, 2);
    } else {
      const rows = [['target','address','port','service','state','response_ms','banner']];
      report.hosts.forEach(h =>
        h.probes.forEach(p =>
          rows.push([
            h.target, h.address || '', p.port.toString(), getPortFriendlyName(p.port), p.state,
            p.latency_ms?.toString() || '',
            `"${(p.banner||'').replace(/"/g,'""')}"`,
          ])
        )
      );
      body = rows.map(r => r.join(',')).join('\n');
    }
    const url = URL.createObjectURL(new Blob([body], { type: fmt === 'json' ? 'application/json' : 'text/csv' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    a.click(); URL.revokeObjectURL(url);
  };

  const copySummary = () => {
    if (!report) return;
    const summary = `SentryWatch Security Scan:
Target(s): ${report.hosts.map(h => h.target).join(', ')}
Open Doors (Ports): ${report.open_port_count} found open
Time Taken: ${report.duration_ms} ms
Details: ${report.hosts.flatMap(h => h.probes.filter(p => p.state === 'open').map(p => `Port ${p.port} (${getPortFriendlyName(p.port)})`)).join(', ')}`;
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col w-full h-full p-4 lg:p-6 gap-4 bg-[#0A0A0A] text-[#E8E6E3] overflow-y-auto">

      {/* ── TOP HEADER ── */}
      <div className="p-4 lg:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-[#1E1E1E] bg-[#111111] rounded-lg">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#6B8F71]" />
            <h1 className="font-semibold text-sm text-[#E8E6E3]">
              Server Port & Vulnerability Scanner
            </h1>
          </div>
          <p className="text-xs text-[#8A8A8A] mt-0.5">
            Test which doors (ports) are open on your server so you can close unnecessary ones before adversaries find them.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {report && (
            <>
              {report.meta?.simulation && (
                <div className="p-2 mb-2 rounded bg-[#C4963A]/10 border border-[#C4963A]/20 flex items-center gap-2">
                  <AlertCircle size={14} className="text-[#D4A64A]" />
                  <span className="text-xs text-[#D4A64A] font-semibold">SIMULATION MODE</span>
                  <span className="text-[10px] text-[#8A8A8A]">Results are simulated — not from live backend scan</span>
                </div>
              )}
              <button
                onClick={copySummary}
                disabled={report.meta?.simulation}
                className="px-3 py-1 text-xs rounded bg-[#1A1A1A] border border-[#222222] text-[#8A8A8A] hover:text-[#E8E6E3] flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {copied ? <Check size={13} className="text-[#6B8F71]" /> : <Copy size={13} />}
                <span>{copied ? 'Copied' : 'Copy Summary'}</span>
              </button>
              <button
                onClick={() => exportReport('json')}
                disabled={report.meta?.simulation}
                className="px-2.5 py-1 text-xs rounded bg-[#1A1A1A] border border-[#222222] text-[#8A8A8A] hover:text-[#E8E6E3] flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileCode size={13} />
                <span>JSON</span>
              </button>
            </>
          )}

          <button
            onClick={launch}
            disabled={scanning}
            className="px-4 py-1.5 text-xs font-semibold rounded bg-[#6B8F71] text-[#0A0A0A] hover:bg-[#7DA385] flex items-center gap-1.5 transition-all disabled:opacity-50"
          >
            {scanning ? (
              <>
                <RotateCw size={13} className="animate-spin" />
                <span>Scanning...</span>
              </>
            ) : (
              <>
                <Play size={13} />
                <span>Start Security Scan</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── 2-COLUMN WORKBENCH ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-[520px]">

        {/* LEFT COLUMN: Target Configuration & Sliders */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          <div className="p-4 flex flex-col gap-4 bg-[#111111] border border-[#1E1E1E] rounded-lg flex-1">
            <div className="flex items-center justify-between pb-2.5 border-b border-[#1E1E1E]">
              <span className="text-xs font-semibold text-[#E8E6E3] flex items-center gap-2">
                <Sliders size={14} className="text-[#6B8F71]" />
                Step 1: Choose Target Server & Scan Type
              </span>
            </div>

            {/* Target input */}
            <div>
              <label className="block text-xs font-medium text-[#8A8A8A] mb-1">
                Server Address or Website to Scan
              </label>
              <textarea
                rows={2}
                className="w-full text-xs leading-relaxed bg-[#0D0D0D] border border-[#1E1E1E] rounded p-2 text-[#E8E6E3] resize-none font-mono focus:border-[#6B8F71]/40 focus:outline-none"
                value={targets}
                onChange={e => setTargets(e.target.value)}
                placeholder="scanme.nmap.org, 198.51.100.10..."
              />
              <div className="flex items-center gap-2 mt-1.5 text-[11px] text-[#5A5A5A]">
                <span>Try an example:</span>
                {['scanme.nmap.org', 'github.com', '127.0.0.1 (blocked)'].map(h => (
                  <button
                    key={h}
                    onClick={() => setTargets(h.replace(' (blocked)', ''))}
                    className="text-[#6B8F71] hover:underline cursor-pointer"
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>

            {/* Port profile presets */}
            <div>
              <div className="text-xs font-medium text-[#8A8A8A] mb-1.5">
                Select Door (Port) Category to Check
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(PRESETS).map(([k, v]) => (
                  <button
                    key={k}
                    onClick={() => applyPreset(k)}
                    className={`p-2.5 rounded border text-left transition-all cursor-pointer ${
                      preset === k
                        ? 'bg-[#6B8F71]/10 border-[#6B8F71]/30 text-[#E8E6E3]'
                        : 'bg-[#0D0D0D] border-[#1A1A1A] text-[#5A5A5A] hover:border-[#222222]'
                    }`}
                  >
                    <div className="text-xs font-semibold flex items-center justify-between">
                      <span className={preset === k ? 'text-[#7DA385]' : 'text-[#E8E6E3]'}>{v.label}</span>
                      {preset === k && <Check size={12} className="text-[#6B8F71]" />}
                    </div>
                    <div className="text-[10px] text-[#5A5A5A] mt-0.5">{v.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom port range */}
            <div>
              <label className="block text-xs font-medium text-[#8A8A8A] mb-1">
                Specific Port Numbers
              </label>
              <input
                type="text"
                className="w-full text-xs bg-[#0D0D0D] border border-[#1E1E1E] rounded p-2 text-[#E8E6E3] font-mono focus:border-[#6B8F71]/40 focus:outline-none"
                value={customPorts}
                onChange={e => { setCustomPorts(e.target.value); setPreset('custom'); }}
                placeholder="22, 80, 443..."
              />
              <span className="text-[10.5px] text-[#5A5A5A] mt-1 block">
                Ports are numbered doors from 1 to 65535.
              </span>
            </div>

            {/* Sliders */}
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#1E1E1E]">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#8A8A8A]">Scan Speed</span>
                  <span className="text-[#6B8F71] font-semibold font-mono">{concurrency} workers</span>
                </div>
                <input
                  type="range"
                  min={16}
                  max={1024}
                  step={16}
                  value={concurrency}
                  onChange={e => setConcurrency(+e.target.value)}
                  className="w-full accent-[#6B8F71] cursor-pointer"
                />
                <span className="text-[10px] text-[#5A5A5A] block mt-0.5">Higher = Faster scan</span>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#8A8A8A]">Wait Time</span>
                  <span className="text-[#6B8F71] font-semibold font-mono">{timeout}s</span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={10}
                  step={0.5}
                  value={timeout}
                  onChange={e => setTimeout_(+e.target.value)}
                  className="w-full accent-[#6B8F71] cursor-pointer"
                />
                <span className="text-[10px] text-[#5A5A5A] block mt-0.5">Wait time for slow hosts</span>
              </div>
            </div>

            {/* Safety Options */}
            <div className="flex flex-col gap-2 pt-2 border-t border-[#1E1E1E]">
              <label className="flex items-center justify-between cursor-pointer p-2 rounded bg-[#0D0D0D] border border-[#1A1A1A]">
                <div>
                  <span className="text-xs font-medium text-[#E8E6E3] block">Identify Service Software Names</span>
                  <span className="text-[10.5px] text-[#5A5A5A]">Ask open doors what software is running (e.g. Nginx, Ubuntu, OpenSSH)</span>
                </div>
                <input
                  type="checkbox"
                  checked={grabBanners}
                  onChange={e => setGrabBanners(e.target.checked)}
                  className="accent-[#6B8F71] w-4 h-4 ml-2"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer p-2 rounded bg-[#0D0D0D] border border-[#1A1A1A]">
                <div>
                  <span className="text-xs font-medium text-[#E8E6E3] block">Allow Scanning Home/Private IPs</span>
                  <span className="text-[10.5px] text-[#5A5A5A]">Bypasses automatic safety fence (Keep OFF for normal safety)</span>
                </div>
                <input
                  type="checkbox"
                  checked={allowPriv}
                  onChange={e => setAllowPriv(e.target.checked)}
                  className="accent-[#6B8F71] w-4 h-4 ml-2"
                />
              </label>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Results & Open Doors Matrix */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          <div className="p-4 flex flex-col bg-[#111111] border border-[#1E1E1E] rounded-lg flex-1">
            <div className="flex items-center justify-between pb-2.5 border-b border-[#1E1E1E] mb-3">
              <span className="text-xs font-semibold text-[#E8E6E3] flex items-center gap-2">
                <Terminal size={14} className="text-[#6B8F71]" />
                Step 2: Discovered Open Doors & Software
              </span>
              {report && (
                <div className="text-xs text-[#8A8A8A]">
                  Found <strong className="text-[#6B8F71]">{report.open_port_count} open door(s)</strong> in {report.duration_ms} ms
                </div>
              )}
            </div>

            {/* Scan progress */}
            {scanning && (
              <div className="p-3 mb-3 rounded bg-[#6B8F71]/10 border border-[#6B8F71]/20 flex flex-col gap-2">
                <div className="text-xs text-[#7DA385] flex items-center gap-2 font-medium">
                  <RotateCw size={13} className="animate-spin" />
                  <span>{progress}</span>
                </div>
                <div className="w-full bg-[#1A1A1A] h-1.5 rounded-full overflow-hidden">
                  <div className="bg-[#6B8F71] h-full rounded-full animate-pulse" style={{ width: '75%' }} />
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 mb-3 rounded bg-[#C45C5C]/10 border border-[#C45C5C]/20 text-xs text-[#D47070] flex items-center gap-2">
                <AlertTriangle size={14} />
                <span>{error}</span>
              </div>
            )}

            {/* Results Grid */}
            {report && (
              <div className="flex flex-col gap-3 flex-1 overflow-y-auto max-h-[500px] pr-1">
                {report.hosts.map((h, i) => (
                  <div
                    key={h.target + i}
                    className="p-3 rounded border border-[#1E1E1E] bg-[#0D0D0D] flex flex-col gap-2.5"
                  >
                    {/* Host Header */}
                    <div className="flex items-center justify-between border-b border-[#1A1A1A] pb-2">
                      <div className="flex items-center gap-2 text-xs">
                        <Globe size={14} className="text-[#6B8F71]" />
                        <span className="font-semibold text-[#E8E6E3]">{h.target}</span>
                        {h.address && <span className="text-[#5A5A5A] text-[11px]">({h.address})</span>}
                      </div>

                      <div className="text-xs">
                        {h.error ? (
                          <span className="text-[10px] py-0.5 px-2 rounded bg-[#C45C5C]/10 text-[#D47070] border border-[#C45C5C]/20">
                            {h.error}
                          </span>
                        ) : (
                          <span className="text-[10px] py-0.5 px-2 rounded bg-[#6B8F71]/10 text-[#7DA385] border border-[#6B8F71]/20 font-semibold font-mono">
                            {h.open_port_count} OPEN SERVICES
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Probes Matrix */}
                    {!h.error && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {h.probes.map(p => {
                          const isOpen = p.state === 'open';
                          const isFiltered = p.state === 'filtered';
                          const serviceName = getPortFriendlyName(p.port);

                          return (
                            <button
                              key={p.port}
                              onClick={() => setProbe(p)}
                              className={`p-2.5 rounded border text-left transition-all cursor-pointer flex flex-col justify-between ${
                                probe?.port === p.port
                                  ? 'bg-[#6B8F71]/15 border-[#6B8F71]/50'
                                  : isOpen
                                  ? 'bg-[#6B8F71]/5 border-[#6B8F71]/20 hover:border-[#6B8F71]/40'
                                  : isFiltered
                                  ? 'bg-[#C4963A]/5 border-[#C4963A]/20'
                                  : 'bg-[#141414] border-[#1E1E1E]'
                              }`}
                            >
                              <div>
                                <div className="flex items-center justify-between mb-0.5">
                                  <span className={`font-semibold text-xs ${isOpen ? 'text-[#7DA385]' : isFiltered ? 'text-[#D4A64A]' : 'text-[#5A5A5A]'}`}>
                                    Port :{p.port}
                                  </span>
                                  <span
                                    className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                                      isOpen
                                        ? 'bg-[#6B8F71]/20 text-[#7DA385]'
                                        : isFiltered
                                        ? 'bg-[#C4963A]/20 text-[#D4A64A]'
                                        : 'bg-[#1E1E1E] text-[#5A5A5A]'
                                    }`}
                                  >
                                    {isOpen ? 'OPEN' : isFiltered ? 'FILTERED' : 'CLOSED'}
                                  </span>
                                </div>
                                <div className="text-[11px] text-[#8A8A8A] font-medium truncate">
                                  {serviceName}
                                </div>
                              </div>

                              <div className="text-[10px] text-[#5A5A5A] mt-2">
                                {isOpen ? `${p.latency_ms?.toFixed(1)} ms (Click to inspect)` : 'Not listening'}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {!report && !scanning && !error && (
              <div className="flex flex-col items-center justify-center flex-1 p-12 text-center text-xs text-[#5A5A5A]">
                <Zap size={28} className="mb-2 opacity-30 text-[#8A8A8A]" />
                <span className="font-semibold text-[#8A8A8A]">Ready to scan</span>
                <span className="text-[11px] text-[#5A5A5A] mt-1">
                  Select a server above and click "Start Security Scan" to discover open doors and services.
                </span>
              </div>
            )}

            {/* Clicked Port Detail Drawer */}
            {probe && (
              <div className="mt-3 p-3.5 rounded border border-[#6B8F71]/30 bg-[#6B8F71]/5 flex flex-col gap-2">
                <div className="flex items-center justify-between pb-1.5 border-b border-[#6B8F71]/20 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#6B8F71]" />
                    <span className="font-semibold text-[#E8E6E3]">
                      Door {probe.port} Details: {getPortFriendlyName(probe.port)}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#6B8F71]/20 text-[#7DA385] font-mono uppercase">{probe.state}</span>
                  </div>
                  <button onClick={() => setProbe(null)} className="text-[#5A5A5A] hover:text-[#E8E6E3]">
                    <X size={14} />
                  </button>
                </div>

                <div className="text-xs text-[#8A8A8A]">
                  <strong className="text-[#E8E6E3]">What this means: </strong>
                  {probe.state === 'open'
                    ? `This service (${getPortFriendlyName(probe.port)}) is actively running and accessible over the network.`
                    : `This door is closed or protected behind a firewall.`}
                </div>

                {probe.banner && (
                  <div className="mt-1">
                    <div className="text-[10.5px] text-[#5A5A5A] font-semibold mb-1 uppercase">Software Detected Behind Door:</div>
                    <pre className="p-2 rounded bg-[#0D0D0D] border border-[#1E1E1E] text-[#7DA385] text-[11px] font-mono overflow-x-auto whitespace-pre-wrap">
                      {probe.banner}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
