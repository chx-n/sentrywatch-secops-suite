# Design System: SentryWatch SecOps Suite

## 1. Visual Theme & Atmosphere
A high-density, mission-critical SecOps cyber-command interface. Clinical, dark-tech, and precise with edge-to-edge spatial layout. The atmosphere reflects a high-security operations terminal — austere Void dark surfaces, high-contrast Cyber Teal singular accent, tabular telemetry numerals, and hardware-accelerated motion feedback without decorative AI slop.

- **Visual Density:** Cockpit Dense (8/10)
- **Design Variance:** Controlled Tactical (6/10)
- **Motion Intensity:** Fluid Performance (5/10)

## 2. Color Palette & Roles
- **Deep Void** (`#060A10`) — Primary background canvas
- **Obsidian Tier 1** (`#090D14`) — Inset panels, sidebar, inputs
- **Obsidian Tier 2** (`#0D1320`) — Standard panels, cards, threat containers
- **Obsidian Tier 3** (`#11192B`) — Raised modules, hovered surfaces
- **Obsidian Tier 4** (`#182237`) — Outlines and scrollbar tracks
- **Cyber Teal** (`#00D4AA`) — Singular accent for primary CTAs, active telemetry, open ports, and focus rings
- **Cyber Teal Dim** (`rgba(0, 212, 170, 0.14)`) — Chip fills, active navigation highlights
- **Amber Alert** (`#F59E0B`) — Filtered ports, security warnings
- **Crimson Alert** (`#EF4444`) — Blocked SSRF targets, errors, critical alerts
- **Sky Alert** (`#38BDF8`) — Informational packets, notices
- **Primary Ink** (`#F0F4FF`) — High-contrast display typography
- **Muted Steel** (`#8899BB`) — Secondary descriptions and parameters
- **Deep Slate** (`#4A5878`) — Labels, timestamps, inactive states
- **Whisper Line** (`rgba(255, 255, 255, 0.05)`) — Structural 1px division borders

*(Strictly 1 accent color: Cyber Teal. Saturated purple/neon glows banned. Pure `#000000` banned.)*

## 3. Typography Rules
- **Display / Headers:** `Space Grotesk` (300, 400, 500, 600, 700) — Track-tight, weight-driven hierarchy, `text-wrap: balance`.
- **Telemetry / Mono:** `IBM Plex Mono` (400, 500, 600) — For all code, addresses, port numbers, log streams, timestamps, metrics. Tabular figures enforced (`font-variant-numeric: tabular-nums`).
- **Body:** System sans fallback with max 65ch line limits.
- **Banned:** `Inter` default usage, generic serif fonts in software dashboards, emojis as UI iconography.

## 4. Component Stylings
- **Buttons:** Tactile `-1px` translate and `scale(0.97)` on `:active`. Cyber Teal fill for `.btn-primary` with `#060A10` contrasting text. Outline `.btn-ghost` for secondary tools. No neon box-shadow glows. Explicit transition properties only (`background-color`, `transform`, `box-shadow`, `border-color`).
- **Panels & Containers:** Layered concentric radii (`--radius-sm: 4px`, `--radius-md: 8px`, `--radius-lg: 12px`). Subdued 1px borders. No random heavy shadows.
- **Inputs & Range Fields:** Inset `#090D14` background, Cyber Teal focus ring (`box-shadow: 0 0 0 2px rgba(0, 212, 170, 0.08)`).
- **Badges & Chips:** Pill badges with 1px border and 10% opacity tint fill. Color-coded by severity and port state.
- **Empty States:** Composed terminal empty states with clear instructions — no decorative emoji glyphs.

## 5. Layout Principles
- **Cockpit Edge-to-Edge:** Zero horizontal global margin on `<main>`. Each view module manages internal padding (`.view-pad`) with a max container width of 1440px.
- **Asymmetric Command Layout:** Top persistent status bar + fixed 220px left navigation + modular right telemetry canvas.
- **CSS Grid Architecture:** Structured multi-column dashboard without flexbox percentage calculations.
- **Mobile Collapse:** Multi-column panels stack gracefully below 768px (`md`).

## 6. Motion & Interaction
- **Radar & Telemetry Motion:** 4s continuous radar sweep with Canvas radial gradients. Hardware-accelerated transforms (`translateY`, `scale`, `opacity`) only.
- **Live Stream Indicator:** Infinite gentle ping animation (`ping-teal` 2s loop) on active WebSocket connection.
- **Transitions:** Snappy 150ms ease-out transitions for interactive elements. `transition: all` is prohibited.

## 7. Anti-Patterns (Banned)
- No emojis anywhere in UI text, badges, or states (use Lucide/Phosphor icons or clean text indicators like `ERR`).
- No generic AI purple/blue neon glows.
- No centered hero layouts on operational dashboard screens.
- No 3-column equal card feature layouts.
- No `Inter` as primary body font.
- No pure `#000000` black surfaces.
- No generic circular loading spinners (use skeletal shimmers or pulse progress bars).
- No unconstrained continuous state updates on React render loops.
