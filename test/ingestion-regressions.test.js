const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const { ingestDirectory } = require('../src/ingestion/file-ingestion');
const { generateAnalyticsReport } = require('../src/pipeline');

test('watch mode ignores data_exports directory and descendants', async () => {
    const indexSource = await fs.readFile(path.join(__dirname, '..', 'src', 'index.js'), 'utf-8');

    assert.ok(indexSource.includes('/[\\/\\\\]data_exports([\\/\\\\]|$)/'));
    assert.ok(!indexSource.includes('/data_exports[\\/\\\\]?$/'));
});

test('cache eviction does not remove sibling directory entries', async () => {
    const cwdBefore = process.cwd();
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'uap-cache-'));
    const sourceDirectory = path.join(workspace, 'UAP_Data');
    const siblingDirectory = path.join(workspace, 'UAP_Data_Archive');
    const liveFile = path.join(sourceDirectory, 'live.txt');
    const staleSourceFile = path.join(sourceDirectory, 'stale.txt');
    const staleSiblingFile = path.join(siblingDirectory, 'stale.txt');

    try {
        await fs.mkdir(sourceDirectory, { recursive: true });
        await fs.mkdir(siblingDirectory, { recursive: true });
        await fs.writeFile(liveFile, 'Roswell event on 2024-01-01');

        await fs.writeFile(
            path.join(workspace, '.analytics_cache.json'),
            JSON.stringify(
                {
                    version: 1,
                    entries: {
                        [staleSourceFile]: { fingerprint: 'old', data: { fileName: 'stale.txt' } },
                        [staleSiblingFile]: { fingerprint: 'old', data: { fileName: 'stale.txt' } },
                    },
                },
                null,
                2
            )
        );

        process.chdir(workspace);
        await ingestDirectory(sourceDirectory, { workers: 1 });

        const cache = JSON.parse(await fs.readFile(path.join(workspace, '.analytics_cache.json'), 'utf-8'));
        assert.equal(cache.entries[staleSourceFile], undefined);
        assert.ok(cache.entries[staleSiblingFile]);
    } finally {
        process.chdir(cwdBefore);
        await fs.rm(workspace, { recursive: true, force: true });
    }
});

test('worker NLP extraction captures natural-language dates and places', async () => {
    const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'uap-nlp-'));

    try {
        await fs.writeFile(
            path.join(fixtureRoot, 'observation.txt'),
            'Witnesses reported unusual movement on 2024-03-05 near Phoenix in Arizona.'
        );

        const report = await generateAnalyticsReport(fixtureRoot, { workers: 1, clearCache: true });
        assert.ok(report.descriptive.dates.length > 0);
        assert.ok(report.descriptive.locations.includes('Phoenix'));
    } finally {
        await fs.rm(fixtureRoot, { recursive: true, force: true });
    }
});
