#!/usr/bin/env node
/**
 * UAP Government Release Packs Synchronizer & Monitor
 * 
 * Automatically audits https://www.war.gov/ufo/ for officially released PURSUE packs (R01..RN),
 * cross-references local files, prompts for approval before downloading missing packs,
 * and supports automated watching for future drops.
 * 
 * Usage:
 *   node scripts/sync-government-packs.js                  # Audit and prompt for approval
 *   node scripts/sync-government-packs.js --check          # Audit only (no download)
 *   node scripts/sync-government-packs.js --approve        # Auto-approve download of missing packs
 *   node scripts/sync-government-packs.js --watch          # Monitor for new drops periodically
 *   node scripts/sync-government-packs.js --target "D:\..."# Specify custom target directory
 */

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');

// Configuration Defaults
const PORTAL_URL = 'https://www.war.gov/ufo/';
const DEFAULT_TARGET_DIR = path.resolve('D:\\Downloads (D)\\.2026\\WARdotGOV\\UAP File Dumps');
const FALLBACK_TARGET_DIR = path.resolve(__dirname, '..', 'data_exports', 'government_packs');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// Parse CLI flags
const args = process.argv.slice(2);
const isCheckOnly = args.includes('--check') || args.includes('-c');
const isAutoApprove = args.includes('--approve') || args.includes('-y') || args.includes('--yes');
const isWatchMode = args.includes('--watch') || args.includes('-w');
const targetDirArgIdx = args.findIndex(a => a === '--target' || a === '-t');
const targetDir = targetDirArgIdx !== -1 && args[targetDirArgIdx + 1]
    ? path.resolve(args[targetDirArgIdx + 1])
    : (fs.existsSync(path.dirname(DEFAULT_TARGET_DIR)) ? DEFAULT_TARGET_DIR : FALLBACK_TARGET_DIR);

/**
 * Format bytes into human-readable string
 */
function formatBytes(bytes) {
    if (bytes === 0 || !bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Fetch HTML and discover all official release packs
 */
async function discoverOfficialPacks() {
    console.log(`📡 Fetching live release manifest from ${PORTAL_URL}...`);
    const resp = await fetch(PORTAL_URL, {
        headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
    });

    if (!resp.ok) {
        throw new Error(`Failed to fetch portal: HTTP ${resp.status} ${resp.statusText}`);
    }

    const html = await resp.text();
    const aRegex = /<a\b[^>]*?\bhref=["']([^"']*\.zip)["'][^>]*?>([\s\S]*?)<\/a\s*>/gi;
    let match;
    const packs = [];

    while ((match = aRegex.exec(html)) !== null) {
        let url = match[1].trim();
        if (url.startsWith('/')) url = 'https://www.war.gov' + url;
        const rawLabel = match[2].replace(/<[^>]+>/g, '').trim();

        // Extract Release number, e.g. "Release 01" -> "R01"
        const relMatch = rawLabel.match(/Release\s*([0-9]+)/i) || url.match(/release[_-]?([0-9]+)/i);
        const relNumber = relMatch ? parseInt(relMatch[1], 10) : null;
        const releaseId = relNumber !== null ? `R${String(relNumber).padStart(2, '0')}` : 'R??';

        // Extract Type (Documents or Videos)
        const isVideo = /video/i.test(rawLabel) || /vid/i.test(url) || /uapvideos/i.test(url);
        const type = isVideo ? 'Videos' : 'Documents';

        // Extract filename from URL
        const fileName = path.basename(new URL(url).pathname);

        // Size estimate from label, e.g. [1.2gb]
        const sizeMatch = rawLabel.match(/\[([^\]]+)\]/);
        const labelSize = sizeMatch ? sizeMatch[1].toUpperCase() : 'N/A';

        packs.push({
            releaseId,
            relNumber,
            type,
            labelSize,
            url,
            fileName,
            folderName: relNumber !== null ? `Release ${relNumber}` : 'Other'
        });
    }

    return packs;
}

/**
 * Fetch remote file metadata (Content-Length, Accept-Ranges)
 */
async function getRemoteMetadata(url) {
    try {
        const resp = await fetch(url, {
            method: 'HEAD',
            headers: {
                'User-Agent': USER_AGENT,
                'Referer': PORTAL_URL,
                'Accept': '*/*'
            }
        });
        if (resp.ok) {
            const lengthHeader = resp.headers.get('content-length');
            const acceptRanges = resp.headers.get('accept-ranges') === 'bytes';
            return {
                status: resp.status,
                size: lengthHeader ? parseInt(lengthHeader, 10) : null,
                acceptRanges
            };
        }
        return { status: resp.status, size: null, acceptRanges: false };
    } catch (e) {
        return { status: 0, error: e.message, size: null, acceptRanges: false };
    }
}

/**
 * Audit local directory for existing packs
 */
function auditLocalFile(baseDir, folderName, fileName) {
    // Check in specific subfolder first: <baseDir>\<folderName>\<fileName>
    const subfolderPath = path.join(baseDir, folderName, fileName);
    if (fs.existsSync(subfolderPath)) {
        const stat = fs.statSync(subfolderPath);
        return { exists: true, filePath: subfolderPath, size: stat.size };
    }

    // Check directly in root of baseDir: <baseDir>\<fileName>
    const rootPath = path.join(baseDir, fileName);
    if (fs.existsSync(rootPath)) {
        const stat = fs.statSync(rootPath);
        return { exists: true, filePath: rootPath, size: stat.size };
    }

    // Check if a .part or .download exists
    const partPath = `${subfolderPath}.part`;
    if (fs.existsSync(partPath)) {
        const stat = fs.statSync(partPath);
        return { exists: false, isPartial: true, filePath: partPath, size: stat.size };
    }

    return { exists: false, filePath: subfolderPath, size: 0 };
}

/**
 * Download a file with streaming progress bar
 */
async function downloadFile(url, destPath, expectedSize) {
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }

    const tempPath = `${destPath}.part`;
    let startByte = 0;

    // Check if partial download can be resumed
    const requestHeaders = {
        'User-Agent': USER_AGENT,
        'Referer': PORTAL_URL,
        'Accept': '*/*'
    };

    if (fs.existsSync(tempPath)) {
        startByte = fs.statSync(tempPath).size;
        if (expectedSize && startByte >= expectedSize) {
            // Part file is already complete or invalid, reset
            fs.unlinkSync(tempPath);
            startByte = 0;
        } else if (startByte > 0) {
            requestHeaders['Range'] = `bytes=${startByte}-`;
            console.log(`   ⏩ Resuming from byte ${formatBytes(startByte)}...`);
        }
    }

    const response = await fetch(url, { headers: requestHeaders });

    if (!response.ok && response.status !== 206) {
        throw new Error(`Download failed with HTTP ${response.status}: ${response.statusText}`);
    }

    const isPartial = response.status === 206;
    const totalBytes = isPartial
        ? startByte + parseInt(response.headers.get('content-length') || '0', 10)
        : parseInt(response.headers.get('content-length') || String(expectedSize || 0), 10);

    const fileStream = fs.createWriteStream(tempPath, { flags: isPartial ? 'a' : 'w' });
    let downloadedBytes = startByte;
    let lastLoggedTime = Date.now();
    let bytesInWindow = 0;
    let speedStr = '0 B/s';

    const reader = response.body.getReader();
    const progressStream = new Readable({
        async read() {
            try {
                const { done, value } = await reader.read();
                if (done) {
                    this.push(null);
                    return;
                }

                downloadedBytes += value.length;
                bytesInWindow += value.length;

                const now = Date.now();
                if (now - lastLoggedTime >= 500) {
                    const elapsedSec = (now - lastLoggedTime) / 1000;
                    const speed = bytesInWindow / elapsedSec;
                    speedStr = `${formatBytes(speed)}/s`;
                    bytesInWindow = 0;
                    lastLoggedTime = now;

                    const percent = totalBytes > 0 ? ((downloadedBytes / totalBytes) * 100).toFixed(1) : '?.?';
                    const progStr = totalBytes > 0
                        ? `${formatBytes(downloadedBytes)} / ${formatBytes(totalBytes)} (${percent}%)`
                        : `${formatBytes(downloadedBytes)} (size unknown)`;

                    process.stdout.write(`\r   ⏳ Progress: ${progStr} | Speed: ${speedStr}   `);
                }

                this.push(value);
            } catch (err) {
                this.destroy(err);
            }
        }
    });

    await pipeline(progressStream, fileStream);
    process.stdout.write(`\r   ✅ Complete: ${formatBytes(downloadedBytes)} transferred!                     \n`);

    // Verify and rename
    fs.renameSync(tempPath, destPath);
}

/**
 * Main Sync & Audit Execution Loop
 */
async function runSync() {
    console.log('='.repeat(70));
    console.log('🛰️  UAP Government Release Packs Synchronizer & Monitor');
    console.log(`📁 Target Directory: ${targetDir}`);
    console.log('='.repeat(70));

    const packs = await discoverOfficialPacks();
    console.log(`🔍 Found ${packs.length} official packs cataloged on war.gov/ufo.\n`);

    const missingPacks = [];
    const upToDatePacks = [];

    console.log('Auditing local files against live manifest:');
    console.log('-'.repeat(70));

    for (const pack of packs) {
        const local = auditLocalFile(targetDir, pack.folderName, pack.fileName);
        const remoteMeta = await getRemoteMetadata(pack.url);
        const expectedBytes = remoteMeta.size;

        if (local.exists) {
            // Check size validation
            if (expectedBytes && Math.abs(local.size - expectedBytes) > 1024 * 1024) {
                console.log(`⚠️  ${pack.releaseId} ${pack.type.padEnd(9)}: Size mismatch (Local: ${formatBytes(local.size)}, Remote: ${formatBytes(expectedBytes)})`);
                missingPacks.push({ ...pack, localPath: local.filePath, expectedBytes, reason: 'size_mismatch' });
            } else {
                console.log(`✅  ${pack.releaseId} ${pack.type.padEnd(9)}: UP TO DATE (${formatBytes(local.size)})`);
                upToDatePacks.push({ ...pack, localPath: local.filePath, size: local.size });
            }
        } else {
            console.log(`❌  ${pack.releaseId} ${pack.type.padEnd(9)}: MISSING (${formatBytes(expectedBytes) || pack.labelSize})`);
            missingPacks.push({ ...pack, localPath: local.filePath, expectedBytes, reason: 'not_found' });
        }
    }

    console.log('-'.repeat(70));
    console.log(`📊 Summary: ${upToDatePacks.length} up to date | ${missingPacks.length} missing\n`);

    if (missingPacks.length === 0) {
        console.log('🎉 All released packs (R01 through latest) are already fully downloaded and verified!');
        return;
    }

    const totalMissingBytes = missingPacks.reduce((sum, p) => sum + (p.expectedBytes || 0), 0);
    console.log(`📥 Total Missing Download Volume: ${formatBytes(totalMissingBytes)} across ${missingPacks.length} pack(s).`);

    if (isCheckOnly) {
        console.log('\n[Check Mode Active] Skipping downloads. Run without --check or with --approve to download.');
        return;
    }

    // Approval Gating
    let shouldProceed = isAutoApprove;
    if (!shouldProceed) {
        const isInteractive = !process.stdin.isTTY ? false : true;
        if (!isInteractive) {
            console.log('\n⚠️  Non-interactive environment detected. Provide --approve / -y to authorize downloads.');
            return;
        }

        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const answer = await new Promise(resolve => {
            rl.question(`\n❓ Would you like to download the ${missingPacks.length} missing pack(s) now? (y/N): `, resolve);
        });
        rl.close();

        if (answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes') {
            shouldProceed = true;
        } else {
            console.log('\n🚫 Download canceled by user. Exiting safely.');
            return;
        }
    }

    // Download Missing Packs
    console.log('\n🚀 Starting downloads of authorized packs...\n');
    for (let i = 0; i < missingPacks.length; i++) {
        const p = missingPacks[i];
        console.log(`[${i + 1}/${missingPacks.length}] Downloading ${p.releaseId} ${p.type}: ${p.fileName}`);
        console.log(`   🔗 URL: ${p.url}`);
        console.log(`   💾 Destination: ${p.localPath}`);

        try {
            await downloadFile(p.url, p.localPath, p.expectedBytes);
        } catch (err) {
            console.error(`   ❌ Failed to download ${p.fileName}: ${err.message}`);
        }
        console.log('');
    }

    console.log('🎉 Synchronization process completed!');
}

/**
 * Watcher / Daemon Loop for New Drops
 */
async function watchDrops(intervalMinutes = 60) {
    console.log(`🛰️  Watching for new UAP drops every ${intervalMinutes} minutes (Press Ctrl+C to stop)...`);
    let knownReleases = new Set();

    async function checkOnce() {
        try {
            const packs = await discoverOfficialPacks();
            const releases = new Set(packs.map(p => p.releaseId));
            
            if (knownReleases.size === 0) {
                knownReleases = releases;
                console.log(`[${new Date().toLocaleTimeString()}] Baseline established with ${releases.size} release(s): ${Array.from(releases).join(', ')}`);
            } else {
                const newDrops = Array.from(releases).filter(r => !knownReleases.has(r));
                if (newDrops.length > 0) {
                    console.log(`\n🚨🚨 NEW UAP DROP DETECTED! Releases: ${newDrops.join(', ')} 🚨🚨`);
                    await runSync();
                    knownReleases = releases;
                } else {
                    console.log(`[${new Date().toLocaleTimeString()}] No new drops detected. Current latest: ${Array.from(releases).pop()}`);
                }
            }
        } catch (e) {
            console.error(`[${new Date().toLocaleTimeString()}] Check error: ${e.message}`);
        }
    }

    await checkOnce();
    setInterval(checkOnce, intervalMinutes * 60 * 1000);
}

// Execution Entrypoint
(async () => {
    try {
        if (isWatchMode) {
            await watchDrops(60);
        } else {
            await runSync();
        }
    } catch (err) {
        console.error(`\n❌ Fatal Execution Error: ${err.message}`);
        process.exit(1);
    }
})();
