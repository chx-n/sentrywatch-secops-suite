import React, { useState } from 'react';
import { 
  Search, 
  HelpCircle, 
  ChevronDown, 
  ShieldCheck
} from 'lucide-react';

interface HeaderProps {
  onOpenHelp: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  isExpertMode: boolean;
  onToggleExpertMode: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenHelp,
  searchQuery,
  onSearchChange,
  isExpertMode,
  onToggleExpertMode,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <header
      data-tauri-drag-region
      className="flex items-center justify-between px-4 py-2 select-none border-b border-[#1E1E1E]"
      style={{
        background: '#0D0D0D',
        height: 48,
        minHeight: 48,
      }}
    >
      {/* Left: Logo & Title */}
      <div data-tauri-drag-region className="flex items-center gap-2.5">
        <div className="w-6 h-6 rounded-full bg-[#1A1A1A] border border-[#2A2A2A] flex items-center justify-center">
          <ShieldCheck size={14} className="text-[#6B8F71]" />
        </div>
        <span className="font-semibold text-[13px] tracking-tight text-[#E8E6E3]">
          SentryWatch
        </span>
        <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-[#141414] text-[#5A5A5A] border border-[#1E1E1E]">
          v0.1.0
        </span>
      </div>

      {/* Center: Search Bar */}
      <div data-tauri-drag-region className="flex-1 max-w-md mx-6">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5A5A]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search apps, domains, IP addresses, ports..."
            className="w-full h-[30px] pl-8 pr-3 text-[12px] bg-[#141414] text-[#E8E6E3] placeholder-[#5A5A5A] rounded-md border border-[#1E1E1E] focus:border-[#6B8F71]/50 focus:outline-none transition-all"
          />
        </div>
      </div>

      {/* Right: Mode Selector & Get Help */}
      <div className="flex items-center gap-2.5">
        {/* Mode Selector Dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[11.5px] rounded bg-[#141414] border border-[#1E1E1E] text-[#8A8A8A] hover:text-[#E8E6E3] hover:border-[#2A2A2A] transition-colors"
          >
            <span>{isExpertMode ? 'Expert Interface' : 'Simple Interface'}</span>
            <ChevronDown size={12} className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-1 w-36 bg-[#1A1A1A] border border-[#2A2A2A] rounded-md shadow-xl py-1 z-50">
              <button
                onClick={() => { onToggleExpertMode(); setDropdownOpen(false); }}
                className="w-full text-left px-3 py-1.5 text-xs text-[#E8E6E3] hover:bg-[#222222] flex items-center justify-between"
              >
                <span>{isExpertMode ? 'Simple Mode' : 'Expert Mode'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Get Help */}
        <button
          onClick={onOpenHelp}
          className="flex items-center gap-1.5 px-2.5 py-1 text-[11.5px] rounded bg-[#141414] border border-[#1E1E1E] text-[#8A8A8A] hover:text-[#E8E6E3] hover:border-[#2A2A2A] transition-colors"
        >
          <HelpCircle size={13} className="text-[#8A8A8A]" />
          <span>Get Help</span>
        </button>
      </div>
    </header>
  );
};
