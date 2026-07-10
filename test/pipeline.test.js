process.env.NODE_ENV = 'test';

const test = require('node:test');
const { after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const { generateAnalyticsReport } = require('../src/pipeline');
const { buildDiagnosticAnalytics } = require('../src/analytics/diagnostic');
const { generateCsvReport } = require('../src/delivery/csv-generator');

// Global synchronization macro guard to prevent WebAssembly unmanaged heap access violations on process exit
after(async () => {
    // Explicitly give the unmanaged WebAssembly memory space time to flush before process exit
    await new Promise((resolve) => setTimeout(resolve, 1500));
});

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

test('generateAnalyticsReport passes ingestion options through to the pipeline', async () => {
    const ingestionModulePath = require.resolve('../src/ingestion/file-ingestion');
    const pipelineModulePath = require.resolve('../src/pipeline');
    const originalIngestionModule = require.cache[ingestionModulePath];
    const originalPipelineModule = require.cache[pipelineModulePath];
    let receivedOptions;

    delete require.cache[pipelineModulePath];
    require.cache[ingestionModulePath] = {
        id: ingestionModulePath,
        filename: ingestionModulePath,
        loaded: true,
        exports: {
            ingestDirectory: async (_sourceDirectory, options) => {
                receivedOptions = options;
                return {
                    sourceDirectory: '/tmp/mock-source',
                    files: [
                        {
                            fileName: 'fixture.txt',
                            textContent: 'Date: 2024-01-01\nLocation: Roswell\nsighting'
                        }
                    ],
                };
            }
        }
    };

    try {
        const { generateAnalyticsReport: generateMockedAnalyticsReport } = require('../src/pipeline');
        const report = await generateMockedAnalyticsReport('/tmp/mock-source', { workers: 4, clearCache: true });

        assert.equal(report.sourceDirectory, '/tmp/mock-source');
        assert.equal(report.descriptive.fileCount, 1);
        assert.deepEqual(receivedOptions, { workers: 4, clearCache: true });
    } finally {
        if (originalIngestionModule) {
            require.cache[ingestionModulePath] = originalIngestionModule;
        } else {
            delete require.cache[ingestionModulePath];
        }

        if (originalPipelineModule) {
            require.cache[pipelineModulePath] = originalPipelineModule;
        } else {
            delete require.cache[pipelineModulePath];
        }
    }
});

test('buildDiagnosticAnalytics falls back to relative paths when file names are missing', () => {
    const diagnostic = buildDiagnosticAnalytics([
        {
            relativePath: 'reports/alpha.txt',
            wordFrequency: { signal: 2, light: 1 },
            totalWords: 3,
            uniqueWords: ['signal', 'light']
        },
        {
            relativePath: 'reports/beta.txt',
            wordFrequency: { signal: 2, glow: 1 },
            totalWords: 3,
            uniqueWords: ['signal', 'glow']
        }
    ]);

    assert.equal(diagnostic.semanticAnalysis[0].fileName, 'reports/alpha.txt');
    assert.equal(diagnostic.semanticAnalysis[0].relatedDocuments[0].match, 'reports/beta.txt');
});

test('generateCsvReport escapes spreadsheet-sensitive values', async () => {
    const exportsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'uap-analytics-csv-'));

    try {
        const csvPath = await generateCsvReport(
            {
                descriptive: {
                    fileCount: 1,
                    locations: ['=cmd|" /C calc"!A0', 'Phoenix, AZ']
                },
                predictive: {
                    locationClusterForecast: {
                        likelyNextHotspot: '@hidden'
                    },
                    keywordFrequencyForecast: {
                        forecastMonth: '2026-06',
                        forecastWordCount: 3
                    }
                }
            },
            exportsDir
        );

        const csvContent = await fs.readFile(csvPath, 'utf-8');
        assert.match(csvContent, /"'=cmd\|"" \/C calc""!A0, Phoenix, AZ"/);
        assert.match(csvContent, /"'\@hidden"/);
    } finally {
        await fs.rm(exportsDir, { recursive: true, force: true });
    }
});

test('generateAnalyticsReport builds all analytics tiers from a generated PDF file', async () => {
    const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'uap-analytics-pdf-'));
    const pdfPath = path.join(fixtureRoot, 'sighting.pdf');
    const minimalPdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 54 >>
stream
BT
/F1 12 Tf
72 712 Td
(Date: 2024-05-01 Location: Roswell) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000276 00000 n
trailer
<< /Size 5 /Root 1 0 R >>
startxref
381
%%EOF`;

    try {
        await fs.writeFile(pdfPath, minimalPdf, 'utf-8');
        const report = await generateAnalyticsReport(fixtureRoot, { clearCache: true, workers: 1 });
        
        assert.equal(report.descriptive.fileCount, 1);
        assert.deepEqual(report.descriptive.locations, ['Roswell']);
        assert.deepEqual(report.descriptive.dates, ['2024-05-01']);
    } finally {
        await fs.rm(fixtureRoot, { recursive: true, force: true });
    }
});