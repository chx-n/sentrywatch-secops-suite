import React, { useState, useEffect } from 'react';
import { Search, Wrench, CheckCircle2, Shield, Lock, Ban, Check, Sliders, RefreshCw, Radio } from 'lucide-react';
import { apiService } from '../services/api';

interface AppCard {
  id: string;
  name: string;
  category: 'active' | 'all';
  iconColor: string;
  iconLetter: string;
  ports: number[];
  connections: number;
  blocked: number;
  pid?: string;
  listening?: boolean;
}

// Desaturated icon colors — no neon
const ALL_APPS_LIST: AppCard[] = [
  { id: 'agy',      name: 'Antigravity IDE',                   category: 'active', iconColor: '#7A9EB0', iconLetter: 'A', ports: [5173, 8000], connections: 4, blocked: 0 },
  { id: 'brave',    name: 'Brave Browser',                     category: 'active', iconColor: '#B8845A', iconLetter: 'B', ports: [443, 80],   connections: 28, blocked: 3 },
  { id: 'helium',   name: 'Helium Core Service',               category: 'active', iconColor: '#7A7A99', iconLetter: 'H', ports: [8443],      connections: 24, blocked: 1 },
  { id: 'langsrv',  name: 'Language Server Windows X64',       category: 'active', iconColor: '#5A8A5A', iconLetter: 'L', ports: [9000],      connections: 2,  blocked: 0 },
  { id: 'edge',     name: 'Microsoft Edge WebView2',           category: 'active', iconColor: '#5A7A8A', iconLetter: 'M', ports: [443],       connections: 12, blocked: 0 },
  { id: 'gaming',   name: 'Microsoft Gaming Install Services', category: 'active', iconColor: '#5A6A8A', iconLetter: 'M', ports: [443],       connections: 2,  blocked: 0 },
  { id: 'vs',       name: 'Microsoft® Visual Studio®',        category: 'active', iconColor: '#7A6B99', iconLetter: 'M', ports: [443, 8080], connections: 1,  blocked: 0 },
  { id: 'noise',    name: 'Network Noise Filter',              category: 'active', iconColor: '#5A5A6A', iconLetter: 'N', ports: [53],        connections: 0,  blocked: 12 },
  { id: 'node',     name: 'Node.js Runtime',                   category: 'active', iconColor: '#5A8A5A', iconLetter: 'N', ports: [3000, 5173],connections: 17, blocked: 0 },
  { id: 'other',    name: 'Other Connections & Probes',        category: 'active', iconColor: '#4A4A5A', iconLetter: 'O', ports: [445, 139],  connections: 5,  blocked: 8 },
  { id: 'riot',     name: 'Riot Client Network',               category: 'active', iconColor: '#9A5A5A', iconLetter: 'R', ports: [2099],      connections: 6,  blocked: 0 },
  { id: 'dns',      name: 'System DNS Client Resolver',        category: 'active', iconColor: '#6B8F71', iconLetter: 'S', ports: [53, 853],   connections: 32, blocked: 0 },
  { id: 'appinfo',  name: 'Windows Service: Appinfo',          category: 'active', iconColor: '#5A5A6A', iconLetter: 'W', ports: [443],       connections: 2,  blocked: 0 },
  { id: 'ssdp',     name: 'Windows Service: SSDPSRV',          category: 'active', iconColor: '#5A5A6A', iconLetter: 'W', ports: [1900],      connections: 1,  blocked: 0 },

  { id: 'actsrv',   name: 'Actions Server Worker',             category: 'all',    iconColor: '#8A7A4A', iconLetter: 'A', ports: [],          connections: 0,  blocked: 0 },
  { id: 'adb',      name: 'Android Debug Bridge (Adb)',        category: 'all',    iconColor: '#7A6A8A', iconLetter: 'A', ports: [5037],      connections: 0,  blocked: 0 },
  { id: 'chipset',  name: 'AMD Chipset Software Driver',       category: 'all',    iconColor: '#8A5A5A', iconLetter: 'A', ports: [],          connections: 0,  blocked: 0 },
  { id: 'crashdef', name: 'AMD Crash Defender Service',        category: 'all',    iconColor: '#5A5A6A', iconLetter: 'A', ports: [],          connections: 0,  blocked: 0 },
  { id: 'ext1',     name: 'AMD External Events Client',        category: 'all',    iconColor: '#8A7A4A', iconLetter: 'A', ports: [],          connections: 0,  blocked: 0 },
  { id: 'ext2',     name: 'AMD External Events Daemon',        category: 'all',    iconColor: '#6A5A7A', iconLetter: 'A', ports: [],          connections: 0,  blocked: 0 },
  { id: 'ext3',     name: 'AMD External Events Monitor',       category: 'all',    iconColor: '#7A5A5A', iconLetter: 'A', ports: [],          connections: 0,  blocked: 0 },
  { id: 'ext4',     name: 'AMD External Events Dispatcher',    category: 'all',    iconColor: '#7A5A6A', iconLetter: 'A', ports: [],          connections: 0,  blocked: 0 },
  { id: 'instmgr',  name: 'AMD Install Manager Package',       category: 'all',    iconColor: '#5A5A6A', iconLetter: 'A', ports: [],          connections: 0,  blocked: 0 },
  { id: 'userprog', name: 'AMD User Experience Program',       category: 'all',    iconColor: '#8A6A4A', iconLetter: 'A', ports: [],          connections: 0,  blocked: 0 },
  { id: 'software', name: 'AMD Software Adrenalin',            category: 'all',    iconColor: '#7A5A5A', iconLetter: 'A', ports: [],          connections: 0,  blocked: 0 },
];

interface AllAppsViewProps {
  globalSearch?: string;
}

export const AllAppsView: React.FC<AllAppsViewProps> = ({ globalSearch = '' }) => {
  const [search, setSearch] = useState('');
  const [selectedApp, setSelectedApp] = useState<AppCard | null>(null);
  const [manageRulesOpen, setManageRulesOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [appsList, setAppsList] = useState<AppCard[]>(ALL_APPS_LIST);
  const [isLive, setIsLive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Global firewall policy switches
  const [blockInboundAll, setBlockInboundAll] = useState(true);
  const [forceHttpsOnly, setForceHttpsOnly] = useState(true);
  const [autoIsolateUnknown, setAutoIsolateUnknown] = useState(false);
  const [dropRawSockets, setDropRawSockets] = useState(true);

  const loadLiveApps = async () => {
    setIsLoading(true);
    try {
      const live = await apiService.getNetworkApps();
      if (live && live.length > 0) {
        setAppsList(live);
        setIsLive(true);
        showToast(`Discovered ${live.length} live host network applications`);
      }
    } catch (err) {
      console.warn('Failed loading live network apps:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLiveApps();
  }, []);

  const effectiveSearch = (search || globalSearch).toLowerCase();
  const activeApps = appsList.filter(a => a.name.toLowerCase().includes(effectiveSearch));
  const allApps = appsList.filter(a => a.category === 'all' && a.name.toLowerCase().includes(effectiveSearch));

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0A0A0A] text-[#E8E6E3] overflow-y-auto p-6 font-sans select-none">
      
      {/* Toast banner */}
      {toastMessage && (
        <div className="fixed top-14 right-8 z-50 p-3 rounded bg-[#6B8F71]/15 border border-[#6B8F71]/40 text-xs text-[#7DA385] flex items-center gap-2 shadow-2xl animate-slide-up">
          <Check size={14} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Title Bar */}
      <div className="flex items-center justify-between mb-6 pb-3 border-b border-[#1E1E1E]">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-[#E8E6E3]">
            All Apps & Network Nodes
          </h1>
          <span className={`text-[11px] font-mono px-2 py-0.5 rounded border flex items-center gap-1.5 ${
            isLive ? 'bg-[#6B8F71]/15 text-[#7DA385] border-[#6B8F71]/30' : 'bg-[#141414] text-[#8A8A8A] border-[#1E1E1E]'
          }`}>
            {isLive ? <Radio size={11} className="text-[#6B8F71] animate-pulse" /> : null}
            {isLive ? `${appsList.length} Live Host Sockets` : `${appsList.length} Network Nodes`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={loadLiveApps}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-[#141414] border border-[#1E1E1E] text-[#8A8A8A] hover:text-[#E8E6E3] hover:bg-[#1A1A1A] transition-colors cursor-pointer disabled:opacity-50"
            title="Scan host /proc/net sockets and active daemons"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin text-[#6B8F71]' : ''} />
            <span>{isLoading ? 'Scanning...' : 'Refresh Sockets'}</span>
          </button>

          <button 
            onClick={() => setManageRulesOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-[#141414] border border-[#1E1E1E] text-[#8A8A8A] hover:text-[#E8E6E3] hover:bg-[#1A1A1A] transition-colors cursor-pointer"
          >
            <Wrench size={13} />
            <span>Manage App Rules</span>
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md mb-6">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5A5A]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter apps or target executables..."
          className="w-full h-8 pl-8 pr-3 text-xs bg-[#111111] rounded-md border border-[#1E1E1E] text-[#E8E6E3] placeholder-[#5A5A5A] focus:outline-none focus:border-[#6B8F71]/40"
        />
      </div>

      {/* Active Section */}
      <div className="mb-8">
        <div className="text-xs font-semibold text-[#5A5A5A] mb-3 uppercase tracking-wider font-mono">
          Active ({activeApps.length})
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
          {activeApps.map((app) => (
            <div
              key={app.id}
              onClick={() => setSelectedApp(app)}
              className="flex items-center justify-between p-3 rounded-lg bg-[#111111] border border-[#1A1A1A] hover:bg-[#161616] hover:border-[#222222] transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ background: app.iconColor }}
                >
                  {app.iconLetter}
                </div>
                <div className="min-w-0">
                  <div className="text-[12.5px] font-medium text-[#E8E6E3] truncate group-hover:text-[#6B8F71] transition-colors">
                    {app.name}
                  </div>
                  <div className="text-[10px] text-[#5A5A5A] font-mono">
                    {app.connections} Conns · {app.ports.length ? `Ports: ${app.ports.join(',')}` : 'Dynamic'}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Background Daemons Section */}
      <div className="mb-6">
        <div className="text-xs font-semibold text-[#5A5A5A] mb-3 uppercase tracking-wider font-mono">
          Background & System Daemons ({allApps.length})
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
          {allApps.map((app) => (
            <div
              key={app.id}
              onClick={() => setSelectedApp(app)}
              className="flex items-center justify-between p-3 rounded-lg bg-[#0D0D0D] border border-[#1A1A1A] hover:bg-[#141414] hover:border-[#1E1E1E] transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold text-white shrink-0 opacity-60"
                  style={{ background: app.iconColor }}
                >
                  {app.iconLetter}
                </div>
                <div className="min-w-0">
                  <div className="text-[12px] font-medium text-[#5A5A5A] truncate">
                    {app.name}
                  </div>
                  <div className="text-[10px] text-[#3A3A3A] font-mono">
                    Standby
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── MANAGE GLOBAL RULES MODAL ── */}
      {manageRulesOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-lg bg-[#141414] border border-[#222222] rounded-xl p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#1E1E1E] mb-4">
              <div className="flex items-center gap-2.5">
                <Wrench size={16} className="text-[#6B8F71]" />
                <h3 className="text-sm font-semibold text-[#E8E6E3]">Global App Rules & Firewall Policies</h3>
              </div>
              <button onClick={() => setManageRulesOpen(false)} className="text-[#5A5A5A] hover:text-white p-1">
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs mb-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#1E1E1E]">
                <div>
                  <div className="font-semibold text-[#E8E6E3]">Block Inbound Unsolicited Sockets</div>
                  <div className="text-[11px] text-[#5A5A5A] mt-0.5">Prevents external servers from opening listen sockets on desktop apps.</div>
                </div>
                <label className="pm-toggle">
                  <input type="checkbox" checked={blockInboundAll} onChange={(e) => setBlockInboundAll(e.target.checked)} />
                  <span className="pm-toggle-slider" />
                </label>
              </div>

              <div className="flex items-center justify-between pb-3 border-b border-[#1E1E1E]">
                <div>
                  <div className="font-semibold text-[#E8E6E3]">Enforce HTTPS & Encrypted TLS Only</div>
                  <div className="text-[11px] text-[#5A5A5A] mt-0.5">Drops plaintext HTTP (port 80) connections across all active applications.</div>
                </div>
                <label className="pm-toggle">
                  <input type="checkbox" checked={forceHttpsOnly} onChange={(e) => setForceHttpsOnly(e.target.checked)} />
                  <span className="pm-toggle-slider" />
                </label>
              </div>

              <div className="flex items-center justify-between pb-3 border-b border-[#1E1E1E]">
                <div>
                  <div className="font-semibold text-[#E8E6E3]">Drop Untrusted Raw Socket Probes</div>
                  <div className="text-[11px] text-[#5A5A5A] mt-0.5">Blocks non-standard TCP/UDP raw packet injection.</div>
                </div>
                <label className="pm-toggle">
                  <input type="checkbox" checked={dropRawSockets} onChange={(e) => setDropRawSockets(e.target.checked)} />
                  <span className="pm-toggle-slider" />
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-[#E8E6E3]">Auto-Isolate Unknown Background Daemons</div>
                  <div className="text-[11px] text-[#5A5A5A] mt-0.5">Quarantines new unsigned processes until manually authorized.</div>
                </div>
                <label className="pm-toggle">
                  <input type="checkbox" checked={autoIsolateUnknown} onChange={(e) => setAutoIsolateUnknown(e.target.checked)} />
                  <span className="pm-toggle-slider" />
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setManageRulesOpen(false)}
                className="px-4 py-1.5 text-xs rounded bg-[#1A1A1A] text-[#8A8A8A] hover:text-[#E8E6E3] border border-[#222222]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setManageRulesOpen(false);
                  showToast('Global App Rules Updated Successfully');
                }}
                className="px-4 py-1.5 text-xs rounded bg-[#6B8F71] text-[#0A0A0A] font-semibold hover:bg-[#7DA385]"
              >
                Save All Rules
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── APP INSPECTOR MODAL ── */}
      {selectedApp && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-lg bg-[#141414] border border-[#2A2A2A] rounded-xl p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#1E1E1E] mb-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold text-white"
                  style={{ background: selectedApp.iconColor }}
                >
                  {selectedApp.iconLetter}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#E8E6E3]">{selectedApp.name}</h3>
                  <span className="text-[11px] text-[#6B8F71] font-mono">Status: Monitored</span>
                </div>
              </div>

              <button
                onClick={() => setSelectedApp(null)}
                className="text-[#5A5A5A] hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs mb-5">
              <div className="p-3 rounded-md bg-[#0F0F0F] border border-[#1E1E1E]">
                <div className="text-[#8A8A8A] mb-1">Network Policy:</div>
                <div className="flex items-center gap-2 text-[#6B8F71] font-medium">
                  <CheckCircle2 size={14} />
                  <span>Allow outbound HTTPS (443), block untrusted raw sockets</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-[#8A8A8A]">
                <div className="p-2.5 rounded bg-[#0F0F0F] border border-[#1E1E1E]">
                  <span className="text-[#5A5A5A] block">Active Connections:</span>
                  <span className="text-sm font-bold text-[#E8E6E3]">{selectedApp.connections}</span>
                </div>
                <div className="p-2.5 rounded bg-[#0F0F0F] border border-[#1E1E1E]">
                  <span className="text-[#5A5A5A] block">Blocked Threats:</span>
                  <span className="text-sm font-bold text-[#C45C5C]">{selectedApp.blocked}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setSelectedApp(null)}
                className="px-4 py-1.5 text-xs rounded bg-[#1A1A1A] text-[#8A8A8A] hover:text-[#E8E6E3] border border-[#2A2A2A]"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setSelectedApp(null);
                  showToast(`Security Policy Saved for ${selectedApp.name}`);
                }}
                className="px-4 py-1.5 text-xs rounded bg-[#6B8F71] text-[#0A0A0A] font-semibold hover:bg-[#7DA385]"
              >
                Save Policy
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
