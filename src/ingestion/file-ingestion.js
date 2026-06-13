const path = require("node:path");
const os = require("node:os");
const { promises: fsp } = require("node:fs");
const { Worker } = require("node:worker_threads");

async function* walkFiles(rootDirectory) {
    const directoryEntries = await fsp.readdir(rootDirectory, { withFileTypes: true });

    for (const entry of directoryEntries) {
        const absolutePath = path.join(rootDirectory, entry.name);
        if (entry.isDirectory()) {
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
            cache = JSON.parse(cacheData);
        } catch (err) {
            cache = {};
        }
    }

    for await (const filePath of walkFiles(sourceDirectory)) {
        const stats = await fsp.stat(filePath);
        const fingerprint = `${stats.size}-${stats.mtimeMs}`; // Size + Modified Time
        
        if (cache[filePath] && cache[filePath].fingerprint === fingerprint) {
            files.push(cache[filePath].data); // Short-circuit bypass
        } else {
            pathsToProcess.push({ filePath, fingerprint });
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
    await fsp.writeFile(cachePath, JSON.stringify(cache, null, 2));

    return { sourceDirectory, files };
}

module.exports = { ingestDirectory };