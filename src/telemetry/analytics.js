/**
 * Telemetry Analytics & Configuration Drift Detection
 */

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

    // 6. Metrics Baseline Drift Checks
    if (parsedMetrics.cycleVelocity !== null && parsedMetrics.cycleVelocity !== undefined && parsedMetrics.cycleVelocity > 4.0) {
        alerts.push({
            code: 'DRIFT_SLOW_CYCLE',
            severity: 'critical',
            message: `Drift detected: cycleVelocity is ${parsedMetrics.cycleVelocity} hours, which exceeds the max cycle velocity baseline of 4.0.`
        });
    }

    if (parsedMetrics.churnRatio !== null && parsedMetrics.churnRatio !== undefined && parsedMetrics.churnRatio > 0.20) {
        alerts.push({
            code: 'DRIFT_HIGH_CHURN',
            severity: 'critical',
            message: `Drift detected: churnRatio is ${parsedMetrics.churnRatio}, which exceeds the max churn ratio baseline of 0.20.`
        });
    }

    if (parsedMetrics.successFrequency !== null && parsedMetrics.successFrequency !== undefined && parsedMetrics.successFrequency < 0.90) {
        alerts.push({
            code: 'DRIFT_LOW_SUCCESS',
            severity: 'critical',
            message: `Drift detected: successFrequency is ${parsedMetrics.successFrequency}, which is below the min success frequency baseline of 0.90.`
        });
    }

    const isValid = !alerts.some(alert => alert.severity === 'critical');

    return {
        isValid,
        alerts
    };
}

module.exports = {
    validateTelemetry
};
