const path = require('node:path');
const { parentPort } = require('node:worker_threads');
const fs = require('node:fs/promises');

// ✨ Advanced Stop-Word Culling Dictionary
const STOP_WORDS = new Set([
    'a', 'about', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
    'how', 'i', 'in', 'is', 'it', 'of', 'on', 'or', 'that', 'the', 'this',
    'to', 'was', 'what', 'when', 'where', 'who', 'will', 'with'
]);

parentPort.on('message', async (task) => {
    try {
        const content = await fs.readFile(task.filePath, 'utf-8');
        const stats = await fs.stat(task.filePath);
        
        const dates = [];
        const locations = [];

        // Filter out punctuation, make lowercase, and cull stop words
        const words = content
            .replace(/[^\w\s]/g, '')
            .toLowerCase()
            .split(/\s+/)
            .filter(word => word.length > 1 && !STOP_WORDS.has(word));

        // Extract all dates and locations (not just the first occurrence)
        for (const match of content.matchAll(/Date:\s*(\d{4}-\d{2}-\d{2})/gi)) {
            dates.push(match[1]);
        }

        for (const match of content.matchAll(/Location:\s*([A-Za-z]+)/gi)) {
            // SPRINT 2 Task 1: Named Entity Token Unification
            const loc = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
            locations.push(loc);
        }

        parentPort.postMessage({
            success: true,
            filePath: task.filePath,
            fingerprint: task.fingerprint,
            result: {
                fileName: task.filePath.split(/[/\\]/).pop(),
                relativePath: task.rootDirectory ? path.relative(task.rootDirectory, task.filePath) : task.filePath,
                extension: path.extname(task.filePath).toLowerCase(),
                size: stats.size,
                modifiedAt: stats.mtime.toISOString(),
                content,
                words,
                dates,
                locations
            }
        });
    } catch (error) {
        parentPort.postMessage({ success: false, filePath: task.filePath, error: error.message });
    }
});