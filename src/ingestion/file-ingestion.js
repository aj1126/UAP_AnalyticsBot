const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { promises: fsp } = require('node:fs');
const nlp = require('compromise'); // <-- Injected NLP Library

const TEXT_EXTENSIONS = new Set(['.txt', '.md', '.json', '.csv', '.log']);

async function* walkFiles(rootDirectory) {
    const directoryEntries = await fsp.readdir(rootDirectory, { withFileTypes: true });

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
    return text
        .toLowerCase()
        .match(/[a-z0-9']+/g) ?? [];
}

// Replaced Regex with NLP #Date tagging
function extractDates(text) {
    const doc = nlp(text);
    return [...new Set(doc.dates().out('array'))];
}

// Replaced Regex with NLP #Place tagging
function extractLocations(text) {
    const doc = nlp(text);
    return [...new Set(doc.places().out('array'))];
}

async function readTextFile(filePath, rootDirectory) {
    const extension = path.extname(filePath).toLowerCase();

    if (!TEXT_EXTENSIONS.has(extension)) {
        return null;
    }

    const stats = await fsp.stat(filePath);
    const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const lineReader = readline.createInterface({ input: stream, crlfDelay: Infinity });
    const words = [];
    const dates = new Set();
    const locations = new Set();

    const readLinesPromise = (async () => {
        for await (const line of lineReader) {
            words.push(...normalizeWords(line));
            for (const date of extractDates(line)) {
                dates.add(date);
            }
            for (const location of extractLocations(line)) {
                locations.add(location);
            }
        }
    })();

    const streamErrorPromise = new Promise((_, reject) => {
        stream.once('error', (error) => {
            reject(new Error(`Failed to read file "${filePath}": ${error.message}`));
        });
    });

    try {
        await Promise.race([readLinesPromise, streamErrorPromise]);
        await readLinesPromise;
    } catch (error) {
        if (error instanceof Error && error.message.startsWith(`Failed to read file "${filePath}":`)) {
            throw error;
        }

        throw new Error(`Failed to read file "${filePath}": ${error instanceof Error ? error.message : String(error)}`);
    } finally {
        lineReader.close();
        if (!stream.destroyed) {
            stream.destroy();
        }
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
        locations: [...locations]
    };
}

async function ingestDirectory(rootDirectory) {
    const sourceDirectory = path.resolve(rootDirectory);
    const files = [];

    for await (const filePath of walkFiles(sourceDirectory)) {
        const fileRecord = await readTextFile(filePath, sourceDirectory);
        if (fileRecord) {
            files.push(fileRecord);
        }
    }

    return {
        sourceDirectory,
        files
    };
}

module.exports = {
    ingestDirectory
};