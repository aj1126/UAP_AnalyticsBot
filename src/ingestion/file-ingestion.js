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

    for await (const filePath of walkFiles(sourceDirectory)) {
        pathsToProcess.push(filePath);
    }

    // FIX 1: Cap workers to the number of files. 
    // Prevents spawning 15 massive threads to process 1 tiny test file.
    const maxCores = Math.max(1, os.cpus().length - 1);
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
                    } else if (!msg.success) {
                        process.stderr.write(`\n⚠️ File failed (${msg.filePath}): ${msg.error}\n`);
                    }
                    assignNextTask();
                });

                worker.on("error", (err) => {
                    process.stderr.write(`\n⚠️ Fatal Worker Crash: ${err.message}\n`);
                    // FIX 2: Await thread termination so it doesn't leave dangling memory leaks
                    worker.terminate().then(resolve);
                });

                function assignNextTask() {
                    if (currentIndex >= pathsToProcess.length) {
                        // FIX 2: Await thread termination to clear the Node.js event loop
                        worker.terminate().then(resolve);
                        return;
                    }
                    
                    const filePath = pathsToProcess[currentIndex++];
                    worker.postMessage({ filePath, rootDirectory: sourceDirectory });
                }

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