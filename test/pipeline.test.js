const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const { generateAnalyticsReport } = require('../src/pipeline');

async function createFixtureDirectory() {
    const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'uap-analytics-'));

    await fs.writeFile(
        path.join(fixtureRoot, 'report-one.txt'),
        [
            'Date: 2024-01-01',
            'LOCATION: Roswell',
            'Lights appeared in Roswell and hovered over the desert.'
        ].join('\n')
    );

    await fs.writeFile(
        path.join(fixtureRoot, 'report-two.md'),
        [
            'Date: 2024-02-14',
            'Location: Phoenix',
            'A bright triangle was reported NEAR Phoenix and hovered briefly.'
        ].join('\n')
    );

    return fixtureRoot;
}

test('generateAnalyticsReport builds all analytics tiers from text files', async () => {
    const fixtureRoot = await createFixtureDirectory();

    try {
        const report = await generateAnalyticsReport(fixtureRoot);

        assert.equal(report.descriptive.fileCount, 2);
        assert.deepEqual(report.descriptive.locations, ['Phoenix', 'Roswell']);
        assert.deepEqual(report.descriptive.dates, ['2024-01-01', '2024-02-14']);
        assert.ok(report.descriptive.wordFrequency.location >= 2);
        assert.ok(report.diagnostic.wordUsageByLocation.Roswell.length > 0);
        assert.equal(report.predictive.locationClusterForecast.likelyNextHotspot, 'Phoenix');
        assert.equal(report.prescriptive.recommendations[0].type, 'folder-restructure');
    } finally {
        await fs.rm(fixtureRoot, { recursive: true, force: true });
    }
});

test('generateAnalyticsReport flags files with missing metadata for prescriptive actions', async () => {
    const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'uap-analytics-'));

    try {
        await fs.writeFile(path.join(fixtureRoot, 'partial.txt'), 'Strange humming without a location marker.');

        const report = await generateAnalyticsReport(fixtureRoot);

        assert.equal(report.descriptive.fileCount, 1);
        assert.equal(report.prescriptive.recommendations[0].type, 'missing-data');
        assert.deepEqual(report.prescriptive.recommendations[0].files, ['partial.txt']);
    } finally {
        await fs.rm(fixtureRoot, { recursive: true, force: true });
    }
});

test('generateAnalyticsReport processes PDF files and extracts metadata', async () => {
    const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'uap-analytics-'));

    try {
        // Create a minimal text-only PDF structure for testing.
        // Notice this lacks binary xref tables. Our new worker pre-flight check will safely bypass WASM OCR for this mock, preventing native crashes.
        const pdfContent = '%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>/Contents 4 0 R>>endobj 4 0 obj<</Length 65>>stream\nBT /F1 12 Tf 100 700 Td (Date: 2025-05-05 Location: Phoenix) Tj ET\nendstream\nendobj\ntrailer<</Root 1 0 R>>';
        
        await fs.writeFile(path.join(fixtureRoot, 'test.pdf'), pdfContent);

        const report = await generateAnalyticsReport(fixtureRoot);

        assert.equal(report.descriptive.fileCount, 1);
        assert.ok(report.descriptive.files.some(f => f.extension === '.pdf'));
        assert.deepEqual(report.descriptive.locations, ['Phoenix']);
        assert.deepEqual(report.descriptive.dates, ['2025-05-05']);
        
        const pdfRecord = report.descriptive.files.find(f => f.extension === '.pdf'); 
        assert.ok(pdfRecord.metadata !== undefined, 'PDF metadata should be present');
    } finally {
        await fs.rm(fixtureRoot, { recursive: true, force: true });
    }
});