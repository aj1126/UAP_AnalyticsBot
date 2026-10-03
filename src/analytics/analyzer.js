const nlp = require("compromise");
const { isStopWord, ALL_STOP_WORDS } = require("./multilingual-dictionary");
const { detectLanguage } = require("../ingestion/language-detector");

// Legacy English stop-words maintained for backward compatibility
const STOP_WORDS = ALL_STOP_WORDS;

/**
 * Performs linguistic analysis and calculates word frequencies/NLP tags on a single raw file.
 * Supports multilingual Unicode tokens and dual-text (original + translated sidecar) extraction.
 * @param {Object} file - Raw file metadata and text content
 * @returns {Object} Enriched file with analysis metrics
 */
function analyzeFile(file) {
    const text = file.textContent || "";
    const dates = new Set();
    const locations = new Set();
    const wordFrequency = {};
    let totalWords = 0;

    const detectedLang = file.language || (text ? detectLanguage(text).language : "en");
    const isEnglish = file.isEnglish !== undefined ? file.isEnglish : (detectedLang === "en");

    if (text) {
        // Strip out non-letter/non-number punctuation with Unicode property escapes and count word frequencies
        const normalizedText = text.normalize("NFKC");
        const rawWords = normalizedText
            .replace(/[^\p{L}\p{N}\s]/gu, " ")
            .toLowerCase()
            .split(/\s+/)
            .filter(
                (word) =>
                    word.length > 1 &&
                    !isStopWord(word, detectedLang) &&
                    !/^\d+$/.test(word),
            );

        for (const word of rawWords) {
            wordFrequency[word] = (wordFrequency[word] || 0) + 1;
        }
        totalWords = rawWords.length;

        // Perform NLP date and place matching across original text and translated text (if available)
        const textsToScan = [text];
        if (file.translatedText && file.translatedText !== text) {
            textsToScan.push(file.translatedText);
        }

        for (const scanText of textsToScan) {
            const doc = nlp(scanText);
            for (const value of doc.match("#Date").out("array")) {
                dates.add(value);
            }
            for (const value of doc.match("#Place").out("array")) {
                locations.add(value);
            }

            // Apply regex-based fallbacks for structured logs (supporting multi-language labels)
            for (const match of scanText.matchAll(/(?:Date|Datum|Fecha|Date|Дата):\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/gi)) {
                dates.add(match[1]);
            }
            for (const match of scanText.matchAll(/(?:Location|Ort|Lugar|Lieu|Место):\s*([\p{L}][\p{L}\t '-]*)/giu)) {
                locations.add(match[1].trim());
            }
        }
    }

    return {
        path: file.relativePath || file.fileName,
        fileName: file.fileName,
        relativePath: file.relativePath,
        extension: file.extension,
        size: file.size,
        modifiedAt: file.modifiedAt,
        language: detectedLang,
        isEnglish,
        translatedText: file.translatedText || null,
        wordCount: totalWords,
        wordFrequency,
        totalWords,
        uniqueWords: Object.keys(wordFrequency),
        dates: [...dates],
        locations: [...locations],
        metadata: {
            ...(file.metadata || {}),
            language: detectedLang,
            isEnglish,
            isTranslated: !!file.translatedText
        }
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
