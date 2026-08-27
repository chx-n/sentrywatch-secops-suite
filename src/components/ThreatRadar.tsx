import React, { useRef, useEffect } from 'react';
import { HostScanResult } from '../types';

interface RadarProps {
  hosts: HostScanResult[];
  isScanning?: boolean;
}

export const ThreatRadar: React.FC<RadarProps> = ({ hosts, isScanning = false }) => {
  const cvs = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = cvs.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const R  = Math.min(cx, cy) - 18;

    const TEAL   = '#00D4AA';
    const AMBER  = '#F59E0B';
    const RED    = '#EF4444';

    const blips = hosts.map((h, i) => {
      const angle = (i / Math.max(hosts.length, 1)) * Math.PI * 2 - Math.PI / 2;
      const dist  = Math.min(0.88, Math.max(0.25, (h.duration_ms || 80) / 240));
      const color = h.error ? RED : h.open_port_count > 0 ? TEAL : AMBER;
      return { angle, dist, color, target: h.target, open: h.open_port_count, pulse: 0 };
    });

    let sweep  = 0;
    let raf: number;
    const SPEED = isScanning ? 0.035 : 0.018;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      // Background fill
      ctx.fillStyle = 'rgba(6,10,16,0.98)';
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();

      // Grid rings
      [0.25, 0.5, 0.75, 1].forEach((f, i) => {
        ctx.beginPath();
        ctx.arc(cx, cy, R * f, 0, Math.PI * 2);
        ctx.strokeStyle = i === 3 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // Cross hairs
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4].forEach(a => {
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
        ctx.lineTo(cx - Math.cos(a) * R, cy - Math.sin(a) * R);
        ctx.stroke();
      });

      // Sweep arc
      const TAIL = Math.PI / 3;
      const start = sweep - TAIL;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, start, sweep);
      ctx.closePath();
      const sweepGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      sweepGrad.addColorStop(0, 'rgba(0,212,170,0)');
      sweepGrad.addColorStop(1, 'rgba(0,212,170,0.12)');
      ctx.fillStyle = sweepGrad;
      ctx.fill();

      // Sweep leading edge
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(sweep) * R, cy + Math.sin(sweep) * R);
      ctx.strokeStyle = 'rgba(0,212,170,0.75)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Blips
      blips.forEach(b => {
        const bx = cx + Math.cos(b.angle) * (R * b.dist);
        const by = cy + Math.sin(b.angle) * (R * b.dist);

        const diff = ((sweep - b.angle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        if (diff < 0.12) b.pulse = 1;
        else b.pulse = Math.max(0.1, b.pulse - 0.016);

        // outer ring
        ctx.beginPath();
        ctx.arc(bx, by, 8 * b.pulse, 0, Math.PI * 2);
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 1;
        ctx.globalAlpha = b.pulse * 0.6;
        ctx.stroke();
        ctx.globalAlpha = 1;

        // dot
        ctx.beginPath();
        ctx.arc(bx, by, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = b.color;
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;

        // label
        ctx.fillStyle = 'rgba(240,244,255,0.7)';
        ctx.font = '10px "IBM Plex Mono"';
        ctx.fillText(b.target.length > 15 ? b.target.slice(0, 14) + '…' : b.target, bx + 6, by - 2);
        if (b.open > 0) {
          ctx.fillStyle = b.color;
          ctx.fillText(`${b.open} open`, bx + 6, by + 9);
        }
      });

      // Center
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fillStyle = TEAL;
      ctx.shadowColor = TEAL;
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;

      sweep += SPEED;
      if (sweep > Math.PI * 2) sweep -= Math.PI * 2;
      raf = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(raf);
  }, [hosts, isScanning]);

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <canvas
        ref={cvs}
        width={300}
        height={300}
        style={{
          borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.06)',
          display: 'block',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        }}
      />
      <div className="flex items-center justify-center gap-4 mono text-[10px] text-text-3">
        <span className="flex items-center gap-1.5"><span className="status-dot dot-teal" style={{width:5,height:5}} /> Open ports</span>
        <span className="flex items-center gap-1.5"><span className="status-dot dot-amber" style={{width:5,height:5}} /> Filtered</span>
        <span className="flex items-center gap-1.5"><span className="status-dot dot-red" style={{width:5,height:5}} /> SSRF Blocked</span>
      </div>
    </div>
  );
};
