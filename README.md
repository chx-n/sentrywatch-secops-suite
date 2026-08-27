# SentryWatch SecOps Suite

Production-grade, reusable cybersecurity platform: an asynchronous scanning engine,
streaming log parser, FastAPI telemetry backend, and React dashboard.

## Layout

| Path        | Purpose                                                        |
| ----------- | -------------------------------------------------------------- |
| `core/`     | Typed library: asyncio scanner, streaming parser, SSRF guards, Pydantic v2 schemas (PEP 561 `py.typed`) |
| `cli/`      | Typer + Rich CLI with table / JSON / CSV output                |
| `api/`      | FastAPI app: API-key auth, CORS allow-list, slowapi limits, WebSocket telemetry |
| `src/`      | React + TypeScript + Tailwind dashboard with reconnecting WebSocket hook |
| `tests/`    | pytest unit + integration suites                               |

## Quickstart

```bash
# 1. Python Engine & CLI
python3.11 -m venv .venv && source .venv/bin/activate
pip install -e ".[api,cli,dev]"
pytest                          # full test suite
uvicorn api.main:app --reload   # API on :8000 (docs at /docs)

# 2. React Dashboard (localhost:5173)
pnpm install && pnpm start      # or npm install && npm run dev
```

### Docker

```bash
export SENTRYWATCH_API_KEYS=$(openssl rand -hex 32)
docker compose up --build
# dashboard http://localhost:8080  |  api http://localhost:8000/docs
```

## Security model

* All user targets pass SSRF screening (`core/security.py`): scheme/credential stripping,
  reserved-CIDR blocklists (incl. cloud metadata), hostname syntax enforcement, and
  DNS pinning — the scanner dials validated literal IPs only.
* API key middleware uses constant-time comparison; WebSockets authenticate via a
  `token` query parameter; `/healthz` and `/readyz` stay unauthenticated for probes.
* Private/RFC1918 targets require explicit opt-in on **both** client and server.

## Configuration (env)

`SENTRYWATCH_API_KEYS`, `SENTRYWATCH_ALLOWED_ORIGINS`, `SENTRYWATCH_RATE_LIMIT`,
`SENTRYWATCH_REDIS_URL`, `SENTRYWATCH_ALLOW_PRIVATE_NETWORKS`,
`SENTRYWATCH_MAX_CONCURRENT_SCANS`.

Frontend: set `VITE_SENTRYWATCH_API_KEY` at build/dev time.

## License

MIT
