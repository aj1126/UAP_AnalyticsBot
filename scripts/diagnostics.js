/**
 * System Diagnostics and Environment Health Inspection Script
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { execSync } = require('node:child_process');

const reportLines = [];

function log(msg) {
    console.log(msg);
    reportLines.push(msg);
}

async function runDiagnostics() {
    log(`=====================================================`);
    log(`🔍 SYSTEM DIAGNOSTICS REPORT - UAP AnalyticsBot`);
    log(`Generated: ${new Date().toISOString()}`);
    log(`=====================================================`);
    log(``);

    // 1. Environment Details
    log(`[1] ENVIRONMENT & RUNTIME`);
    log(`-----------------------------------`);
    log(`OS Platform:  ${os.platform()} (${os.type()} ${os.release()})`);
    log(`Architecture: ${os.arch()}`);
    log(`Total RAM:    ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`);
    log(`CPU Model:    ${os.cpus()[0]?.model || 'Unknown'}`);
    log(`Node.js Ver:  ${process.version}`);
    
    try {
        const npmVer = execSync('npm -v', { encoding: 'utf8' }).trim();
        log(`npm Version:  ${npmVer}`);
    } catch (e) {
        log(`npm Version:  [WARNING] Failed to query npm version: ${e.message}`);
    }
    log(``);

    // 2. Dependency Loading Verification
    log(`[2] PACKAGE DEPENDENCY STATUS`);
    log(`-----------------------------------`);
    const dependencies = [
        'chokidar',
        'compromise',
        'mupdf',
        'pdf-parse',
        'tesseract.js'
    ];

    let allDepsPass = true;
    for (const dep of dependencies) {
        try {
            await import(dep);
            log(`  [PASS] Required dependency: ${dep}`);
        } catch (err) {
            log(`  [FAIL] Failed to load dependency "${dep}": ${err.message}`);
            allDepsPass = false;
        }
    }
    log(`Overall Dependency Status: ${allDepsPass ? '✅ Healthy' : '❌ Issues Found (Please run install.bat/npm install)'}`);
    log(``);

    // 3. Database Integrity & Storage
    log(`[3] TELEMETRY DATABASE STATUS`);
    log(`-----------------------------------`);
    const dbPath = path.resolve(__dirname, '../uap_telemetry.db');
    log(`Database file location: ${dbPath}`);
    log(`File exists:            ${fs.existsSync(dbPath) ? 'Yes' : 'No'}`);

    try {
        const db = require('../src/telemetry/db');
        db.initDb();
        log(`Database Driver Type:   ${db.isMock() ? 'Fallback JSON Mock' : 'Native SQLite'}`);

        const database = db.getDatabase();
        let eventCount = 0;
        let alertCount = 0;
        let summaryCount = 0;

        if (db.isMock()) {
            eventCount = database.tables.telemetry_events.length;
            alertCount = database.tables.alerts.length;
            summaryCount = database.tables.metric_summaries.length;
        } else {
            const getCount = (table) => {
                const stmt = database.prepare(`SELECT COUNT(*) as count FROM ${table}`);
                const res = stmt.get();
                return res ? res.count : 0;
            };
            eventCount = getCount('telemetry_events');
            alertCount = getCount('alerts');
            summaryCount = getCount('metric_summaries');
        }

        log(`Telemetry Events Logged: ${eventCount}`);
        log(`System Alerts Logged:   ${alertCount}`);
        log(`Metric Summaries:       ${summaryCount}`);
        log(`Database Connection:    ✅ Health Status OK`);
    } catch (err) {
        log(`Database Connection:    ❌ Failed connection: ${err.message}`);
    }
    log(``);

    // 4. GUI Network Port Availability
    log(`[4] NETWORK PORT ACCESS (Port 3000)`);
    log(`-----------------------------------`);
    
    const portCheck = () => {
        return new Promise((resolve) => {
            const server = net.createServer();
            server.once('error', (err) => {
                if (err.code === 'EADDRINUSE') {
                    resolve({ available: false, message: 'Port 3000 is currently occupied/blocked by another process.' });
                } else {
                    resolve({ available: false, message: `Port 3000 check encountered error: ${err.message}` });
                }
            });
            server.once('listening', () => {
                server.close();
                resolve({ available: true, message: 'Port 3000 is open and available for GUI launch.' });
            });
            server.listen(3000);
        });
    };

    const portRes = await portCheck();
    log(`Port Availability: ${portRes.available ? '✅ Available' : '⚠️ Blocked'}`);
    log(`Detail:            ${portRes.message}`);
    log(``);

    // 5. Diagnostics Summary Verdict
    log(`[5] DIAGNOSTIC SUMMARY VERDICT`);
    log(`-----------------------------------`);
    if (allDepsPass && portRes.available) {
        log(`OVERALL HEALTH STATUS: ✅ EXCELLENT`);
        log(`UAP AnalyticsBot is ready to run and visual Web GUI is launchable.`);
    } else if (allDepsPass) {
        log(`OVERALL HEALTH STATUS: ⚠️ READY WITH PORT WARNING`);
        log(`Dependencies are configured, but Port 3000 is in use. Double check if another instance of the GUI is running.`);
    } else {
        log(`OVERALL HEALTH STATUS: ❌ FAILING CONFIGURATION`);
        log(`Dependencies are missing. Please run install.bat or execute 'npm install' to repair setup.`);
    }
    log(``);
    log(`=====================================================`);
    log(`Report saved to diagnostics_report.txt`);
    log(`=====================================================`);

    // Write file
    const reportText = reportLines.join('\n');
    fs.writeFileSync(path.resolve(__dirname, '../diagnostics_report.txt'), reportText, 'utf8');
}

runDiagnostics().catch(err => {
    console.error('Fatal diagnostics error:', err);
    process.exit(1);
});
