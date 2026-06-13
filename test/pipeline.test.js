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
        // FIXED: Correctly targets the nested descriptive dates array
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

test('generateAnalyticsReport safely processes PDF files without native crashes', async () => {
    const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'uap-analytics-'));

    try {
        // A complete, structurally valid 1-page PDF encoded in Base64
        // Eliminates unhandled promise rejections inside the background thread environment
        const validBlankPdfBase64 = "JVBERi0xLjQKJcOkw7zDtsOfCjIgMCBvYmoKPDwvTGVuZ3RoIDMgMCBSL0ZpbHRlci9GbGF0ZURlY29kZT4+CnN0cmVhbQp4nDPQM1Qo5ypUMFAwALJMLU31jBQsTAz1LBSKUrnCtRTyuRQAwkYGcQplbmRzdHJlYW0KZW5kb2JqCgozIDAgb2JqCjQyCmVuZG9iagoKNSAwIG9iago8PC9MZW5ndGggNiAwIFIvRmlsdGVyL0ZsYXRlRGVjb2RlL0xlbmd0aDEgMjMyPj4Kc3RyZWFtCnicY2BgYGQAg8wMDCDAhMEQA2EwMjAwgjQxAykB0QYGAiYGBnUGBgYOBgYGEwYGBhsGBgYZBgYGfQYGBksGBgZnBgYGHwYGBn8GBgYFIBNIMwA9JwfzCmVuZHN0cmVhbQplbmRvYmoKCjYgMCBvYmoKODcKZW5kb2JqCgoxIDAgb2JqCjw8L1R5cGUvUGFnZS9QYXJlbnQgNCAwIFIvUmVzb3VyY2VzPDwvRm9udDw8L0YxIDUgMCBSPj4vUHJvY1NldFsvUERGL1RleHRdPj4vTWVkaWFCb3hbMCAwIDU5NS4yNzU1OTAxIDg0MS44ODk3NjM4XS9Db250ZW50cyAyIDAgUj4+CmVuZG9iagoKNCAwIG9iago8PC9UeXBlL1BhZ2VzL0NvdW50IDEvS2lkc1sxIDAgUl0+PgplbmRvYmoKCjcgMCBvYmoKPDwvVHlwZS9DYXRhbG9nL1BhZ2VzIDQgMCBSPj4KZW5kb2JqCgo4IDAgb2JqCjw8L0NyZWF0b3IoUGRmQ3JlYXRvciBvbmxpbmUpL1Byb2R1Y2VyKFBkZkNyZWF0b3Igb25saW5lKT4+CmVuZG9iagoKeHJlZgowIDkKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMjM5IDAwMDAwIG4gCjAwMDAwMDAwMTkgMDAwMDAgbiAKMDAwMDAwMDEzNCAwMDAwMCBuIAowMDAwMDAwMzY4IDAwMDAwIG4gCjAwMDAwMDAxNTUgMDAwMDAgbiAKMDAwMDAwMDMxMyAwMDAwMCBuIAowMDAwMDAwNDI3IDAwMDAwIG4gCjAwMDAwMDA0NzYgMDAwMDAgbiAKdHJhaWxlcgo8PC9TaXplIDkvUm9vdCA3IDAgUi9JbmZvIDggMCBSPj4Kc3RhcnR4cmVmCjU1NQolJUVPRgo=";
        
        const pdfBuffer = Buffer.from(validBlankPdfBase64, 'base64');
        await fs.writeFile(path.join(fixtureRoot, 'test.pdf'), pdfBuffer);

        const report = await generateAnalyticsReport(fixtureRoot);

        assert.equal(report.descriptive.fileCount, 1);
        assert.ok(report.descriptive.files.some(f => f.extension === '.pdf'));
        
        const pdfRecord = report.descriptive.files.find(f => f.extension === '.pdf'); 
        assert.ok(pdfRecord !== undefined, 'PDF record should exist');
        assert.ok(pdfRecord.metadata !== undefined, 'PDF metadata should be present');
    } finally {
        await fs.rm(fixtureRoot, { recursive: true, force: true });
    }
});