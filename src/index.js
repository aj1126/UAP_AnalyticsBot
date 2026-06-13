#!/usr/bin/env node
const path = require('node:path');
const chokidar = require('chokidar');
const { generateAnalyticsReport } = require('./pipeline');
const { generateMarkdownReport } = require('./delivery/markdown-generator');
const { generateCsvReport } = require('./delivery/csv-generator');

async function runPipeline(sourceDirectory, format, options) {
    try {
        const report = await generateAnalyticsReport(sourceDirectory, options);
        const exportsDir = path.join(process.cwd(), 'data_exports');
        
        if (format === 'md' || format === 'markdown') {
            const savedPath = await generateMarkdownReport(report, exportsDir);
            process.stdout.write(`✅ Markdown report successfully generated at:\n${savedPath}\n`);
        } else if (format === 'csv') {
            const savedPath = await generateCsvReport(report, exportsDir);
            process.stdout.write(`✅ CSV report successfully generated at:\n${savedPath}\n`);
        } else {
            process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
        }
    } catch (error) {
        process.stderr.write(`❌ Pipeline Error: ${error.message}\n`);
    }
}

async function main() {
    const args = process.argv.slice(2);
    
    const formatFlag = args.find(arg => arg.startsWith('--format='));
    const format = formatFlag ? formatFlag.split('=')[1].toLowerCase() : 'json';
    const isWatchMode = args.includes('--watch');
    const clearCache = args.includes('--clear-cache');
    
    const workersFlag = args.find(arg => arg.startsWith('--workers='));
    let workers;
    if (workersFlag) {
        const parsed = parseInt(workersFlag.split('=')[1], 10);
        if (Number.isNaN(parsed) || parsed < 1) {
            process.stderr.write(`⚠️ Invalid --workers value. Must be a positive integer. Defaulting to CPU count.\n`);
        } else {
            workers = parsed;
        }
    }
    
    const sourceArg = args.find(arg => !arg.startsWith('--'));
    const sourceDirectory = sourceArg ? path.resolve(sourceArg) : process.cwd();

    const options = { clearCache, workers };

    if (isWatchMode) {
        process.stdout.write(`👀 Watching directory for changes: ${sourceDirectory}\n`);
        const watcher = chokidar.watch(sourceDirectory, {
            ignored: [/(^|[\/\\])\../, /node_modules/, /data_exports/],
            persistent: true, ignoreInitial: false
        });

        let timeout;
        let pipelineQueue = Promise.resolve();
        const triggerPipeline = () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                process.stdout.write(`\n🔄 File system event detected. Recalculating analytics...\n`);
                pipelineQueue = pipelineQueue.then(() => runPipeline(sourceDirectory, format, options));
            }, 500);
        };
        watcher.on('add', triggerPipeline).on('change', triggerPipeline).on('unlink', triggerPipeline);
    } else {
        await runPipeline(sourceDirectory, format, options);
    }
}

main().catch((error) => {
    process.stderr.write(`❌ Fatal Error: ${error.message}\n`);
    process.exitCode = 1;
});