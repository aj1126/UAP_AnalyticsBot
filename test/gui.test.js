process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const server = require('../src/gui/server');

test('GUI Backend API Integration Suite', async (t) => {
    let port = 0;
    let baseUrl = '';

    // Start server on an ephemeral port before tests
    await new Promise((resolve) => {
        server.listen(0, () => {
            port = server.address().port;
            baseUrl = `http://localhost:${port}`;
            resolve();
        });
    });

    // Clean up server after tests
    t.after(async () => {
        server.close();
        // Explicitly give the unmanaged WebAssembly memory space time to flush before process exit
        await new Promise((resolve) => setTimeout(resolve, 1500));
    });

    await t.test('GET / serves the dashboard HTML file', async () => {
        const res = await fetch(`${baseUrl}/`);
        assert.equal(res.status, 200);
        assert.equal(res.headers.get('content-type'), 'text/html');
        const text = await res.text();
        assert.ok(text.includes('<title>UAP AnalyticsBot Dashboard</title>'));
    });

    await t.test('GET /api/browse returns directory structure', async () => {
        const res = await fetch(`${baseUrl}/api/browse`);
        assert.equal(res.status, 200);
        assert.equal(res.headers.get('content-type'), 'application/json');
        
        const data = await res.json();
        assert.ok(data.currentPath);
        assert.ok(Array.isArray(data.directories));
        assert.ok(Array.isArray(data.files));
        assert.ok(data.directories.includes('src') || data.directories.includes('test'));
    });

    await t.test('GET /api/browse?path=... handles specific directory navigation', async () => {
        const targetPath = path.resolve(__dirname, '../src');
        const res = await fetch(`${baseUrl}/api/browse?path=${encodeURIComponent(targetPath)}`);
        assert.equal(res.status, 200);
        
        const data = await res.json();
        assert.equal(data.currentPath, targetPath);
        assert.ok(data.directories.includes('gui') || data.directories.includes('analytics'));
    });

    await t.test('POST /api/analyze executes the ingestion & analytics pipeline', async () => {
        // Run analysis on the test/fixtures directory or similar, or just the root directory
        const targetPath = path.resolve(__dirname, '../src/telemetry');
        const res = await fetch(`${baseUrl}/api/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: targetPath })
        });
        assert.equal(res.status, 200);

        const data = await res.json();
        assert.ok(data.sourceDirectory);
        assert.ok(data.descriptive);
        assert.ok(data.diagnostic);
        assert.ok(data.predictive);
        assert.ok(data.prescriptive);
    });

    await t.test('GET /api/telemetry retrieves current telemetry and system logs', async () => {
        const res = await fetch(`${baseUrl}/api/telemetry`);
        assert.equal(res.status, 200);

        const data = await res.json();
        assert.ok(Object.prototype.hasOwnProperty.call(data, 'summary'));
        assert.ok(Array.isArray(data.events));
        assert.ok(Array.isArray(data.alerts));
    });
});
