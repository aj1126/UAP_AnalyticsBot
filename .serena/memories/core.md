# UAPBot Core Architecture

Top-level entry point and source map for the UAPBot (UAP_AnalyticsBot) telemetry and file analytics platform.

## Subsystems & Domain Map
- Technology stack & runtime environment: `mem:tech_stack`
- Development commands & test runners: `mem:suggested_commands`
- Coding standards, invariants & worker thread safety: `mem:conventions`
- Task completion verification gates: `mem:task_completion`
- Telemetry ingestion, SQLite DB, drift detection, and subagent handoff: `mem:telemetry/core`
- Multi-format file ingestion (PDF, OCR, Video, Audio): `mem:ingestion/core`

## Source Tree Overview
- `src/index.js` — Main CLI entry point and orchestration.
- `src/pipeline.js` — Core analysis pipeline generating Standard Intermediate Representation (SIR).
- `src/analytics/` — Descriptive, diagnostic, predictive, and prescriptive analytics engines.
- `src/telemetry/` — Telemetry SQLite DB, GitHub webhook ingestion, anomaly validation, and subagent handoff simulator.
- `src/ingestion/` — Worker-thread file parser (PDF, OCR, video frame extraction).
- `src/datapools/` — Data pool database management and caching.
- `src/delivery/` — CSV/JSON report generators.
- `src/gui/` — Local Web GUI dashboard server.
- `verify.js` — Standalone end-to-end simulation script.
