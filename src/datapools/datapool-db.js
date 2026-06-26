const fs = require('node:fs');
const path = require('node:path');

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

const DB_PATH = path.join(process.cwd(), 'uap_telemetry.db');
const MOCK_DB_PATH = path.join(process.cwd(), 'uap_datapools.json');

class MockDatabase {
    constructor(filePath) {
        this.filePath = filePath;
        this.data = {
            saved_ingestions: [],
            datapools: [],
            datapool_ingestions: []
        };
        this.load();
    }

    load() {
        if (fs.existsSync(this.filePath)) {
            try {
                this.data = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
            } catch (err) {
                // Fallback to empty tables if JSON parsing fails
            }
        }
    }

    save() {
        try {
            const tmpPath = `${this.filePath}.tmp`;
            fs.writeFileSync(tmpPath, JSON.stringify(this.data, null, 2), 'utf8');
            fs.renameSync(tmpPath, this.filePath);
        } catch (err) {
            // Ignore write errors silently in test/dev
        }
    }
}

let dbInstance = null;

function getDatabase() {
    if (dbInstance) return dbInstance;
    
    if (useMock) {
        dbInstance = new MockDatabase(MOCK_DB_PATH);
    } else {
        dbInstance = new DatabaseSync(DB_PATH);
    }
    return dbInstance;
}

function initDb() {
    const db = getDatabase();
    if (useMock) {
        if (!db.data.saved_ingestions) db.data.saved_ingestions = [];
        if (!db.data.datapools) db.data.datapools = [];
        if (!db.data.datapool_ingestions) db.data.datapool_ingestions = [];
        db.save();
        return;
    }

    db.exec(`
        CREATE TABLE IF NOT EXISTS saved_ingestions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            source_directory TEXT NOT NULL,
            ingested_at TEXT NOT NULL,
            files_data TEXT NOT NULL
        )
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS datapools (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            created_at TEXT NOT NULL
        )
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS datapool_ingestions (
            pool_id INTEGER NOT NULL,
            ingestion_id INTEGER NOT NULL,
            PRIMARY KEY (pool_id, ingestion_id),
            FOREIGN KEY (pool_id) REFERENCES datapools (id) ON DELETE CASCADE,
            FOREIGN KEY (ingestion_id) REFERENCES saved_ingestions (id) ON DELETE CASCADE
        )
    `);
}

// ==========================================
// Saved Ingestions CRUD
// ==========================================

function saveIngestion(name, sourceDirectory, filesData) {
    const db = getDatabase();
    const ingestedAt = new Date().toISOString();
    const serializedFiles = typeof filesData === 'string' ? filesData : JSON.stringify(filesData);

    if (useMock) {
        // Enforce name uniqueness
        const exists = db.data.saved_ingestions.some(ing => ing.name === name);
        if (exists) {
            throw new Error(`Ingestion with name "${name}" already exists.`);
        }

        const id = db.data.saved_ingestions.length > 0 
            ? Math.max(...db.data.saved_ingestions.map(i => i.id)) + 1 
            : 1;
        
        const row = {
            id,
            name,
            source_directory: sourceDirectory,
            ingested_at: ingestedAt,
            files_data: serializedFiles
        };
        db.data.saved_ingestions.push(row);
        db.save();
        return id;
    } else {
        try {
            const stmt = db.prepare(`
                INSERT INTO saved_ingestions (name, source_directory, ingested_at, files_data)
                VALUES (?, ?, ?, ?)
            `);
            const result = stmt.run(name, sourceDirectory, ingestedAt, serializedFiles);
            return result.lastInsertRowid;
        } catch (err) {
            if (err.message && err.message.includes('UNIQUE constraint failed')) {
                throw new Error(`Ingestion with name "${name}" already exists.`);
            }
            throw err;
        }
    }
}

function getIngestionsList() {
    const db = getDatabase();
    if (useMock) {
        return db.data.saved_ingestions.map(ing => {
            let fileCount = 0;
            try {
                const parsed = JSON.parse(ing.files_data);
                fileCount = Array.isArray(parsed) ? parsed.length : 0;
            } catch (err) {}
            return {
                id: ing.id,
                name: ing.name,
                source_directory: ing.source_directory,
                ingested_at: ing.ingested_at,
                fileCount
            };
        });
    } else {
        const stmt = db.prepare("SELECT id, name, source_directory, ingested_at, files_data FROM saved_ingestions ORDER BY id DESC");
        const rows = stmt.all() || [];
        return rows.map(row => {
            let fileCount = 0;
            try {
                const parsed = JSON.parse(row.files_data);
                fileCount = Array.isArray(parsed) ? parsed.length : 0;
            } catch (err) {}
            return {
                id: row.id,
                name: row.name,
                source_directory: row.source_directory,
                ingested_at: row.ingested_at,
                fileCount
            };
        });
    }
}

function deleteIngestion(id) {
    const db = getDatabase();
    const idNum = parseInt(id, 10);

    if (useMock) {
        db.data.saved_ingestions = db.data.saved_ingestions.filter(ing => ing.id !== idNum);
        db.data.datapool_ingestions = db.data.datapool_ingestions.filter(link => link.ingestion_id !== idNum);
        db.save();
    } else {
        // Enable foreign key support in SQLite
        db.exec("PRAGMA foreign_keys = ON;");
        const stmt = db.prepare("DELETE FROM saved_ingestions WHERE id = ?");
        stmt.run(idNum);
    }
}

// ==========================================
// Data Pools CRUD
// ==========================================

function createDataPool(name, description) {
    const db = getDatabase();
    const createdAt = new Date().toISOString();

    if (useMock) {
        const exists = db.data.datapools.some(p => p.name === name);
        if (exists) {
            throw new Error(`Data pool with name "${name}" already exists.`);
        }

        const id = db.data.datapools.length > 0 
            ? Math.max(...db.data.datapools.map(p => p.id)) + 1 
            : 1;

        const row = {
            id,
            name,
            description,
            created_at: createdAt
        };
        db.data.datapools.push(row);
        db.save();
        return id;
    } else {
        try {
            const stmt = db.prepare(`
                INSERT INTO datapools (name, description, created_at)
                VALUES (?, ?, ?)
            `);
            const result = stmt.run(name, description, createdAt);
            return result.lastInsertRowid;
        } catch (err) {
            if (err.message && err.message.includes('UNIQUE constraint failed')) {
                throw new Error(`Data pool with name "${name}" already exists.`);
            }
            throw err;
        }
    }
}

function getDataPoolsList() {
    const db = getDatabase();
    if (useMock) {
        return db.data.datapools.map(pool => {
            const linkedLinks = db.data.datapool_ingestions.filter(link => link.pool_id === pool.id);
            const ingestions = linkedLinks.map(link => {
                const ing = db.data.saved_ingestions.find(i => i.id === link.ingestion_id);
                if (!ing) return null;
                let fileCount = 0;
                try {
                    fileCount = JSON.parse(ing.files_data).length;
                } catch (e) {}
                return {
                    id: ing.id,
                    name: ing.name,
                    fileCount
                };
            }).filter(Boolean);

            return {
                id: pool.id,
                name: pool.name,
                description: pool.description,
                created_at: pool.created_at,
                ingestions
            };
        });
    } else {
        const stmt = db.prepare("SELECT id, name, description, created_at FROM datapools ORDER BY id DESC");
        const pools = stmt.all() || [];
        
        return pools.map(pool => {
            const linksStmt = db.prepare(`
                SELECT di.ingestion_id, si.name, si.files_data 
                FROM datapool_ingestions di
                JOIN saved_ingestions si ON di.ingestion_id = si.id
                WHERE di.pool_id = ?
            `);
            const links = linksStmt.all(pool.id) || [];
            
            const ingestions = links.map(link => {
                let fileCount = 0;
                try {
                    fileCount = JSON.parse(link.files_data).length;
                } catch (e) {}
                return {
                    id: link.ingestion_id,
                    name: link.name,
                    fileCount
                };
            });

            return {
                id: pool.id,
                name: pool.name,
                description: pool.description,
                created_at: pool.created_at,
                ingestions
            };
        });
    }
}

function deleteDataPool(id) {
    const db = getDatabase();
    const idNum = parseInt(id, 10);

    if (useMock) {
        db.data.datapools = db.data.datapools.filter(p => p.id !== idNum);
        db.data.datapool_ingestions = db.data.datapool_ingestions.filter(link => link.pool_id !== idNum);
        db.save();
    } else {
        db.exec("PRAGMA foreign_keys = ON;");
        const stmt = db.prepare("DELETE FROM datapools WHERE id = ?");
        stmt.run(idNum);
    }
}

function linkIngestionToPool(poolId, ingestionId) {
    const db = getDatabase();
    const pId = parseInt(poolId, 10);
    const ingId = parseInt(ingestionId, 10);

    if (useMock) {
        const exists = db.data.datapool_ingestions.some(link => link.pool_id === pId && link.ingestion_id === ingId);
        if (!exists) {
            db.data.datapool_ingestions.push({ pool_id: pId, ingestion_id: ingId });
            db.save();
        }
    } else {
        try {
            const stmt = db.prepare("INSERT INTO datapool_ingestions (pool_id, ingestion_id) VALUES (?, ?)");
            stmt.run(pId, ingId);
        } catch (err) {
            if (err.message && err.message.includes('UNIQUE constraint failed')) {
                // Ignore duplicates gracefully
                return;
            }
            throw err;
        }
    }
}

function unlinkIngestionFromPool(poolId, ingestionId) {
    const db = getDatabase();
    const pId = parseInt(poolId, 10);
    const ingId = parseInt(ingestionId, 10);

    if (useMock) {
        db.data.datapool_ingestions = db.data.datapool_ingestions.filter(
            link => !(link.pool_id === pId && link.ingestion_id === ingId)
        );
        db.save();
    } else {
        const stmt = db.prepare("DELETE FROM datapool_ingestions WHERE pool_id = ? AND ingestion_id = ?");
        stmt.run(pId, ingId);
    }
}

function getFilesInPool(poolId) {
    const db = getDatabase();
    const pId = parseInt(poolId, 10);
    const files = [];

    if (useMock) {
        const links = db.data.datapool_ingestions.filter(link => link.pool_id === pId);
        for (const link of links) {
            const ing = db.data.saved_ingestions.find(i => i.id === link.ingestion_id);
            if (ing) {
                try {
                    const parsed = JSON.parse(ing.files_data);
                    if (Array.isArray(parsed)) {
                        files.push(...parsed);
                    }
                } catch (e) {}
            }
        }
    } else {
        const stmt = db.prepare(`
            SELECT si.files_data 
            FROM datapool_ingestions di
            JOIN saved_ingestions si ON di.ingestion_id = si.id
            WHERE di.pool_id = ?
        `);
        const rows = stmt.all(pId) || [];
        for (const row of rows) {
            try {
                const parsed = JSON.parse(row.files_data);
                if (Array.isArray(parsed)) {
                    files.push(...parsed);
                }
            } catch (e) {}
        }
    }

    return files;
}

// Clear mock DB for testing
function _clearMockDb() {
    if (useMock && fs.existsSync(MOCK_DB_PATH)) {
        try {
            fs.unlinkSync(MOCK_DB_PATH);
        } catch (e) {}
        dbInstance = null;
    }
}

module.exports = {
    initDb,
    saveIngestion,
    getIngestionsList,
    deleteIngestion,
    createDataPool,
    getDataPoolsList,
    deleteDataPool,
    linkIngestionToPool,
    unlinkIngestionFromPool,
    getFilesInPool,
    _clearMockDb
};
