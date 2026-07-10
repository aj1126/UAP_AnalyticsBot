const { Worker } = require('node:worker_threads');
const path = require('node:path');
const fs = require('node:fs/promises');
const crypto = require('node:crypto');

const CACHE_FILE = '.analytics_cache.json';
const CACHE_SCHEMA_VERSION = 1;

async function loadCache() {
    try {
        const cachePath = path.join(process.cwd(), CACHE_FILE);
        const data = await fs.readFile(cachePath, 'utf-8');
        const parsed = JSON.parse(data);
        if (
            parsed &&
            parsed.version === CACHE_SCHEMA_VERSION &&
            parsed.entries &&
            typeof parsed.entries === 'object' &&
            !Array.isArray(parsed.entries)
        ) {
            return parsed.entries;
        }
        return Object.create(null);
    } catch {
        return Object.create(null);
    }
}

async function saveCache(entries) {
    try {
        const cachePath = path.join(process.cwd(), CACHE_FILE);
        const payload = {
            version: CACHE_SCHEMA_VERSION,
            entries
        };
        await fs.writeFile(cachePath, JSON.stringify(payload, null, 2), 'utf-8');
    } catch {
        // Fallback silently if the directory is read-only
    }
}

async function walkFiles(dir, fileList = []) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name !== 'data_exports' && entry.name !== '.git') {
                await walkFiles(fullPath, fileList);
            }
        } else {
            const ext = path.extname(entry.name).toLowerCase();
            if (['.txt', '.md', '.pdf', '.png', '.jpg', '.jpeg', '.mp4'].includes(ext)) {
                fileList.push(fullPath);
            }
        }
    }
    return fileList;
}

async function ingestDirectory(sourceDirectory, options = {}) {
    const numWorkers = options.workers || 1;
    const cachePath = path.join(process.cwd(), CACHE_FILE);
    if (options.clearCache) {
        try {
            await fs.unlink(cachePath);
        } catch {}
    }

    const cache = await loadCache();
    const allFilePaths = await walkFiles(sourceDirectory);
    
    const pathsToProcess = [];
    const finalFiles = [];
    const visitedPaths = new Set();

    for (const filePath of allFilePaths) {
        visitedPaths.add(filePath);
        const stat = await fs.stat(filePath);
        const fingerprint = crypto
            .createHash('md5')
            .update(`${filePath}:${stat.mtimeMs}:${stat.size}`)
            .digest('hex');

        if (cache[filePath] && cache[filePath].fingerprint === fingerprint) {
            finalFiles.push(cache[filePath].data);
        } else {
            pathsToProcess.push({ filePath, fingerprint });
        }
    }

    // Evict stale cache keys scoped to this sourceDirectory
    for (const key of Object.keys(cache)) {
        if (
            (key === sourceDirectory || key.startsWith(sourceDirectory + path.sep)) &&
            !visitedPaths.has(key)
        ) {
            delete cache[key];
        }
    }

    if (pathsToProcess.length === 0) {
        await saveCache(cache);
        return { sourceDirectory, files: finalFiles };
    }

    const actualWorkers = Math.min(numWorkers, pathsToProcess.length);
    let currentIndex = 0;

    await new Promise((resolve) => {
        let completedWorkers = 0;

        for (let i = 0; i < actualWorkers; i++) {
            const worker = new Worker(path.join(__dirname, 'worker.js'));

            worker.on('message', (msg) => {
                if (msg.success && msg.fileData) {
                    finalFiles.push(msg.fileData);
                    cache[msg.filePath] = {
                        fingerprint: msg.fingerprint,
                        data: msg.fileData
                    };
                }
                assignNextTask(worker);
            });

            worker.on('error', () => {
                assignNextTask(worker);
            });

            worker.on('exit', () => {
                completedWorkers++;
                if (completedWorkers === actualWorkers) {
                    resolve();
                }
            });

            assignNextTask(worker);
        }

        function assignNextTask(worker) {
            if (currentIndex >= pathsToProcess.length) {
                // Defer termination to avoid re-entrancy segfaults
                setImmediate(() => {
                    worker.terminate();
                });
                return;
            }
            const task = pathsToProcess[currentIndex++];
            worker.postMessage({
                filePath: task.filePath,
                fingerprint: task.fingerprint,
                rootDirectory: sourceDirectory
            });
        }
    });

    await saveCache(cache);
    return { sourceDirectory, files: finalFiles };
}

module.exports = {
    ingestDirectory
};