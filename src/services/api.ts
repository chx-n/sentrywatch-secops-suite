import { 
  ScanRequest, 
  ScanReport, 
  ParsedEvent, 
  ParserStats, 
  Severity, 
  TelemetryEvent,
  PortProbe,
  HostScanResult,
  PortState
} from '../types';

const API_BASE = '/api/v1';

class SentryWatchService {
  private apiKey: string = 'dev-key-change-me';
  private isConnectedToBackend: boolean = false;
  private subscribers: Set<(event: TelemetryEvent) => void> = new Set();
  private activeWs: WebSocket | null = null;

  constructor() {
    this.checkBackendHealth();
  }

  public setApiKey(key: string) {
    this.apiKey = key;
  }

  public getApiKey(): string {
    return this.apiKey;
  }

  public async checkBackendHealth(): Promise<boolean> {
    try {
      const res = await fetch('/healthz', { signal: AbortSignal.timeout(1500) });
      this.isConnectedToBackend = res.ok;
    } catch {
      this.isConnectedToBackend = false;
    }
    return this.isConnectedToBackend;
  }

  public isBackendOnline(): boolean {
    return this.isConnectedToBackend;
  }

  // --- Scanning Service ---
  public async submitScan(
    request: ScanRequest, 
    onTelemetry?: (event: TelemetryEvent) => void
  ): Promise<ScanReport> {
    const isLive = await this.checkBackendHealth();
    const simulateMode = new URLSearchParams(window.location.search).get('simulate') === 'true';

    if (isLive) {
      try {
        const res = await fetch(`${API_BASE}/scans`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.apiKey,
          },
          body: JSON.stringify(request),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: 'Scan submission failed' }));
          throw new Error(err.detail || `HTTP ${res.status}`);
        }

        const data = await res.json();
        const scanId = data.scan_id;

        if (onTelemetry) {
          this.connectTelemetryWs(scanId, onTelemetry);
        }

        // Poll for completion
        return await this.pollScanUntilComplete(scanId, onTelemetry);
      } catch (err) {
        if (simulateMode) {
          console.warn('Backend scan failed, using simulation mode:', err);
          return await this.simulateScan(request, onTelemetry);
        }
        throw err;
      }
    }

    if (simulateMode) {
      return await this.simulateScan(request, onTelemetry);
    }

    throw new Error('Backend unavailable. Add ?simulate=true to use simulation mode.');
  }

  private async pollScanUntilComplete(
    scanId: string, 
    onTelemetry?: (event: TelemetryEvent) => void
  ): Promise<ScanReport> {
    const maxAttempts = 120;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const res = await fetch(`${API_BASE}/scans/${scanId}`, {
        headers: { 'X-API-Key': this.apiKey }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'completed' && data.report) {
          return data.report;
        }
        if (data.status === 'failed') {
          throw new Error(data.error || 'Scan execution failed on backend');
        }
        if (onTelemetry) {
          onTelemetry({
            type: 'progress',
            scan_id: scanId,
            timestamp: new Date().toISOString(),
            data: { status: data.status, hosts_reported: data.hosts_reported }
          });
        }
      }
    }
    throw new Error('Scan timed out waiting for backend report');
  }

  private connectTelemetryWs(scanId: string, callback: (event: TelemetryEvent) => void) {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/v1/ws/telemetry/${scanId}?token=${encodeURIComponent(this.apiKey)}`;
      this.activeWs = new WebSocket(wsUrl);

      this.activeWs.onmessage = (msg) => {
        try {
          const parsed = JSON.parse(msg.data);
          if (parsed.payload && !parsed.data) {
            parsed.data = parsed.payload;
          }
          callback(parsed);
        } catch {
          // ignore heartbeat parse errors
        }
      };

      this.activeWs.onerror = () => {
        console.warn('Telemetry WS disconnected');
      };
    } catch (err) {
      console.warn('Failed to start WS connection:', err);
    }
  }

  // --- High-Fidelity SecOps Local Engine Simulator ---
  public async simulateScan(
    req: ScanRequest, 
    onTelemetry?: (event: TelemetryEvent) => void
  ): Promise<ScanReport> {
    const scanId = crypto.randomUUID ? crypto.randomUUID() : `scan-${Date.now()}`;
    const startTime = new Date();
    const ports = typeof req.ports === 'string' 
      ? this.parsePortString(req.ports) 
      : (Array.isArray(req.ports) ? req.ports : [21, 22, 53, 80, 443, 8080, 8443, 3306, 5432]);

    const hosts: HostScanResult[] = [];
    let totalOpen = 0;

    for (let tIdx = 0; tIdx < req.targets.length; tIdx++) {
      const target = req.targets[tIdx];
      const hostStart = new Date();

      if (onTelemetry) {
        onTelemetry({
          type: 'host_start',
          scan_id: scanId,
          timestamp: new Date().toISOString(),
          data: { target, index: tIdx + 1, total: req.targets.length }
        });
      }

      // SSRF validation simulation
      if (!req.allow_private_networks && (target.startsWith('10.') || target.startsWith('192.168.') || target === '127.0.0.1' || target === 'localhost')) {
        hosts.push({
          target,
          address: null,
          probes: [],
          started_at: hostStart.toISOString(),
          completed_at: new Date().toISOString(),
          duration_ms: 25,
          open_ports: [],
          open_port_count: 0,
          error: 'SSRF guard rejected RFC1918 / loopback target (enable allow_private_networks to scan)'
        });
        continue;
      }

      const probes: PortProbe[] = [];
      const openPorts: number[] = [];

      // Generate simulated IP
      const mockIp = this.generateTargetIp(target);

      // Probe each port with progress delay
      for (const port of ports) {
        // slight jitter
        await new Promise(r => setTimeout(r, Math.max(15, Math.floor(100 / (req.max_concurrency || 32)))));

        const isOpen = this.shouldPortBeOpen(target, port);
        const isFiltered = !isOpen && (port === 110 || port === 143 || port === 993);
        const state: PortState = isOpen ? 'open' : (isFiltered ? 'filtered' : 'closed');
        const latency = isOpen ? (12 + Math.random() * 45) : (35 + Math.random() * 120);
        const banner = isOpen ? this.getBannerForPort(port, target) : null;

        const probe: PortProbe = {
          port,
          state,
          latency_ms: Math.round(latency * 100) / 100,
          banner: req.grab_banners ? banner : null,
          detail: isOpen ? `TCP handshaked in ${latency.toFixed(1)}ms` : (isFiltered ? 'SYN filtered / drop' : 'RST received')
        };

        if (isOpen) {
          openPorts.push(port);
          totalOpen++;
        }

        probes.push(probe);

        if (onTelemetry) {
          onTelemetry({
            type: 'probe',
            scan_id: scanId,
            timestamp: new Date().toISOString(),
            data: { target, port, state, latency_ms: probe.latency_ms, banner }
          });
        }
      }

      const hostEnd = new Date();
      hosts.push({
        target,
        address: mockIp,
        probes,
        started_at: hostStart.toISOString(),
        completed_at: hostEnd.toISOString(),
        duration_ms: hostEnd.getTime() - hostStart.getTime(),
        open_ports: openPorts,
        open_port_count: openPorts.length,
        error: null
      });

      if (onTelemetry) {
        onTelemetry({
          type: 'host_complete',
          scan_id: scanId,
          timestamp: new Date().toISOString(),
          data: { target, open_ports: openPorts.length }
        });
      }
    }

    const endTime = new Date();
    const report: ScanReport = {
      id: scanId,
      targets: req.targets,
      ports_scanned: ports,
      hosts,
      started_at: startTime.toISOString(),
      completed_at: endTime.toISOString(),
      duration_ms: endTime.getTime() - startTime.getTime(),
      hosts_scanned: hosts.length,
      hosts_failed: hosts.filter(h => h.error !== null).length,
      open_port_count: totalOpen,
      successful: hosts.every(h => h.error === null),
      meta: { simulation: true }
    };

    if (onTelemetry) {
      onTelemetry({
        type: 'complete',
        scan_id: scanId,
        timestamp: new Date().toISOString(),
        data: { report }
      });
    }

    return report;
  }

  private parsePortString(spec: string): number[] {
    const ports = new Set<number>();
    const tokens = spec.split(',');
    for (const t of tokens) {
      const piece = t.trim();
      if (!piece) continue;
      if (piece.includes('-')) {
        const [s, e] = piece.split('-').map(Number);
        if (!isNaN(s) && !isNaN(e) && s <= e) {
          for (let p = s; p <= Math.min(e, 65535); p++) ports.add(p);
        }
      } else {
        const p = parseInt(piece, 10);
        if (!isNaN(p) && p >= 1 && p <= 65535) ports.add(p);
      }
    }
    return Array.from(ports).sort((a, b) => a - b);
  }

  private shouldPortBeOpen(target: string, port: number): boolean {
    const hash = (target.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) + port) % 10;
    if (port === 80 || port === 443) return true;
    if (port === 22 && hash % 2 === 0) return true;
    if (port === 8080 && hash > 4) return true;
    if (port === 8443 && hash > 6) return true;
    if (port === 3306 && hash === 1) return true;
    if (port === 5432 && hash === 3) return true;
    if (port === 53 && hash > 7) return true;
    return false;
  }

  private getBannerForPort(port: number, target: string): string {
    switch (port) {
      case 22:
        return 'SSH-2.0-OpenSSH_9.3p1 Ubuntu-1ubuntu3.2';
      case 80:
        return `nginx/1.24.0 (Ubuntu) - HTTP/1.1 200 OK (${target})`;
      case 443:
        return `TLSv1.3 / HTTP/2 - cloudflare-edge / ALPN [h2, http/1.1]`;
      case 8080:
        return 'SentryWatch-Telemetry-Gateway v0.1.0 (FastAPI / Uvicorn)';
      case 8443:
        return 'EnvoyProxy/1.28.0 (SecOps Ingress Mesh)';
      case 53:
        return 'CoreDNS-1.11.1 (DNS-over-TLS enabled)';
      case 3306:
        return '8.0.36-0ubuntu0.22.04.1 (MySQL Community Server)';
      case 5432:
        return 'PostgreSQL 16.2 on x86_64-pc-linux-gnu';
      default:
        return `TCP-ACK SentryProbe Service on :${port}`;
    }
  }

  private generateTargetIp(target: string): string {
    let sum = 0;
    for (let i = 0; i < target.length; i++) sum += target.charCodeAt(i);
    return `198.51.100.${(sum % 240) + 10}`;
  }

  // --- Log Streaming & Parser Engine (Mirroring core/parser.py) ---
  public parseLine(line: string): ParsedEvent {
    const raw = line.trim();
    const id = `evt-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    // Syslog RFC 5424 / 3164 pattern
    const syslogRegex = /^<(?<priority>\d{1,3})>(?<timestamp>[A-Z][a-z]{2}\s+\d{1,2} \d{2}:\d{2}:\d{2}) (?<host>[\w.-]+) (?<process>[\w\-/.]+)(?:\[(?<pid>\d+)\])?: (?<message>.*)$/;
    const syslogMatch = raw.match(syslogRegex);
    if (syslogMatch && syslogMatch.groups) {
      const pri = parseInt(syslogMatch.groups.priority, 10);
      const severity = this.syslogPriorityToSeverity(pri);
      const fields = { ...syslogMatch.groups };
      delete fields.priority;
      delete fields.timestamp;
      return {
        id,
        raw_line: raw,
        source_rule: 'syslog',
        severity,
        timestamp: syslogMatch.groups.timestamp,
        fields,
        matched: true,
        parsed_at: new Date().toISOString()
      };
    }

    // Apache CLF pattern
    const clfRegex = /^(?<remote_addr>\S+) \S+ (?<remote_user>\S+) \[(?<timestamp>[^\]]+)\] "(?<method>[A-Z]+) (?<path>\S+) (?<protocol>[^"]+)" (?<status>\d{3}) (?<bytes_sent>\d+|-)/;
    const clfMatch = raw.match(clfRegex);
    if (clfMatch && clfMatch.groups) {
      const status = parseInt(clfMatch.groups.status, 10);
      const severity: Severity = status >= 500 ? 'error' : (status >= 400 ? 'warning' : 'info');
      return {
        id,
        raw_line: raw,
        source_rule: 'apache_clf',
        severity,
        timestamp: clfMatch.groups.timestamp,
        fields: { ...clfMatch.groups },
        matched: true,
        parsed_at: new Date().toISOString()
      };
    }

    // Key-Value pattern
    const kvRegex = /(?<key>[A-Za-z_][\w.-]*)=(?:"(?<dq>[^"]*)"|'(?<sq>[^']*)'|(?<bare>[^\s,;]+))/g;
    let match;
    const fields: Record<string, string> = {};
    let kvFound = false;
    while ((match = kvRegex.exec(raw)) !== null) {
      if (match.groups) {
        kvFound = true;
        const val = match.groups.dq ?? match.groups.sq ?? match.groups.bare ?? '';
        fields[match.groups.key] = val;
      }
    }

    if (kvFound) {
      const level = (fields.level || fields.severity || fields.action || '').toLowerCase();
      let severity: Severity = 'unknown';
      if (['emergency', 'emerg'].includes(level)) severity = 'emergency';
      else if (['alert', 'crit', 'critical'].includes(level)) severity = 'critical';
      else if (['error', 'err', 'failed', 'denied', 'drop'].includes(level)) severity = 'error';
      else if (['warning', 'warn'].includes(level)) severity = 'warning';
      else if (['notice', 'info', 'accept', 'allow'].includes(level)) severity = 'info';
      else if (['debug'].includes(level)) severity = 'debug';

      return {
        id,
        raw_line: raw,
        source_rule: 'key_value',
        severity,
        timestamp: fields.timestamp || fields.time || null,
        fields,
        matched: true,
        parsed_at: new Date().toISOString()
      };
    }

    return {
      id,
      raw_line: raw,
      source_rule: null,
      severity: 'unknown',
      timestamp: null,
      fields: {},
      matched: false,
      parsed_at: new Date().toISOString()
    };
  }

  private syslogPriorityToSeverity(pri: number): Severity {
    const code = (pri >= 0 && pri <= 191) ? (pri % 8) : -1;
    switch (code) {
      case 0: return 'emergency';
      case 1: return 'alert';
      case 2: return 'critical';
      case 3: return 'error';
      case 4: return 'warning';
      case 5: return 'notice';
      case 6: return 'info';
      case 7: return 'debug';
      default: return 'unknown';
    }
  }

  // --- Live System Network & Application Discovery ---
  public async getNetworkApps(): Promise<any[]> {
    try {
      const res = await fetch(`${API_BASE}/system/network-apps`, {
        headers: { 'X-API-Key': this.apiKey },
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Failed fetching live network apps from backend:', e);
    }
    return [];
  }

  public async getConnections(): Promise<any[]> {
    try {
      const res = await fetch(`${API_BASE}/system/connections`, {
        headers: { 'X-API-Key': this.apiKey },
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Failed fetching live connections from backend:', e);
    }
    return [];
  }

  // --- Live Log Ingestion & Parsing ---
  public async parseLogs(lines: string[]): Promise<{ events: ParsedEvent[]; stats: any }> {
    try {
      const res = await fetch(`${API_BASE}/logs/parse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        body: JSON.stringify({ lines }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Backend parseLogs failed:', e);
    }
    return { events: [], stats: { lines_in: 0, events_out: 0, matched_threats: 0, recognition_rate: 0 } };
  }

  public async getSystemLogs(limit: number = 50): Promise<{ events: ParsedEvent[]; stats: any }> {
    try {
      const res = await fetch(`${API_BASE}/logs/system?limit=${limit}`, {
        headers: { 'X-API-Key': this.apiKey },
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Backend getSystemLogs failed:', e);
    }
    return { events: [], stats: { lines_in: 0, events_out: 0, matched_threats: 0, recognition_rate: 0 } };
  }

  // --- Real Security Alerts & Threat Actions ---
  public async getAlerts(): Promise<any[]> {
    try {
      const res = await fetch(`${API_BASE}/alerts`, {
        headers: { 'X-API-Key': this.apiKey },
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Backend getAlerts failed:', e);
    }
    return [];
  }

  public async acknowledgeAlert(id?: string, all: boolean = false): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/alerts/acknowledge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        body: JSON.stringify({ alert_id: id, all }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async blockIp(ip: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/alerts/block-ip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        body: JSON.stringify({ ip }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // --- Synthetic Stream Samples for Live Demo ---
  public getSampleLogs(): string[] {
    return [
      '<134>Aug 25 23:14:02 sentry-node-01 sshd[4912]: Failed password for invalid user root from 198.51.100.42 port 52312 ssh2',
      '203.0.113.88 - admin [25/Aug/2026:23:14:05 +0000] "POST /api/v1/scans HTTP/1.1" 202 128',
      'action="FIREWALL_DROP" src_ip="185.220.101.5" dst_ip="198.51.100.10" dst_port="22" proto="TCP" level="warning" reason="SSRF_GUARD_TRIGGERED"',
      '<34>Aug 25 23:14:08 sentry-waf nginx-ingress[1042]: ModSecurity: Access denied with code 403 (Phase 2). Pattern match "\\bUNION\\b.*\\bSELECT\\b" at ARGS:id.',
      '198.51.100.15 - - [25/Aug/2026:23:14:12 +0000] "GET /healthz HTTP/1.1" 200 2',
      'event="SURICATA_ALERT" gid="1" sid="2010935" rev="3" msg="ET SCAN Potential Nmap OS Detection Probe" proto="TCP" src_ip="45.33.32.156" dst_ip="198.51.100.10" level="alert"',
      '<11>Aug 25 23:14:18 sentry-auth-srv auth0[892]: [AUTH-FAIL] Repeated invalid MFA tokens for user admin@sentrywatch.local count=5 level=critical',
      'app="sentrywatch-scanner" scan_id="scan-98f21b" target="api.prod.local" port="443" state="open" latency_ms="18.4" banner="TLSv1.3 Envoy" level="info"',
      '192.0.2.140 - test-bot [25/Aug/2026:23:14:24 +0000] "GET /etc/passwd HTTP/1.1" 404 182',
      'status="500" method="POST" endpoint="/api/v1/query" error="RedisConnectionTimeout" host="redis-master.internal" level="error"'
    ];
  }
}

export const apiService = new SentryWatchService();
