const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { promises: fsp } = require('node:fs');

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

function extractDates(text) {
    const datePattern = /\b(?:\d{4}-\d{2}-\d{2}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{1,2},\s+\d{4})\b/gi;
    return [...new Set(text.match(datePattern) ?? [])];
}

function extractLocations(text) {
    const metadataPattern = /\b(?:location|city|site)\s*:\s*([A-Z][a-zA-Z]+(?:[\s-][A-Z][a-zA-Z]+)*)/g;
    const sentencePattern = /\b(?:in|at|near)\s+([A-Z][a-zA-Z]+(?:[\s-][A-Z][a-zA-Z]+)*)/g;
    const locations = new Set();

    for (const pattern of [metadataPattern, sentencePattern]) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            locations.add(match[1]);
        }
    }

    return [...locations];
}

async function readTextFile(filePath, rootDirectory) {
    const stats = await fsp.stat(filePath);
    const extension = path.extname(filePath).toLowerCase();

    if (!TEXT_EXTENSIONS.has(extension)) {
        return null;
    }

    const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const lineReader = readline.createInterface({ input: stream, crlfDelay: Infinity });
    const lines = [];

    const readLinesPromise = (async () => {
        for await (const line of lineReader) {
            lines.push(line);
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

    const text = lines.join('\n');

    return {
        path: filePath,
        relativePath: path.relative(rootDirectory, filePath),
        extension,
        size: stats.size,
        createdAt: stats.birthtime.toISOString(),
        modifiedAt: stats.mtime.toISOString(),
        text,
        words: normalizeWords(text),
        dates: extractDates(text),
        locations: extractLocations(text)
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
