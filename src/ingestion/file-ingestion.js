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

async function ingestDirectory(rootDirectory) {
    const sourceDirectory = path.resolve(rootDirectory);
    const files = [];
    const pathsToProcess = [];

    // 1. Instantly gather all file paths without blocking
    for await (const filePath of walkFiles(sourceDirectory)) {
        pathsToProcess.push(filePath);
    }

    // 2. Provision the Worker Pool (Leave 1 core free for OS stability)
    const numWorkers = Math.max(1, os.cpus().length - 1);
    process.stdout.write(`\n🚀 Initializing WebAssembly Worker Pool (${numWorkers} threads)...\n`);

    let currentIndex = 0;

    // 3. Dispatch tasks concurrently
    await Promise.all(
        Array.from({ length: numWorkers }).map(() => {
            return new Promise((resolve) => {
                const worker = new Worker(path.join(__dirname, "worker.js"));

                worker.on("message", (msg) => {
                    if (msg.success && msg.result) {
                        files.push(msg.result);
                    } else if (!msg.success) {
                        process.stderr.write(`\n⚠️ File failed (${msg.filePath}): ${msg.error}\n`);
                    }
                    assignNextTask();
                });

                worker.on("error", (err) => {
                    process.stderr.write(`\n⚠️ Fatal Worker Crash: ${err.message}\n`);
                    assignNextTask();
                });

                function assignNextTask() {
                    // Terminate the thread cleanly when the queue is empty
                    if (currentIndex >= pathsToProcess.length) {
                        worker.terminate();
                        resolve();
                        return;
                    }
                    
                    const filePath = pathsToProcess[currentIndex++];
                    worker.postMessage({ filePath, rootDirectory: sourceDirectory });
                }

                // Boot the first task
                assignNextTask();
            });
        })
    );

    return {
        sourceDirectory,
        files,
    };
}

module.exports = {
    ingestDirectory,
};