/**
 * Domain-Driven Design (DDD) - Presentation/GUI Bounded Context
 * Application Entrypoint: HTTP Server
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { exec } = require('child_process');

const { generateAnalyticsReport } = require('../pipeline');
const { ingestDirectory } = require('../ingestion/file-ingestion');
const { analyzeFiles } = require('../analytics/analyzer');
const { buildDescriptiveAnalytics } = require('../analytics/descriptive');
const { buildDiagnosticAnalytics } = require('../analytics/diagnostic');
const { buildPredictiveAnalytics } = require('../analytics/predictive');
const { buildPrescriptiveAnalytics } = require('../analytics/prescriptive');
const db = require('../telemetry/db');
const datapoolDb = require('../datapools/datapool-db');

// Ensure database tables are initialized
try {
    db.initDb();
} catch (e) {
    // Non-blocking fallback for environment scenarios
}
try {
    datapoolDb.initDb();
} catch (e) {
    // Non-blocking fallback for environment scenarios
}

// ==========================================
// 1. Domain & Application Services
// ==========================================

/**
 * Application Service: Handles file system navigation
 */
class FolderExplorerService {
    static browse(targetPath) {
        let current = targetPath ? path.resolve(targetPath) : process.cwd();
        
        // Safety check: if path doesn't exist, fallback to process.cwd()
        if (!fs.existsSync(current)) {
            current = process.cwd();
        }

        const stat = fs.statSync(current);
        if (!stat.isDirectory()) {
            current = path.dirname(current);
        }

        const entries = fs.readdirSync(current, { withFileTypes: true });
        const directories = [];
        const files = [];

        for (const entry of entries) {
            // Filter out hidden folders/files
            if (entry.name.startsWith('.')) continue;

            if (entry.isDirectory()) {
                directories.push(entry.name);
            } else if (entry.isFile()) {
                files.push(entry.name);
            }
        }

        // Sort names alphabetically
        directories.sort();
        files.sort();

        // Safe determination of parent directory
        const parent = path.dirname(current);
        const isRoot = (parent === current);

        return {
            currentPath: current,
            parentPath: isRoot ? null : parent,
            directories,
            files
        };
    }
}

/**
 * Application Service: Coordinates Report Generation
 */
class ReportCoordinator {
    static async generate(folderPath) {
        if (!folderPath || !fs.existsSync(folderPath)) {
            throw new Error(`Invalid source path: ${folderPath}`);
        }
        return await generateAnalyticsReport(folderPath);
    }
}

/**
 * Domain Repository Service: Fetches metrics and event records from persistent store
 */
class TelemetryRepository {
    static getOverview() {
        const database = db.getDatabase();
        let summary = null;
        let events = [];
        let alerts = [];

        try {
            summary = db.getMetricsSummary() || null;
        } catch (e) {
            // Fallback
        }

        try {
            const eventsStmt = database.prepare("SELECT id, event_type, created_at, parsed_metrics FROM telemetry_events ORDER BY id DESC LIMIT 50");
            events = eventsStmt.all() || [];
        } catch (e) {
            // Fallback
        }

        try {
            const alertsStmt = database.prepare("SELECT id, type, message, created_at FROM alerts ORDER BY id DESC LIMIT 50");
            alerts = alertsStmt.all() || [];
        } catch (e) {
            // Fallback
        }

        return {
            summary,
            events,
            alerts
        };
    }
}

// ==========================================
// 2. HTTP Server Infrastructure (Controller)
// ==========================================

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
    // CORS Headers for dynamic front-ends
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
    const pathname = parsedUrl.pathname;

    // Route: HTML Entry Point
    if (pathname === '/' && req.method === 'GET') {
        const indexPath = path.join(__dirname, 'index.html');
        fs.readFile(indexPath, 'utf8', (err, html) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Error loading dashboard index.html');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(html);
        });
        return;
    }

    // Route: API Folder Browse
    if (pathname === '/api/browse' && req.method === 'GET') {
        try {
            const queryPath = parsedUrl.searchParams.get('path');
            const data = FolderExplorerService.browse(queryPath);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // Route: API Analyze Path
    if (pathname === '/api/analyze' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            try {
                const payload = JSON.parse(body);
                const report = await ReportCoordinator.generate(payload.path);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(report));
            } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    // Route: API Telemetry Overview
    if (pathname === '/api/telemetry' && req.method === 'GET') {
        try {
            const overview = TelemetryRepository.getOverview();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(overview));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // Route: API List Ingestions
    if (pathname === '/api/ingestions' && req.method === 'GET') {
        try {
            const list = datapoolDb.getIngestionsList();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(list));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // Route: API Create Ingestion (Ingest folder & Save snapshot)
    if (pathname === '/api/ingestions' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            try {
                const payload = JSON.parse(body);
                if (!payload.name || !payload.path) {
                    throw new Error("Missing 'name' or 'path' in request body.");
                }
                const ingestionResult = await ingestDirectory(payload.path);
                const ingestionId = datapoolDb.saveIngestion(payload.name, ingestionResult.sourceDirectory, ingestionResult.files);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, id: ingestionId }));
            } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    // Route: API Delete Ingestion
    if (pathname.startsWith('/api/ingestions/') && req.method === 'DELETE') {
        try {
            const id = pathname.split('/').pop();
            datapoolDb.deleteIngestion(id);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // Route: API List Data Pools
    if (pathname === '/api/datapools' && req.method === 'GET') {
        try {
            const list = datapoolDb.getDataPoolsList();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(list));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // Route: API Create Data Pool
    if (pathname === '/api/datapools' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            try {
                const payload = JSON.parse(body);
                if (!payload.name) {
                    throw new Error("Missing 'name' in request body.");
                }
                const poolId = datapoolDb.createDataPool(payload.name, payload.description);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, id: poolId }));
            } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    // Route: API Delete Data Pool
    if (pathname.startsWith('/api/datapools/') && req.method === 'DELETE' && !pathname.includes('/ingestions') && !pathname.includes('/analyze')) {
        try {
            const id = pathname.split('/').pop();
            datapoolDb.deleteDataPool(id);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // Route: API Link Ingestion to Data Pool
    if (pathname.startsWith('/api/datapools/') && pathname.endsWith('/ingestions') && req.method === 'POST') {
        const poolId = pathname.split('/')[3];
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            try {
                const payload = JSON.parse(body);
                if (!payload.ingestionId) {
                    throw new Error("Missing 'ingestionId' in request body.");
                }
                datapoolDb.linkIngestionToPool(poolId, payload.ingestionId);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    // Route: API Unlink Ingestion from Data Pool
    if (pathname.startsWith('/api/datapools/') && pathname.includes('/ingestions/') && req.method === 'DELETE') {
        try {
            const parts = pathname.split('/');
            const poolId = parts[3];
            const ingestionId = parts.pop();
            datapoolDb.unlinkIngestionFromPool(poolId, ingestionId);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // Route: API Analyze Data Pool
    if (pathname.startsWith('/api/datapools/') && pathname.endsWith('/analyze') && req.method === 'GET') {
        try {
            const poolId = pathname.split('/')[3];
            const files = datapoolDb.getFilesInPool(poolId);
            if (files.length === 0) {
                throw new Error("No files linked in this data pool. Link at least one saved ingestion containing files first.");
            }
            const analyzedFiles = analyzeFiles(files);
            const descriptive = buildDescriptiveAnalytics(analyzedFiles);
            const report = {
                sourceDirectory: `Data Pool: ${poolId}`,
                descriptive,
                diagnostic: buildDiagnosticAnalytics(analyzedFiles),
                predictive: buildPredictiveAnalytics(analyzedFiles),
                prescriptive: buildPrescriptiveAnalytics(analyzedFiles, descriptive)
            };
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(report));
        } catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // Default 404 Route
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
});

// Start listening if executed directly
if (require.main === module) {
    server.listen(PORT, () => {
        console.log(`====================================================`);
        console.log(`🚀 UAP AnalyticsBot Dashboard online: http://localhost:${PORT}`);
        console.log(`====================================================`);

        // Automatically launch browser on Windows when not in testing mode
        if (process.env.NODE_ENV !== 'test') {
            setTimeout(() => {
                try {
                    exec(`start http://localhost:${PORT}`);
                } catch (e) {
                    // Fail silently if browser cannot be launched
                }
            }, 1000);
        }
    });
}

module.exports = server;
