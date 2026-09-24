import React, { useState, Suspense, lazy } from 'react';
import { Header } from './components/Header';
import { Sidebar, TabType } from './components/Sidebar';
import { Overview } from './components/Overview';
import { AlertsView } from './components/AlertsView';
import { AllAppsView } from './components/AllAppsView';
import { ScanEngine } from './components/ScanEngine';
import { LogParser } from './components/LogParser';
import { GlobalSettingsView } from './components/GlobalSettingsView';
import { HelpView } from './components/HelpView';
import { TipsModal } from './components/TipsModal';
import { ScanReport, ParsedEvent } from './types';

const ThreatRadar = lazy(() => import('./components/ThreatRadar').then(m => ({ default: m.ThreatRadar })));
const ReportsView = lazy(() => import('./components/ReportsView').then(m => ({ default: m.ReportsView })));
const SettingsModal = lazy(() => import('./components/SettingsModal').then(m => ({ default: m.SettingsModal })));

const Skeleton = () => (
  <div className="flex-1 flex items-center justify-center bg-[#0A0A0A]">
    <div className="text-[#5A5A5A] text-xs animate-pulse">Loading...</div>
  </div>
);

export const App: React.FC = () => {
  const [tab, setTab] = useState<TabType>('overview');
  const [reports, setReports] = useState<ScanReport[]>([]);
  const [events, setEvents] = useState<ParsedEvent[]>([]);
  const [scanTarget, setScanTarget] = useState('scanme.nmap.org');
  const [searchQuery, setSearchQuery] = useState('');
  const [isExpertMode, setIsExpertMode] = useState(false);
  const [tipsOpen, setTipsOpen] = useState(false);
  const [hasNotifications, setHasNotifications] = useState(true);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0A0A0A] text-[#E8E6E3] overflow-hidden select-none font-sans">
      
      {/* Top Header Bar */}
      <Header
        onOpenHelp={() => setTab('help')}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isExpertMode={isExpertMode}
        onToggleExpertMode={() => setIsExpertMode(!isExpertMode)}
      />

      {/* Main Workspace (Sidebar Rail + Dynamic View) */}
      <div className="flex flex-1 min-h-0 w-full overflow-hidden">
        
        {/* Left Sidebar Rail */}
        <Sidebar
          currentTab={tab}
          onSelectTab={(newTab) => {
            if (newTab === 'alerts') setHasNotifications(false);
            setTab(newTab);
          }}
          hasNotifications={hasNotifications}
          onOpenNotifications={() => {
            setHasNotifications(false);
            setTab('alerts');
          }}
          onOpenTips={() => setTipsOpen(true)}
        />

        {/* Content View */}
        <main className="flex-1 flex flex-col h-full min-h-0 min-w-0 bg-[#0A0A0A] overflow-hidden">
          {tab === 'overview' && (
            <Overview
              reports={reports}
              latestEvents={events}
              globalSearch={searchQuery}
              isExpertMode={isExpertMode}
              onNavigateToScan={(t) => { if (t) setScanTarget(t); setTab('scanner'); }}
              onNavigateToLogs={() => setTab('logs')}
              onNavigateToApps={() => setTab('apps')}
            />
          )}

          {tab === 'alerts' && (
            <AlertsView
              onNavigateToLogs={() => setTab('logs')}
              onNavigateToApps={() => setTab('apps')}
            />
          )}

          {tab === 'apps' && (
            <AllAppsView globalSearch={searchQuery} />
          )}

          {tab === 'scanner' && (
            <ScanEngine
              initialTarget={scanTarget}
              onScanComplete={(r) => setReports(p => [r, ...p])}
            />
          )}

          {tab === 'logs' && (
            <LogParser onEventsUpdated={setEvents} />
          )}

          {tab === 'radar' && (
            <Suspense fallback={<Skeleton />}>
              <ThreatRadar 
                hosts={reports.flatMap(r => r.hosts)} 
                onNavigateToScan={() => setTab('scanner')}
              />
            </Suspense>
          )}

          {tab === 'reports' && (
            <Suspense fallback={<Skeleton />}>
              <ReportsView reports={reports} onClearReports={() => setReports([])} />
            </Suspense>
          )}

          {tab === 'settings' && (
            <GlobalSettingsView />
          )}

          {tab === 'help' && (
            <HelpView />
          )}
        </main>
      </div>

      {/* Tips Tour Card */}
      <TipsModal
        isOpen={tipsOpen}
        onClose={() => setTipsOpen(false)}
      />

    </div>
  );
};

export default App;
