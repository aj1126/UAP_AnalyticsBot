process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const server = require('../src/gui/server');
const datapoolDb = require('../src/datapools/datapool-db');

test('UAP Data Pools & Saved Ingestions Suite', async (t) => {
    let port = 0;
    let baseUrl = '';

    // Initialize/reset database environment for testing
    datapoolDb.initDb();

    // Start server on an ephemeral port before tests
    await new Promise((resolve) => {
        server.listen(0, () => {
            port = server.address().port;
            baseUrl = `http://localhost:${port}`;
            resolve();
        });
    });

    // Clean up server after tests
    t.after(() => {
        server.close();
        // Clear mock DB if mock mode is active
        datapoolDb._clearMockDb();
    });

    await t.test('1. Database CRUD Operations', async (t2) => {
        await t2.test('saveIngestion and getIngestionsList', () => {
            const testFiles = [
                { filename: 'uap_1.txt', textContent: 'UAP sighting in New York on 2026-06-21.' },
                { filename: 'uap_2.txt', textContent: 'Strange orb over Seattle.' }
            ];

            const name = `test_ingest_${Date.now()}`;
            const id = datapoolDb.saveIngestion(name, '/dummy/dir', testFiles);
            assert.ok(id > 0, 'Ingestion ID should be a positive number');

            const list = datapoolDb.getIngestionsList();
            const saved = list.find(x => x.id === id);
            assert.ok(saved, 'Saved ingestion should be found in the list');
            assert.equal(saved.name, name);
            assert.equal(saved.source_directory, '/dummy/dir');
            assert.equal(saved.fileCount, 2, 'fileCount should be parsed and calculated correctly');
        });

        await t2.test('enforce uniqueness on ingestion name', () => {
            const name = `test_uniq_ingest_${Date.now()}`;
            datapoolDb.saveIngestion(name, '/dummy/dir', []);
            assert.throws(() => {
                datapoolDb.saveIngestion(name, '/dummy/dir', []);
            }, /already exists/i, 'Should throw unique constraint error');
        });

        await t2.test('createDataPool and getDataPoolsList', () => {
            const name = `test_pool_${Date.now()}`;
            const desc = 'Test pool description';
            const id = datapoolDb.createDataPool(name, desc);
            assert.ok(id > 0, 'Pool ID should be positive');

            const list = datapoolDb.getDataPoolsList();
            const saved = list.find(x => x.id === id);
            assert.ok(saved);
            assert.equal(saved.name, name);
            assert.equal(saved.description, desc);
            assert.ok(Array.isArray(saved.ingestions), 'Pool ingestions list should be an array');
        });

        await t2.test('linkIngestionToPool, getFilesInPool, and unlinkIngestionFromPool', () => {
            const ingName = `link_ingest_${Date.now()}`;
            const poolName = `link_pool_${Date.now()}`;
            const files = [
                { filename: 'file1.txt', textContent: 'Target sighting at coordinates 47.6062, -122.3321.' }
            ];

            const ingId = datapoolDb.saveIngestion(ingName, '/test/dir', files);
            const poolId = datapoolDb.createDataPool(poolName, 'pool to test linking');

            // Initially empty
            let poolFiles = datapoolDb.getFilesInPool(poolId);
            assert.equal(poolFiles.length, 0);

            // Link them
            datapoolDb.linkIngestionToPool(poolId, ingId);

            // Verify they are linked
            const pools = datapoolDb.getDataPoolsList();
            const targetPool = pools.find(p => p.id === poolId);
            assert.ok(targetPool.ingestions.some(i => i.id === ingId));

            poolFiles = datapoolDb.getFilesInPool(poolId);
            assert.equal(poolFiles.length, 1);
            assert.equal(poolFiles[0].filename, 'file1.txt');

            // Unlink
            datapoolDb.unlinkIngestionFromPool(poolId, ingId);
            poolFiles = datapoolDb.getFilesInPool(poolId);
            assert.equal(poolFiles.length, 0, 'Pool files should be 0 after unlinking');
        });
    });

    await t.test('2. REST API Integration', async (t2) => {
        let savedIngestionId = null;
        let savedPoolId = null;

        await t2.test('POST /api/ingestions ingests folder and saves snapshot', async () => {
            const targetDir = path.resolve(__dirname, 'fixtures');
            const uniqueName = `api_ingest_${Date.now()}`;
            const res = await fetch(`${baseUrl}/api/ingestions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: uniqueName, path: targetDir })
            });

            assert.equal(res.status, 200);
            const data = await res.json();
            assert.ok(data.success);
            assert.ok(data.id);
            savedIngestionId = data.id;
        });

        await t2.test('GET /api/ingestions lists saved ingestions', async () => {
            const res = await fetch(`${baseUrl}/api/ingestions`);
            assert.equal(res.status, 200);
            const data = await res.json();
            assert.ok(Array.isArray(data));
            assert.ok(data.some(i => i.id === savedIngestionId));
        });

        await t2.test('POST /api/datapools creates data pool', async () => {
            const uniqueName = `api_pool_${Date.now()}`;
            const res = await fetch(`${baseUrl}/api/datapools`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: uniqueName, description: 'Created via API test' })
            });

            assert.equal(res.status, 200);
            const data = await res.json();
            assert.ok(data.success);
            assert.ok(data.id);
            savedPoolId = data.id;
        });

        await t2.test('GET /api/datapools lists data pools', async () => {
            const res = await fetch(`${baseUrl}/api/datapools`);
            assert.equal(res.status, 200);
            const data = await res.json();
            assert.ok(Array.isArray(data));
            assert.ok(data.some(p => p.id === savedPoolId));
        });

        await t2.test('POST /api/datapools/:id/ingestions links ingestion', async () => {
            const res = await fetch(`${baseUrl}/api/datapools/${savedPoolId}/ingestions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ingestionId: savedIngestionId })
            });

            assert.equal(res.status, 200);
            const data = await res.json();
            assert.ok(data.success);

            // Double check list endpoint reflects the link
            const listRes = await fetch(`${baseUrl}/api/datapools`);
            const pools = await listRes.json();
            const pool = pools.find(p => p.id === savedPoolId);
            assert.ok(pool.ingestions.some(i => i.id === savedIngestionId));
        });

        await t2.test('GET /api/datapools/:id/analyze runs analytics over the pool', async () => {
            const res = await fetch(`${baseUrl}/api/datapools/${savedPoolId}/analyze`);
            assert.equal(res.status, 200);

            const report = await res.json();
            assert.ok(report.sourceDirectory.includes(`Data Pool: ${savedPoolId}`));
            assert.ok(report.descriptive);
            assert.ok(report.diagnostic);
            assert.ok(report.predictive);
            assert.ok(report.prescriptive);
        });

        await t2.test('DELETE /api/datapools/:id/ingestions/:ingestionId unlinks ingestion', async () => {
            const res = await fetch(`${baseUrl}/api/datapools/${savedPoolId}/ingestions/${savedIngestionId}`, {
                method: 'DELETE'
            });

            assert.equal(res.status, 200);
            const data = await res.json();
            assert.ok(data.success);

            // Check list endpoint reflects unlinking
            const listRes = await fetch(`${baseUrl}/api/datapools`);
            const pools = await listRes.json();
            const pool = pools.find(p => p.id === savedPoolId);
            assert.ok(!pool.ingestions.some(i => i.id === savedIngestionId));
        });

        await t2.test('DELETE /api/ingestions/:id deletes saved ingestion', async () => {
            const res = await fetch(`${baseUrl}/api/ingestions/${savedIngestionId}`, {
                method: 'DELETE'
            });

            assert.equal(res.status, 200);
            const data = await res.json();
            assert.ok(data.success);
        });

        await t2.test('DELETE /api/datapools/:id deletes data pool', async () => {
            const res = await fetch(`${baseUrl}/api/datapools/${savedPoolId}`, {
                method: 'DELETE'
            });

            assert.equal(res.status, 200);
            const data = await res.json();
            assert.ok(data.success);
        });
    });
});
