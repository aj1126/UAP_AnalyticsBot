/**
 * Telemetry Ingestion Engine
 */

/**
 * Parses and extracts metrics from webhook payloads.
 * @param {string} eventType - The webhook event type ('pull_request', 'push', 'workflow_run')
 * @param {Object} payload - The webhook payload payload
 * @returns {Object} Parsed metrics
 */
function parseWebhook(eventType, payload) {
    if (!eventType || typeof eventType !== 'string') {
        throw new Error('eventType must be a non-empty string');
    }
    if (!payload || typeof payload !== 'object') {
        throw new Error('payload must be an object');
    }

    switch (eventType) {
        case 'pull_request': {
            const pr = payload.pull_request;
            if (!pr) {
                return { cycleVelocity: 0, additions: 0, deletions: 0 };
            }
            const state = pr.state || payload.action;
            if (!pr.merged || state !== 'closed') {
                return { cycleVelocity: 0, additions: pr.additions || 0, deletions: pr.deletions || 0 };
            }
            const start = new Date(pr.created_at).getTime();
            const end = new Date(pr.merged_at || pr.closed_at).getTime();
            const calculatedVelocity = (end - start) / (1000 * 60 * 60); // in hours
            const cycleVelocity = isNaN(calculatedVelocity) ? 0 : Math.max(0, calculatedVelocity);
            return {
                cycleVelocity,
                additions: pr.additions || 0,
                deletions: pr.deletions || 0
            };
        }
        case 'push': {
            let additions = 0;
            let deletions = 0;

            if (payload.stats) {
                additions = payload.stats.additions || 0;
                deletions = payload.stats.deletions || 0;
            } else if (payload.commits && Array.isArray(payload.commits)) {
                for (const commit of payload.commits) {
                    if (commit && typeof commit === 'object') {
                        const addedCount = commit.added ? commit.added.length : 0;
                        const removedCount = commit.removed ? commit.removed.length : 0;
                        const modifiedCount = commit.modified ? commit.modified.length : 0;

                        additions += addedCount + modifiedCount;
                        deletions += removedCount + modifiedCount;
                    }
                }
            }

            const total = additions + deletions;
            const churnRatio = total > 0 ? (deletions / total) : 0;

            const files = [];
            if (payload.commits && Array.isArray(payload.commits)) {
                for (const commit of payload.commits) {
                    if (commit && typeof commit === 'object') {
                        if (commit.added) files.push(...commit.added);
                        if (commit.removed) files.push(...commit.removed);
                        if (commit.modified) files.push(...commit.modified);
                    }
                }
            }

            return {
                churnRatio,
                files: [...new Set(files)]
            };
        }
        case 'workflow_run': {
            const run = payload.workflow_run;
            if (!run) {
                return { successFrequency: null };
            }
            const isCompleted = run.status === 'completed' || payload.action === 'completed' || !!run.conclusion;
            if (!isCompleted) {
                return { successFrequency: null };
            }
            const success = run.conclusion === 'success';
            return {
                successFrequency: success ? 1.0 : 0.0,
                conclusion: run.conclusion || 'unknown'
            };
        }
        default:
            throw new Error(`Unsupported eventType: ${eventType}`);
    }
}

module.exports = {
    parseWebhook
};
