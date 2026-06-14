const path = require("node:path");
const { parentPort } = require("node:worker_threads");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const readline = require("node:readline");
const nlp = require("compromise");

const TEXT_EXTENSIONS = new Set([".txt", ".md", ".json", ".csv", ".log"]);
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg"]);
const SUPPORTED_EXTENSIONS = new Set([
    ...TEXT_EXTENSIONS,
    ...IMAGE_EXTENSIONS,
    ".pdf",
]);

// ✨ Advanced Stop-Word Culling Dictionary
const STOP_WORDS = new Set([
    "a",
    "about",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "how",
    "i",
    "in",
    "is",
    "it",
    "of",
    "on",
    "or",
    "that",
    "the",
    "this",
    "to",
    "was",
    "what",
    "when",
    "where",
    "who",
    "will",
    "with",
]);

parentPort.on("message", async (task) => {
    try {
        const extension = path.extname(task.filePath).toLowerCase();
        if (!SUPPORTED_EXTENSIONS.has(extension)) {
            parentPort.postMessage({
                success: true,
                filePath: task.filePath,
                fingerprint: task.fingerprint,
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
                .replace(/[^\w\s]/g, "")
                .toLowerCase()
                .split(/\s+/)
                .filter(
                    (word) =>
                        word.length > 1 &&
                        !STOP_WORDS.has(word) &&
                        !/^\d+$/.test(word),
                );

            // 🚀 OPTIMIZATION: Calculate map inside worker to drastically reduce IPC channel memory usage
            for (const word of rawWords) {
                wordFrequency[word] = (wordFrequency[word] || 0) + 1;
            }
            totalWords += rawWords.length;

            const doc = nlp(text);
            for (const value of doc.match("#Date").out("array")) {
                dates.add(value);
            }
            for (const value of doc.match("#Place").out("array")) {
                locations.add(value);
            }

            for (const match of text.matchAll(
                /Date:\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/gi,
            )) {
                dates.add(match[1]);
            }
            for (const match of text.matchAll(
                /Location:\s*([A-Za-z][A-Za-z\s'-]*)/gi,
            )) {
                locations.add(match[1].trim());
            }
        };

        const processTextFile = async () => {
            const fileStream = fs.createReadStream(task.filePath, {
                encoding: "utf-8",
            });
            const lines = readline.createInterface({
                input: fileStream,
                crlfDelay: Infinity,
            });

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
        const pdfParseModule = require('pdf-parse');
        const path = require('path');
        const fsp = require('fs/promises');

        // 1. Resolve standard fonts path to silence the asset pipeline warning
        const standardFontsPath = path.join(path.dirname(require.resolve('pdf-parse')), '../pdfjs-dist/standard_fonts/');

        const dataBuffer = await fsp.readFile(task.filePath);
        const wasmData = new Uint8Array(dataBuffer.buffer, dataBuffer.byteOffset, dataBuffer.byteLength);
        
        const options = { 
            disableFontFace: false,
            standardFontDataUrl: standardFontsPath
        };

        const parserInstance = new pdfParseModule.PDFParse(wasmData, options);
        const textResult = await parserInstance.getText(); 
        
        // 2. Advanced Mojibake Boolean Node
        // Check vowel density to determine if the vector string is natural language or scrambled alphanumerics.
        const validText = textResult ? textResult.replace(/[^\w\s]/g, '').trim() : '';
        const vowelMatch = validText.match(/[aeiouyAEIOUY]/g);
        const vowelDensity = vowelMatch ? (vowelMatch.length / validText.length) : 0;

        // If the string is too short or lacks the linguistic density of English, route to OCR.
        if (validText.length < 20 || vowelDensity < 0.15 || vowelDensity > 0.5) {
            process.stdout.write(`\n🔍 Corrupted vector geometry detected in ${path.basename(task.filePath)}. Rasterizing via MuPDF & OCR...`);
            
            const mupdf = require('mupdf');
            const tesseract = require('tesseract.js');
            
            // Load document into MuPDF's memory pointer
            const doc = mupdf.Document.openDocument(dataBuffer, "application/pdf");
            const page = doc.loadPage(0); // Isolate the first sheet for processing
            
            // Render out a 2D sprite sheet (scaled 2x for clean OCR rasterization)
            const pixmap = page.toPixmap(mupdf.Matrix.scale(2, 2), mupdf.ColorSpace.DeviceRGB, false);
            const imageBuffer = pixmap.asPNG();
            
            // Free WebAssembly memory pointers to prevent memory leaks in the worker pool
            page.destroy();
            doc.destroy();
            
            const ocrResult = await tesseract.recognize(imageBuffer, 'eng', { logger: () => {} });
            processTextChunk(ocrResult?.data?.text || '');
        } else {
            processTextChunk(textResult);
        }
    } catch (error) {
        process.stderr.write(`\n⚠️ PDF extraction skipped (${task.filePath}): ${error.message}\n`);
    }
};
        const processImageFile = async () => {
            try {
                const tesseract = require("tesseract.js");
                const result = await tesseract.recognize(task.filePath, "eng", {
                    logger: () => {},
                });
                processTextChunk(result?.data?.text || "");
            } catch (error) {
                process.stderr.write(
                    `\n⚠️ Image OCR skipped (${task.filePath}): ${error.message}\n`,
                );
            }
        };

        if (TEXT_EXTENSIONS.has(extension)) {
            await processTextFile();
        } else if (extension === ".pdf") {
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
                relativePath: task.rootDirectory
                    ? path.relative(task.rootDirectory, task.filePath)
                    : task.filePath,
                extension,
                size: stats.size,
                modifiedAt: stats.mtime.toISOString(),
                wordFrequency,
                totalWords,
                uniqueWords: Object.keys(wordFrequency),
                dates: [...dates],
                locations: [...locations],
            },
        });
    } catch (error) {
        parentPort.postMessage({
            success: false,
            filePath: task.filePath,
            error: error.message,
        });
    }
});
