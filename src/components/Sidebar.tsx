import React, { useState } from 'react';
import {
  Activity,
  LayoutGrid,
  Radio,
  ScrollText,
  Settings,
  HelpCircle,
  Bell,
  Info,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';

export type TabType = 'overview' | 'alerts' | 'apps' | 'scanner' | 'logs' | 'settings' | 'help';

interface SidebarProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  hasNotifications: boolean;
  onOpenNotifications: () => void;
  onOpenTips: () => void;
}

interface NavItem {
  id: TabType;
  icon: LucideIcon;
  label: string;
}

const PRIMARY_NAV: NavItem[] = [
  { id: 'overview', icon: Activity,   label: 'Activity & Monitor' },
  { id: 'alerts',   icon: Bell,       label: 'Security Alerts' },
  { id: 'apps',     icon: LayoutGrid, label: 'All Apps' },
  { id: 'scanner',  icon: Radio,      label: 'Network Scanner' },
  { id: 'logs',     icon: ScrollText, label: 'Log Analyzer' },
];

const BOTTOM_NAV: NavItem[] = [
  { id: 'settings', icon: Settings,   label: 'Global Settings' },
  { id: 'help',     icon: HelpCircle, label: 'Help & Community' },
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  hasNotifications,
  onOpenNotifications,
  onOpenTips,
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <aside
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      className="flex flex-col py-2.5 bg-[#0D0D0D] border-r border-[#1E1E1E] select-none z-20 transition-all duration-200 ease-out overflow-hidden"
      style={{
        width: expanded ? 190 : 52,
        minWidth: expanded ? 190 : 52,
        height: 'calc(100vh - 48px)',
      }}
    >
      {/* Top Status & Tips Cluster */}
      <div className="flex flex-col gap-1.5 mb-2 px-1.5">
        {/* Shield Status Button */}
        <button
          onClick={() => onSelectTab('overview')}
          className="h-8 rounded-md flex items-center gap-2.5 px-2 text-[#8A8A8A] hover:text-[#E8E6E3] hover:bg-[#1A1A1A] transition-colors"
          title="Protection Status: Active"
        >
          <div className="w-6 h-6 shrink-0 rounded-full bg-[#1A1A1A] border border-[#2A2A2A] flex items-center justify-center">
            <ShieldCheck size={14} className="text-[#6B8F71]" />
          </div>
          <span
            className="text-[11px] font-medium whitespace-nowrap transition-opacity duration-150 text-[#E8E6E3]"
            style={{ opacity: expanded ? 1 : 0 }}
          >
            SecOps Active
          </span>
        </button>

        {/* Quick Tips Button */}
        <button
          onClick={onOpenTips}
          className="h-8 rounded-md flex items-center gap-2.5 px-2 text-[#5A5A5A] hover:text-[#8A8A8A] hover:bg-[#141414] transition-colors"
          title="SentryWatch Tips"
        >
          <Info size={16} className="shrink-0 ml-0.5" />
          <span
            className="text-[11px] whitespace-nowrap transition-opacity duration-150"
            style={{ opacity: expanded ? 1 : 0 }}
          >
            Tips
          </span>
        </button>
      </div>

      <div className="mx-3 h-[1px] bg-[#1E1E1E] my-1" />

      {/* Main Core Features Navigation (Upper Cluster) */}
      <nav className="flex flex-col gap-0.5 flex-1 mt-1 px-1.5">
        {PRIMARY_NAV.map(({ id, icon: Icon, label }) => {
          const active = currentTab === id;
          const isAlertTab = id === 'alerts';

          return (
            <button
              key={id}
              onClick={() => onSelectTab(id)}
              className={`h-9 rounded-md flex items-center gap-2.5 px-2 transition-all relative ${
                active
                  ? 'bg-[#1A1A1A] text-[#E8E6E3]'
                  : 'text-[#5A5A5A] hover:text-[#8A8A8A] hover:bg-[#141414]'
              }`}
              title={expanded ? undefined : label}
            >
              <div className="relative shrink-0 ml-0.5">
                <Icon size={17} strokeWidth={active ? 2 : 1.75} />
                {isAlertTab && hasNotifications && (
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#C4963A]" />
                )}
              </div>

              {/* Label text */}
              <span
                className="text-[11.5px] font-medium whitespace-nowrap transition-opacity duration-150"
                style={{ opacity: expanded ? 1 : 0 }}
              >
                {label}
              </span>

              {/* Active indicator bar on left edge */}
              {active && (
                <span className="absolute -left-[6px] top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-r bg-[#6B8F71]" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Navigation Cluster: Global Settings & Help & Community */}
      <div className="flex flex-col gap-0.5 mt-auto pt-2 border-t border-[#1E1E1E] px-1.5">
        {BOTTOM_NAV.map(({ id, icon: Icon, label }) => {
          const active = currentTab === id;
          return (
            <button
              key={id}
              onClick={() => onSelectTab(id)}
              className={`h-9 rounded-md flex items-center gap-2.5 px-2 transition-all relative ${
                active
                  ? 'bg-[#1A1A1A] text-[#E8E6E3]'
                  : 'text-[#5A5A5A] hover:text-[#8A8A8A] hover:bg-[#141414]'
              }`}
              title={expanded ? undefined : label}
            >
              <Icon size={17} strokeWidth={active ? 2 : 1.75} className="shrink-0 ml-0.5" />

              {/* Label text */}
              <span
                className="text-[11.5px] font-medium whitespace-nowrap transition-opacity duration-150"
                style={{ opacity: expanded ? 1 : 0 }}
              >
                {label}
              </span>

              {/* Active indicator bar on left edge */}
              {active && (
                <span className="absolute -left-[6px] top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-r bg-[#6B8F71]" />
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
};
