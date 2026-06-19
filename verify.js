/**
 * Standalone E2E Simulation Script for Telemetry Extension
 */
const { initDb, saveWebhookEvent, saveAlert, saveMetricsSummary, getMetricsSummary, isMock } = require('./src/telemetry/db');
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
    initDb();
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
            saveAlert(alert.code, alert.message, alert);
        }
    }
    console.log('');

    // Step 5: Save Events and Metrics to Database
    console.log('[Step 5/6] Persisting telemetry events to database...');
    saveWebhookEvent('pull_request', prPayload, prMetrics);
    saveWebhookEvent('push', pushPayload, pushMetrics);
    saveWebhookEvent('workflow_run', workflowPayload, workflowMetrics);
    
    // Also generate and persist the metrics summary
    saveMetricsSummary(
        prMetrics.cycleVelocity,
        pushMetrics.churnRatio,
        workflowMetrics.successFrequency
    );
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
    const summary = getMetricsSummary();
    console.log(summary ? summary : '⚠️ No metrics summaries generated yet.');
    console.log('\n🎉 Telemetry E2E simulation completed successfully.');
}

if (require.main === module) {
    runSimulation().catch(err => {
        console.error('❌ E2E Simulation failed:', err);
        process.exit(1);
    });
}
