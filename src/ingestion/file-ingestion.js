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
    return text.toLowerCase().match(/[a-z0-9']+/g) ?? [];
}

function extractDates(text) {
    const doc = nlp(text);
    return [...new Set(doc.match("#Date").out("array"))];
}

function extractLocations(text) {
    const doc = nlp(text);

    // 1. Get explicitly known places in the base lexicon (like Phoenix)
    const knownPlaces = doc.match("#Place").out("array");

    // 2. Syntactic Extraction: Get Proper Nouns following location keywords
    // We match the keyword + noun, then strip the keyword away, leaving just the noun (Roswell)
    const contextualPlaces = doc
        .match("(in|at|near|location) #ProperNoun")
        .not("(in|at|near|location)")
        .out("array");

    // 3. Combine and deduplicate the arrays
    return [...new Set([...knownPlaces, ...contextualPlaces])];
}

// Extracted text processing logic so it can be shared across file types
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

    try {
        if (TEXT_EXTENSIONS.has(extension)) {
            // Keep the memory-efficient streaming for standard text logs
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
            const pdfData = await pdfParse(dataBuffer, {
                pagerender: (pageData) => {
                    return pageData.getTextContent().then((textContent) => {
                        return textContent.items.map((s) => s.str).join(" ");
                    });
                },
            });
            await processTextData(pdfData.text, words, dates, locations);
            // Append metadata to file record
            return {
                ...stats,
                metadata: pdfData.info, // Contains Title, Author, Creator, etc.
            };
        } else if (IMAGE_EXTENSIONS.has(extension)) {
            // Run OCR against image files
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
