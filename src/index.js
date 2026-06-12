#!/usr/bin/env node
const path = require('node:path');
const { generateAnalyticsReport } = require('./pipeline');
const { generateMarkdownReport } = require('./delivery/markdown-generator');

async function main() {
    // 1. Parse CLI arguments
    const args = process.argv.slice(2);
    const formatFlag = args.find(arg => arg.startsWith('--format='));
    const format = formatFlag ? formatFlag.split('=')[1].toLowerCase() : 'json';
    const sourceArg = args.find(arg => !arg.startsWith('--'));
    
    const sourceDirectory = sourceArg ? path.resolve(sourceArg) : process.cwd();
    
    // 2. Generate the core data pipeline
    const report = await generateAnalyticsReport(sourceDirectory);

    // 3. Route Output based on format flag
    if (format === 'md' || format === 'markdown') {
        const exportsDir = path.join(process.cwd(), 'data_exports');
        const savedPath = await generateMarkdownReport(report, exportsDir);
        process.stdout.write(`✅ Markdown report successfully generated at:\n${savedPath}\n`);
    } else {
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    }
}

main().catch((error) => {
    process.stderr.write(`❌ Error: ${error.message}\n`);
    process.exitCode = 1;
});