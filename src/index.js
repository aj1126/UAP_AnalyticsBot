#!/usr/bin/env node
const path = require('node:path');
const { generateAnalyticsReport } = require('./pipeline');

async function main() {
    const sourceDirectory = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
    const report = await generateAnalyticsReport(sourceDirectory);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
});
