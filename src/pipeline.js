const { ingestDirectory } = require('./ingestion/file-ingestion');
const { analyzeFiles } = require('./analytics/analyzer');
const { buildDescriptiveAnalytics } = require('./analytics/descriptive');
const { buildDiagnosticAnalytics } = require('./analytics/diagnostic');
const { buildPredictiveAnalytics } = require('./analytics/predictive');
const { buildPrescriptiveAnalytics } = require('./analytics/prescriptive');

async function validateSIR(files) {
    if (!Array.isArray(files)) {
        throw new TypeError('Ingestion result files must be an array');
    }
    for (const file of files) {
        const identifier = file.filePath || file.fileName || file.relativePath;
        if (!identifier || typeof identifier !== 'string') {
            throw new Error(`Invalid IngestedDocument: missing file identifier`);
        }
        if (typeof file.textContent !== 'string') {
            throw new Error(`Invalid IngestedDocument: missing textContent (${identifier})`);
        }
        if (file.metadata && typeof file.metadata !== 'object') {
            throw new Error(`Invalid IngestedDocument: metadata must be an object (${identifier})`);
        }
        // Ensure metadata exists
        file.metadata = file.metadata || {};
    }
}

async function generateAnalyticsReport(sourceDirectory, options = {}) {
    const ingestionResult = await ingestDirectory(sourceDirectory, options);
    await validateSIR(ingestionResult.files);
    
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