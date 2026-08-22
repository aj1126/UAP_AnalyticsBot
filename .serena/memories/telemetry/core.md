# Telemetry Subsystem Architecture

The telemetry extension (`src/telemetry/`) provides real-time GitHub webhook parsing, SQLite metrics aggregation, configuration drift detection, and subagent handoff simulation.

## Components
- **Database (`src/telemetry/db.js`)**: Manages `telemetry_events`, `metric_summaries`, and `alerts` tables. Provides `initDb()`, `saveWebhookEvent()`, `saveAlert()`, `saveMetricsSummary()`, and `getMetricsSummary()`.
- **Ingestion (`src/telemetry/ingestion.js`)**: Parses `pull_request`, `push`, and `workflow_run` events into cycle velocity, churn ratio, and success frequencies.
- **Analytics & Drift Detection (`src/telemetry/analytics.js`)**: Validates metrics against environment baselines and emits warnings for legacy configurations or security drift.
- **Handoff Simulator (`src/telemetry/handoff.js`)**: Simulates `invoke_subagent` task dispatching and asynchronous worker execution.
