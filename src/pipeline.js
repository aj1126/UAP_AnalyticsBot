const { ingestDirectory } = require('./ingestion/file-ingestion');
const { analyzeFiles } = require('./analytics/analyzer');
const { buildDescriptiveAnalytics } = require('./analytics/descriptive');
const { buildDiagnosticAnalytics } = require('./analytics/diagnostic');
const { buildPredictiveAnalytics } = require('./analytics/predictive');
const { buildPrescriptiveAnalytics } = require('./analytics/prescriptive');

async function generateAnalyticsReport(sourceDirectory, options = {}) {
    const ingestionResult = await ingestDirectory(sourceDirectory, options);
    const analyzedFiles = analyzeFiles(ingestionResult.files);
    const descriptive = buildDescriptiveAnalytics(analyzedFiles);

    return {
        sourceDirectory: ingestionResult.sourceDirectory,
        descriptive,
        diagnostic: buildDiagnosticAnalytics(analyzedFiles),
        predictive: buildPredictiveAnalytics(analyzedFiles),
        prescriptive: buildPrescriptiveAnalytics(analyzedFiles, descriptive)
    };
}

module.exports = { generateAnalyticsReport };