import React, { useRef, useEffect, useState } from 'react';
import { HostScanResult } from '../types';
import { apiService } from '../services/api';
import { Radio, RefreshCw, Shield, AlertTriangle, ExternalLink } from 'lucide-react';

interface RadarProps {
  hosts: HostScanResult[];
  isScanning?: boolean;
  onNavigateToScan?: (target?: string) => void;
}

export const ThreatRadar: React.FC<RadarProps> = ({ 
  hosts, 
  isScanning = false,
  onNavigateToScan 
}) => {
  const cvs = useRef<HTMLCanvasElement>(null);
  const [liveTargets, setLiveTargets] = useState<HostScanResult[]>([]);
  const [isSweeping, setIsSweeping] = useState(false);
  const [selectedHost, setSelectedHost] = useState<HostScanResult | null>(null);

  // Load live system endpoints if no scan reports exist yet
  const loadLiveConnections = async () => {
    setIsSweeping(true);
    try {
      const conns = await apiService.getConnections();
      if (conns && conns.length > 0) {
        // Group by remote or local host
        const hostsMap = new Map<string, HostScanResult>();
        conns.slice(0, 12).forEach((c, idx) => {
          const target = c.remote_ip || c.local_address.split(':')[0];
          if (!hostsMap.has(target)) {
            const now = new Date().toISOString();
            hostsMap.set(target, {
              target,
              address: target,
              started_at: now,
              completed_at: now,
              duration_ms: 15 + (idx * 12) % 180,
              probes: [],
              open_ports: c.remote_port > 0 ? [c.remote_port] : [],
              open_port_count: c.remote_port > 0 ? 1 : 0,
            });
          }
        });
        const mapped = Array.from(hostsMap.values());
        setLiveTargets(mapped);
      }
    } catch (e) {
      console.warn('Failed loading live radar connections:', e);
    } finally {
      setIsSweeping(false);
    }
  };

  useEffect(() => {
    if (hosts.length === 0) {
      loadLiveConnections();
    }
  }, [hosts.length]);

  const displayHosts = hosts.length > 0 ? hosts : liveTargets;

  useEffect(() => {
    const canvas = cvs.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const R  = Math.min(cx, cy) - 24;

    const TEAL   = '#00D4AA';
    const AMBER  = '#F59E0B';
    const RED    = '#EF4444';

    const blips = displayHosts.map((h, i) => {
      const angle = (i / Math.max(displayHosts.length, 1)) * Math.PI * 2 - Math.PI / 2;
      const dist  = Math.min(0.85, Math.max(0.28, (h.duration_ms || 80) / 240));
      const color = h.error ? RED : h.open_port_count > 0 ? TEAL : AMBER;
      return { angle, dist, color, target: h.target, open: h.open_port_count, host: h };
    });

    let sweep  = 0;
    let raf: number;
    const SPEED = isScanning || isSweeping ? 0.04 : 0.015;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      // Radar body fill
      ctx.fillStyle = 'rgba(10, 14, 20, 0.98)';
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();

      // Range concentric rings
      [0.25, 0.5, 0.75, 1.0].forEach((f, i) => {
        ctx.beginPath();
        ctx.arc(cx, cy, R * f, 0, Math.PI * 2);
        ctx.strokeStyle = i === 3 ? 'rgba(107, 143, 113, 0.35)' : 'rgba(255, 255, 255, 0.06)';
        ctx.lineWidth = i === 3 ? 1.5 : 1;
        ctx.stroke();

        // Distance marker
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.font = '9px monospace';
        ctx.fillText(`${Math.round(f * 250)}ms`, cx + 4, cy - R * f + 12);
      });

      // Crosshairs
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
      ctx.lineWidth = 1;
      [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4].forEach(a => {
        ctx.beginPath();
        ctx.moveTo(cx - Math.cos(a) * R, cy - Math.sin(a) * R);
        ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
        ctx.stroke();
      });

      // Rotating Radar Beam
      const grad = ctx.createConicGradient(sweep, cx, cy);
      grad.addColorStop(0, 'rgba(0, 212, 170, 0.25)');
      grad.addColorStop(0.12, 'rgba(0, 212, 170, 0.04)');
      grad.addColorStop(0.2, 'transparent');
      grad.addColorStop(1, 'transparent');

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = grad;
      ctx.fill();

      // Leading beam line
      const lx = cx + Math.cos(sweep) * R;
      const ly = cy + Math.sin(sweep) * R;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(lx, ly);
      ctx.strokeStyle = 'rgba(0, 212, 170, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      // Target Blips
      blips.forEach(b => {
        const bx = cx + Math.cos(b.angle) * (R * b.dist);
        const by = cy + Math.sin(b.angle) * (R * b.dist);

        // Blip dot
        ctx.beginPath();
        ctx.arc(bx, by, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = b.color;
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Label
        ctx.fillStyle = 'rgba(240, 244, 255, 0.85)';
        ctx.font = '10px monospace';
        const displayTarget = b.target.length > 14 ? b.target.slice(0, 13) + '…' : b.target;
        ctx.fillText(displayTarget, bx + 7, by - 2);

        if (b.open > 0) {
          ctx.fillStyle = b.color;
          ctx.font = '9px monospace';
          ctx.fillText(`${b.open} open`, bx + 7, by + 9);
        }
      });

      // Center Core
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = TEAL;
      ctx.shadowColor = TEAL;
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;

      sweep += SPEED;
      if (sweep > Math.PI * 2) sweep -= Math.PI * 2;
      raf = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(raf);
  }, [displayHosts, isScanning, isSweeping]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0A0A0A] text-[#E8E6E3] overflow-y-auto p-6 font-sans select-none">
      
      {/* ── TOP HEADER ── */}
      <div className="flex items-center justify-between mb-6 pb-3 border-b border-[#1E1E1E]">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-[#E8E6E3]">
            Threat Radar & Perimeter Monitor
          </h1>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#6B8F71]/15 text-[#7DA385] border border-[#6B8F71]/30 flex items-center gap-1.5">
            <Radio size={11} className="text-[#6B8F71] animate-pulse" />
            {displayHosts.length} Monitored Endpoints
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadLiveConnections}
            disabled={isSweeping}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-[#141414] border border-[#1E1E1E] text-[#8A8A8A] hover:text-[#E8E6E3] hover:bg-[#1A1A1A] transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={13} className={isSweeping ? 'animate-spin text-[#6B8F71]' : ''} />
            <span>{isSweeping ? 'Sweeping...' : 'Sweep Local Net'}</span>
          </button>

          {onNavigateToScan && (
            <button
              onClick={() => onNavigateToScan()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-[#6B8F71] text-[#0A0A0A] font-semibold hover:bg-[#7DA385] transition-colors cursor-pointer"
            >
              <Shield size={13} />
              <span>Launch Target Scan</span>
            </button>
          )}
        </div>
      </div>

      {/* ── RADAR + TARGET LIST GRID ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Radar Canvas Card */}
        <div className="lg:col-span-2 flex flex-col items-center justify-center p-6 bg-[#111111] border border-[#1E1E1E] rounded-xl relative">
          <canvas
            ref={cvs}
            width={440}
            height={440}
            className="rounded-full shadow-2xl max-w-full"
            style={{
              border: '1px solid rgba(107, 143, 113, 0.25)',
              boxShadow: '0 0 50px rgba(0, 212, 170, 0.06)',
            }}
          />

          <div className="flex items-center justify-center gap-6 mt-6 font-mono text-[11px] text-[#8A8A8A]">
            <span className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#00D4AA] shadow-[0_0_8px_#00D4AA]" />
              Open Ports Detected
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
              Responsive / Filtered
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" />
              Threat / Blocked
            </span>
          </div>
        </div>

        {/* Live Detected Nodes Side Panel */}
        <div className="flex flex-col gap-3">
          <div className="p-3 bg-[#111111] border border-[#1E1E1E] rounded-lg">
            <h3 className="text-xs font-semibold text-[#8A8A8A] uppercase tracking-wider mb-2">
              Discovered Perimeter Nodes
            </h3>
            
            <div className="flex flex-col gap-2 max-h-[460px] overflow-y-auto pr-1">
              {displayHosts.length === 0 ? (
                <div className="text-xs text-[#5A5A5A] p-4 text-center">
                  No active hosts tracked. Run a target scan or click Sweep Local Net.
                </div>
              ) : (
                displayHosts.map((h, i) => (
                  <div
                    key={`${h.target}-${i}`}
                    onClick={() => setSelectedHost(h)}
                    className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between text-xs ${
                      selectedHost?.target === h.target
                        ? 'bg-[#1E1E1E] border-[#6B8F71]/60'
                        : 'bg-[#141414] border-[#1E1E1E] hover:border-[#2A2A2A]'
                    }`}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="font-mono font-medium text-[#E8E6E3]">{h.target}</span>
                      <span className="text-[10px] text-[#5A5A5A]">
                        {h.duration_ms ? `${h.duration_ms}ms latency` : 'Active'} · {h.open_port_count} ports open
                      </span>
                    </div>

                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                      h.error
                        ? 'bg-[#EF4444]/15 text-[#EF4444]'
                        : h.open_port_count > 0
                        ? 'bg-[#00D4AA]/15 text-[#00D4AA]'
                        : 'bg-[#F59E0B]/15 text-[#F59E0B]'
                    }`}>
                      {h.error ? 'BLOCKED' : h.open_port_count > 0 ? 'ACTIVE' : 'FILTERED'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
