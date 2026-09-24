export type PortState = 'open' | 'closed' | 'filtered' | 'error';

export interface PortProbe {
  port: number;
  state: PortState;
  latency_ms?: number | null;
  banner?: string | null;
  detail?: string | null;
}

export interface HostScanResult {
  target: string;
  address?: string | null;
  probes: PortProbe[];
  started_at: string;
  completed_at: string;
  duration_ms: number;
  open_ports: number[];
  open_port_count: number;
  error?: string | null;
}

export interface ScanReportMeta {
  simulation?: boolean;
}

export interface ScanReport {
  id: string;
  targets: string[];
  ports_scanned: number[];
  hosts: HostScanResult[];
  started_at: string;
  completed_at: string;
  duration_ms: number;
  hosts_scanned: number;
  hosts_failed: number;
  open_port_count: number;
  successful?: boolean;
  meta?: ScanReportMeta;
}

export interface ScanRequest {
  targets: string[];
  ports?: string | number[];
  max_concurrency?: number;
  connect_timeout_s?: number;
  banner_timeout_s?: number;
  grab_banners?: boolean;
  max_retries?: number;
  allow_private_networks?: boolean;
}

export type Severity =
  | 'emergency'
  | 'alert'
  | 'critical'
  | 'error'
  | 'warning'
  | 'notice'
  | 'info'
  | 'debug'
  | 'unknown';

export interface ParsedEvent {
  id?: string;
  raw_line: string;
  source_rule?: string | null;
  severity: Severity;
  timestamp?: string | null;
  fields: Record<string, string>;
  matched: boolean;
  parsed_at: string;
  is_simulated?: boolean;
}

export interface ParserStats {
  lines_in: number;
  matched: number;
  unmatched: number;
  bytes_seen: number;
  errors: number;
  match_ratio: number;
}

export interface TelemetryEvent {
  type: 'progress' | 'host_start' | 'host_result' | 'host_complete' | 'probe' | 'status' | 'complete' | 'failed' | 'cancelled' | 'heartbeat';
  scan_id?: string;
  timestamp?: string;
  data?: Record<string, any>;
  payload?: Record<string, any>;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'offline';
  version: string;
  redis: boolean;
  activeWorkers: number;
  memoryUsageMb: number;
  uptimeSeconds: number;
}
