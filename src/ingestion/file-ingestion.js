const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");
const { promises: fsp } = require("node:fs");
const nlp = require("compromise");
const pdfParse = require("pdf-parse");
const tesseract = require("tesseract.js");

const TEXT_EXTENSIONS = new Set([".txt", ".md", ".json", ".csv", ".log"]);
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg"]);
const SUPPORTED_EXTENSIONS = new Set([
    ...TEXT_EXTENSIONS,
    ...IMAGE_EXTENSIONS,
    ".pdf",
]);

const STOP_WORDS = new Set([
    "the", "of", "to", "and", "in", "a", "for", "on", "that", "is", "it", 
    "with", "as", "was", "at", "by", "be", "this", "an", "are", "from", 
    "or", "which", "will", "not", "have", "has", "but", "they", "their", 
    "we", "you", "i", "he", "she", "my", "his", "her", "its", "our", "your",
    "there", "can", "if", "would", "about", "who", "what", "where", "when", "how"
]);

async function* walkFiles(rootDirectory) {
    const directoryEntries = await fsp.readdir(rootDirectory, {
        withFileTypes: true,
    });

    for (const entry of directoryEntries) {
        const absolutePath = path.join(rootDirectory, entry.name);

        if (entry.isDirectory()) {
            yield* walkFiles(absolutePath);
            continue;
        }

        if (entry.isFile()) {
            yield absolutePath;
        }
    }
}

function normalizeWords(text) {
    const rawWords = text.toLowerCase().match(/[a-z0-9']+/g) ?? [];
    
    return rawWords.filter(word => {
        // 1. Drop standard grammatical "glue"
        if (STOP_WORDS.has(word)) return false;
        
        // 2. Drop pure numbers and OCR noise (e.g., '00', '1', '10')
        // isNaN returns false for valid numbers, so !isNaN catches them
        if (!isNaN(word)) return false;
        
        // 3. Drop stray single-character artifacts 
        if (word.length <= 1) return false;

        return true;
    });
}

function extractDates(text) {
    const doc = nlp(text);
    return [...new Set(doc.match("#Date").out("array"))];
}

function extractLocations(text) {
    const doc = nlp(text);

    const knownPlaces = doc.match("#Place").out("array");
    const contextualPlaces = doc
        .match("(in|at|near|location) #ProperNoun")
        .not("(in|at|near|location)")
        .out("array");

    return [...new Set([...knownPlaces, ...contextualPlaces])];
}

async function processTextData(text, words, dates, locations) {
    if (!text) return;
    words.push(...normalizeWords(text));
    for (const date of extractDates(text)) {
        dates.add(date);
    }
    for (const location of extractLocations(text)) {
        locations.add(location);
    }
}

async function readFileData(filePath, rootDirectory) {
    const extension = path.extname(filePath).toLowerCase();

    if (!SUPPORTED_EXTENSIONS.has(extension)) {
        return null;
    }

    const stats = await fsp.stat(filePath);
    const words = [];
    const dates = new Set();
    const locations = new Set();
    let metadata = {}; 

    try {
        if (TEXT_EXTENSIONS.has(extension)) {
            const stream = fs.createReadStream(filePath, { encoding: "utf8" });
            const lineReader = readline.createInterface({
                input: stream,
                crlfDelay: Infinity,
            });

            for await (const line of lineReader) {
                await processTextData(line, words, dates, locations);
            }
            stream.destroy();
            
        } else if (extension === ".pdf") {
            const dataBuffer = await fsp.readFile(filePath);
            let extractedText = "";

            try {
                // 1. Fast Path: Attempt standard digital text extraction
                const parseFn = typeof pdfParse === "function" ? pdfParse : pdfParse.default;
                const pdfData = await parseFn(dataBuffer, {
                    pagerender: (pageData) => {
                        return pageData.getTextContent().then((textContent) => {
                            return textContent.items.map((s) => s.str).join(" ");
                        });
                    },
                });
                extractedText = pdfData.text || "";
                metadata = pdfData.info || {};
            } catch (err) {
                // Ignore standard parse failure, will trigger OCR fallback
            }

            // 2. Automated OCR Fallback using WebAssembly (mupdf)
            if (extractedText.trim().length < 50) {
                process.stdout.write(`\n🔍 Scanned PDF detected: ${path.basename(filePath)}. Rasterizing via WebAssembly...\n`);
                
                try {
                    // Dynamically import mupdf to bypass CommonJS/ESM module boundaries
                    const mupdf = await import("mupdf");
                    
                    // Open document natively in memory
                    const doc = mupdf.Document.openDocument(dataBuffer, "application/pdf");
                    const pageCount = doc.countPages();
                    extractedText = ""; // Clear any garbage data
                    
                    for (let i = 0; i < pageCount; i++) {
                        const page = doc.loadPage(i);
                        // Scale 2x for higher resolution (better OCR accuracy)
                        const pixmap = page.toPixmap(mupdf.Matrix.scale(2, 2), mupdf.ColorSpace.DeviceRGB, false);
                        const pngBuffer = Buffer.from(pixmap.asPNG());
                        
                        const { data: { text } } = await tesseract.recognize(pngBuffer, "eng", {
                            logger: () => {},  // Suppress console spam
                        });
                        extractedText += text + " ";
                    }
                } catch (ocrError) {
                    process.stdout.write(`\n⚠️ OCR Failed for ${path.basename(filePath)}: ${ocrError.message}\n`);
                }
            }

            await processTextData(extractedText, words, dates, locations);
            
        } else if (IMAGE_EXTENSIONS.has(extension)) {
            const {
                data: { text },
            } = await tesseract.recognize(filePath, "eng", {
                logger: () => {},
            });
            await processTextData(text, words, dates, locations);
        }
    } catch (error) {
        throw new Error(`Failed to read file "${filePath}": ${error.message}`);
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

async function ingestDirectory(rootDirectory) {
    const sourceDirectory = path.resolve(rootDirectory);
    const files = [];

    for await (const filePath of walkFiles(sourceDirectory)) {
        const fileRecord = await readFileData(filePath, sourceDirectory);
        if (fileRecord) {
            files.push(fileRecord);
        }
    }

    return {
        sourceDirectory,
        files,
    };
}

module.exports = {
    ingestDirectory,
};