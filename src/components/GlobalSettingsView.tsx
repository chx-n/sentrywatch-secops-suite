import React, { useState } from 'react';
import { 
  ChevronDown, 
  Plus, 
  Edit3, 
  RotateCcw, 
  FileDown, 
  FileUp, 
  Info,
  Sliders,
  Shield,
  ScrollText,
  Activity,
  Radio,
  SlidersHorizontal,
  Check
} from 'lucide-react';

export const GlobalSettingsView: React.FC = () => {
  const [activeSection, setActiveSection] = useState<'dns' | 'scanner' | 'logs' | 'network' | 'general'>('dns');

  // DNS Settings
  const [dnsServers, setDnsServers] = useState([
    'dot://cloudflare-dns.com?ip=1.1.1.2&name=Cloudflare&blockedif=zeroip',
    'dot://cloudflare-dns.com?ip=1.0.0.2&name=Cloudflare&blockedif=zeroip',
    'dot://dns.quad9.net?ip=9.9.9.9&name=Quad9-Secure'
  ]);
  const [useDnsCache, setUseDnsCache] = useState(true);
  const [blockUnencryptedDns, setBlockUnencryptedDns] = useState(true);

  // Scanner Settings
  const [defaultConcurrency, setDefaultConcurrency] = useState(256);
  const [defaultTimeout, setDefaultTimeout] = useState(2.5);
  const [defaultGrabBanners, setDefaultGrabBanners] = useState(true);
  const [ssrfBlockPrivate, setSsrfBlockPrivate] = useState(true);

  // Log Analyzer Settings
  const [ruleSshEnabled, setRuleSshEnabled] = useState(true);
  const [ruleSqliEnabled, setRuleSqliEnabled] = useState(true);
  const [ruleScanEnabled, setRuleScanEnabled] = useState(true);
  const [ruleFirewallEnabled, setRuleFirewallEnabled] = useState(true);
  const [maxLogBuffer, setMaxLogBuffer] = useState(200);

  // Network & Telemetry Settings
  const [sampleRate, setSampleRate] = useState('1s');
  const [wsUrl, setWsUrl] = useState('ws://127.0.0.1:8000/api/v1/telemetry/ws');

  // Server Input State
  const [newServerInput, setNewServerInput] = useState('');
  const [addingServer, setAddingServer] = useState(false);
  const [savedBanner, setSavedBanner] = useState(false);

  const handleAddServer = () => {
    if (newServerInput.trim()) {
      setDnsServers([...dnsServers, newServerInput.trim()]);
      setNewServerInput('');
      setAddingServer(false);
    }
  };

  const handleSave = () => {
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 2500);
  };

  const exportConfig = () => {
    const config = {
      dns: { dnsServers, useDnsCache, blockUnencryptedDns },
      scanner: { defaultConcurrency, defaultTimeout, defaultGrabBanners, ssrfBlockPrivate },
      logs: { ruleSshEnabled, ruleSqliEnabled, ruleScanEnabled, ruleFirewallEnabled, maxLogBuffer },
      network: { sampleRate, wsUrl }
    };
    const b = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(b),
      download: `sentrywatch-config-${Date.now()}.json`
    });
    a.click();
  };

  return (
    <div className="flex w-full h-full bg-[#0A0A0A] text-[#E8E6E3] overflow-hidden font-sans">
      
      {/* ── LEFT SETTINGS NAVIGATION RAIL ── */}
      <div className="w-[220px] min-w-[220px] flex flex-col justify-between p-5 border-r border-[#1E1E1E] bg-[#0D0D0D]">
        <div>
          <div className="text-[12px] font-semibold text-[#E8E6E3] mb-4 flex items-center gap-1.5">
            <span>Suite Configuration</span>
            <Info size={12} className="text-[#5A5A5A]" />
          </div>

          {/* Navigation Tree */}
          <div className="space-y-1 text-xs">
            {/* Secure DNS */}
            <button
              onClick={() => setActiveSection('dns')}
              className={`flex items-center gap-2.5 py-1.5 px-2 rounded-md text-[12px] font-medium transition-colors w-full text-left ${
                activeSection === 'dns' ? 'bg-[#1A1A1A] text-[#E8E6E3]' : 'text-[#8A8A8A] hover:text-[#E8E6E3] hover:bg-[#141414]'
              }`}
            >
              <Shield size={14} className={activeSection === 'dns' ? 'text-[#6B8F71]' : 'text-[#5A5A5A]'} />
              <span>DNS & Resolving</span>
            </button>

            {/* Scanner Config */}
            <button
              onClick={() => setActiveSection('scanner')}
              className={`flex items-center gap-2.5 py-1.5 px-2 rounded-md text-[12px] font-medium transition-colors w-full text-left ${
                activeSection === 'scanner' ? 'bg-[#1A1A1A] text-[#E8E6E3]' : 'text-[#8A8A8A] hover:text-[#E8E6E3] hover:bg-[#141414]'
              }`}
            >
              <Radio size={14} className={activeSection === 'scanner' ? 'text-[#6B8F71]' : 'text-[#5A5A5A]'} />
              <span>Scanner Policies</span>
            </button>

            {/* Log Engine */}
            <button
              onClick={() => setActiveSection('logs')}
              className={`flex items-center gap-2.5 py-1.5 px-2 rounded-md text-[12px] font-medium transition-colors w-full text-left ${
                activeSection === 'logs' ? 'bg-[#1A1A1A] text-[#E8E6E3]' : 'text-[#8A8A8A] hover:text-[#E8E6E3] hover:bg-[#141414]'
              }`}
            >
              <ScrollText size={14} className={activeSection === 'logs' ? 'text-[#6B8F71]' : 'text-[#5A5A5A]'} />
              <span>Threat Detection</span>
            </button>

            {/* Network Telemetry */}
            <button
              onClick={() => setActiveSection('network')}
              className={`flex items-center gap-2.5 py-1.5 px-2 rounded-md text-[12px] font-medium transition-colors w-full text-left ${
                activeSection === 'network' ? 'bg-[#1A1A1A] text-[#E8E6E3]' : 'text-[#8A8A8A] hover:text-[#E8E6E3] hover:bg-[#141414]'
              }`}
            >
              <Activity size={14} className={activeSection === 'network' ? 'text-[#6B8F71]' : 'text-[#5A5A5A]'} />
              <span>Telemetry Feed</span>
            </button>

            {/* General */}
            <button
              onClick={() => setActiveSection('general')}
              className={`flex items-center gap-2.5 py-1.5 px-2 rounded-md text-[12px] font-medium transition-colors w-full text-left ${
                activeSection === 'general' ? 'bg-[#1A1A1A] text-[#E8E6E3]' : 'text-[#8A8A8A] hover:text-[#E8E6E3] hover:bg-[#141414]'
              }`}
            >
              <SlidersHorizontal size={14} className={activeSection === 'general' ? 'text-[#6B8F71]' : 'text-[#5A5A5A]'} />
              <span>General Defaults</span>
            </button>
          </div>
        </div>

        {/* Bottom Import / Export */}
        <div className="space-y-1.5 pt-4 border-t border-[#1E1E1E]">
          <button
            onClick={exportConfig}
            className="w-full py-1.5 px-3 rounded bg-[#141414] border border-[#1E1E1E] text-[11px] text-[#8A8A8A] hover:text-[#E8E6E3] hover:bg-[#1A1A1A] flex items-center justify-center gap-1.5 transition-colors"
          >
            <FileDown size={12} />
            <span>Export Config JSON</span>
          </button>
        </div>
      </div>


      {/* ── RIGHT DYNAMIC SETTINGS PANEL ── */}
      <div className="flex-1 flex flex-col h-full overflow-y-auto p-8 bg-[#0A0A0A] max-w-4xl">
        
        {savedBanner && (
          <div className="mb-4 p-3 rounded bg-[#6B8F71]/15 border border-[#6B8F71]/30 text-xs text-[#7DA385] flex items-center gap-2">
            <Check size={14} />
            <span>Settings saved successfully.</span>
          </div>
        )}

        {/* ══ 1. DNS & RESOLVING ══ */}
        {activeSection === 'dns' && (
          <div>
            <h1 className="text-xl font-semibold text-[#E8E6E3] mb-1">
              Secure DNS & Resolvers
            </h1>
            <p className="text-xs text-[#5A5A5A] mb-6">Manage DNS-over-TLS (DoT) endpoints and local caching.</p>

            {/* DNS Server list */}
            <div className="mb-6 rounded-lg bg-[#111111] border border-[#1E1E1E] p-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-[#8A8A8A] pb-2 border-b border-[#1A1A1A]">
                <span className="font-semibold text-[#E8E6E3]">Active DNS Resolvers ({dnsServers.length})</span>
                <span className="text-[11px] text-[#5A5A5A]">Port 853 TLS</span>
              </div>

              <div className="space-y-1.5">
                {dnsServers.map((srv, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded bg-[#0D0D0D] border border-[#1A1A1A] text-xs font-mono text-[#D4D4D4]"
                  >
                    <span className="truncate">{srv}</span>
                    <button 
                      onClick={() => setDnsServers(dnsServers.filter((_, i) => i !== idx))}
                      className="hover:text-[#C45C5C] text-[#5A5A5A] p-1 shrink-0 ml-2"
                      title="Remove resolver"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              {addingServer ? (
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="text"
                    value={newServerInput}
                    onChange={(e) => setNewServerInput(e.target.value)}
                    placeholder="dot://dns.example.com?ip=1.1.1.1"
                    className="flex-1 h-8 px-3 text-xs font-mono bg-[#0D0D0D] border border-[#6B8F71]/40 rounded text-white focus:outline-none"
                  />
                  <button
                    onClick={handleAddServer}
                    className="px-3 h-8 bg-[#6B8F71] text-[#0A0A0A] font-semibold text-xs rounded hover:bg-[#7DA385]"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setAddingServer(false)}
                    className="px-3 h-8 bg-[#1A1A1A] text-[#8A8A8A] text-xs rounded hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setAddingServer(true)}
                  className="w-full py-2 border border-dashed border-[#222222] rounded text-xs text-[#8A8A8A] hover:text-[#6B8F71] hover:border-[#6B8F71]/40 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Plus size={13} />
                  <span>Add Custom DoT Resolver</span>
                </button>
              )}
            </div>

            {/* DNS Policy Toggles */}
            <div className="rounded-lg bg-[#111111] border border-[#1E1E1E] p-4 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#1A1A1A]">
                <div>
                  <div className="text-xs font-semibold text-[#E8E6E3]">Local DNS Record Cache</div>
                  <div className="text-[11px] text-[#5A5A5A] mt-0.5">Caches validated DoT records locally to avoid repeated queries.</div>
                </div>
                <label className="pm-toggle">
                  <input type="checkbox" checked={useDnsCache} onChange={(e) => setUseDnsCache(e.target.checked)} />
                  <span className="pm-toggle-slider" />
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-[#E8E6E3]">Block Insecure Plaintext DNS</div>
                  <div className="text-[11px] text-[#5A5A5A] mt-0.5">Automatically blocks plain UDP port 53 traffic to prevent DNS poisoning.</div>
                </div>
                <label className="pm-toggle">
                  <input type="checkbox" checked={blockUnencryptedDns} onChange={(e) => setBlockUnencryptedDns(e.target.checked)} />
                  <span className="pm-toggle-slider" />
                </label>
              </div>
            </div>
          </div>
        )}

        {/* ══ 2. SCANNER POLICIES ══ */}
        {activeSection === 'scanner' && (
          <div>
            <h1 className="text-xl font-semibold text-[#E8E6E3] mb-1">
              Port Scanner Policies
            </h1>
            <p className="text-xs text-[#5A5A5A] mb-6">Default worker concurrency, connection timeouts, and safety barriers.</p>

            <div className="rounded-lg bg-[#111111] border border-[#1E1E1E] p-4 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#1A1A1A]">
                <div>
                  <div className="text-xs font-semibold text-[#E8E6E3]">Default Concurrency Workers</div>
                  <div className="text-[11px] text-[#5A5A5A] mt-0.5">Number of asynchronous connection probes to dispatch in parallel.</div>
                </div>
                <span className="text-xs font-mono font-semibold text-[#6B8F71]">{defaultConcurrency} workers</span>
              </div>

              <div className="flex items-center justify-between pb-3 border-b border-[#1A1A1A]">
                <div>
                  <div className="text-xs font-semibold text-[#E8E6E3]">Connection Timeout</div>
                  <div className="text-[11px] text-[#5A5A5A] mt-0.5">Maximum seconds to wait for a port handshake before marking as filtered/closed.</div>
                </div>
                <span className="text-xs font-mono font-semibold text-[#6B8F71]">{defaultTimeout}s</span>
              </div>

              <div className="flex items-center justify-between pb-3 border-b border-[#1A1A1A]">
                <div>
                  <div className="text-xs font-semibold text-[#E8E6E3]">Banner Grabbing (Service Fingerprinting)</div>
                  <div className="text-[11px] text-[#5A5A5A] mt-0.5">Reads server software headers (Nginx, OpenSSH, Apache) upon connection.</div>
                </div>
                <label className="pm-toggle">
                  <input type="checkbox" checked={defaultGrabBanners} onChange={(e) => setDefaultGrabBanners(e.target.checked)} />
                  <span className="pm-toggle-slider" />
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-[#E8E6E3] flex items-center gap-2">
                    <span>Block Private Networks (SSRF Protection)</span>
                    <span className="px-1.5 py-0.2 rounded bg-[#6B8F71]/15 text-[#7DA385] text-[9px] font-mono font-bold">RECOMMENDED</span>
                  </div>
                  <div className="text-[11px] text-[#5A5A5A] mt-0.5">Prevents scanning 127.0.0.1, RFC1918 (192.168.x, 10.x), and cloud metadata IPs.</div>
                </div>
                <label className="pm-toggle">
                  <input type="checkbox" checked={ssrfBlockPrivate} onChange={(e) => setSsrfBlockPrivate(e.target.checked)} />
                  <span className="pm-toggle-slider" />
                </label>
              </div>
            </div>
          </div>
        )}

        {/* ══ 3. THREAT DETECTION (LOGS) ══ */}
        {activeSection === 'logs' && (
          <div>
            <h1 className="text-xl font-semibold text-[#E8E6E3] mb-1">
              Threat Detection Rules
            </h1>
            <p className="text-xs text-[#5A5A5A] mb-6">Manage real-time parsing signatures for ingested security logs.</p>

            <div className="rounded-lg bg-[#111111] border border-[#1E1E1E] p-4 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#1A1A1A]">
                <div>
                  <div className="text-xs font-semibold text-[#E8E6E3]">SSH Brute Force Detection</div>
                  <div className="text-[11px] text-[#5A5A5A] mt-0.5">Detects repeated authentication failures and password spray attempts.</div>
                </div>
                <label className="pm-toggle">
                  <input type="checkbox" checked={ruleSshEnabled} onChange={(e) => setRuleSshEnabled(e.target.checked)} />
                  <span className="pm-toggle-slider" />
                </label>
              </div>

              <div className="flex items-center justify-between pb-3 border-b border-[#1A1A1A]">
                <div>
                  <div className="text-xs font-semibold text-[#E8E6E3]">SQL Injection Signatures</div>
                  <div className="text-[11px] text-[#5A5A5A] mt-0.5">Identifies OR 1=1, UNION SELECT, and comment payload injections in URI parameters.</div>
                </div>
                <label className="pm-toggle">
                  <input type="checkbox" checked={ruleSqliEnabled} onChange={(e) => setRuleSqliEnabled(e.target.checked)} />
                  <span className="pm-toggle-slider" />
                </label>
              </div>

              <div className="flex items-center justify-between pb-3 border-b border-[#1A1A1A]">
                <div>
                  <div className="text-xs font-semibold text-[#E8E6E3]">Nmap & Reconnaissance Probes</div>
                  <div className="text-[11px] text-[#5A5A5A] mt-0.5">Flags port scanning signatures and Suricata reconnaissance alerts.</div>
                </div>
                <label className="pm-toggle">
                  <input type="checkbox" checked={ruleScanEnabled} onChange={(e) => setRuleScanEnabled(e.target.checked)} />
                  <span className="pm-toggle-slider" />
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-[#E8E6E3]">Firewall SMB / NetBIOS Drops</div>
                  <div className="text-[11px] text-[#5A5A5A] mt-0.5">Matches dropped incoming connections on Windows port 445 and NetBIOS.</div>
                </div>
                <label className="pm-toggle">
                  <input type="checkbox" checked={ruleFirewallEnabled} onChange={(e) => setRuleFirewallEnabled(e.target.checked)} />
                  <span className="pm-toggle-slider" />
                </label>
              </div>
            </div>
          </div>
        )}

        {/* ══ 4. TELEMETRY FEED ══ */}
        {activeSection === 'network' && (
          <div>
            <h1 className="text-xl font-semibold text-[#E8E6E3] mb-1">
              Telemetry & Live Feed
            </h1>
            <p className="text-xs text-[#5A5A5A] mb-6">Configure the local Python WebSocket bridge and streaming sample rate.</p>

            <div className="rounded-lg bg-[#111111] border border-[#1E1E1E] p-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#E8E6E3] mb-1">WebSocket Telemetry URL</label>
                <input
                  type="text"
                  value={wsUrl}
                  onChange={(e) => setWsUrl(e.target.value)}
                  className="w-full h-8 px-3 text-xs font-mono bg-[#0D0D0D] border border-[#1E1E1E] rounded text-[#E8E6E3] focus:border-[#6B8F71]/40 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#1A1A1A]">
                <div>
                  <div className="text-xs font-semibold text-[#E8E6E3]">Waveform Sample Rate</div>
                  <div className="text-[11px] text-[#5A5A5A] mt-0.5">Frequency of throughput aggregation points on the live graph.</div>
                </div>
                <select
                  value={sampleRate}
                  onChange={(e) => setSampleRate(e.target.value)}
                  className="bg-[#0D0D0D] border border-[#1E1E1E] text-xs text-[#E8E6E3] rounded px-2 py-1"
                >
                  <option value="500ms">500ms (High Detail)</option>
                  <option value="1s">1s (Balanced)</option>
                  <option value="2s">2s (Low CPU)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* ══ 5. GENERAL DEFAULTS ══ */}
        {activeSection === 'general' && (
          <div>
            <h1 className="text-xl font-semibold text-[#E8E6E3] mb-1">
              General Preferences
            </h1>
            <p className="text-xs text-[#5A5A5A] mb-6">Suite version, theme confirmation, and factory reset.</p>

            <div className="rounded-lg bg-[#111111] border border-[#1E1E1E] p-4 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#1A1A1A]">
                <div>
                  <div className="text-xs font-semibold text-[#E8E6E3]">Active Theme</div>
                  <div className="text-[11px] text-[#5A5A5A] mt-0.5">Dark Industrial (Charcoal & Muted Sage)</div>
                </div>
                <span className="text-xs font-mono text-[#6B8F71] font-semibold">LOCKED</span>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-[#E8E6E3]">Reset Configuration</div>
                  <div className="text-[11px] text-[#5A5A5A] mt-0.5">Restores default DNS resolvers, scan concurrency, and detection rules.</div>
                </div>
                <button
                  onClick={() => {
                    setDnsServers(['dot://cloudflare-dns.com?ip=1.1.1.2&name=Cloudflare', 'dot://dns.quad9.net?ip=9.9.9.9']);
                    setDefaultConcurrency(256);
                    setDefaultTimeout(2.5);
                    handleSave();
                  }}
                  className="px-3 py-1 text-xs rounded bg-[#1A1A1A] border border-[#222222] text-[#8A8A8A] hover:text-[#E8E6E3] flex items-center gap-1.5"
                >
                  <RotateCcw size={12} />
                  <span>Reset Defaults</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Save Action */}
        <div className="flex justify-end mt-6">
          <button
            onClick={handleSave}
            className="px-5 py-2 text-xs font-semibold rounded bg-[#6B8F71] text-[#0A0A0A] hover:bg-[#7DA385] transition-colors"
          >
            Save Changes
          </button>
        </div>

      </div>

    </div>
  );
};
