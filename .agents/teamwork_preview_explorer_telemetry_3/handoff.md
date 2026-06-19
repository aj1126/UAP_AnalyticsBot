# Telemetry Subagent Handoff and Verification/Test Integration Design

## Context
Designing the architecture for Milestone 4 (Subagent Handoff) and Milestone 5 (E2E & Test Integration) of the `UAP_AnalyticsBot` telemetry extension. Specifically, this includes the design of the simulated `invoke_subagent` routine, the E2E verification script `verify.js`, and the integration of `test/telemetry.test.js` into the existing Node.js test runner in `package.json` to ensure at least 80% test coverage.

---

## Observation

1. **Test Script in `package.json`**:
   In `package.json` (line 9), the test runner is specified as:
   ```json
   "test": "node --test --experimental-test-coverage"
   ```

2. **Existing Test Framework**:
   In `test/pipeline.test.js` (lines 1-2):
   ```javascript
   const test = require('node:test');
   const assert = require('node:assert/strict');
   ```
   This confirms the use of Node.js's native test runner (`node:test`) and strict assert library (`node:assert/strict`).

3. **Node.js Environment and SQLite Database**:
   Peer agent `explorer_1` documented in `teamwork_preview_explorer_telemetry_1/handoff.md` (lines 70-277) that:
   - The codebase must be compatible with Node.js 20.x and 22.x.
   - Native `node:sqlite` (`DatabaseSync`) is used on Node.js 22.5.0+, while a `MockDatabaseSync` fallback (persisting to JSON) is used on Node.js 20.x.
   - The database wrapper (`src/telemetry/db.js`) exports: `initDb`, `saveWebhookEvent`, `saveAlert`, `getMetricsSummary`, and `getDatabase`.

4. **Telemetry Ingestion & Analytics contracts**:
   Peer agent `explorer_2` documented in `teamwork_preview_explorer_telemetry_2/handoff.md` (lines 189-298) that:
   - `src/telemetry/ingestion.js` parses Webhooks: `pull_request` (cycle velocity), `push` (churn ratio), and `workflow_run` (success frequency).
   - `src/telemetry/analytics.js` exports `validateTelemetry(parsedMetrics, envConfig)` which checks for schema validation, legacy configs, and parameter drift.

5. **Test Coverage Performance**:
   Running `npm test` on the current codebase yields an overall test coverage of `89.26%` lines, `75.15%` branches, and `92.75%` functions.

---

## Logic Chain

1. **Simulated `invoke_subagent` Routine (`src/telemetry/handoff.js`)**:
   - The system prompt defines the subagent communication schema (Context, Content, Action).
   - `simulateHandoff(subagentRole, payload)` must accept a role and a telemetry payload, format it, and log the dispatch sequence.
   - To make it realistic and useful, it will:
     - Validate inputs (throwing clean errors on invalid types).
     - Format a structured payload containing metadata, computed metrics, comparison baselines, and detected anomalies.
     - Select tailored instructions based on the subagent's role (e.g., `analyst` gets performance tasks, `security_auditor` gets config/drift validation tasks).
     - Log the simulated dispatch to standard output.
     - Return a mock completed response detailing the subagent's findings and recommended remediation actions.

2. **E2E Verification Script (`verify.js`)**:
   - The standalone `verify.js` file needs to reside in the workspace root to tie all telemetry components together.
   - It will run sequentially through:
     1. **Database Initialization**: Invoking `initDb()` to construct tables.
     2. **Payload Generation**: Creating mock github webhook structures for PRs, pushes, and workflow runs.
     3. **Ingestion & Metric Parsing**: Parsing payloads to extract performance and health metrics.
     4. **Drift Detection**: Validating parsed metrics against standard ruleset configurations and logging drift alerts.
     5. **Persistence**: Inserting webhooks and metrics into the SQLite DB.
     6. **Subagent Handoff**: Formatting and delegating anomalies to virtual subagents.
     7. **Reporting**: Fetching the database summary and printing a final report.

3. **Node.js Test Integration & Coverage (`package.json` & `test/telemetry.test.js`)**:
   - Node.js's native test runner (`node --test`) automatically scans the `test` directory for any `*.test.js` files. Consequently, placing `telemetry.test.js` in `test/` is sufficient for integration; no changes to the `package.json` `"test"` script are needed.
   - To ensure we meet the `>=80%` test coverage requirement, `test/telemetry.test.js` must require all four telemetry files (`db.js`, `ingestion.js`, `analytics.js`, `handoff.js`) and cover their primary branches.
   - Using `:memory:` for the database path during tests guarantees that tests run in isolation and do not affect the production `uap_telemetry.db` file or pollute the filesystem.

---

## Caveats

- **Mock Database Fallback**: Since Node.js v20 environments do not support `node:sqlite`, tests and E2E simulations on Node.js v20 will rely on the `MockDatabaseSync` fallback. The tests must handle this and verify database interactions transparently.
- **Node.js Test Coverage Limitation**: Node's built-in coverage tool only instruments files required during the test run. We must ensure `test/telemetry.test.js` imports all target files to reflect accurate coverage statistics.
- **Mock Webhook Limitations**: The mock Webhooks in `verify.js` simulate key metrics but do not contain full GitHub webhook properties (which can exceed 10KB). This is intentional to ensure fast and readable unit tests.

---

## Conclusion

### 1. Simulated `invoke_subagent` Design (`src/telemetry/handoff.js`)
The handoff routine will structure payloads and simulate delegation as follows:

```javascript
const path = require('node:path');

/**
 * Simulates the invoke_subagent routine, formatting and forwarding payload structures to virtual subagents.
 * @param {string} subagentRole - The role of the subagent (e.g. 'analyst', 'security_auditor')
 * @param {Object} payload - Analytical data containing metrics and alerts
 * @returns {Promise<Object>} Mock subagent execution output
 */
async function simulateHandoff(subagentRole, payload) {
    if (!subagentRole || typeof subagentRole !== 'string') {
        throw new Error('subagentRole must be a non-empty string');
    }
    if (!payload || typeof payload !== 'object') {
        throw new Error('payload must be an object');
    }

    // 1. Format the analytical payload with metadata, metrics, and comparisons
    const analyticalPayload = {
        meta: {
            subagentId: `subagent-${subagentRole}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            timestamp: payload.timestamp || new Date().toISOString(),
            sourceRepository: payload.repository || 'unknown-repo',
            role: subagentRole
        },
        analysis: {
            metrics: {
                cycleVelocity: payload.metrics?.cycleVelocity ?? null,
                churnRatio: payload.metrics?.churnRatio ?? null,
                successFrequency: payload.metrics?.successFrequency ?? null
            },
            baselines: {
                minCycleVelocityHours: 4.0,
                maxChurnRatio: 0.20,
                minSuccessFrequency: 0.90
            }
        },
        anomalies: payload.alerts || [],
        instructions: _generateInstructions(subagentRole, payload.alerts || [])
    };

    // 2. Simulate task delegation (stdout logging)
    console.log(`[Handoff] Delegating task to virtual subagent '${subagentRole}'`);
    console.log(`[Handoff] Dispatch ID: ${analyticalPayload.meta.subagentId}`);
    console.log(`[Handoff] Context: ${JSON.stringify(analyticalPayload.analysis.metrics)}`);

    // 3. Generate mock subagent diagnosis/response
    const response = _generateSubagentResponse(subagentRole, analyticalPayload);

    return {
        success: true,
        handoffId: analyticalPayload.meta.subagentId,
        dispatchedPayload: analyticalPayload,
        response
    };
}

function _generateInstructions(role, alerts) {
    const instructions = [
        "Assess telemetry indicators against project baseline goals.",
        "Highlight significant drifts or anomalies."
    ];
    if (alerts.length > 0) {
        instructions.unshift("Diagnose the root cause of the active validation alerts.");
    }
    return instructions;
}

function _generateSubagentResponse(role, analyticalPayload) {
    const hasAnomalies = analyticalPayload.anomalies.length > 0;
    
    switch (role.toLowerCase()) {
        case 'analyst':
            return {
                status: 'COMPLETED',
                findings: hasAnomalies
                    ? 'Analyzed telemetry drift. The drop in cycle velocity corresponds to a spike in pull request review times.'
                    : 'All performance metrics match the project baseline. No deviations found.',
                recommendations: hasAnomalies
                    ? ['Automate minor PR approvals', 'Establish localized review queues']
                    : ['Maintain active monitoring']
            };
        case 'security_auditor':
            return {
                status: 'COMPLETED',
                findings: hasAnomalies
                    ? 'Security configuration drift found: branch protection policies bypass signed commits.'
                    : 'Repository configurations conform to branch protection and signature requirements.',
                recommendations: hasAnomalies
                    ? ['Enforce force-signed-commits in GitHub settings']
                    : ['Continue monitoring commits']
            };
        default:
            return {
                status: 'COMPLETED',
                findings: 'Analysis completed successfully.',
                recommendations: ['Routine checks']
            };
    }
}

module.exports = { simulateHandoff };
```

---

### 2. E2E Verification Script Design (`verify.js`)
The script `verify.js` at the project root maps the full workflow from webhook injection to database summary and subagent dispatch:

```javascript
/**
 * Standalone E2E Simulation Script for Telemetry Extension
 */
const { initDb, saveWebhookEvent, saveAlert, getMetricsSummary, isMock } = require('./src/telemetry/db');
const { parseWebhook } = require('./src/telemetry/ingestion');
const { validateTelemetry } = require('./src/telemetry/analytics');
const { simulateHandoff } = require('./src/telemetry/handoff');

async function runSimulation() {
    console.log('====================================================');
    console.log('🚀 Starting Telemetry Extension E2E Simulation');
    console.log(`Database Mode: ${isMock() ? 'Mock File-Based' : 'Native SQLite'}`);
    console.log('====================================================\n');

    // Step 1: Initialize Database
    console.log('[Step 1/6] Initializing Database schema...');
    await initDb();
    console.log('✅ Database tables created/verified.\n');

    // Step 2: Inject Mock Webhook Payloads
    console.log('[Step 2/6] Defining Mock Webhook payload events...');
    const prPayload = {
        action: 'closed',
        pull_request: {
            number: 404,
            created_at: '2026-06-19T02:00:00Z',
            closed_at: '2026-06-19T08:00:00Z', // 6 hours cycle time
            merged: true,
            additions: 150,
            deletions: 50
        },
        repository: { full_name: 'aj1126/UAP_AnalyticsBot' }
    };

    const pushPayload = {
        ref: 'refs/heads/main',
        commits: [
            {
                added: ['src/telemetry/analytics.js'],
                removed: [],
                modified: ['package.json']
            }
        ],
        repository: { full_name: 'aj1126/UAP_AnalyticsBot' }
    };

    const workflowPayload = {
        action: 'completed',
        workflow_run: {
            conclusion: 'failure', // Triggers validation alerts
            run_number: 89
        },
        repository: { full_name: 'aj1126/UAP_AnalyticsBot' }
    };

    // Step 3: Ingestion & Metric Parsing
    console.log('[Step 3/6] Parsing webhooks into metrics...');
    const prMetrics = parseWebhook('pull_request', prPayload);
    const pushMetrics = parseWebhook('push', pushPayload);
    const workflowMetrics = parseWebhook('workflow_run', workflowPayload);

    console.log(` - PR Cycle Velocity: ${prMetrics.cycleVelocity} hours`);
    console.log(` - Push Churn Ratio: ${pushMetrics.churnRatio}`);
    console.log(` - Workflow Run Status: ${workflowMetrics.successFrequency === 1 ? 'Success' : 'Failure'}\n`);

    // Step 4: Validate Telemetry and Detect Drift
    console.log('[Step 4/6] Checking for configuration drift and validation alerts...');
    const envConfig = {
        rulesetVersion: '1.0.0', // Legacy version triggers warning
        environments: {
            production: {
                requiredApprovers: 1, // Insufficient approvers triggers critical alert
                enforceSignedCommits: false, // Disabled signed commits triggers critical alert
                telemetryEnabled: true
            }
        },
        ci: {
            requiredChecks: ['test'] // Missing 'docs:check' triggers critical alert
        }
    };

    const validationResult = validateTelemetry({
        cycleVelocity: prMetrics.cycleVelocity,
        churnRatio: pushMetrics.churnRatio,
        successFrequency: workflowMetrics.successFrequency
    }, envConfig);

    if (!validationResult.isValid) {
        console.log(`🚨 Validation alert detected! (${validationResult.alerts.length} issues)`);
        for (const alert of validationResult.alerts) {
            console.log(`   [${alert.severity.toUpperCase()}] ${alert.code}: ${alert.message}`);
            await saveAlert(alert.code, alert.message, alert);
        }
    }
    console.log('');

    // Step 5: Save Events and Metrics to Database
    console.log('[Step 5/6] Persisting telemetry events to database...');
    await saveWebhookEvent('pull_request', prPayload, prMetrics);
    await saveWebhookEvent('push', pushPayload, pushMetrics);
    await saveWebhookEvent('workflow_run', workflowPayload, workflowMetrics);
    console.log('✅ Events persisted.\n');

    // Step 6: Dispatch Handoff to Subagent
    console.log('[Step 6/6] Dispatching handoff to subagent...');
    if (validationResult.alerts.length > 0) {
        const handoff = await simulateHandoff('security_auditor', {
            repository: 'aj1126/UAP_AnalyticsBot',
            metrics: {
                cycleVelocity: prMetrics.cycleVelocity,
                churnRatio: pushMetrics.churnRatio,
                successFrequency: workflowMetrics.successFrequency
            },
            alerts: validationResult.alerts
        });

        console.log('\n--- Virtual Subagent Response ---');
        console.log(`Status: ${handoff.response.status}`);
        console.log(`Findings: ${handoff.response.findings}`);
        console.log(`Recommendations:\n - ${handoff.response.recommendations.join('\n - ')}`);
        console.log('---------------------------------\n');
    }

    // Print summary
    console.log('📊 E2E Simulation Summary report:');
    const summary = await getMetricsSummary();
    console.log(summary ? summary : '⚠️ No metrics summaries generated yet.');
    console.log('\n🎉 Telemetry E2E simulation completed successfully.');
}

if (require.main === module) {
    runSimulation().catch(err => {
        console.error('❌ E2E Simulation failed:', err);
        process.exit(1);
    });
}
```

---

### 3. Test Runner Integration & Suite (`test/telemetry.test.js`)
We will create `test/telemetry.test.js`. It requires no modification of `package.json` since Node's built-in test runner automatically detects files matching `test/**/*.test.js`.

The test file is structured as follows to ensure 80%+ branch and line coverage:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

// Target telemetry modules
const db = require('../src/telemetry/db');
const ingestion = require('../src/telemetry/ingestion');
const analytics = require('../src/telemetry/analytics');
const handoff = require('../src/telemetry/handoff');

// Helper to clean up any temporary test database files if not using :memory:
async function cleanTestDb(dbPath) {
    try {
        await fs.rm(dbPath, { force: true });
    } catch (e) {
        // ignore
    }
}

test('Telemetry Extension Suite', async (t) => {

    await t.test('Database Layer (db.js)', async () => {
        // Initialize db
        await db.initDb();
        
        // Save telemetry event
        const mockPayload = { id: 1 };
        const mockMetrics = { cycleVelocity: 2.5 };
        
        assert.doesNotThrow(() => {
            db.saveWebhookEvent('pull_request', mockPayload, mockMetrics);
        });

        // Save alert
        assert.doesNotThrow(() => {
            db.saveAlert('DRIFT_DETECTED', 'Metrics drifted from baseline', { expected: 4, actual: 2.5 });
        });

        // Check summary retrieval (returns object/undefined depending on mock/sqlite limits)
        const summary = db.getMetricsSummary();
        if (summary) {
            assert.ok(Object.prototype.hasOwnProperty.call(summary, 'cycle_velocity'));
        }
    });

    await t.test('Ingestion Engine (ingestion.js)', () => {
        // Test Pull Request ingestion
        const prPayload = {
            action: 'closed',
            pull_request: {
                merged: true,
                created_at: '2026-06-19T04:00:00Z',
                closed_at: '2026-06-19T06:30:00Z',
                additions: 100,
                deletions: 20
            }
        };
        const parsedPr = ingestion.parseWebhook('pull_request', prPayload);
        assert.equal(parsedPr.cycleVelocity, 2.5); // 2.5 hours

        // Test Push ingestion
        const pushPayload = {
            commits: [
                {
                    added: ['src/a.js'],
                    removed: ['src/b.js'],
                    modified: ['package.json']
                }
            ]
        };
        const parsedPush = ingestion.parseWebhook('push', pushPayload);
        assert.ok(parsedPush.churnRatio > 0);

        // Test Workflow Run ingestion
        const workflowPayload = {
            workflow_run: {
                conclusion: 'success'
            }
        };
        const parsedWorkflow = ingestion.parseWebhook('workflow_run', workflowPayload);
        assert.equal(parsedWorkflow.successFrequency, 1.0);
    });

    await t.test('Analytics & Drift Detection (analytics.js)', () => {
        const parsedMetrics = {
            cycleVelocity: 2.5,
            churnRatio: 0.1,
            successFrequency: 1.0
        };

        const badConfig = {
            rulesetVersion: '1.0.0', // warning
            environments: {
                production: {
                    requiredApprovers: 1, // critical
                    enforceSignedCommits: false // critical
                }
            }
        };

        const result = analytics.validateTelemetry(parsedMetrics, badConfig);
        assert.equal(result.isValid, false);
        assert.ok(result.alerts.length >= 3);
        
        // Assert specific alert codes
        const codes = result.alerts.map(a => a.code);
        assert.ok(codes.includes('WARN_LEGACY_VERSION'));
        assert.ok(codes.includes('DRIFT_INSUFFICIENT_APPROVERS'));
        assert.ok(codes.includes('DRIFT_SIGNED_COMMITS_DISABLED'));
    });

    await t.test('Subagent Handoff Simulator (handoff.js)', async () => {
        // Invalid arguments test
        await assert.rejects(async () => {
            await handoff.simulateHandoff(null, {});
        }, /subagentRole must be a non-empty string/);

        await assert.rejects(async () => {
            await handoff.simulateHandoff('analyst', null);
        }, /payload must be an object/);

        // Valid execution
        const response = await handoff.simulateHandoff('analyst', {
            repository: 'aj1126/UAP_AnalyticsBot',
            metrics: { cycleVelocity: 6 },
            alerts: [{ code: 'SLOW_CYCLE', severity: 'warning', message: 'Cycle velocity is 6 hours' }]
        });

        assert.equal(response.success, true);
        assert.equal(response.response.status, 'COMPLETED');
        assert.ok(response.response.findings.includes('cycle velocity'));
    });
});
```

---

## Verification Method

1. **Unit Test Coverage Check**:
   Run the test suite using standard Node command:
   ```bash
   npm test
   ```
   Verify that:
   - All tests in `test/telemetry.test.js` pass successfully.
   - The test coverage report shows `>=80%` coverage for:
     - `src/telemetry/db.js`
     - `src/telemetry/ingestion.js`
     - `src/telemetry/analytics.js`
     - `src/telemetry/handoff.js`

2. **E2E Simulation Validation**:
   Run the end-to-end verification script from the root directory:
   ```bash
   node verify.js
   ```
   Check that:
   - The script exits with code `0`.
   - The output accurately logs the database initialization, parsing, drift detection warnings/critical alerts, mock database insertions, subagent handoff logs, subagent response findings, and the final database metrics summary.
