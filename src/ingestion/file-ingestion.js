const path = require("node:path");
const os = require("node:os");
const { promises: fsp } = require("node:fs");
const { Worker } = require("node:worker_threads");

const CACHE_VERSION = 1;
const SUPPORTED_TEXT_EXTENSIONS = new Set([".txt", ".md", ".json", ".csv", ".log"]);

function isSupportedTextFile(filePath) {
    return SUPPORTED_TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

async function* walkFiles(rootDirectory) {
    const directoryEntries = await fsp.readdir(rootDirectory, { withFileTypes: true });

    for (const entry of directoryEntries) {
        const absolutePath = path.join(rootDirectory, entry.name);
        if (entry.isSymbolicLink()) {
            continue; // Skip symlinks to prevent traversal outside the source directory
        } else if (entry.isDirectory()) {
            yield* walkFiles(absolutePath);
        } else if (entry.isFile()) {
            yield absolutePath;
        }
    }
}

async function ingestDirectory(rootDirectory, options = {}) {
    const sourceDirectory = path.resolve(rootDirectory);
    const files = [];
    const pathsToProcess = [];

    // State Caching (Memoization)
    const cachePath = path.join(process.cwd(), '.analytics_cache.json');
    let cache = {};
    if (!options.clearCache) {
        try {
            const cacheData = await fsp.readFile(cachePath, 'utf-8');
            const parsedCache = JSON.parse(cacheData);
            if (parsedCache && parsedCache.version === CACHE_VERSION && parsedCache.entries && typeof parsedCache.entries === 'object') {
                cache = parsedCache.entries;
            }
        } catch (err) {
            cache = {};
        }
    }

    const visitedPaths = new Set();
    for await (const filePath of walkFiles(sourceDirectory)) {
        if (!isSupportedTextFile(filePath)) {
            continue;
        }

        visitedPaths.add(filePath);
        const stats = await fsp.stat(filePath);
        const fingerprint = `${stats.size}-${stats.mtimeMs}`; // Size + Modified Time
        
        if (cache[filePath] && cache[filePath].fingerprint === fingerprint) {
            files.push(cache[filePath].data); // Short-circuit bypass
        } else {
            pathsToProcess.push({ filePath, fingerprint });
        }
    }

    // Evict stale cache keys scoped to this sourceDirectory
    for (const key of Object.keys(cache)) {
        if (key.startsWith(sourceDirectory) && !visitedPaths.has(key)) {
            delete cache[key];
        }
    }

    const maxCores = options.workers || Math.max(1, os.cpus().length - 1);
    const numWorkers = Math.min(pathsToProcess.length, maxCores);
    
    if (numWorkers === 0) {
        return { sourceDirectory, files };
    }

    process.stdout.write(`\n🚀 Initializing WebAssembly Worker Pool (${numWorkers} threads)...\n`);

    let currentIndex = 0;

    await Promise.all(
        Array.from({ length: numWorkers }).map(() => {
            return new Promise((resolve) => {
                const worker = new Worker(path.join(__dirname, "worker.js"));

                worker.on("message", (msg) => {
                    if (msg.success && msg.result) {
                        files.push(msg.result);
                        cache[msg.filePath] = { fingerprint: msg.fingerprint, data: msg.result };
                    } else if (!msg.success) {
                        process.stderr.write(`\n⚠️ File failed (${msg.filePath}): ${msg.error}\n`);
                    }
                    assignNextTask();
                });

                worker.on("error", (err) => {
                    process.stderr.write(`\n⚠️ Fatal Worker Crash: ${err.message}\n`);
                    worker.terminate().then(resolve);
                });

                function assignNextTask() {
                    if (currentIndex >= pathsToProcess.length) {
                        worker.terminate().then(resolve);
                        return;
                    }
                    const task = pathsToProcess[currentIndex++];
                    worker.postMessage({ filePath: task.filePath, fingerprint: task.fingerprint, rootDirectory: sourceDirectory });
                }

                assignNextTask();
            });
        })
    );

    // Save newly parsed data back to .analytics_cache.json
    const cachePayload = JSON.stringify({ version: CACHE_VERSION, entries: cache }, null, 2);
    const tempCachePath = `${cachePath}.${process.pid}.${Date.now()}.tmp`;
    await fsp.writeFile(tempCachePath, cachePayload, 'utf-8');
    await fsp.rename(tempCachePath, cachePath);

    return { sourceDirectory, files };
}

module.exports = { ingestDirectory };