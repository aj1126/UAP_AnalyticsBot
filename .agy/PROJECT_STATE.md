# File: .agy/PROJECT_STATE.md
# Antigravity Project State Manifest: UAP AnalyticsBot

## 1. Project Metadata & Identity

- **Project Name**: UAP_AnalyticsBot (`uap_analyticsbot`)
- **Version**: `1.0.0`
- **Primary Runtime**: Node.js v20+ (ES Modules, Native `node:sqlite`, Worker Threads)
- **Secondary Environment**: Python 3.12+ (`.venv` for auxiliary ML / OCR / legacy bindings)
- **Host OS Target**: Windows 11 (PowerShell / Command Prompt automation scripts)
- **Repository Type**: Monolithic Node.js analytics and ingestion engine with REST API and Web GUI.

---

## 2. System Architecture & Module Map

The codebase implements a multi-tiered pipeline designed for data ingestion, diagnostic NLP analytics, persistence, and telemetry monitoring.

| Layer | Scope | Responsibility |
| :--- | :--- | :--- |
| **1. Ingestion Tier** | `src/ingestion/` | Multi-format parsing (PDF, TXT, MD, MP4, JSON), worker thread NLP extraction & caching. |
| **2. Analytics Tier** | `src/analytics/` | Descriptive -> Diagnostic (TF-IDF) -> Predictive -> Prescriptive pipeline. |
| **3. Persistence Tier** | `src/datapools/`, `src/telemetry/` | SQLite (Telemetry & Snapshots) + Data Pools (`uap_datapools.json`). |
| **4. Delivery Tier** | `src/gui/`, `src/delivery/` | Express REST API, Interactive GUI Dashboard, CSV Report Generator. |
| **5. Agent Telemetry** | `src/telemetry/` | Event auditing & Virtual Subagent handoff simulator (`handoff.js`). |

---

### Module Breakdown

| Directory / File | Subsystem | Responsibility |
| :--- | :--- | :--- |
| `src/ingestion/file-ingestion.js` | Ingestion Controller | Directory scanning, format routing, caching (`.analytics_cache.json`). |
| `src/ingestion/worker.js` | Parsing Engine | Worker thread extraction for PDFs, MP4 metadata, raw text NLP. |
| `src/analytics/analyzer.js` | Tiered Orchestrator | Executes Descriptive, Diagnostic, Predictive, and Prescriptive pipeline. |
| `src/analytics/descriptive.js` | Descriptive Tier | Aggregates volume, file extensions, size distributions, time windows. |
| `src/analytics/diagnostic.js` | Diagnostic Tier | TF-IDF term extraction, missing metadata classification, drift detection. |
| `src/analytics/predictive.js` | Predictive Tier | Trend velocity, ingestion cadence, projection models. |
| `src/analytics/prescriptive.js`| Prescriptive Tier | Actionable remediation triggers, flag escalation, validation rules. |
| `src/datapools/datapool-db.js` | Pool Repository | Data pool creation, snapshot linkage, persistent query isolation. |
| `src/telemetry/db.js` | Telemetry Store | SQLite persistence (`uap_telemetry.db`) tracking execution latency. |
| `src/telemetry/handoff.js` | Agent Orchestrator | Virtual subagent delegation (`analyst`, `security_auditor`). |
| `src/gui/server.js` | Delivery Server | Express HTTP server serving GUI dashboard and REST endpoints. |
| `src/delivery/csv-generator.js`| Report Exporter | Sanitized CSV generation with spreadsheet-safe escaping. |

---

## 3. Security Architecture & Verification Pipeline

The repository enforces a 4-tier open-source security pipeline integrated into pre-commit hooks and GitHub Actions.

| Layer | Engine | Configuration | Scope |
| :--- | :--- | :--- | :--- |
| **Secrets Detection** | Gitleaks | `.gitleaks.toml` | Commits, index changes, staged diffs (Vendor/.venv excluded). |
| **SAST** | Semgrep OSS | Auto-ruleset | JS/Node backend, Express endpoints, workflow YAML files. |
| **SCA / CVEs** | Aqua Trivy | Filesystem Scan | `package-lock.json`, npm dependency trees. |
| **IaC / Misconfig** | Aqua Trivy | Config Scan | CI workflows, batch configurations, deployment manifests. |

---

## 4. Quality Assurance & Test Baseline

- **Test Framework**: Native Node.js Test Runner (`node:test`)
- **Test Command**: `node --test --experimental-test-coverage`
- **Total Tests**: 39 Passed / 0 Failed / 0 Skipped
- **Overall Line Coverage**: 86.54%
- **Branch Coverage**: 77.74%
- **Function Coverage**: 86.43%

### Test Suite Coverage
- `test/datapools.test.js`: Database CRUD operations and REST API data pool integration.
- `test/gui.test.js`: Dashboard routing, directory tree navigation, pipeline execution endpoints.
- `test/ingestion-regressions.test.js`: Cache eviction boundaries, watch mode ignore rules, NLP extraction.
- `test/pipeline.test.js`: Multi-format analytics generation, metadata fallback handling, CSV escaping.
- `test/telemetry.test.js`: SQLite telemetry storage, schema migrations, virtual subagent handoff dispatch.
- `test/video-ingestion.test.js`: MP4 container inspection and intermediate representation modeling.

---

## 5. Execution Scripts & Entry Points

- `.\gui.bat`: Start Web GUI Dashboard
- `.\run.bat`: Execute Analytics Ingestion Run
- `.\diagnose.bat`: Execute System Diagnostics & Verification
- `.\verify.bat`: Run Full Unit & Regression Test Suite

---

## 6. Agentic Execution Directives (Antigravity Ingestion Context)

When operating on this repository within Antigravity (`agy`):

1. **Environment Compatibility**: Always generate execution commands strictly for Windows PowerShell (`pwsh`) or Command Prompt. Do not output Bash syntax.
2. **Database Integrity**: The SQLite layer in `src/telemetry/db.js` uses native Node.js SQLite (`node:sqlite`). Preserve connection caching and handle experimental warnings gracefully.
3. **Documentation Sync**: When updating endpoints or analytical schemas, run `npm run docs:generate` and `npm run docs:check` to maintain documentation synchronization.
4. **Security Enforcement**: Ensure all code changes pass local `gitleaks detect` and `semgrep scan --config auto` without introducing un-sanitized context interpolations or untracked vendor assets.
