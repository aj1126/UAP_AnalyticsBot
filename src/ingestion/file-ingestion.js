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
} else if (extension === '.pdf') {
            const dataBuffer = await fsp.readFile(filePath);

            // Access the function explicitly as pdfParse.pdf based on version 2.4.5
            const parseFn = pdfParse.pdf;

            if (typeof parseFn !== 'function') {
                throw new Error("Could not find callable 'pdf' function in pdf-parse v2.4.5.");
            }

            const pdfData = await parseFn(dataBuffer, {
                pagerender: (pageData) => {
                    return pageData.getTextContent().then((textContent) => {
                        return textContent.items.map((s) => s.str).join(' ');
                    });
                },
            });

            await processTextData(pdfData.text, words, dates, locations);

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
                metadata: pdfData.info,
            };
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
