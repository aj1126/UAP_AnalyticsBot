const { ingestDirectory } = require('./ingestion/file-ingestion');
const { buildDescriptiveAnalytics } = require('./analytics/descriptive');
const { buildDiagnosticAnalytics } = require('./analytics/diagnostic');
const { buildPredictiveAnalytics } = require('./analytics/predictive');
const { buildPrescriptiveAnalytics } = require('./analytics/prescriptive');

async function generateAnalyticsReport(sourceDirectory) {
    const ingestionResult = await ingestDirectory(sourceDirectory);
    const descriptive = buildDescriptiveAnalytics(ingestionResult.files);

    return {
        sourceDirectory: ingestionResult.sourceDirectory,
        descriptive,
        diagnostic: buildDiagnosticAnalytics(ingestionResult.files),
        predictive: buildPredictiveAnalytics(ingestionResult.files),
        prescriptive: buildPrescriptiveAnalytics(ingestionResult.files, descriptive)
    };
}

module.exports = {
    generateAnalyticsReport
};
