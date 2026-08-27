import React, { useState } from 'react';
import { X, Key, ShieldCheck } from 'lucide-react';
import { apiService } from '../services/api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [key,     setKey]     = useState(apiService.getApiKey());
  const [saved,   setSaved]   = useState(false);

  if (!isOpen) return null;

  const save = () => {
    apiService.setApiKey(key);
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 700);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(4,6,10,0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        className="panel animate-slide-up"
        style={{
          width: '100%',
          maxWidth: 500,
          padding: 24,
          borderColor: 'rgba(0,212,170,0.25)',
        }}
      >
        {/* header */}
        <div className="flex items-center justify-between mb-5 pb-3 border-b border-white/[0.08]">
          <div>
            <h2 className="font-bold text-base text-text-1">
              Security & Engine Settings
            </h2>
            <p className="text-xs text-text-3">Configure API connection and safety policies.</p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-4 text-xs">
          {/* API key */}
          <div>
            <label className="block text-xs font-semibold text-text-2 mb-1 flex items-center gap-1.5">
              <Key size={13} className="text-teal" /> Backend Secret API Key
            </label>
            <input
              type="text"
              className="field text-xs font-mono bg-[var(--obs-1)] border-white/10"
              value={key}
              onChange={e => setKey(e.target.value)}
              placeholder="dev-key-change-me"
            />
            <span className="text-[11px] text-text-3 block mt-1">
              Secret password used by frontend to talk securely with backend API (:8000).
            </span>
          </div>

          {/* Safety notice */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 6,
              background: 'rgba(0,212,170,0.04)',
              border: '1px solid rgba(0,212,170,0.15)',
            }}
          >
            <div className="flex items-center gap-1.5 mb-1.5 font-bold text-xs" style={{ color: '#5ffce0' }}>
              <ShieldCheck size={14} color="var(--teal)" />
              Built-In Safety Shield (SSRF Guard)
            </div>
            <p className="text-[11px] text-text-3 leading-relaxed">
              SentryWatch includes automatic safety locks to prevent accidental scanning of private home/office networks (192.168.x.x, 10.x.x.x) or cloud instance credentials (169.254.169.254).
            </p>
          </div>

          {/* Proxy info */}
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 6,
              background: 'var(--obs-1)',
              border: '1px solid var(--line)',
            }}
          >
            <div className="text-[11px] font-semibold text-text-3 mb-0.5">Local Server Port Forwarding:</div>
            <div className="text-xs text-text-2 font-mono">
              Dashboard (5173) ⇄ Python Backend (8000)
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-5 pt-3 border-t border-white/[0.08]">
          <button onClick={onClose} className="btn btn-ghost text-xs">Close</button>
          <button onClick={save} className="btn btn-primary text-xs font-semibold px-4">
            {saved ? 'Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};
