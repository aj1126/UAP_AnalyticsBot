const path = require('node:path');
const { parentPort } = require('node:worker_threads');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const readline = require('node:readline');

const SUPPORTED_TEXT_EXTENSIONS = new Set(['.txt', '.md', '.json', '.csv', '.log']);

// ✨ Advanced Stop-Word Culling Dictionary
const STOP_WORDS = new Set([
    'a', 'about', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
    'how', 'i', 'in', 'is', 'it', 'of', 'on', 'or', 'that', 'the', 'this',
    'to', 'was', 'what', 'when', 'where', 'who', 'will', 'with'
]);

parentPort.on('message', async (task) => {
    try {
        const extension = path.extname(task.filePath).toLowerCase();
        if (!SUPPORTED_TEXT_EXTENSIONS.has(extension)) {
            parentPort.postMessage({
                success: true,
                filePath: task.filePath,
                fingerprint: task.fingerprint
            });
            return;
        }

        const stats = await fsp.stat(task.filePath);
        
        const dates = [];
        const locations = [];
        const wordFrequency = {};
        let totalWords = 0;
        const fileStream = fs.createReadStream(task.filePath, { encoding: 'utf-8' });
        const lines = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

        for await (const line of lines) {
            // Filter out punctuation, make lowercase, and cull stop words
            const rawWords = line
                .replace(/[^\w\s]/g, '')
                .toLowerCase()
                .split(/\s+/)
                .filter(word => word.length > 1 && !STOP_WORDS.has(word));

            // 🚀 OPTIMIZATION: Calculate map inside worker to drastically reduce IPC channel memory usage
            for (const word of rawWords) {
                wordFrequency[word] = (wordFrequency[word] || 0) + 1;
            }
            totalWords += rawWords.length;

            for (const match of line.matchAll(/Date:\s*(\d{4}-\d{2}-\d{2})/gi)) {
                dates.push(match[1]);
            }

            for (const match of line.matchAll(/Location:\s*([A-Za-z]+)/gi)) {
                const loc = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
                locations.push(loc);
            }
        }

        parentPort.postMessage({
            success: true,
            filePath: task.filePath,
            fingerprint: task.fingerprint,
            result: {
                fileName: task.filePath.split(/[/\\]/).pop(),
                relativePath: task.rootDirectory ? path.relative(task.rootDirectory, task.filePath) : task.filePath,
                extension,
                size: stats.size,
                modifiedAt: stats.mtime.toISOString(),
                wordFrequency, 
                totalWords,
                uniqueWords: Object.keys(wordFrequency),
                dates,
                locations
            }
        });
    } catch (error) {
        parentPort.postMessage({ success: false, filePath: task.filePath, error: error.message });
    }
});