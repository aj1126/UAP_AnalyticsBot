const nlp = require("compromise");

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

/**
 * Performs linguistic analysis and calculates word frequencies/NLP tags on a single raw file.
 * @param {Object} file - Raw file metadata and text content
 * @returns {Object} Enriched file with analysis metrics
 */
function analyzeFile(file) {
    const text = file.textContent || "";
    const dates = new Set();
    const locations = new Set();
    const wordFrequency = {};
    let totalWords = 0;

    if (text) {
        // Strip out punctuation and count word frequencies
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

        for (const word of rawWords) {
            wordFrequency[word] = (wordFrequency[word] || 0) + 1;
        }
        totalWords = rawWords.length;

        // Perform NLP date and place matching
        const doc = nlp(text);
        for (const value of doc.match("#Date").out("array")) {
            dates.add(value);
        }
        for (const value of doc.match("#Place").out("array")) {
            locations.add(value);
        }

        // Apply regex-based fallbacks for structured logs
        for (const match of text.matchAll(/Date:\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/gi)) {
            dates.add(match[1]);
        }
        for (const match of text.matchAll(/Location:\s*([A-Za-z][A-Za-z\t '-]*)/gi)) {
            locations.add(match[1].trim());
        }
    }

    return {
        path: file.relativePath || file.fileName,
        fileName: file.fileName,
        relativePath: file.relativePath,
        extension: file.extension,
        size: file.size,
        modifiedAt: file.modifiedAt,
        wordCount: totalWords,
        wordFrequency,
        totalWords,
        uniqueWords: Object.keys(wordFrequency),
        dates: [...dates],
        locations: [...locations],
        metadata: file.metadata || {}
    };
}

/**
 * Performs analysis across all ingested files.
 * @param {Array<Object>} files - List of raw ingested files
 * @returns {Array<Object>} List of analyzed files
 */
function analyzeFiles(files) {
    if (!Array.isArray(files)) return [];
    return files.map(analyzeFile);
}

module.exports = {
    analyzeFile,
    analyzeFiles
};
