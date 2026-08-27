# SentryWatch SecOps Suite — Repository Structure & Placement Contract

## 1. Directory Tree

```text
sentrywatch-secops-suite/
├── api/                        # FastAPI Web & WebSocket Server
│   ├── main.py                 # App initialization, routing & WebSocket server
│   ├── dependencies.py         # API key validation, security headers
│   └── routers/                # Sub-routers for scan, parse, telemetry
│
├── core/                       # Core Typed Library (PEP 561 py.typed)
│   ├── scanner.py              # Async TCP connect scanner with concurrency control
│   ├── parser.py               # Regex log streaming parser (Syslog, CLF, KV)
│   ├── security.py             # DNS pinning, SSRF validation, CIDR blocklists
│   └── models.py               # Pydantic v2 schemas & domain models
│
├── cli/                        # Terminal Command-Line Interface (Typer + Rich)
│   ├── main.py                 # CLI commands (scan, parse, export)
│   └── formatters.py           # Rich terminal table and JSON formatters
│
├── src/                        # React + TypeScript + Tailwind Frontend Deck
│   ├── components/             # High-density cockpit UI modules
│   │   ├── Header.tsx          # Top command bar, engine status, UTC clock
│   │   ├── Sidebar.tsx         # Tactical navigation rail & system diagnostics
│   │   ├── Overview.tsx        # Command cockpit overview & quick dialer
│   │   ├── ScanEngine.tsx      # Multi-target CIDR scanner & port inspector
│   │   ├── LogParser.tsx       # SOC streaming log analyzer & schema decoder
│   │   ├── TelemetryStream.tsx # Realtime WebSocket jitter histogram & packet grid
│   │   ├── ReportsView.tsx     # Security Audit Vault & Executive Inspector
│   │   ├── ThreatRadar.tsx     # Canvas-based 360° spatial threat map
│   │   └── SettingsModal.tsx   # API key and SSRF security policies
│   │
│   ├── services/
│   │   └── api.ts              # API client, WebSocket subscriber & local fallback
│   ├── types/                  # Shared TypeScript interfaces & schemas
│   ├── App.tsx                 # Root layout & tab router
│   ├── index.css               # Design System v3 tokens, utilities & animations
│   └── main.tsx                # React DOM root mounting point
│
├── tests/                      # Python pytest test suites
│   ├── test_scanner.py         # Async scanner unit tests
│   ├── test_parser.py          # Log parser regex tests
│   └── test_security.py        # SSRF screening & DNS pinning tests
│
├── docker/                     # Docker build assets
├── docker-compose.yml          # Container orchestration (Dashboard + API)
├── pyproject.toml              # Python package metadata & dependencies
├── package.json                # Frontend package dependencies & scripts
├── DESIGN.md                   # Google Stitch semantic design system spec
├── PROJECT_DOCUMENTATION.md    # Comprehensive system, architecture & design guide
└── README.md                   # Public repository documentation
```

## 2. Placement Rules

- **Frontend Views (`src/components/`):** New functional workspaces belong in `src/components/` with matching tab entries in `Sidebar.tsx` and `App.tsx`.
- **Core Security Logic (`core/security.py`):** Any target validation, scheme filtering, or IP resolution checks must live in `core/security.py` — never inside route handlers or frontend code.
- **Core Scanning & Parsing (`core/`):** Network probing and log parsing logic must remain headless, typed, and framework-agnostic.
- **API Endpoints (`api/`):** Web and WebSocket presentation layer only. Must delegate all computational and network logic to `core/`.
- **Styling (`src/index.css`):** Design tokens and base utilities are centralized in `src/index.css`. Component-specific layout styles use Tailwind classes with standard color tokens (`var(--teal)`, `var(--obs-1)`, `var(--text-1)`).

## 3. Naming Conventions

- **React Components:** PascalCase (`ScanEngine.tsx`, `TelemetryStream.tsx`).
- **Python Modules:** snake_case (`scanner.py`, `security.py`).
- **CSS Utility Classes:** kebab-case prefixed by role (`chip-teal`, `dot-teal`, `panel-inset`).
- **Environment Variables:** `SENTRYWATCH_*` uppercase (`SENTRYWATCH_API_KEYS`, `SENTRYWATCH_ALLOWED_ORIGINS`).
