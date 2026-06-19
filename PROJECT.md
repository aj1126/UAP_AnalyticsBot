# Project: UAP_AnalyticsBot Telemetry Extension

## Architecture
We are extending the `UAP_AnalyticsBot` service with a telemetry ingestion, parsing, database, and subagent handoff pipeline.

The new telemetry components will reside under `src/telemetry/`:
1. **Database Layer (`src/telemetry/db.js`)**: Initializes and manages a local SQLite database (`uap_telemetry.db`). Stores raw webhook events, aggregated metrics, and anomaly logs.
2. **Ingestion Engine (`src/telemetry/ingestion.js`)**: Parses GitHub Webhook payloads (pull request events, push events) and calculates cycle velocity, codebase churn ratio, and commit success frequencies.
3. **Parsing & Anomaly Detection (`src/telemetry/analytics.js`)**: Validates webhook payloads, detects metric drift, legacy configurations, and triggers workspace alerts.
4. **Subagent Handoff (`src/telemetry/handoff.js`)**: Simulates the `invoke_subagent` routine, formatting and forwarding payload structures to virtual subagents.
5. **E2E Simulation Script (`verify.js`)**: Located at the project root, this standalone script injects mock webhook data, runs the parsing and DB storage, triggers subagent handoffs, and prints the summary.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Database Layer | Implement SQLite schema, tables, and DB connection utility in `src/telemetry/db.js` | None | DONE |
| 2 | Telemetry Ingestion | Implement webhook parsing and velocity/churn/success metric extraction in `src/telemetry/ingestion.js` | M1 | DONE |
| 3 | Anomaly Detection | Implement schema validation and ruleset/configuration drift checks in `src/telemetry/analytics.js` | M2 | DONE |
| 4 | Subagent Handoff | Implement simulated `invoke_subagent` forwarding routine in `src/telemetry/handoff.js` | M3 | DONE |
| 5 | E2E & Tests | Implement standalone `verify.js` and test suite `test/telemetry.test.js`, targeting 80%+ test coverage | M4 | DONE |

## Interface Contracts
### `db.js`
- `initDb()`: Initializes SQLite database and tables (`telemetry_events`, `metric_summaries`, `alerts`).
- `saveWebhookEvent(eventType, payload, parsedMetrics)`: Inserts a raw webhook event and its calculated metrics.
- `saveAlert(type, message, details)`: Inserts an alert log for drift/anomalies.
- `getMetricsSummary()`: Retrieves aggregated telemetry metrics (velocities, churn, success rate).

### `ingestion.js`
- `parseWebhook(eventType, payload)`: Validates format, returns parsed metrics (e.g. `cycleVelocity` for PRs, `churnRatio` for push, `successFrequency` for workflow runs).

### `analytics.js`
- `validateTelemetry(parsedMetrics, envConfig)`: Checks schemas, detects configuration/metric drift, returns list of alerts.

### `handoff.js`
- `simulateHandoff(subagentRole, payload)`: Formats analytical payloads and logs a mock subagent execution, ensuring safe parameter forwarding.

## Code Layout
- `src/telemetry/db.js` - SQLite Database Layer
- `src/telemetry/ingestion.js` - Telemetry Ingestor
- `src/telemetry/analytics.js` - Validation & Anomaly Detection
- `src/telemetry/handoff.js` - Subagent Handoff Simulator
- `test/telemetry.test.js` - Test suite for telemetry extension
- `verify.js` - Standalone verification script
