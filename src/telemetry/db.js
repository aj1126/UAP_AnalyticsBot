const fs = require('node:fs');
const path = require('node:path');

// Determine if native node:sqlite is available
let DatabaseSync;
let useMock = false;

try {
    const sqlite = require('node:sqlite');
    DatabaseSync = sqlite.DatabaseSync;
    if (!DatabaseSync) {
        useMock = true;
    }
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
                const tmpPath = `${this.dbPath}.tmp`;
                fs.writeFileSync(tmpPath, JSON.stringify(this.tables, null, 2), 'utf8');
                fs.renameSync(tmpPath, this.dbPath);
            } catch (err) {
                // Ignore write errors silently in test/dev
            }
        }
    }

    close() {
        // Mock close operation
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
                        created_at: args[3] || new Date().toISOString()
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
                        created_at: args[3] || new Date().toISOString()
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
                        created_at: args[3] || new Date().toISOString()
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
                    let data = [...self.tables.metric_summaries];
                    if (normalizedSql.includes('order by id desc')) {
                        data.reverse();
                    }
                    if (normalizedSql.includes('limit 1')) {
                        data = data.slice(0, 1);
                    }
                    return data;
                }
                if (normalizedSql.includes('from telemetry_events')) {
                    let data = [...self.tables.telemetry_events];
                    if (normalizedSql.includes('order by id desc')) {
                        data.reverse();
                    }
                    return data;
                }
                if (normalizedSql.includes('from alerts')) {
                    let data = [...self.tables.alerts];
                    if (normalizedSql.includes('order by id desc')) {
                        data.reverse();
                    }
                    return data;
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
let currentDbFile = path.resolve(__dirname, '../../uap_telemetry.db');

// If we are in test environment, default to :memory:
if (process.env.NODE_ENV === 'test') {
    currentDbFile = ':memory:';
}

function setDatabasePath(newPath) {
    if (db && typeof db.close === 'function') {
        db.close();
    }
    currentDbFile = newPath;
    db = null; // force re-creation
}

function getDatabase() {
    if (!db) {
        if (useMock) {
            let targetPath = currentDbFile;
            if (targetPath !== ':memory:' && targetPath.endsWith('uap_telemetry.db')) {
                targetPath = targetPath.replace('uap_telemetry.db', 'uap_telemetry_mock.json');
            }
            db = new MockDatabaseSync(targetPath);
        } else {
            db = new DatabaseSync(currentDbFile);
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
            cycle_velocity REAL,
            churn_ratio REAL,
            success_frequency REAL,
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

function saveMetricsSummary(cycleVelocity, churnRatio, successFrequency) {
    const lastRow = getMetricsSummary();
    const finalCycleVelocity = (cycleVelocity !== undefined && cycleVelocity !== null)
        ? cycleVelocity
        : (lastRow ? lastRow.cycle_velocity : null);
    const finalChurnRatio = (churnRatio !== undefined && churnRatio !== null)
        ? churnRatio
        : (lastRow ? lastRow.churn_ratio : null);
    const finalSuccessFrequency = (successFrequency !== undefined && successFrequency !== null)
        ? successFrequency
        : (lastRow ? lastRow.success_frequency : null);

    const database = getDatabase();
    const stmt = database.prepare(`
        INSERT INTO metric_summaries (cycle_velocity, churn_ratio, success_frequency, created_at)
        VALUES (?, ?, ?, ?)
    `);
    stmt.run(finalCycleVelocity, finalChurnRatio, finalSuccessFrequency, new Date().toISOString());
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
    saveMetricsSummary,
    getMetricsSummary,
    getDatabase,
    setDatabasePath,
    isMock: () => useMock,
    MockDatabaseSync
};
