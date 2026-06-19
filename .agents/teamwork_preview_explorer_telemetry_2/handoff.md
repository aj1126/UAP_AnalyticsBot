# Telemetry Ingestion and Anomaly/Drift Detection Design Report

## Context
As part of extending the `UAP_AnalyticsBot` service with a telemetry ingestion, parsing, database, and subagent handoff pipeline, this report details the architectural design for the **Telemetry Ingestion Engine (`src/telemetry/ingestion.js`)** and the **Parsing & Anomaly Detection module (`src/telemetry/analytics.js`)**. The goal is to design:
1. The JSON schemas of mock Webhook payloads for Pull Requests, Push events, and Workflow Runs.
2. The mathematical models for calculating cycle velocities, codebase churn ratios, and commit success frequencies.
3. The logic and configuration rulesets for schema validation and config drift detection (including legacy configurations and environment ruleset gaps).

---

## Observation
1. **Milestone Outlines (`PROJECT.md` lines 16-20)**:
   - Milestone 2: "Implement webhook parsing and velocity/churn/success metric extraction in `src/telemetry/ingestion.js`".
   - Milestone 3: "Implement schema validation and ruleset/configuration drift checks in `src/telemetry/analytics.js`".
2. **Interface Contracts (`PROJECT.md` lines 29-33)**:
   - `ingestion.js`: `parseWebhook(eventType, payload)`: Validates format, returns parsed metrics (e.g. `cycleVelocity` for PRs, `churnRatio` for push, `successFrequency` for workflow runs).
   - `analytics.js`: `validateTelemetry(parsedMetrics, envConfig)`: Checks schemas, detects configuration/metric drift, returns list of alerts.
3. **Existing CI Pipeline (`.github/workflows/test.yml` lines 29-32)**:
   - Declares execution sequence: `npm ci`, `npm test`, and `npm run docs:check`. This establishes standard CI steps to be validated against config drift.
4. **Current Ingest & Prescriptive Logic (`src/analytics/prescriptive.js` lines 1-35)**:
   - Establishes a format for alerts/recommendations return structures (containing `type`, `message`, and supporting files/locations array attributes).

---

## Logic Chain
1. **Webhook Payload Shape Design**:
   - Because `parseWebhook(eventType, payload)` needs to extract `cycleVelocity` (using duration, additions, deletions, state), `churnRatio` (using additions, deletions, modified files), and `successFrequency` (using status, conclusion), the incoming JSON webhook structures must map these properties cleanly.
   - We map the standard GitHub webhook events (`pull_request`, `push`, and `workflow_run`) into simplified, robust schemas tailored for the ingestion engine's utility functions.

2. **Metrics Mathematics Design**:
   - **Cycle Velocity ($V_c$)**: Calculated using the time elapsed between PR creation and merge. To avoid outliers or false velocities, only merged PRs are included, and division-by-zero is handled if the PR count is zero.
   - **Codebase Churn Ratio ($R_{\text{churn}}$)**: We define two formulations: 
     1. *Project-Scoped Churn Ratio*: Volatility relative to the total active lines of code ($LOC_{\text{total}}$) of the target files.
     2. *Change-Scoped Churn Ratio*: Volatility representing deletions relative to total modifications (additions + deletions).
   - **Commit Success Frequency ($F_{\text{success}}$)**: Extracted from completed workflow run conclusions. Active runs are ignored (pending), and skipped/cancelled runs are handled cleanly.

3. **Validation & Drift Detection Logic**:
   - The contract `validateTelemetry(parsedMetrics, envConfig)` requires comparing an active environment configuration (`envConfig`) against a baseline ruleset.
   - We define a baseline **Standard Environment Ruleset** containing required environment properties (e.g., minimum required PR approvals, mandatory signed commits, required CI checks like `test` and `docs:check`).
   - We design validation rules that identify:
     1. **Critical Drift**: Missing environment rulesets entirely.
     2. **Legacy Config Warnings**: Deprecated configuration parameters (e.g., `legacy_telemetry_mode`, `legacy_logger`, ruleset version $< 2.0.0$).
     3. **Active Parameter Drift**: When security attributes or mandatory CI checks fail to match the standard baseline.

---

## Caveats
- **Metadata Availability**: Calculating the *Project-Scoped Churn Ratio* requires access to the total codebase LOC ($LOC_{\text{total}}$). If the repository size is dynamic or unavailable, the engine must fall back to the *Change-Scoped Churn Ratio* (which does not depend on the codebase size).
- **Time Representation**: All timestamps are assumed to be ISO-8601 compliant UTC strings. Any deviation in format must be normalized at the ingestion parsing level.
- **Simplification of Webhooks**: GitHub Webhook payloads can be very large ($>10\text{KB}$). The mock payloads designed below focus strictly on the attributes required by `UAP_AnalyticsBot` for clarity and testing efficiency.

---

## Conclusion

### 1. Shape of Incoming Mock Webhook Payloads

#### 1.1 Pull Request Event Payload (`pull_request`)
Used to determine cycle velocity and size of code integrations.
```json
{
  "event": "pull_request",
  "action": "closed",
  "number": 105,
  "pull_request": {
    "id": 8746291,
    "state": "closed",
    "merged": true,
    "title": "feat: add telemetry database schema",
    "created_at": "2026-06-19T06:00:00Z",
    "closed_at": "2026-06-19T08:30:00Z",
    "merged_at": "2026-06-19T08:30:00Z",
    "additions": 340,
    "deletions": 45,
    "changed_files": 3,
    "user": {
      "login": "dev-pioneer"
    },
    "base": {
      "ref": "main"
    },
    "head": {
      "ref": "feat/telemetry-db"
    }
  }
}
```

#### 1.2 Push Event Payload (`push`)
Used to determine codebase churn and modified file list.
```json
{
  "event": "push",
  "ref": "refs/heads/main",
  "before": "9081717c961034c77c865a7f5c7217926b42b10a",
  "after": "735b00b7cae87002b0c3f58e8b6a3b68fc71813a",
  "commits": [
    {
      "id": "735b00b7cae87002b0c3f58e8b6a3b68fc71813a",
      "message": "fix: resolve sql injection in telemetry db queries",
      "added": ["src/telemetry/db.js"],
      "removed": [],
      "modified": ["package.json", "src/telemetry/ingestion.js"]
    }
  ],
  "stats": {
    "additions": 85,
    "deletions": 12
  }
}
```

#### 1.3 Workflow Run Event Payload (`workflow_run`)
Used to determine commit success frequencies.
```json
{
  "event": "workflow_run",
  "action": "completed",
  "workflow_run": {
    "id": 9934125,
    "name": "Continuous Integration",
    "head_branch": "main",
    "head_sha": "735b00b7cae87002b0c3f58e8b6a3b68fc71813a",
    "status": "completed",
    "conclusion": "success",
    "created_at": "2026-06-19T08:35:00Z",
    "updated_at": "2026-06-19T08:42:00Z"
  }
}
```

---

### 2. Analytics Mathematics Design

#### 2.1 Cycle Velocity ($V_c$)
Let $P_m$ be the set of merged Pull Requests in the observation window. For each $p \in P_m$:
- $T_{\text{create}}(p) = \text{Date.parse}(p.\text{created\_at})$
- $T_{\text{merge}}(p) = \text{Date.parse}(p.\text{merged\_at})$
- $\Delta t_p = \frac{T_{\text{merge}}(p) - T_{\text{create}}(p)}{1000 \times 60} \quad \text{(expressed in minutes)}$

The average Cycle Velocity is:
$$V_c = \begin{cases} \frac{1}{|P_m|} \sum_{p \in P_m} \Delta t_p & \text{if } |P_m| > 0 \\ 0 & \text{if } |P_m| = 0 \end{cases}$$

#### 2.2 Codebase Churn Ratio ($R_{\text{churn}}$)
To track codebase stability, we define both absolute churn and relative ratios:

##### Form A: Project-Scoped Churn Ratio
Measures net volatility relative to the total active codebase size. Let $LOC_{\text{total}}$ be the total lines of code in the target repository's analyzed files.
$$R_{\text{churn, project}} = \frac{\text{Additions} + \text{Deletions}}{LOC_{\text{total}}}$$

##### Form B: Change-Scoped Churn Ratio
Measures the percentage of modified code representing deletions (re-written or removed logic).
$$R_{\text{churn, change}} = \begin{cases} \frac{\text{Deletions}}{\text{Additions} + \text{Deletions}} & \text{if } \text{Additions} + \text{Deletions} > 0 \\ 0 & \text{if } \text{Additions} + \text{Deletions} = 0 \end{cases}$$

#### 2.3 Commit Success Frequency ($F_{\text{success}}$)
Let $W_c$ be the set of completed workflow runs on target branches. For each run $w \in W_c$, let the outcome indicator $S(w)$ be:
$$S(w) = \begin{cases} 1 & \text{if } w.\text{conclusion} = \text{"success"} \\ 0 & \text{otherwise} \end{cases}$$

The success frequency is:
$$F_{\text{success}} = \begin{cases} \frac{1}{|W_c|} \sum_{w \in W_c} S(w) & \text{if } |W_c| > 0 \\ 1.0 & \text{if } |W_c| = 0 \end{cases}$$

---

### 3. Validation & Configuration Drift Detection Logic

#### 3.1 Standard Environment Ruleset Baseline
A repository is validated against the following standard baseline:
```json
{
  "rulesetVersion": "2.0.0",
  "environments": {
    "production": {
      "requiredApprovers": 2,
      "enforceSignedCommits": true,
      "allowedBranches": ["main", "release/*"],
      "telemetryEnabled": true
    }
  },
  "ci": {
    "requiredChecks": ["test", "docs:check"]
  }
}
```

#### 3.2 Drift Detection Implementation Design
The parsing and drift utility in `src/telemetry/analytics.js` performs validation checks in a sequential pipeline:

```javascript
/**
 * Validates incoming parsed metrics and checks environment configurations for drift.
 * @param {Object} parsedMetrics - Extracted metrics from webhook events.
 * @param {Object} envConfig - Repository/environment configuration to validate.
 * @returns {Object} Validation summary and generated alerts.
 */
function validateTelemetry(parsedMetrics, envConfig) {
    const alerts = [];
    
    // 1. Schema Check on incoming metrics
    if (!parsedMetrics || typeof parsedMetrics !== 'object') {
        alerts.push({
            code: 'INVALID_METRICS_SCHEMA',
            severity: 'critical',
            message: 'Parsed metrics payload is empty or structurally invalid.'
        });
        return { isValid: false, alerts };
    }

    // 2. Validate envConfig Presence & Structure
    if (!envConfig || typeof envConfig !== 'object') {
        alerts.push({
            code: 'MISSING_ENV_CONFIG',
            severity: 'critical',
            message: 'Environment configuration payload is missing or invalid.'
        });
        return { isValid: false, alerts };
    }

    // 3. Detect Legacy Configurations
    const legacyKeys = ['legacy_telemetry_mode', 'legacy_logger', 'debug_mode'];
    for (const key of legacyKeys) {
        if (key in envConfig) {
            alerts.push({
                code: 'WARN_LEGACY_CONFIG',
                severity: 'warning',
                message: `Legacy configuration attribute '${key}' detected. Migrate to standard environment rulesets.`
            });
        }
    }
    
    const version = parseFloat(envConfig.rulesetVersion);
    if (!envConfig.rulesetVersion || isNaN(version) || version < 2.0) {
        alerts.push({
            code: 'WARN_LEGACY_VERSION',
            severity: 'warning',
            message: `Legacy rulesetVersion '${envConfig.rulesetVersion || 'unknown'}' detected. Standard baseline requires version >= 2.0.0.`
        });
    }

    // 4. Standard Environment Ruleset Checks
    const production = envConfig.environments?.production;
    if (!production) {
        alerts.push({
            code: 'DRIFT_MISSING_RULESET',
            severity: 'critical',
            message: "Missing standard environment rulesets for environment 'production'."
        });
    } else {
        // Enforce required approvers
        if (typeof production.requiredApprovers !== 'number' || production.requiredApprovers < 2) {
            alerts.push({
                code: 'DRIFT_INSUFFICIENT_APPROVERS',
                severity: 'critical',
                message: `Drift detected: 'requiredApprovers' is ${production.requiredApprovers || 0}, but standard ruleset requires at least 2.`
            });
        }
        
        // Enforce signed commits
        if (production.enforceSignedCommits !== true) {
            alerts.push({
                code: 'DRIFT_SIGNED_COMMITS_DISABLED',
                severity: 'critical',
                message: "Drift detected: Signed commits must be enforced in environment 'production'."
            });
        }

        // Enforce telemetry
        if (production.telemetryEnabled !== true) {
            alerts.push({
                code: 'DRIFT_TELEMETRY_DISABLED',
                severity: 'critical',
                message: "Drift detected: Telemetry ingestion must be active in 'production'."
            });
        }
    }

    // 5. Standard CI Validation Checks
    const requiredChecks = ['test', 'docs:check'];
    const activeChecks = envConfig.ci?.requiredChecks || [];
    
    for (const check of requiredChecks) {
        if (!activeChecks.includes(check)) {
            alerts.push({
                code: 'DRIFT_MISSING_CI_CHECK',
                severity: 'critical',
                message: `Drift detected: Required CI validation check '${check}' is missing from branch protection settings.`
            });
        }
    }

    const isValid = !alerts.some(alert => alert.severity === 'critical');
    
    return {
        isValid,
        alerts
    };
}
```

---

## Verification Method

### 1. Standalone Metrics Verification Script
A developer can verify the mathematical calculations by running `node verify.js` (once implemented in Milestones 4-5) with mock webhook datasets:
```bash
# Executing standard build tests to ensure pipeline integrity
npm test
```
The test suite in `test/telemetry.test.js` should assert:
1. That `parseWebhook('pull_request', payload)` extracts a cycle velocity of exactly `150` for a PR open for 2.5 hours.
2. That `parseWebhook('push', payload)` returns the correct modification list and churn values.
3. That `validateTelemetry(metrics, legacyConfig)` correctly returns a list of warning alerts targeting version `1.0.0` and critical alerts targeting missing rulesets.

### 2. Unit Testing Assertions
Example test scenarios to include in `test/telemetry.test.js`:
- **PR Ingestion**: Verify `parseWebhook('pull_request', prPayload)` handles missing fields gracefully (e.g. returns default $0$ duration).
- **Drift Detection (Critical)**: Verify that passing `envConfig = {}` yields a critical alert count of $\ge 2$ and `isValid: false`.
- **Drift Detection (Warning)**: Verify that passing an envConfig with `legacy_telemetry_mode: true` generates `WARN_LEGACY_CONFIG`.
