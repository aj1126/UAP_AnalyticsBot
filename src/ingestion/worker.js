const { parentPort } = require("node:worker_threads");
const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");
const { promises: fsp } = require("node:fs");
const nlp = require("compromise");

const TEXT_EXTENSIONS = new Set([".txt", ".md", ".json", ".csv", ".log"]);
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg"]);
const SUPPORTED_EXTENSIONS = new Set([...TEXT_EXTENSIONS, ...IMAGE_EXTENSIONS, ".pdf"]);

const STOP_WORDS = new Set([
    "the", "of", "to", "and", "in", "a", "for", "on", "that", "is", "it", 
    "with", "as", "was", "at", "by", "be", "this", "an", "are", "from", 
    "or", "which", "will", "not", "have", "has", "but", "they", "their", 
    "we", "you", "i", "he", "she", "my", "his", "her", "its", "our", "your",
    "there", "can", "if", "would", "about", "who", "what", "where", "when", "how"
]);

function normalizeWords(text) {
    const rawWords = text.toLowerCase().match(/[a-z0-9']+/g) ?? [];
    return rawWords.filter(word => !STOP_WORDS.has(word) && isNaN(word) && word.length > 1);
}

function extractDates(text) {
    const doc = nlp(text);
    return [...new Set(doc.match("#Date").out("array"))];
}

function extractLocations(text) {
    const doc = nlp(text);
    const knownPlaces = doc.match("#Place").out("array");
    const contextualPlaces = doc.match("(in|at|near|location) #ProperNoun").not("(in|at|near|location)").out("array");
    return [...new Set([...knownPlaces, ...contextualPlaces])];
}

async function processTextData(text, words, dates, locations) {
    if (!text) return;
    words.push(...normalizeWords(text));
    extractDates(text).forEach(date => dates.add(date));
    extractLocations(text).forEach(loc => locations.add(loc));
}

async function readFileData(filePath, rootDirectory) {
    const extension = path.extname(filePath).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(extension)) return null;

    const stats = await fsp.stat(filePath);
    const words = [];
    const dates = new Set();
    const locations = new Set();
    let metadata = {}; 

    if (TEXT_EXTENSIONS.has(extension)) {
        const stream = fs.createReadStream(filePath, { encoding: "utf8" });
        const lineReader = readline.createInterface({ input: stream, crlfDelay: Infinity });
        for await (const line of lineReader) await processTextData(line, words, dates, locations);
        stream.destroy();
    } else if (extension === ".pdf") {
        const dataBuffer = await fsp.readFile(filePath);
        let extractedText = "";

        try {
            // LAZY LOAD: Prevents memory exhaustion for non-PDFs
            const pdfParse = require("pdf-parse"); 
            const parseFn = typeof pdfParse === "function" ? pdfParse : pdfParse.default;
            const pdfData = await parseFn(dataBuffer);
            extractedText = pdfData.text || "";
            metadata = pdfData.info || {};
        } catch (err) { /* OCR Fallback */ }

        if (extractedText.trim().length < 50) {
            try {
                // LAZY LOAD: Heavy WASM engines only spin up if strictly necessary
                const mupdf = await import("mupdf");
                const tesseract = require("tesseract.js");
                
                const doc = mupdf.Document.openDocument(dataBuffer, "application/pdf");
                let ocrText = ""; 
                for (let i = 0; i < doc.countPages(); i++) {
                    const page = doc.loadPage(i);
                    const pixmap = page.toPixmap(mupdf.Matrix.scale(2, 2), mupdf.ColorSpace.DeviceRGB, false);
                    const { data: { text } } = await tesseract.recognize(Buffer.from(pixmap.asPNG()), "eng", { logger: () => {} });
                    ocrText += text + " ";
                }
                if (ocrText.trim().length > 0) extractedText = ocrText;
            } catch (ocrError) {
                // Silently fall back to parsed text if WebAssembly aborts on corrupted scans
            }
        }
        await processTextData(extractedText, words, dates, locations);
    } else if (IMAGE_EXTENSIONS.has(extension)) {
        // LAZY LOAD
        const tesseract = require("tesseract.js");
        const { data: { text } } = await tesseract.recognize(filePath, "eng", { logger: () => {} });
        await processTextData(text, words, dates, locations);
    }

    return {
        path: filePath,
        relativePath: path.relative(rootDirectory, filePath),
        extension,
        size: stats.size,
        createdAt: stats.birthtime.toISOString(),
        modifiedAt: stats.mtime.toISOString(),
        words,
        dates: [...dates],
        locations: [...locations],
        metadata, 
    };
}

// Listen for tasks from the main thread
parentPort.on("message", async ({ filePath, rootDirectory }) => {
    try {
        const result = await readFileData(filePath, rootDirectory);
        parentPort.postMessage({ success: true, result });
    } catch (error) {
        parentPort.postMessage({ success: false, error: error.message, filePath });
    }
});