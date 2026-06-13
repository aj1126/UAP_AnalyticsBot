#!/usr/bin/env node
const path = require('node:path');
const chokidar = require('chokidar');
const { generateAnalyticsReport } = require('./pipeline');
const { generateMarkdownReport } = require('./delivery/markdown-generator');

async function runPipeline(sourceDirectory, format) {
    try {
        const report = await generateAnalyticsReport(sourceDirectory);
        if (format === 'md' || format === 'markdown') {
            const exportsDir = path.join(process.cwd(), 'data_exports');
            const savedPath = await generateMarkdownReport(report, exportsDir);
            process.stdout.write(`✅ Markdown report successfully generated at:\n${savedPath}\n`);
        } else {
            process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
        }
    } catch (error) {
        process.stderr.write(`❌ Pipeline Error: ${error.message}\n`);
    }
}

async function main() {
    const args = process.argv.slice(2);
    
    // Parse flags
    const formatFlag = args.find(arg => arg.startsWith('--format='));
    const format = formatFlag ? formatFlag.split('=')[1].toLowerCase() : 'json';
    const isWatchMode = args.includes('--watch');
    
    // Parse target directory
    const sourceArg = args.find(arg => !arg.startsWith('--'));
    const sourceDirectory = sourceArg ? path.resolve(sourceArg) : process.cwd();

    if (isWatchMode) {
        process.stdout.write(`👀 Watching directory for changes: ${sourceDirectory}\n`);
        
        // Initialize OS Event Listener
        const watcher = chokidar.watch(sourceDirectory, {
            ignored: [/(^|[\/\\])\../, /node_modules/, /data_exports/],
            persistent: true,
            ignoreInitial: false
        });

        // Debounce logic to prevent CPU spikes on bulk file operations
        let timeout;
        const triggerPipeline = () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                process.stdout.write(`\n🔄 File system event detected. Recalculating analytics...\n`);
                runPipeline(sourceDirectory, format);
            }, 500); // 500ms buffer
        };

        // Bind events
        watcher
            .on('add', triggerPipeline)
            .on('change', triggerPipeline)
            .on('unlink', triggerPipeline);
    } else {
        await runPipeline(sourceDirectory, format);
    }
}

main().catch((error) => {
    process.stderr.write(`❌ Fatal Error: ${error.message}\n`);
    process.exitCode = 1;
});