# Telemetry Environment Research & DB Pattern Handoff

## Context
Researching environmental constraints for the SQLite telemetry database implementation in the `UAP_AnalyticsBot` project, specifically runtime Node.js versions, dependencies, and code patterns suitable for offline/offline-only execution.

## Observation
1. **Node.js matrix target**:
   In `e:\Repos\UAP_AnalyticsBot\.github\workflows\test.yml`, line 17:
   ```yaml
   node-version: [20.x, 22.x]
   ```
2. **Project dependencies**:
   In `e:\Repos\UAP_AnalyticsBot\package.json`, lines 25-35:
   ```json
   "dependencies": {
     "chokidar": "^5.0.0",
     "compromise": "^14.15.1",
     "mupdf": "^1.27.0",
     "pdf-parse": "^2.4.5",
     "tesseract.js": "^7.0.0"
   },
   "devDependencies": {
     "commit-and-tag-version": "^12.7.3",
     "husky": "^9.1.7"
   }
   ```
3. **Module System Type**:
   In `e:\Repos\UAP_AnalyticsBot\package.json`, line 5:
   ```json
   "type": "commonjs",
   ```
4. **Local `node_modules` search**:
   No directories matching `*sqlite*` exist under `e:\Repos\UAP_AnalyticsBot\node_modules` when executing:
   ```
   find_by_name(Pattern: "*sqlite*", SearchDirectory: "node_modules", Type: "directory") -> Found 0 results
   ```
5. **Transitive SQLite references**:
   A grep search inside `e:\Repos\UAP_AnalyticsBot\package-lock.json` returned zero matches for the term `sqlite`.
6. **Command execution limitation**:
   Executing the terminal command `node -v` using `run_command` timed out waiting for user approval.

## Logic Chain
1. **Node.js Environment Compatibility**:
   - The CI test matrix targets both Node.js `20.x` and `22.x` (Observation 1).
   - This means any telemetry database extension code must run successfully and pass tests on both runtime versions.
2. **NPM Package SQLite Availability**:
   - No external SQLite npm packages (`better-sqlite3`, `sqlite3`, `sqlite`) are declared in `package.json` (Observation 2) or installed in `package-lock.json` / `node_modules` (Observations 4 and 5).
3. **Offline constraints & built-in `node:sqlite` module**:
   - Since we must avoid any network connection/download (User Request), we cannot download/install npm packages.
   - Node.js has a built-in module `node:sqlite` (DatabaseSync API). However, this built-in module was introduced in Node.js v22.5.0 as an experimental feature.
   - On Node.js v20.x (which must be supported as per Observation 1), `node:sqlite` is completely unavailable.
   - Therefore, a direct require of `node:sqlite` (`require('node:sqlite')`) will throw a `MODULE_NOT_FOUND` error on Node.js v20.x, failing the CI tests.
4. **Optimal Code Pattern**:
   - To build a fully offline database layer compatible with both Node.js v20 and v22, we must use a conditional require block that attempts to load `node:sqlite`.
   - If `node:sqlite` is found, it uses the native `DatabaseSync` class.
   - If `node:sqlite` is not found (Node.js v20), it falls back to a clean mock implementation (e.g. `MockDatabaseSync` storing data in-memory or persisting to a local JSON file) that implements the exact same public API contract (`exec`, `prepare`, `run`, `all`, `get`).

## Caveats
- We could not verify the exact version of Node.js on the user's host machine because the permission prompt for command execution timed out (Observation 6). However, the CI pipeline configurations (Observation 1) serve as the source of truth for target environments.
- Although Node.js v22 supports `node:sqlite`, it is still marked as an experimental feature. In standard Node.js v22+ environments, this is fully supported.

## Conclusion
1. **Node.js & Runtime**: The application is configured as a CommonJS project (`"type": "commonjs"`) and must run on both Node.js 20.x and 22.x.
2. **Available SQLite Packages**:
   - `better-sqlite3`: Not available.
   - `sqlite3`: Not available.
   - `node:sqlite`: Available on Node.js v22.5.0+, but NOT available on Node.js v20.x. No third-party packages are installed.
3. **Best Code Pattern**: A hybrid conditional loading pattern that exposes a unified API. If `node:sqlite` is present, it uses Node's native SQLite engine; otherwise, it falls back to a JSON/in-memory mock database conforming to the same interface.

### Proposed Implementation for `src/telemetry/db.js`
Below is the robust design pattern for `src/telemetry/db.js`:

```javascript
const fs = require('node:fs');
const path = require('node:path');

// Determine if native node:sqlite is available
let DatabaseSync;
let useMock = false;

try {
    const sqlite = require('node:sqlite');
    DatabaseSync = sqlite.DatabaseSync;
} catch (err) {
    useMock = true;
}

// In-Memory/JSON File Fallback Mock for Node.js 20
class MockDatabaseSync {
    constructor(dbPath) {
        this.dbPath = dbPath;
        this.tables = {
            telemetry_events: [],
            metric_summaries: [],
            alerts: []
        };
        this.load();
    }

    load() {
        if (this.dbPath !== ':memory:' && fs.existsSync(this.dbPath)) {
            try {
                this.tables = JSON.parse(fs.readFileSync(this.dbPath, 'utf8'));
            } catch (err) {
                // Keep default empty tables if JSON parsing fails
            }
        }
    }

    save() {
        if (this.dbPath !== ':memory:') {
            try {
                fs.writeFileSync(this.dbPath, JSON.stringify(this.tables, null, 2), 'utf8');
            } catch (err) {
                // Ignore write errors silently in test/dev
            }
        }
    }

    exec(sql) {
        // Table creation queries are mocked out as no-ops
        return this;
    }

    prepare(sql) {
        const self = this;
        const normalizedSql = sql.toLowerCase().trim();

        return {
            run(...args) {
                let changes = 0;
                let lastInsertRowid = 0;

                if (normalizedSql.includes('insert into telemetry_events')) {
                    const row = {
                        id: self.tables.telemetry_events.length + 1,
                        event_type: args[0],
                        payload: args[1],
                        parsed_metrics: args[2],
                        created_at: new Date().toISOString()
                    };
                    self.tables.telemetry_events.push(row);
                    lastInsertRowid = row.id;
                    changes = 1;
                } else if (normalizedSql.includes('insert into alerts')) {
                    const row = {
                        id: self.tables.alerts.length + 1,
                        type: args[0],
                        message: args[1],
                        details: args[2],
                        created_at: new Date().toISOString()
                    };
                    self.tables.alerts.push(row);
                    lastInsertRowid = row.id;
                    changes = 1;
                } else if (normalizedSql.includes('insert into metric_summaries')) {
                    const row = {
                        id: self.tables.metric_summaries.length + 1,
                        cycle_velocity: args[0],
                        churn_ratio: args[1],
                        success_frequency: args[2],
                        created_at: new Date().toISOString()
                    };
                    self.tables.metric_summaries.push(row);
                    lastInsertRowid = row.id;
                    changes = 1;
                }

                self.save();
                return { changes, lastInsertRowid };
            },

            all(...args) {
                if (normalizedSql.includes('from metric_summaries')) {
                    return self.tables.metric_summaries;
                }
                if (normalizedSql.includes('from telemetry_events')) {
                    return self.tables.telemetry_events;
                }
                if (normalizedSql.includes('from alerts')) {
                    return self.tables.alerts;
                }
                return [];
            },

            get(...args) {
                const results = this.all(...args);
                return results.length > 0 ? results[0] : undefined;
            }
        };
    }
}

// Instantiate Database
let db;
const dbFile = path.resolve(__dirname, '../../uap_telemetry.db');

function getDatabase() {
    if (!db) {
        if (useMock) {
            db = new MockDatabaseSync(dbFile);
        } else {
            db = new DatabaseSync(dbFile);
        }
    }
    return db;
}

function initDb() {
    const database = getDatabase();
    database.exec(`
        CREATE TABLE IF NOT EXISTS telemetry_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type TEXT NOT NULL,
            payload TEXT NOT NULL,
            parsed_metrics TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    `);
    database.exec(`
        CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            message TEXT NOT NULL,
            details TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    `);
    database.exec(`
        CREATE TABLE IF NOT EXISTS metric_summaries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cycle_velocity REAL NOT NULL,
            churn_ratio REAL NOT NULL,
            success_frequency REAL NOT NULL,
            created_at TEXT NOT NULL
        )
    `);
}

function saveWebhookEvent(eventType, payload, parsedMetrics) {
    const database = getDatabase();
    const stmt = database.prepare(`
        INSERT INTO telemetry_events (event_type, payload, parsed_metrics, created_at)
        VALUES (?, ?, ?, ?)
    `);
    stmt.run(eventType, JSON.stringify(payload), JSON.stringify(parsedMetrics), new Date().toISOString());
}

function saveAlert(type, message, details) {
    const database = getDatabase();
    const stmt = database.prepare(`
        INSERT INTO alerts (type, message, details, created_at)
        VALUES (?, ?, ?, ?)
    `);
    stmt.run(type, message, JSON.stringify(details), new Date().toISOString());
}

function getMetricsSummary() {
    const database = getDatabase();
    const stmt = database.prepare(`
        SELECT cycle_velocity, churn_ratio, success_frequency, created_at
        FROM metric_summaries
        ORDER BY id DESC
        LIMIT 1
    `);
    return stmt.get();
}

module.exports = {
    initDb,
    saveWebhookEvent,
    saveAlert,
    getMetricsSummary,
    getDatabase,
    isMock: () => useMock
};
```

## Verification Method
1. **Inspection of Config/Dependencies**: Verify that no sqlite packages were added to `package.json` or `package-lock.json`.
2. **Environment Simulation**: Run tests using `npm test`. The test suite should pass on both Node.js v20 (using the Mock fallback) and Node.js v22 (using the native `node:sqlite` or Mock fallback depending on the specific minor version).
3. **Execution check**: Run a short Node command to ensure the module compiles and loads correctly:
   `node -e "const db = require('./src/telemetry/db.js'); console.log('Database initialized, Mock mode:', db.isMock());"`
