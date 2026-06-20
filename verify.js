const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { initDb, saveWebhookEvent, saveAlert, saveMetricsSummary, getMetricsSummary, isMock } = require('./src/telemetry/db');
const { parseWebhook } = require('./src/telemetry/ingestion');
const { validateTelemetry } = require('./src/telemetry/analytics');
const { simulateHandoff } = require('./src/telemetry/handoff');
const { generateAnalyticsReport } = require('./src/pipeline');

async function runSimulation() {
    console.log('====================================================');
    console.log('🚀 Starting Telemetry Extension E2E Simulation');
    console.log(`Database Mode: ${isMock() ? 'Mock File-Based' : 'Native SQLite'}`);
    console.log('====================================================\n');

    // Step 0: Ingestion Pipeline E2E Validation
    console.log('[Step 0/7] Running Ingestion Pipeline Validation...');
    const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'uap-verify-ingest-'));
    
    // Create text file
    await fs.writeFile(
        path.join(fixtureRoot, 'sighting-txt.txt'),
        'Date: 2024-03-05\nLocation: Phoenix\nA bright triangle was reported near Phoenix.'
    );
    
    // Create PDF file
    const minimalPdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 54 >>
stream
BT
/F1 12 Tf
72 712 Td
(Date: 2024-05-01 Location: Roswell) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000276 00000 n
trailer
<< /Size 5 /Root 1 0 R >>
startxref
381
%%EOF`;
    await fs.writeFile(path.join(fixtureRoot, 'sighting-pdf.pdf'), minimalPdf, 'utf-8');

    try {
        const report = await generateAnalyticsReport(fixtureRoot, { clearCache: true, workers: 2 });
        if (report.descriptive.fileCount !== 2) {
            throw new Error(`Expected 2 files ingested, found: ${report.descriptive.fileCount}`);
        }
        if (!report.descriptive.locations.includes('Phoenix') || !report.descriptive.locations.includes('Roswell')) {
            throw new Error(`Expected locations 'Phoenix' and 'Roswell', found: ${JSON.stringify(report.descriptive.locations)}`);
        }
        if (!report.descriptive.dates.includes('2024-03-05') || !report.descriptive.dates.includes('2024-05-01')) {
            throw new Error(`Expected dates '2024-03-05' and '2024-05-01', found: ${JSON.stringify(report.descriptive.dates)}`);
        }
        console.log('✅ Ingestion Pipeline Check: SUCCESS\n');
    } catch (err) {
        console.error('❌ Ingestion Pipeline Check: FAILED');
        throw err;
    } finally {
        await fs.rm(fixtureRoot, { recursive: true, force: true });
    }

    // Step 1: Initialize Database
    console.log('[Step 1/7] Initializing Database schema...');
    initDb();
    console.log('✅ Database tables created/verified.\n');

    // Step 2: Inject Mock Webhook Payloads
    console.log('[Step 2/7] Defining Mock Webhook payload events...');
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
    console.log('[Step 3/7] Parsing webhooks into metrics...');
    const prMetrics = parseWebhook('pull_request', prPayload);
    const pushMetrics = parseWebhook('push', pushPayload);
    const workflowMetrics = parseWebhook('workflow_run', workflowPayload);

    console.log(` - PR Cycle Velocity: ${prMetrics.cycleVelocity} hours`);
    console.log(` - Push Churn Ratio: ${pushMetrics.churnRatio}`);
    console.log(` - Workflow Run Status: ${workflowMetrics.successFrequency === 1 ? 'Success' : 'Failure'}\n`);

    // Step 4: Validate Telemetry and Detect Drift
    console.log('[Step 4/7] Checking for configuration drift and validation alerts...');
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
    console.log('[Step 5/7] Persisting telemetry events to database...');
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
    console.log('[Step 6/7] Dispatching handoff to subagent...');
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

        console.log(`Handoff successfully queued. Status: ${handoff.status}. Dispatch ID: ${handoff.handoffId}`);
        console.log('Waiting for asynchronous subagent execution...');

        const resultPath = path.join(process.cwd(), 'data_exports', 'handoff_results', `${handoff.handoffId}_result.json`);
        const taskPath = path.join(process.cwd(), 'data_exports', 'handoff_tasks', `${handoff.handoffId}.json`);

        let resultPayload;
        const maxAttempts = 30; // 3 seconds max wait
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const data = await fs.readFile(resultPath, 'utf8');
                resultPayload = JSON.parse(data);
                break;
            } catch (err) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        if (resultPayload && resultPayload.response) {
            console.log('\n--- Virtual Subagent Response ---');
            console.log(`Status: ${resultPayload.response.status}`);
            console.log(`Findings: ${resultPayload.response.findings}`);
            console.log(`Recommendations:\n - ${resultPayload.response.recommendations.join('\n - ')}`);
            console.log('---------------------------------\n');
        } else {
            console.error(`❌ Asynchronous subagent execution timed out or failed.`);
        }

        // Clean up queue files
        try {
            await fs.unlink(taskPath);
            await fs.unlink(resultPath);
        } catch (e) {
            // Ignore cleanup errors
        }
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
