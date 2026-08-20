# Continuum — PRD & Status

_Last updated: 20 June 2026_

## Product
Continuum is an Organizational Resilience Intelligence platform that makes invisible human
dependencies visible across **Discover → Understand → Simulate → Fix → Measure**.

Language rule: expose *system* dependency, never blame individuals. Evidence before inference;
simulations are labelled as estimated impact, not prediction.

## Users
Founders, COOs, chiefs of staff, operations and resilience owners.

## Demo dataset (acceptance gates — all verified)
| Gate | Target | Status |
|---|---|---|
| Northstar Labs counts | 47 employees / 18 processes / 12 clients / 7 vendors / 11 systems | ✅ |
| Sarah Mitchell dependency score | 87 (5 unbacked critical processes, 3 clients, 2 vendors, 1 sole system, 41% documented, 0 trained backups) | ✅ |
| Org baseline resilience | 64 | ✅ |
| Critical human dependencies | 4 | ✅ |
| Sarah 90-day absence | 7 processes, 3 clients, 8 knowledge gaps, 4 critical findings | ✅ |
| Score journey | 64 → 39 → 82 | ✅ |
| Full demo journey | under 3 minutes | ✅ |

## Architecture
- **Backend** FastAPI + MongoDB (Motor). `/app/backend/`
  - `seed_data.py` — the entire Northstar dataset (deterministic, no random values)
  - `engine.py` — scoring + absence-simulation engine (person points model, org 4-dimension
    weighted score, finding rules, downstream propagation)
  - `server.py` — magic-link auth, session/org isolation, all `/api` routes, CSV import
- **Frontend** React (CRA + craco), plain CSS design system in `App.css`, recharts, sonner.
  - `src/App.js` routes: `/login /overview /map /people /people/:personId /simulate/:personId /actions`
  - `src/pages/*` one page per module, `src/components/Shell.jsx`, `src/components/primitives.jsx`
- **Design** dark-first "Operations Observatory" per `/app/design_guidelines.json`
  (IBM Plex Sans/Mono, lime accent #D7F36B, bordered rectangles, restrained motion).

### Scoring model (deterministic, explainable in UI)
Person points: `6×unbacked critical processes + 5×clients + 5×vendors + 5×sole systems +
0.25×(100−knowledge coverage) + backup penalty (12 − 6×trained backups)`, capped at 100.
Org score: `0.30×knowledge documentation + 0.30×backup ownership + 0.20×process documentation +
0.20×access resilience`.
Simulation penalty: `(2×affected processes + 2×clients + 0.5×knowledge gaps + 1×sole systems) ×
duration factor (7d 0.35 / 30d 0.65 / 90d 1.0 / permanent 1.3)`.
Mitigated score: `min(baseline + plan uplift, simulated + plan scenario reduction)`.

## Implemented (20 June 2026)
- Phase 0 — full seeded dataset, magic-link auth (single-use 15-min token, 7-day session,
  rate-limited requests), organization isolation on every query.
- Phase 1 — Overview dashboard with explained score dimensions, dependency map with focus
  switcher + critical-only filter + node detail rail, People register (47 people, search + tier
  filter), Human Manual with six tabs and score composition.
- Phase 2 — deterministic scoring engine with per-component breakdown surfaced in the UI.
- Phase 3 — absence simulator (7/30/90/permanent), propagation to downstream processes, clients,
  knowledge gaps, findings, assumptions, and duration comparison view.
- Phase 4 — Action Center: prioritized queue, complete/reopen, live org score recalculation.
- Phase 5 (simplified) — derived (non-LLM) insight summaries with evidence + confidence,
  global search across all entity types, CSV people import.
- Phase 6 — responsive pass (desktop → 430px), loading/empty/error states, toasts, reduced-motion.

Testing: `iteration_1.json` — 23/23 backend pytest, full frontend journey, 0 issues.
Backend tests live at `/app/backend/tests/backend_test.py`; engine calibration check at
`/app/tests/calibration.py`.

## Explicitly out of scope
SSO, Slack/Teams, real-time monitoring, native mobile app, billing, multi-tenant administration.

## Backlog
**P1**
- Live LLM layer: narrative simulation briefing + natural-language query ("what depends on Sarah?")
- Multi-person / team absence scenarios (two owners unavailable at once)
- Exportable board-ready PDF or share link for a scenario

**P2**
- Real second organization to prove isolation in the UI (org switcher is display-only today)
- Knowledge capture workflow (interview prompts that raise coverage and re-score)
- Scenario history timeline with score deltas over time
- Email delivery for magic links (currently stubbed inline for the demo)
