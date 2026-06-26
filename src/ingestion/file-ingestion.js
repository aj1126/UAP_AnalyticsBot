const path = require("node:path");
const os = require("node:os");
const { promises: fsp } = require("node:fs");
const { Worker } = require("node:worker_threads");

const CACHE_SCHEMA_VERSION = 1;

function parseCacheEntries(cacheData) {
    const parsedCache = JSON.parse(cacheData);

    if (
        parsedCache &&
        typeof parsedCache === 'object' &&
        parsedCache.version === CACHE_SCHEMA_VERSION &&
        parsedCache.entries &&
        typeof parsedCache.entries === 'object' &&
        !Array.isArray(parsedCache.entries)
    ) {
        return parsedCache.entries;
    }

    return {};
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
            cache = parseCacheEntries(cacheData);
        } catch (err) {
            cache = {};
        }
    }

    const visitedPaths = new Set();
    for await (const filePath of walkFiles(sourceDirectory)) {
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
        if (
            (key === sourceDirectory || key.startsWith(sourceDirectory + path.sep)) &&
            !visitedPaths.has(key)
        ) {
            delete cache[key];
        }
    }

    const maxCores = options.workers || Math.max(1, os.cpus().length - 1);
    const numWorkers = Math.min(pathsToProcess.length, maxCores);
    
    if (numWorkers > 0) {
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
                        setImmediate(() => {
                            worker.terminate().then(resolve);
                        });
                    });

                    function assignNextTask() {
                        if (currentIndex >= pathsToProcess.length) {
                            setImmediate(() => {
                                worker.terminate().then(resolve);
                            });
                            return;
                        }
                        const task = pathsToProcess[currentIndex++];
                        worker.postMessage({ filePath: task.filePath, fingerprint: task.fingerprint, rootDirectory: sourceDirectory });
                    }

                    assignNextTask();
                });
            })
        );
    }

    // Save newly parsed data back to .analytics_cache.json
    const tempCachePath = `${cachePath}.${process.pid}.${Date.now()}.tmp`;
    await fsp.writeFile(
        tempCachePath,
        JSON.stringify({ version: CACHE_SCHEMA_VERSION, entries: cache }, null, 2)
    );
    await fsp.rename(tempCachePath, cachePath);

    return { sourceDirectory, files };
}

module.exports = { ingestDirectory };