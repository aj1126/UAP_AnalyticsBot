const path = require('node:path');
const { parentPort } = require('node:worker_threads');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const readline = require('node:readline');
const nlp = require('compromise');

const TEXT_EXTENSIONS = new Set(['.txt', '.md', '.json', '.csv', '.log']);
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg']);
const SUPPORTED_EXTENSIONS = new Set([...TEXT_EXTENSIONS, ...IMAGE_EXTENSIONS, '.pdf']);

// ✨ Advanced Stop-Word Culling Dictionary
const STOP_WORDS = new Set([
    'a', 'about', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
    'how', 'i', 'in', 'is', 'it', 'of', 'on', 'or', 'that', 'the', 'this',
    'to', 'was', 'what', 'when', 'where', 'who', 'will', 'with'
]);

parentPort.on('message', async (task) => {
    try {
        const extension = path.extname(task.filePath).toLowerCase();
        if (!SUPPORTED_EXTENSIONS.has(extension)) {
            parentPort.postMessage({
                success: true,
                filePath: task.filePath,
                fingerprint: task.fingerprint
            });
            return;
        }

        const stats = await fsp.stat(task.filePath);
        
        const dates = new Set();
        const locations = new Set();
        const wordFrequency = {};
        let totalWords = 0;

        const processTextChunk = (text) => {
            if (!text) return;

            const rawWords = text
                .replace(/[^\w\s]/g, '')
                .toLowerCase()
                .split(/\s+/)
                .filter(word => word.length > 1 && !STOP_WORDS.has(word));

            // 🚀 OPTIMIZATION: Calculate map inside worker to drastically reduce IPC channel memory usage
            for (const word of rawWords) {
                wordFrequency[word] = (wordFrequency[word] || 0) + 1;
            }
            totalWords += rawWords.length;

            const doc = nlp(text);
            for (const value of doc.match('#Date').out('array')) {
                dates.add(value);
            }
            for (const value of doc.match('#Place').out('array')) {
                locations.add(value);
            }

            for (const match of text.matchAll(/Date:\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/gi)) {
                dates.add(match[1]);
            }
            for (const match of text.matchAll(/Location:\s*([A-Za-z][A-Za-z\s'-]*)/gi)) {
                locations.add(match[1].trim());
            }
        };

        const processTextFile = async () => {
            const fileStream = fs.createReadStream(task.filePath, { encoding: 'utf-8' });
            const lines = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

            try {
                for await (const line of lines) {
                    processTextChunk(line);
                }
            } finally {
                lines.close();
                fileStream.destroy();
            }
        };

        const processPdfFile = async () => {
            try {
                const pdfParse = require('pdf-parse');
                const parseFn = typeof pdfParse === 'function' ? pdfParse : pdfParse.default;
                const dataBuffer = await fsp.readFile(task.filePath);
                const pdfResult = await parseFn(dataBuffer);
                processTextChunk(pdfResult?.text || '');
            } catch (error) {
                process.stderr.write(`\n⚠️ PDF extraction skipped (${task.filePath}): ${error.message}\n`);
            }
        };

        const processImageFile = async () => {
            try {
                const tesseract = require('tesseract.js');
                const result = await tesseract.recognize(task.filePath, 'eng', { logger: () => {} });
                processTextChunk(result?.data?.text || '');
            } catch (error) {
                process.stderr.write(`\n⚠️ Image OCR skipped (${task.filePath}): ${error.message}\n`);
            }
        };

        if (TEXT_EXTENSIONS.has(extension)) {
            await processTextFile();
        } else if (extension === '.pdf') {
            await processPdfFile();
        } else if (IMAGE_EXTENSIONS.has(extension)) {
            await processImageFile();
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
                dates: [...dates],
                locations: [...locations]
            }
        });
    } catch (error) {
        parentPort.postMessage({ success: false, filePath: task.filePath, error: error.message });
    }
});