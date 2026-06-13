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
        assert.deepEqual(report.dates, ['2024-01-01', '2024-02-14']);
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

test('generateAnalyticsReport builds all analytics tiers from text files', async () => {
    const fixtureRoot = await createFixtureDirectory();

    try {
        const report = await generateAnalyticsReport(fixtureRoot);

        assert.equal(report.descriptive.fileCount, 2);
        assert.deepEqual(report.descriptive.locations, ['Phoenix', 'Roswell']);
        // FIXED: Point to the descriptive nested node layer
        assert.deepEqual(report.descriptive.dates, ['2024-01-01', '2024-02-14']);
        assert.ok(report.descriptive.wordFrequency.location >= 2);
        assert.ok(report.diagnostic.wordUsageByLocation.Roswell.length > 0);
        assert.equal(report.predictive.locationClusterForecast.likelyNextHotspot, 'Phoenix');
        assert.equal(report.prescriptive.recommendations[0].type, 'folder-restructure');
    } finally {
        await fs.rm(fixtureRoot, { recursive: true, force: true });
    }
});