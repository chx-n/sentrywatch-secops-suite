import React, { useState } from 'react';
import {
  ShieldCheck,
  Megaphone,
  Search,
  ArrowUpDown,
  RefreshCw,
  ChevronDown,
  X,
  Shield,
  ExternalLink,
  Ban,
  CheckCircle2,
  Lock,
  Globe,
  Radio
} from 'lucide-react';
import { ScanReport, ParsedEvent } from '../types';

interface OverviewProps {
  reports: ScanReport[];
  latestEvents: ParsedEvent[];
  globalSearch?: string;
  isExpertMode?: boolean;
  onNavigateToScan: (target?: string) => void;
  onNavigateToLogs: () => void;
  onNavigateToApps: () => void;
}

interface AppActivityItem {
  id: string;
  name: string;
  category: string;
  connections: number;
  activityLevel: number;
  color: string;
  iconLetter: string;
}

const INITIAL_APPS_DATA: AppActivityItem[] = [
  { id: 'vs',       name: 'Microsoft® Visual Studio®',        category: 'IDE / Dev',       connections: 1,  activityLevel: 45, color: '#7A6B99', iconLetter: 'M' },
  { id: 'ssdp',     name: 'Windows Service: SSDPSRV',          category: 'System Service',  connections: 1,  activityLevel: 10, color: '#5A6A7A', iconLetter: 'W' },
  { id: 'gaming',   name: 'Microsoft Gaming Install Services',  category: 'Background',      connections: 2,  activityLevel: 30, color: '#5A6A8A', iconLetter: 'M' },
  { id: 'edge',     name: 'Microsoft Edge WebView2',           category: 'Browser Engine',  connections: 12, activityLevel: 75, color: '#5A7A8A', iconLetter: 'E' },
  { id: 'brave',    name: 'Brave Browser',                     category: 'Web Browser',     connections: 28, activityLevel: 90, color: '#B8845A', iconLetter: 'B' },
  { id: 'node',     name: 'Node.js Runtime',                   category: 'Developer Tool',  connections: 17, activityLevel: 65, color: '#5A8A5A', iconLetter: 'N' },
  { id: 'helium',   name: 'Helium Core Engine',                category: 'SecOps Node',     connections: 24, activityLevel: 80, color: '#6A6A99', iconLetter: 'H' },
  { id: 'appinfo',  name: 'Windows Service: Appinfo',          category: 'System Service',  connections: 2,  activityLevel: 15, color: '#5A5A6A', iconLetter: 'W' },
  { id: 'sentry',   name: 'SentryWatch API Server',            category: 'Core Service',    connections: 8,  activityLevel: 85, color: '#6B8F71', iconLetter: 'S' },
];

export interface ConnectionLog {
  id: string;
  status: 'allowed' | 'blocked' | 'filtered';
  domain: string;
  country: string;
  countryCode: string;
  app: string;
  ip: string;
  time: string;
  rule: string;
  proto?: string;
  latencyMs?: number;
  asn?: string;
}

const INITIAL_CONNECTIONS: ConnectionLog[] = [
  { id: 'c1', status: 'allowed', domain: 'browser.events.data.microsoft.com', country: 'US', countryCode: '🇺🇸', app: 'Antigravity IDE', ip: '4.150.220.156:443', time: '<1 min ago', rule: 'Default Network Act', proto: 'TCP/TLS', latencyMs: 14.2, asn: 'AS8075 Microsoft Corp' },
  { id: 'c2', status: 'blocked', domain: 'default.spyscan.com',               country: 'US', countryCode: '🇺🇸', app: 'Antigravity IDE', ip: '13.107.5.88:443',   time: '<1 min ago', rule: 'Filter Lists', proto: 'TCP', latencyMs: 0, asn: 'AS8075 Microsoft Corp' },
  { id: 'c3', status: 'allowed', domain: 'login.live.com',                    country: 'US', countryCode: '🇺🇸', app: 'Windows Service: Appinfo', ip: '40.126.16.144:443', time: '1 min ago',  rule: 'Default Network Act', proto: 'TCP/TLS', latencyMs: 22.8, asn: 'AS8075 Microsoft Corp' },
  { id: 'c4', status: 'allowed', domain: 'cloudflare-dns.com',               country: 'DE', countryCode: '🇩🇪', app: 'Node.js Runtime', ip: '104.16.249.249:443',  time: '2 min ago',  rule: 'Encrypted DNS', proto: 'DoT/TLS', latencyMs: 8.4, asn: 'AS13335 Cloudflare' },
  { id: 'c5', status: 'blocked', domain: 'telemetry.malware-tracker.org',     country: 'NL', countryCode: '🇳🇱', app: 'Helium Core Engine', ip: '185.220.101.5:80', time: '3 min ago',  rule: 'SSRF Blocklist', proto: 'TCP/HTTP', latencyMs: 0, asn: 'AS60729 Tor Exit' },
  { id: 'c6', status: 'allowed', domain: 'api.github.com',                    country: 'US', countryCode: '🇺🇸', app: 'Brave Browser', ip: '140.82.121.4:443',   time: '4 min ago',  rule: 'Default Network Act', proto: 'TCP/TLS', latencyMs: 31.0, asn: 'AS36459 GitHub Inc' },
  { id: 'c7', status: 'allowed', domain: 'identity.sentrywatch.local',        country: 'SG', countryCode: '🇸🇬', app: 'SentryWatch API Server', ip: '198.51.100.12:8000', time: '5 min ago', rule: 'Core Local Act', proto: 'HTTP/REST', latencyMs: 1.2, asn: 'AS64496 RFC5737' },
];

export const Overview: React.FC<OverviewProps> = ({
  reports,
  latestEvents,
  globalSearch = '',
  isExpertMode = false,
  onNavigateToScan,
  onNavigateToLogs,
  onNavigateToApps,
}) => {
  const [appSearch, setAppSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'allowed' | 'blocked'>('all');
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [appSortMode, setAppSortMode] = useState<'activity' | 'name'>('activity');
  const [selectedCountry, setSelectedCountry] = useState<string>('all');
  const [selectedDomain, setSelectedDomain] = useState<string>('all');
  const [selectedAppFilter, setSelectedAppFilter] = useState<string>('all');
  const [groupBy, setGroupBy] = useState<'app' | 'country' | 'status'>('app');
  const [isReloading, setIsReloading] = useState(false);
  const [lastReloadText, setLastReloadText] = useState('just now');
  const [connections, setConnections] = useState<ConnectionLog[]>(INITIAL_CONNECTIONS);
  const [inspectingConnection, setInspectingConnection] = useState<ConnectionLog | null>(null);

  // Dropdown menus
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [domainDropdownOpen, setDomainDropdownOpen] = useState(false);
  const [appDropdownOpen, setAppDropdownOpen] = useState(false);

  // Unique country & domain options for filter dropdowns
  const availableCountries = Array.from(new Set(connections.map(c => c.country)));
  const availableDomains = Array.from(new Set(connections.map(c => c.domain)));
  const availableApps = Array.from(new Set(connections.map(c => c.app)));

  // Filter apps in left column
  const effectiveAppSearch = appSearch || globalSearch;
  let filteredApps = INITIAL_APPS_DATA.filter(a =>
    a.name.toLowerCase().includes(effectiveAppSearch.toLowerCase()) ||
    a.category.toLowerCase().includes(effectiveAppSearch.toLowerCase())
  );

  // Sort apps
  if (appSortMode === 'activity') {
    filteredApps.sort((a, b) => b.connections - a.connections);
  } else {
    filteredApps.sort((a, b) => a.name.localeCompare(b.name));
  }

  // Reload action
  const handleReload = () => {
    setIsReloading(true);
    setTimeout(() => {
      // Inject a fresh telemetry connection event
      const sampleTargets = [
        { domain: 'cdn.auth0.com', country: 'US', countryCode: '🇺🇸', app: 'Brave Browser', ip: '104.16.19.8:443', rule: 'Default Network Act', proto: 'TCP/TLS', latencyMs: 16.4, asn: 'AS13335 Cloudflare' },
        { domain: 'api.openai.com', country: 'US', countryCode: '🇺🇸', app: 'Antigravity IDE', ip: '104.18.7.192:443', rule: 'Default Network Act', proto: 'TCP/TLS', latencyMs: 24.1, asn: 'AS13335 Cloudflare' },
        { domain: 'raw.githubusercontent.com', country: 'US', countryCode: '🇺🇸', app: 'Node.js Runtime', ip: '185.199.108.133:443', rule: 'Default Network Act', proto: 'TCP/TLS', latencyMs: 19.8, asn: 'AS54113 Fastly' }
      ];
      const nextSample = sampleTargets[Math.floor(Math.random() * sampleTargets.length)];
      const newConn: ConnectionLog = {
        id: `c-live-${Date.now()}`,
        status: 'allowed',
        time: '<1 min ago',
        ...nextSample
      };

      setConnections(prev => [newConn, ...prev.slice(0, 19)]);
      setIsReloading(false);
      setLastReloadText('just now');
    }, 450);
  };

  // Block connection action
  const handleBlockConnection = (id: string) => {
    setConnections(prev => prev.map(c => c.id === id ? { ...c, status: 'blocked', rule: 'User Custom Block' } : c));
    if (inspectingConnection?.id === id) {
      setInspectingConnection(prev => prev ? { ...prev, status: 'blocked', rule: 'User Custom Block' } : null);
    }
  };

  // Filter connections in right column
  const filteredConnections = connections.filter(c => {
    // Top global search or status filter
    const effectiveQuery = globalSearch.toLowerCase();
    if (effectiveQuery) {
      const matchQuery = 
        c.domain.toLowerCase().includes(effectiveQuery) ||
        c.app.toLowerCase().includes(effectiveQuery) ||
        c.ip.toLowerCase().includes(effectiveQuery) ||
        c.rule.toLowerCase().includes(effectiveQuery);
      if (!matchQuery) return false;
    }

    if (activeFilter === 'allowed' && c.status !== 'allowed') return false;
    if (activeFilter === 'blocked' && c.status !== 'blocked') return false;
    
    // Left app selection filter
    if (selectedAppId) {
      const selectedAppName = INITIAL_APPS_DATA.find(a => a.id === selectedAppId)?.name;
      if (selectedAppName && !c.app.toLowerCase().includes(selectedAppName.toLowerCase())) return false;
    }

    // Dropdown filters
    if (selectedCountry !== 'all' && c.country !== selectedCountry) return false;
    if (selectedDomain !== 'all' && c.domain !== selectedDomain) return false;
    if (selectedAppFilter !== 'all' && c.app !== selectedAppFilter) return false;

    return true;
  });

  return (
    <div className="flex w-full h-full bg-[#0A0A0A] text-[#E8E6E3] overflow-hidden select-none font-sans">
      
      {/* ═════════════════════════════════════════════════════════════
          LEFT COLUMN: Hero Status Shield, Alert Banner, App List
          ═════════════════════════════════════════════════════════════ */}
      <div className="w-[330px] min-w-[330px] flex flex-col border-r border-[#1E1E1E] bg-[#0D0D0D] h-full">
        
        {/* Status Shield Hero */}
        <div className="flex flex-col items-center justify-center pt-6 pb-4 px-4 border-b border-[#1E1E1E]">
          <div className="relative mb-2 flex items-center justify-center">
            <div className="w-14 h-14 rounded-2xl bg-[#1A1A1A] border border-[#2A2A2A] flex items-center justify-center animate-shield-glow">
              <ShieldCheck size={32} className="text-[#6B8F71]" strokeWidth={2.2} />
            </div>
          </div>

          <h2 className="text-[16px] font-semibold text-[#E8E6E3]">
            SecOps Active
          </h2>
          <span className="text-[11px] text-[#6B8F71] font-medium mt-0.5">
            Active Threat Protection
          </span>
        </div>

        {/* Notifications / Alerts Banner */}
        {!bannerDismissed && (
          <div className="p-3 border-b border-[#1E1E1E]">
            <div className="text-[11px] font-medium text-[#5A5A5A] mb-1.5 px-0.5">
              Notifications
            </div>

            <div className="flex items-center gap-2.5 p-2 rounded-md bg-[#C4963A]/8 border border-[#C4963A]/20 text-[#C4963A]">
              <div className="w-6 h-6 rounded bg-[#C4963A] flex items-center justify-center text-[#0A0A0A] shrink-0">
                <Megaphone size={13} strokeWidth={2.2} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold text-[#D4A64A] truncate">
                  Optimizing OISD-NSFW Filter List
                </div>
                <div className="text-[10px] text-[#8A7040] truncate">
                  Background sync in progress
                </div>
              </div>
              <button 
                onClick={() => setBannerDismissed(true)}
                className="text-[#5A5A5A] hover:text-[#E8E6E3] text-xs px-1"
                title="Dismiss notification"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Apps List Header with Functional Search and Sort */}
        <div className="flex items-center justify-between px-3 pt-3 pb-2">
          <div className="relative flex-1 mr-2">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5A5A5A]" />
            <input
              type="text"
              value={appSearch}
              onChange={(e) => setAppSearch(e.target.value)}
              placeholder="SEARCH APPS"
              className="w-full h-7 pl-7 pr-2 text-[11px] bg-[#141414] rounded border border-[#1E1E1E] text-[#E8E6E3] placeholder-[#5A5A5A] focus:outline-none focus:border-[#6B8F71]/40"
            />
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[10px] font-mono text-[#5A5A5A] bg-[#141414] px-1.5 py-1 rounded border border-[#1E1E1E]">
              {filteredApps.length} APPS
            </span>
            <button 
              onClick={() => setAppSortMode(m => m === 'activity' ? 'name' : 'activity')}
              className={`p-1 rounded hover:bg-[#141414] transition-colors ${appSortMode === 'name' ? 'text-[#6B8F71]' : 'text-[#5A5A5A] hover:text-[#8A8A8A]'}`}
              title={`Sorting by: ${appSortMode === 'activity' ? 'Most Connections' : 'Alphabetical Name'} (Click to toggle)`}
            >
              <ArrowUpDown size={12} />
            </button>
          </div>
        </div>

        {/* Left App Selection Active Filter Badge */}
        {selectedAppId && (
          <div className="mx-2 mb-1 px-2.5 py-1 bg-[#1A1A1A] border border-[#2A2A2A] rounded flex items-center justify-between text-[11px] text-[#6B8F71]">
            <span className="truncate">Filter: {INITIAL_APPS_DATA.find(a => a.id === selectedAppId)?.name}</span>
            <button onClick={() => setSelectedAppId(null)} className="hover:text-white ml-1">✕</button>
          </div>
        )}

        {/* Apps List Items */}
        <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
          {filteredApps.map((app) => {
            const isSelected = selectedAppId === app.id;
            return (
              <div
                key={app.id}
                onClick={() => setSelectedAppId(isSelected ? null : app.id)}
                className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-[#1A1A1A] border border-[#6B8F71]/50'
                    : 'bg-[#111111] border border-[#1A1A1A] hover:bg-[#161616] hover:border-[#222222]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                    style={{ background: app.color }}
                  >
                    {app.iconLetter}
                  </div>

                  <div className="min-w-0">
                    <div className="text-[12px] font-medium text-[#E8E6E3] truncate">
                      {app.name}
                    </div>
                    <div className="text-[10px] text-[#5A5A5A] truncate">
                      {app.category}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-[#1A1A1A] text-[#8A8A8A] border border-[#1E1E1E] min-w-[20px] text-center">
                    {app.connections}
                  </span>

                  {/* Activity bar */}
                  <div className="w-8 h-1.5 rounded-full bg-[#1A1A1A] overflow-hidden">
                    <div
                      className="h-full bg-[#6B8F71] rounded-full"
                      style={{ width: `${app.activityLevel}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </div>


      {/* ═════════════════════════════════════════════════════════════
          RIGHT COLUMN: Live Traffic Graph & Connection Table
          ═════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0A0A0A]">
        
        {/* ── FILTER CHIPS BAR (FULLY INTERACTIVE) ── */}
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-[#1E1E1E] bg-[#0D0D0D]">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Allowed Filter */}
            <button 
              onClick={() => setActiveFilter(activeFilter === 'allowed' ? 'all' : 'allowed')}
              className={`px-3 py-1 text-[11.5px] rounded-md font-medium transition-colors ${
                activeFilter === 'allowed'
                  ? 'bg-[#1A1A1A] text-[#6B8F71] border border-[#6B8F71]/40'
                  : 'bg-[#111111] text-[#8A8A8A] border border-[#1A1A1A] hover:bg-[#161616]'
              }`}
            >
              Allowed
            </button>

            {/* Blocked Filter */}
            <button 
              onClick={() => setActiveFilter(activeFilter === 'blocked' ? 'all' : 'blocked')}
              className={`px-3 py-1 text-[11.5px] rounded-md font-medium transition-colors ${
                activeFilter === 'blocked'
                  ? 'bg-[#C45C5C]/15 text-[#D47070] border border-[#C45C5C]/40'
                  : 'bg-[#111111] text-[#8A8A8A] border border-[#1A1A1A] hover:bg-[#161616]'
              }`}
            >
              Blocked
            </button>

            <span className="h-4 w-[1px] bg-[#1E1E1E] mx-1" />

            {/* Country Dropdown Filter */}
            <div className="relative">
              <button 
                onClick={() => { setCountryDropdownOpen(!countryDropdownOpen); setDomainDropdownOpen(false); setAppDropdownOpen(false); }}
                className={`px-2.5 py-1 text-[11px] rounded border flex items-center gap-1.5 transition-colors ${
                  selectedCountry !== 'all' ? 'bg-[#1A1A1A] text-[#6B8F71] border-[#6B8F71]/40' : 'bg-[#111111] text-[#8A8A8A] border-[#1A1A1A] hover:text-[#E8E6E3]'
                }`}
              >
                <span>{selectedCountry === 'all' ? 'Country' : `Country: ${selectedCountry}`}</span>
                <ChevronDown size={11} />
              </button>

              {countryDropdownOpen && (
                <div className="absolute left-0 mt-1 w-36 bg-[#141414] border border-[#222222] rounded-md shadow-xl py-1 z-50">
                  <button
                    onClick={() => { setSelectedCountry('all'); setCountryDropdownOpen(false); }}
                    className="w-full text-left px-3 py-1.5 text-xs text-[#8A8A8A] hover:bg-[#1A1A1A] hover:text-white"
                  >
                    All Countries
                  </button>
                  {availableCountries.map(c => (
                    <button
                      key={c}
                      onClick={() => { setSelectedCountry(c); setCountryDropdownOpen(false); }}
                      className="w-full text-left px-3 py-1.5 text-xs text-[#E8E6E3] hover:bg-[#1A1A1A] flex items-center justify-between"
                    >
                      <span>{c}</span>
                      {selectedCountry === c && <CheckCircle2 size={12} className="text-[#6B8F71]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Domain Dropdown Filter */}
            <div className="relative">
              <button 
                onClick={() => { setDomainDropdownOpen(!domainDropdownOpen); setCountryDropdownOpen(false); setAppDropdownOpen(false); }}
                className={`px-2.5 py-1 text-[11px] rounded border flex items-center gap-1.5 transition-colors ${
                  selectedDomain !== 'all' ? 'bg-[#1A1A1A] text-[#6B8F71] border-[#6B8F71]/40' : 'bg-[#111111] text-[#8A8A8A] border-[#1A1A1A] hover:text-[#E8E6E3]'
                }`}
              >
                <span className="truncate max-w-[90px]">{selectedDomain === 'all' ? 'Domain' : selectedDomain}</span>
                <ChevronDown size={11} />
              </button>

              {domainDropdownOpen && (
                <div className="absolute left-0 mt-1 w-56 bg-[#141414] border border-[#222222] rounded-md shadow-xl py-1 z-50 max-h-60 overflow-y-auto">
                  <button
                    onClick={() => { setSelectedDomain('all'); setDomainDropdownOpen(false); }}
                    className="w-full text-left px-3 py-1.5 text-xs text-[#8A8A8A] hover:bg-[#1A1A1A] hover:text-white"
                  >
                    All Domains
                  </button>
                  {availableDomains.map(d => (
                    <button
                      key={d}
                      onClick={() => { setSelectedDomain(d); setDomainDropdownOpen(false); }}
                      className="w-full text-left px-3 py-1.5 text-xs text-[#E8E6E3] hover:bg-[#1A1A1A] truncate"
                    >
                      {d}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* App Dropdown Filter */}
            <div className="relative">
              <button 
                onClick={() => { setAppDropdownOpen(!appDropdownOpen); setCountryDropdownOpen(false); setDomainDropdownOpen(false); }}
                className={`px-2.5 py-1 text-[11px] rounded border flex items-center gap-1.5 transition-colors ${
                  selectedAppFilter !== 'all' ? 'bg-[#1A1A1A] text-[#6B8F71] border-[#6B8F71]/40' : 'bg-[#111111] text-[#8A8A8A] border-[#1A1A1A] hover:text-[#E8E6E3]'
                }`}
              >
                <span className="truncate max-w-[90px]">{selectedAppFilter === 'all' ? 'App' : selectedAppFilter}</span>
                <ChevronDown size={11} />
              </button>

              {appDropdownOpen && (
                <div className="absolute left-0 mt-1 w-52 bg-[#141414] border border-[#222222] rounded-md shadow-xl py-1 z-50">
                  <button
                    onClick={() => { setSelectedAppFilter('all'); setAppDropdownOpen(false); }}
                    className="w-full text-left px-3 py-1.5 text-xs text-[#8A8A8A] hover:bg-[#1A1A1A] hover:text-white"
                  >
                    All Apps
                  </button>
                  {availableApps.map(a => (
                    <button
                      key={a}
                      onClick={() => { setSelectedAppFilter(a); setAppDropdownOpen(false); }}
                      className="w-full text-left px-3 py-1.5 text-xs text-[#E8E6E3] hover:bg-[#1A1A1A] truncate"
                    >
                      {a}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Reset Filter Button */}
            {(selectedCountry !== 'all' || selectedDomain !== 'all' || selectedAppFilter !== 'all' || activeFilter !== 'all' || selectedAppId) && (
              <button
                onClick={() => {
                  setSelectedCountry('all');
                  setSelectedDomain('all');
                  setSelectedAppFilter('all');
                  setActiveFilter('all');
                  setSelectedAppId(null);
                }}
                className="text-[10px] text-[#C45C5C] hover:underline px-1"
              >
                Reset filters
              </button>
            )}
          </div>

          {/* Group By & Reload Actions */}
          <div className="flex items-center gap-2 text-[11px] text-[#5A5A5A]">
            <button
              onClick={() => setGroupBy(g => g === 'app' ? 'country' : g === 'country' ? 'status' : 'app')}
              className="hover:text-[#E8E6E3] transition-colors cursor-pointer"
              title="Click to cycle grouping mode (App / Country / Status)"
            >
              Group By: <strong className="text-[#8A8A8A] font-normal uppercase">{groupBy}</strong>
            </button>

            <span className="h-3 w-[1px] bg-[#1E1E1E]" />

            <button 
              onClick={handleReload}
              disabled={isReloading}
              className="flex items-center gap-1 text-[#8A8A8A] hover:text-[#6B8F71] transition-colors cursor-pointer"
              title="Poll latest socket connections"
            >
              <RefreshCw size={11} className={isReloading ? 'animate-spin text-[#6B8F71]' : ''} />
              <span>Reload</span>
            </button>
          </div>
        </div>

        {/* Live Traffic Waveform Graph */}
        <div className="px-5 pt-3 pb-2 border-b border-[#1E1E1E] bg-[#0A0A0A]">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-mono tracking-wider text-[#5A5A5A] uppercase">
              CONNECTIONS & THROUGHPUT
            </span>
            <span className="text-[11px] font-mono text-[#8A8A8A]">
              128 KB/s · 42 pkts/s {isExpertMode && '· TCP ESTABLISHED: 32'}
            </span>
          </div>

          <div className="w-full h-24 relative overflow-hidden rounded bg-[#0F0F0F] border border-[#1E1E1E] p-2">
            <svg viewBox="0 0 600 80" className="w-full h-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id="sageArea" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#6B8F71" stopOpacity="0.20" />
                  <stop offset="100%" stopColor="#6B8F71" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              <line x1="0" y1="20" x2="600" y2="20" stroke="#1E1E1E" strokeDasharray="3 3" />
              <line x1="0" y1="50" x2="600" y2="50" stroke="#1E1E1E" strokeDasharray="3 3" />

              <path
                d="M 0 65 Q 60 55 120 60 T 240 50 T 360 25 T 440 20 T 520 40 T 600 35 L 600 80 L 0 80 Z"
                fill="url(#sageArea)"
              />

              <path
                d="M 0 65 Q 60 55 120 60 T 240 50 T 360 25 T 440 20 T 520 40 T 600 35"
                fill="none"
                stroke="#6B8F71"
                strokeWidth="1.5"
              />
            </svg>

            <div className="absolute bottom-1 left-3 right-3 flex justify-between text-[9px] font-mono text-[#3A3A3A]">
              <span>5 min ago</span>
              <span>4 min ago</span>
              <span>3 min ago</span>
              <span>2 min ago</span>
              <span>1 min ago</span>
              <span className="text-[#8A8A8A]">LIVE</span>
            </div>
          </div>
        </div>

        {/* Connections Stream Table */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between px-5 py-2 text-[11px] font-medium text-[#5A5A5A] border-b border-[#1E1E1E]">
            <span>Showing {filteredConnections.length} of {connections.length} connections</span>
            <span>Last Reload: {lastReloadText}</span>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
            {filteredConnections.map((conn) => {
              const isAllowed = conn.status === 'allowed';
              return (
                <div
                  key={conn.id}
                  onClick={() => setInspectingConnection(conn)}
                  className="flex items-center justify-between px-3 py-2 rounded bg-[#111111] border border-[#1A1A1A] hover:bg-[#161616] hover:border-[#222222] transition-colors text-xs cursor-pointer group"
                >
                  {/* Status Dot & Domain */}
                  <div className="flex items-center gap-2.5 min-w-[280px]">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        isAllowed ? 'bg-[#6B8F71]' : 'bg-[#C45C5C]'
                      }`}
                    />
                    <span className="font-mono text-[12px] text-[#E8E6E3] truncate group-hover:text-[#6B8F71] transition-colors" title={conn.domain}>
                      {conn.domain}
                    </span>
                  </div>

                  {/* Country */}
                  <div className="flex items-center gap-1.5 text-[#8A8A8A] text-[11px] font-mono min-w-[60px]">
                    <span>{conn.countryCode}</span>
                    <span>{conn.country}</span>
                  </div>

                  {/* App Source */}
                  <div className="text-[11.5px] text-[#8A8A8A] min-w-[160px] truncate">
                    {conn.app}
                  </div>

                  {/* IP & Protocol (Expert mode shows protocol + latency) */}
                  <div className="text-[11px] font-mono text-[#5A5A5A] min-w-[150px]">
                    {conn.ip} {isExpertMode && conn.proto && <span className="text-[#8A8A8A] ml-1">({conn.proto})</span>}
                  </div>

                  {/* Latency in expert mode */}
                  {isExpertMode && (
                    <div className="text-[10px] font-mono text-[#6B8F71] min-w-[60px]">
                      {conn.latencyMs ? `${conn.latencyMs}ms` : '0ms'}
                    </div>
                  )}

                  {/* Timestamp */}
                  <div className="text-[11px] font-mono text-[#3A3A3A] min-w-[70px]">
                    {conn.time}
                  </div>

                  {/* Rule Tag */}
                  <div className="text-right">
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded border ${
                        isAllowed
                          ? 'bg-[#1A1A1A] text-[#8A8A8A] border-[#1E1E1E]'
                          : 'bg-[#C45C5C]/8 text-[#D47070] border-[#C45C5C]/15'
                      }`}
                    >
                      {conn.rule}
                    </span>
                  </div>
                </div>
              );
            })}

            {filteredConnections.length === 0 && (
              <div className="p-8 text-center text-xs text-[#5A5A5A]">
                No connections match current filters.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── CONNECTION INSPECTOR MODAL ── */}
      {inspectingConnection && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-lg bg-[#141414] border border-[#222222] rounded-xl p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#1E1E1E] mb-4">
              <div className="flex items-center gap-2.5">
                <span className={`w-2.5 h-2.5 rounded-full ${inspectingConnection.status === 'allowed' ? 'bg-[#6B8F71]' : 'bg-[#C45C5C]'}`} />
                <h3 className="text-sm font-semibold text-[#E8E6E3] font-mono">{inspectingConnection.domain}</h3>
              </div>

              <button onClick={() => setInspectingConnection(null)} className="text-[#5A5A5A] hover:text-white p-1">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs mb-5">
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-[#8A8A8A]">
                <div className="p-2.5 rounded bg-[#0D0D0D] border border-[#1E1E1E]">
                  <span className="text-[#5A5A5A] block text-[10px]">Source App:</span>
                  <span className="text-[#E8E6E3] font-sans font-medium">{inspectingConnection.app}</span>
                </div>
                <div className="p-2.5 rounded bg-[#0D0D0D] border border-[#1E1E1E]">
                  <span className="text-[#5A5A5A] block text-[10px]">Remote Endpoint:</span>
                  <span className="text-[#E8E6E3]">{inspectingConnection.ip}</span>
                </div>
                <div className="p-2.5 rounded bg-[#0D0D0D] border border-[#1E1E1E]">
                  <span className="text-[#5A5A5A] block text-[10px]">Geo / ASN:</span>
                  <span className="text-[#E8E6E3]">{inspectingConnection.countryCode} {inspectingConnection.asn || inspectingConnection.country}</span>
                </div>
                <div className="p-2.5 rounded bg-[#0D0D0D] border border-[#1E1E1E]">
                  <span className="text-[#5A5A5A] block text-[10px]">Active Rule:</span>
                  <span className="text-[#6B8F71]">{inspectingConnection.rule}</span>
                </div>
              </div>

              <div className="p-3 rounded bg-[#0D0D0D] border border-[#1E1E1E] text-xs text-[#8A8A8A]">
                <strong className="text-[#E8E6E3]">Security Status: </strong>
                {inspectingConnection.status === 'allowed'
                  ? 'Traffic permitted under default HTTPS socket rules.'
                  : 'Connection blocked by filter list rule.'}
              </div>
            </div>

            <div className="flex justify-between items-center">
              <button
                onClick={() => {
                  setInspectingConnection(null);
                  onNavigateToApps();
                }}
                className="text-[11px] text-[#6B8F71] hover:underline flex items-center gap-1"
              >
                <ExternalLink size={12} />
                <span>Configure App Policy</span>
              </button>

              <div className="flex gap-2">
                <button
                  onClick={() => setInspectingConnection(null)}
                  className="px-3 py-1.5 text-xs rounded bg-[#1A1A1A] text-[#8A8A8A] hover:text-[#E8E6E3] border border-[#222222]"
                >
                  Close
                </button>
                {inspectingConnection.status === 'allowed' ? (
                  <button
                    onClick={() => handleBlockConnection(inspectingConnection.id)}
                    className="px-3 py-1.5 text-xs rounded bg-[#C45C5C] text-[#0A0A0A] font-semibold hover:bg-[#D47070]"
                  >
                    Block Connection
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setConnections(prev => prev.map(c => c.id === inspectingConnection.id ? { ...c, status: 'allowed', rule: 'User Override Allowed' } : c));
                      setInspectingConnection(null);
                    }}
                    className="px-3 py-1.5 text-xs rounded bg-[#6B8F71] text-[#0A0A0A] font-semibold hover:bg-[#7DA385]"
                  >
                    Unblock Traffic
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
