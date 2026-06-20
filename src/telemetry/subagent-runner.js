const fs = require('node:fs');
const path = require('node:path');

async function main() {
    const handoffId = process.argv[2];
    if (!handoffId) {
        console.error('Usage: node subagent-runner.js <handoffId>');
        process.exit(1);
    }

    const tasksDir = path.join(process.cwd(), 'data_exports', 'handoff_tasks');
    const resultsDir = path.join(process.cwd(), 'data_exports', 'handoff_results');
    const taskPath = path.join(tasksDir, `${handoffId}.json`);
    const resultPath = path.join(resultsDir, `${handoffId}_result.json`);

    try {
        // Read task payload
        if (!fs.existsSync(taskPath)) {
            throw new Error(`Task file not found: ${taskPath}`);
        }
        const taskData = fs.readFileSync(taskPath, 'utf8');
        const payload = JSON.parse(taskData);

        // Process subagent logic
        const role = payload.meta?.role || 'unknown';
        const response = generateSubagentResponse(role, payload);

        // Ensure results directory exists
        fs.mkdirSync(resultsDir, { recursive: true });

        // Save result
        const resultPayload = {
            success: true,
            handoffId,
            response
        };
        fs.writeFileSync(resultPath, JSON.stringify(resultPayload, null, 2), 'utf8');
        process.exit(0);
    } catch (err) {
        console.error(`[Runner Error] Failed to process handoff ${handoffId}:`, err.message);
        try {
            // Write a failure result
            fs.mkdirSync(resultsDir, { recursive: true });
            fs.writeFileSync(resultPath, JSON.stringify({
                success: false,
                handoffId,
                error: err.message,
                response: {
                    status: 'FAILED',
                    findings: `Error processing task: ${err.message}`,
                    recommendations: []
                }
            }, null, 2), 'utf8');
        } catch (writeErr) {
            // Ignored
        }
        process.exit(1);
    }
}

function generateSubagentResponse(role, analyticalPayload) {
    const alerts = analyticalPayload.anomalies || [];
    const hasAnomalies = alerts.length > 0;

    if (!hasAnomalies) {
        switch (role.toLowerCase()) {
            case 'analyst':
                return {
                    status: 'COMPLETED',
                    findings: 'All performance metrics match the project baseline. No deviations found.',
                    recommendations: ['Maintain active monitoring']
                };
            case 'security_auditor':
                return {
                    status: 'COMPLETED',
                    findings: 'Repository configurations conform to branch protection and signature requirements.',
                    recommendations: ['Continue monitoring commits']
                };
            default:
                return {
                    status: 'COMPLETED',
                    findings: 'Analysis completed successfully.',
                    recommendations: ['Routine checks']
                };
        }
    }

    const codes = alerts.map(a => a.code);
    const findingsList = [];
    const recommendationsList = [];

    if (codes.includes('SLOW_CYCLE') || codes.includes('DRIFT_SLOW_CYCLE')) {
        findingsList.push('The cycle velocity has drifted from the standard baseline.');
        recommendationsList.push('Automate minor PR approvals', 'Establish localized review queues');
    }
    if (codes.includes('DRIFT_HIGH_CHURN')) {
        findingsList.push('High codebase churn ratio detected.');
        recommendationsList.push('Improve code review rigor and establish local test validation');
    }
    if (codes.includes('DRIFT_LOW_SUCCESS')) {
        findingsList.push('Workflow run success frequency is below standard baseline.');
        recommendationsList.push('Investigate flaky tests and stabilize CI pipeline runs');
    }
    if (codes.includes('DRIFT_INSUFFICIENT_APPROVERS')) {
        findingsList.push('Required approvers count is below standard requirements.');
        recommendationsList.push('Update repository settings to require at least 2 approvers');
    }
    if (codes.includes('DRIFT_SIGNED_COMMITS_DISABLED')) {
        findingsList.push('branch protection policies bypass signed commits.');
        recommendationsList.push('Enforce force-signed-commits in GitHub settings');
    }
    if (codes.includes('DRIFT_TELEMETRY_DISABLED')) {
        findingsList.push('Telemetry ingestion is disabled in production ruleset.');
        recommendationsList.push('Enable telemetry collection across all production workflows');
    }
    if (codes.includes('DRIFT_MISSING_CI_CHECK')) {
        findingsList.push('Required CI validation checks are missing from branch protection settings.');
        recommendationsList.push('Add missing CI validation checks to branch protection rules');
    }
    if (codes.includes('DRIFT_MISSING_RULESET')) {
        findingsList.push("Missing standard environment rulesets for environment 'production'.");
        recommendationsList.push('Define and apply standard environment rulesets for production');
    }
    if (codes.includes('WARN_LEGACY_CONFIG') || codes.includes('WARN_LEGACY_VERSION')) {
        findingsList.push('Legacy configuration or version detected.');
        recommendationsList.push('Migrate configuration to standard baseline (version >= 2.0.0)');
    }
    if (codes.includes('INVALID_METRICS_SCHEMA') || codes.includes('MISSING_ENV_CONFIG')) {
        findingsList.push('Invalid telemetry metrics schema or missing environment configuration.');
        recommendationsList.push('Ensure the metrics client payloads are formatted correctly');
    }

    if (findingsList.length === 0) {
        findingsList.push(`Active alerts detected: ${codes.join(', ')}.`);
        recommendationsList.push('Investigate active validation alerts');
    }

    const uniqueRecommendations = [...new Set(recommendationsList)];

    switch (role.toLowerCase()) {
        case 'analyst':
            return {
                status: 'COMPLETED',
                findings: `Analyzed telemetry drift. ${findingsList.join(' ')}`,
                recommendations: uniqueRecommendations.length > 0 ? uniqueRecommendations : ['Automate minor PR approvals', 'Establish localized review queues']
            };
        case 'security_auditor':
            return {
                status: 'COMPLETED',
                findings: `Security configuration drift found: ${findingsList.join(' ')}`,
                recommendations: uniqueRecommendations.length > 0 ? uniqueRecommendations : ['Enforce force-signed-commits in GitHub settings']
            };
        default:
            return {
                status: 'COMPLETED',
                findings: `Analysis completed: ${findingsList.join(' ')}`,
                recommendations: uniqueRecommendations.length > 0 ? uniqueRecommendations : ['Routine checks']
            };
    }
}

main();
