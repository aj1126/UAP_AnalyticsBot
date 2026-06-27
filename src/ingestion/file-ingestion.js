const { Worker } = require('node:worker_threads');
const path = require('node:path');
const fs = require('node:fs/promises');
const crypto = require('node:crypto');

const CACHE_FILE = '.analytics_cache.json';

async function loadCache(rootDir) {
    try {
        const cachePath = path.join(rootDir, CACHE_FILE);
        const data = await fs.readFile(cachePath, 'utf-8');
        return JSON.parse(data);
    } catch {
        return Object.create(null);
    }
}

async function saveCache(rootDir, cache) {
    try {
        const cachePath = path.join(rootDir, CACHE_FILE);
        await fs.writeFile(cachePath, JSON.stringify(cache, null, 2), 'utf-8');
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
            if (['.txt', '.md', '.pdf', '.png', '.jpg', '.jpeg'].includes(ext)) {
                fileList.push(fullPath);
            }
        }
    }
    return fileList;
}

async function ingestDirectory(sourceDirectory, options = {}) {
    const numWorkers = options.workers || 1;
    if (options.clearCache) {
        try {
            await fs.unlink(path.join(sourceDirectory, CACHE_FILE));
        } catch {}
    }

    const cache = await loadCache(sourceDirectory);
    const allFilePaths = await walkFiles(sourceDirectory);
    
    const pathsToProcess = [];
    const finalFiles = [];

    for (const filePath of allFilePaths) {
        const stat = await fs.stat(filePath);
        const fingerprint = crypto
            .createHash('md5')
            .update(`${filePath}:${stat.mtimeMs}:${stat.size}`)
            .digest('hex');

        if (cache[fingerprint]) {
            finalFiles.push(cache[fingerprint]);
        } else {
            pathsToProcess.push({ filePath, fingerprint });
        }
    }

    if (pathsToProcess.length === 0) {
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
                    cache[msg.fingerprint] = msg.fileData;
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
                // Send a close message so the worker shuts down gracefully after its event loop empties
                worker.postMessage({ action: 'close' });
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

    await saveCache(sourceDirectory, cache);
    return { sourceDirectory, files: finalFiles };
}

module.exports = {
    ingestDirectory
};