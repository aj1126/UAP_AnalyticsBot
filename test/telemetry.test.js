// Set environment to test to enforce :memory: database mode
process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

// Target telemetry modules
const db = require('../src/telemetry/db');
const ingestion = require('../src/telemetry/ingestion');
const analytics = require('../src/telemetry/analytics');
const handoff = require('../src/telemetry/handoff');

test('Telemetry Extension Suite', async (t) => {

    await t.test('Database Layer (db.js)', async () => {
        // Enforce database path is :memory:
        db.setDatabasePath(':memory:');
        
        // Initialize db
        db.initDb();

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

        // Save metric summary
        assert.doesNotThrow(() => {
            db.saveMetricsSummary(2.5, 0.1, 1.0);
        });

        // Check summary retrieval (returns object/undefined depending on mock/sqlite limits)
        const summary = db.getMetricsSummary();
        assert.ok(summary, 'Summary should not be undefined after saveMetricsSummary');
        assert.ok(Object.prototype.hasOwnProperty.call(summary, 'cycle_velocity'));
        assert.equal(summary.cycle_velocity, 2.5);
        assert.equal(summary.churn_ratio, 0.1);
        assert.equal(summary.success_frequency, 1.0);
    });

    await t.test('Ingestion Engine (ingestion.js)', () => {
        // Test Pull Request ingestion
        const prPayload = {
            action: 'closed',
            pull_request: {
                merged: true,
                state: 'closed',
                created_at: '2026-06-19T04:00:00Z',
                closed_at: '2026-06-19T06:30:00Z',
                additions: 100,
                deletions: 20
            }
        };
        const parsedPr = ingestion.parseWebhook('pull_request', prPayload);
        assert.equal(parsedPr.cycleVelocity, 2.5); // 2.5 hours
        assert.equal(parsedPr.additions, 100);
        assert.equal(parsedPr.deletions, 20);

        // Test non-merged pull request
        const unmergedPr = {
            action: 'closed',
            pull_request: {
                merged: false,
                state: 'closed',
                created_at: '2026-06-19T04:00:00Z',
                closed_at: '2026-06-19T06:30:00Z'
            }
        };
        const parsedUnmerged = ingestion.parseWebhook('pull_request', unmergedPr);
        assert.equal(parsedUnmerged.cycleVelocity, 0);

        // Test missing pull request field
        assert.deepEqual(ingestion.parseWebhook('pull_request', {}), { cycleVelocity: 0, additions: 0, deletions: 0 });

        // Test Push ingestion (file-based fallback)
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
        assert.deepEqual(parsedPush.files, ['src/a.js', 'src/b.js', 'package.json']);

        // Test Push ingestion with stats
        const pushStatsPayload = {
            stats: {
                additions: 80,
                deletions: 20
            }
        };
        const parsedStatsPush = ingestion.parseWebhook('push', pushStatsPayload);
        assert.equal(parsedStatsPush.churnRatio, 0.2);

        // Test Push with zero stats/files
        const emptyPush = {};
        assert.equal(ingestion.parseWebhook('push', emptyPush).churnRatio, 0);

        // Test Workflow Run ingestion (completed success)
        const workflowPayload = {
            workflow_run: {
                status: 'completed',
                conclusion: 'success'
            }
        };
        const parsedWorkflow = ingestion.parseWebhook('workflow_run', workflowPayload);
        assert.equal(parsedWorkflow.successFrequency, 1.0);

        // Test Workflow Run ingestion (completed failure)
        const workflowFailurePayload = {
            workflow_run: {
                status: 'completed',
                conclusion: 'failure'
            }
        };
        const parsedWorkflowFailure = ingestion.parseWebhook('workflow_run', workflowFailurePayload);
        assert.equal(parsedWorkflowFailure.successFrequency, 0.0);

        // Test Workflow Run pending
        const workflowPendingPayload = {
            workflow_run: {
                status: 'in_progress',
                conclusion: null
            }
        };
        const parsedWorkflowPending = ingestion.parseWebhook('workflow_run', workflowPendingPayload);
        assert.equal(parsedWorkflowPending.successFrequency, null);

        // Test Workflow Run empty
        assert.deepEqual(ingestion.parseWebhook('workflow_run', {}), { successFrequency: null });

        // Test Invalid arguments
        assert.throws(() => ingestion.parseWebhook(null, {}), /eventType must be a non-empty string/);
        assert.throws(() => ingestion.parseWebhook('push', null), /payload must be an object/);
        assert.throws(() => ingestion.parseWebhook('unsupported_event', {}), /Unsupported eventType/);
    });

    await t.test('Analytics & Drift Detection (analytics.js)', () => {
        const parsedMetrics = {
            cycleVelocity: 2.5,
            churnRatio: 0.1,
            successFrequency: 1.0
        };

        const badConfig = {
            rulesetVersion: '1.0.0', // warning
            legacy_telemetry_mode: true, // warning
            environments: {
                production: {
                    requiredApprovers: 1, // critical
                    enforceSignedCommits: false, // critical
                    telemetryEnabled: false // critical
                }
            },
            ci: {
                requiredChecks: ['test'] // missing 'docs:check' -> critical
            }
        };

        const result = analytics.validateTelemetry(parsedMetrics, badConfig);
        assert.equal(result.isValid, false);
        
        // Assert specific alert codes
        const codes = result.alerts.map(a => a.code);
        assert.ok(codes.includes('WARN_LEGACY_VERSION'));
        assert.ok(codes.includes('WARN_LEGACY_CONFIG'));
        assert.ok(codes.includes('DRIFT_INSUFFICIENT_APPROVERS'));
        assert.ok(codes.includes('DRIFT_SIGNED_COMMITS_DISABLED'));
        assert.ok(codes.includes('DRIFT_TELEMETRY_DISABLED'));
        assert.ok(codes.includes('DRIFT_MISSING_CI_CHECK'));

        // Test missing metrics or envConfig
        const invalidMetricsResult = analytics.validateTelemetry(null, {});
        assert.equal(invalidMetricsResult.isValid, false);
        assert.equal(invalidMetricsResult.alerts[0].code, 'INVALID_METRICS_SCHEMA');

        const invalidConfigResult = analytics.validateTelemetry({}, null);
        assert.equal(invalidConfigResult.isValid, false);
        assert.equal(invalidConfigResult.alerts[0].code, 'MISSING_ENV_CONFIG');

        // Test missing production ruleset envConfig
        const emptyConfigResult = analytics.validateTelemetry({}, {});
        assert.equal(emptyConfigResult.isValid, false);
        assert.ok(emptyConfigResult.alerts.some(a => a.code === 'DRIFT_MISSING_RULESET'));

        // Test fully valid config
        const goodConfig = {
            rulesetVersion: '2.0.0',
            environments: {
                production: {
                    requiredApprovers: 2,
                    enforceSignedCommits: true,
                    telemetryEnabled: true
                }
            },
            ci: {
                requiredChecks: ['test', 'docs:check']
            }
        };
        const goodResult = analytics.validateTelemetry(parsedMetrics, goodConfig);
        assert.equal(goodResult.isValid, true);
        assert.equal(goodResult.alerts.length, 0);
    });

    await t.test('Subagent Handoff Simulator (handoff.js)', async () => {
        // Invalid arguments test
        await assert.rejects(async () => {
            await handoff.simulateHandoff(null, {});
        }, /subagentRole must be a non-empty string/);

        await assert.rejects(async () => {
            await handoff.simulateHandoff('analyst', null);
        }, /payload must be an object/);

        // Valid execution with analyst and alerts (anomalies)
        const response1 = await handoff.simulateHandoff('analyst', {
            repository: 'aj1126/UAP_AnalyticsBot',
            metrics: { cycleVelocity: 6 },
            alerts: [{ code: 'SLOW_CYCLE', severity: 'warning', message: 'Cycle velocity is 6 hours' }]
        });

        assert.equal(response1.success, true);
        assert.equal(response1.response.status, 'COMPLETED');
        assert.ok(response1.response.findings.includes('cycle velocity'));

        // Valid execution with analyst and no alerts
        const responseNoAlerts = await handoff.simulateHandoff('analyst', {
            repository: 'aj1126/UAP_AnalyticsBot',
            metrics: { cycleVelocity: 2.0 },
            alerts: []
        });
        assert.ok(responseNoAlerts.response.findings.includes('All performance metrics'));

        // Valid execution with security auditor and alerts
        const response2 = await handoff.simulateHandoff('security_auditor', {
            repository: 'aj1126/UAP_AnalyticsBot',
            metrics: { cycleVelocity: 2.0 },
            alerts: [{ code: 'DRIFT_SIGNED_COMMITS_DISABLED', severity: 'critical', message: 'Signed commits disabled' }]
        });
        assert.equal(response2.success, true);
        assert.ok(response2.response.findings.includes('Security configuration drift found'));

        // Valid execution with security auditor and no alerts
        const responseSecNoAlerts = await handoff.simulateHandoff('security_auditor', {
            repository: 'aj1126/UAP_AnalyticsBot',
            metrics: { cycleVelocity: 2.0 },
            alerts: []
        });
        assert.ok(responseSecNoAlerts.response.findings.includes('Repository configurations conform'));

        // Valid execution with default/fallback role
        const responseDefault = await handoff.simulateHandoff('unknown_role', {
            repository: 'aj1126/UAP_AnalyticsBot',
            metrics: {},
            alerts: []
        });
        assert.equal(responseDefault.response.findings, 'Analysis completed successfully.');
    });

    await t.test('Additional telemetry code review fixes coverage', async () => {
        // 1. Baseline Drift Checks (analytics.js)
        const envConfig = {
            rulesetVersion: '2.0.0',
            environments: {
                production: {
                    requiredApprovers: 2,
                    enforceSignedCommits: true,
                    telemetryEnabled: true
                }
            },
            ci: {
                requiredChecks: ['test', 'docs:check']
            }
        };

        const slowCycleResult = analytics.validateTelemetry({ cycleVelocity: 5.0, churnRatio: 0.1, successFrequency: 1.0 }, envConfig);
        assert.equal(slowCycleResult.isValid, false);
        assert.ok(slowCycleResult.alerts.some(a => a.code === 'DRIFT_SLOW_CYCLE' && a.severity === 'critical'));

        const highChurnResult = analytics.validateTelemetry({ cycleVelocity: 2.0, churnRatio: 0.25, successFrequency: 1.0 }, envConfig);
        assert.equal(highChurnResult.isValid, false);
        assert.ok(highChurnResult.alerts.some(a => a.code === 'DRIFT_HIGH_CHURN' && a.severity === 'critical'));

        const lowSuccessResult = analytics.validateTelemetry({ cycleVelocity: 2.0, churnRatio: 0.1, successFrequency: 0.8 }, envConfig);
        assert.equal(lowSuccessResult.isValid, false);
        assert.ok(lowSuccessResult.alerts.some(a => a.code === 'DRIFT_LOW_SUCCESS' && a.severity === 'critical'));

        const nullMetricsResult = analytics.validateTelemetry({ cycleVelocity: null, churnRatio: null, successFrequency: null }, envConfig);
        assert.equal(nullMetricsResult.isValid, true);
        assert.equal(nullMetricsResult.alerts.length, 0);

        // 2. Database Nullable Metrics & Fallback Merging (db.js)
        db.setDatabasePath(':memory:');
        db.initDb();
        db.saveMetricsSummary(1.5, 0.05, 0.95);
        
        // Save partial metric: only cycleVelocity provided
        db.saveMetricsSummary(3.0, null, null);
        const summary1 = db.getMetricsSummary();
        assert.equal(summary1.cycle_velocity, 3.0);
        assert.equal(summary1.churn_ratio, 0.05); // fell back to previous
        assert.equal(summary1.success_frequency, 0.95); // fell back to previous

        // Save all null metrics
        db.saveMetricsSummary(null, null, null);
        const summary2 = db.getMetricsSummary();
        assert.equal(summary2.cycle_velocity, 3.0); // fell back to previous
        assert.equal(summary2.churn_ratio, 0.05);
        assert.equal(summary2.success_frequency, 0.95);

        // Test setDatabasePath with database change and closing
        db.setDatabasePath(':memory:');
        db.initDb();

        // 3. MockDatabaseSync Concurrency (db.js)
        if (db.MockDatabaseSync) {
            const tempDbFile = path.resolve(__dirname, 'temp_mock_telemetry.json');
            // Clean up if exists
            try { await fs.unlink(tempDbFile); } catch {}
            
            const mockDb = new db.MockDatabaseSync(tempDbFile);
            mockDb.exec('CREATE TABLE IF NOT EXISTS test (id INTEGER)');
            
            const stmt = mockDb.prepare('INSERT INTO metric_summaries (cycle_velocity) VALUES (?)');
            stmt.run(4.5, null, null);
            
            const data = mockDb.prepare('SELECT * FROM metric_summaries').all();
            assert.ok(data.length > 0);
            assert.equal(data[0].cycle_velocity, 4.5);

            // Test load JSON parse error
            const badJsonFile = path.resolve(__dirname, 'bad_mock_telemetry.json');
            await fs.writeFile(badJsonFile, 'invalid-json', 'utf8');
            const badMockDb = new db.MockDatabaseSync(badJsonFile);
            assert.deepEqual(badMockDb.tables.telemetry_events, []);
            await fs.unlink(badJsonFile);

            // Test write error in save()
            const dirMockDb = new db.MockDatabaseSync(__dirname);
            dirMockDb.tables.telemetry_events.push({ id: 1 });
            assert.doesNotThrow(() => dirMockDb.save());

            // Run insert into telemetry_events and alerts in mock DB
            const mockDb2 = new db.MockDatabaseSync(':memory:');
            mockDb2.prepare('INSERT INTO telemetry_events (event_type, payload, parsed_metrics)').run('pull_request', '{}', '{}');
            mockDb2.prepare('INSERT INTO alerts (type, message, details)').run('DRIFT', 'msg', '{}');

            // Cover all branches in all()
            const events = mockDb2.prepare('SELECT * FROM telemetry_events ORDER BY id DESC').all();
            assert.equal(events.length, 1);
            
            const eventsNoOrder = mockDb2.prepare('SELECT * FROM telemetry_events').all();
            assert.equal(eventsNoOrder.length, 1);

            const alerts = mockDb2.prepare('SELECT * FROM alerts ORDER BY id DESC').all();
            assert.equal(alerts.length, 1);

            const alertsNoOrder = mockDb2.prepare('SELECT * FROM alerts').all();
            assert.equal(alertsNoOrder.length, 1);

            // Test get method
            const oneEvent = mockDb2.prepare('SELECT * FROM telemetry_events').get();
            assert.ok(oneEvent);
            assert.equal(mockDb2.prepare('SELECT * FROM metric_summaries').get(), undefined);

            // Test close
            mockDb2.close();

            // Clean up files
            try { await fs.unlink(tempDbFile); } catch {}
            try { await fs.unlink(tempDbFile + '.tmp'); } catch {}
        }

        // 4. Commit Safety & Clamps (ingestion.js)
        // PR clamping negative velocity to 0
        const prNegativePayload = {
            action: 'closed',
            pull_request: {
                merged: true,
                state: 'closed',
                created_at: '2026-06-19T06:30:00Z',
                closed_at: '2026-06-19T04:00:00Z', // closed before created
                additions: 100,
                deletions: 20
            }
        };
        const parsedNegative = ingestion.parseWebhook('pull_request', prNegativePayload);
        assert.equal(parsedNegative.cycleVelocity, 0);

        // Push ingestion with null/non-object commits
        const pushCorruptedPayload = {
            commits: [
                null,
                'invalid-commit',
                {
                    added: ['src/a.js'],
                    removed: [],
                    modified: ['src/b.js']
                }
            ]
        };
        const parsedCorruptedPush = ingestion.parseWebhook('push', pushCorruptedPayload);
        assert.equal(parsedCorruptedPush.churnRatio, 1 / 3);
        assert.deepEqual(parsedCorruptedPush.files, ['src/a.js', 'src/b.js']);

        // 5. Dynamic Handoff Feedback (handoff.js)
        const responseChurn = await handoff.simulateHandoff('analyst', {
            repository: 'aj1126/UAP_AnalyticsBot',
            metrics: {},
            alerts: [{ code: 'DRIFT_HIGH_CHURN', severity: 'critical', message: 'High churn' }]
        });
        assert.ok(responseChurn.response.findings.includes('High codebase churn ratio'));

        const responseSuccess = await handoff.simulateHandoff('analyst', {
            repository: 'aj1126/UAP_AnalyticsBot',
            metrics: {},
            alerts: [{ code: 'DRIFT_LOW_SUCCESS', severity: 'critical', message: 'Low success' }]
        });
        assert.ok(responseSuccess.response.findings.includes('Workflow run success frequency'));

        const responseApprovers = await handoff.simulateHandoff('security_auditor', {
            repository: 'aj1126/UAP_AnalyticsBot',
            metrics: {},
            alerts: [{ code: 'DRIFT_INSUFFICIENT_APPROVERS', severity: 'critical', message: 'Insufficient approvers' }]
        });
        assert.ok(responseApprovers.response.findings.includes('Required approvers count'));

        const responseTelemetry = await handoff.simulateHandoff('security_auditor', {
            repository: 'aj1126/UAP_AnalyticsBot',
            metrics: {},
            alerts: [{ code: 'DRIFT_TELEMETRY_DISABLED', severity: 'critical', message: 'Telemetry disabled' }]
        });
        assert.ok(responseTelemetry.response.findings.includes('Telemetry ingestion is disabled'));

        const responseCi = await handoff.simulateHandoff('security_auditor', {
            repository: 'aj1126/UAP_AnalyticsBot',
            metrics: {},
            alerts: [{ code: 'DRIFT_MISSING_CI_CHECK', severity: 'critical', message: 'Missing CI check' }]
        });
        assert.ok(responseCi.response.findings.includes('Required CI validation checks'));

        const responseRuleset = await handoff.simulateHandoff('security_auditor', {
            repository: 'aj1126/UAP_AnalyticsBot',
            metrics: {},
            alerts: [{ code: 'DRIFT_MISSING_RULESET', severity: 'critical', message: 'Missing ruleset' }]
        });
        assert.ok(responseRuleset.response.findings.includes('Missing standard environment rulesets'));

        const responseLegacy = await handoff.simulateHandoff('security_auditor', {
            repository: 'aj1126/UAP_AnalyticsBot',
            metrics: {},
            alerts: [{ code: 'WARN_LEGACY_CONFIG', severity: 'warning', message: 'Legacy' }]
        });
        assert.ok(responseLegacy.response.findings.includes('Legacy configuration'));

        const responseSchema = await handoff.simulateHandoff('security_auditor', {
            repository: 'aj1126/UAP_AnalyticsBot',
            metrics: {},
            alerts: [{ code: 'INVALID_METRICS_SCHEMA', severity: 'critical', message: 'Invalid schema' }]
        });
        assert.ok(responseSchema.response.findings.includes('Invalid telemetry metrics schema'));

        const responseUnknownAlert = await handoff.simulateHandoff('security_auditor', {
            repository: 'aj1126/UAP_AnalyticsBot',
            metrics: {},
            alerts: [{ code: 'UNKNOWN_ALERT', severity: 'warning', message: 'Unknown' }]
        });
        assert.ok(responseUnknownAlert.response.findings.includes('Active alerts detected'));

        const responseDefaultWithAlerts = await handoff.simulateHandoff('unknown_role', {
            repository: 'aj1126/UAP_AnalyticsBot',
            metrics: {},
            alerts: [{ code: 'UNKNOWN_ALERT', severity: 'warning', message: 'Unknown' }]
        });
        assert.ok(responseDefaultWithAlerts.response.findings.includes('Analysis completed:'));
    });
});
