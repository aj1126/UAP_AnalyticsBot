/**
 * Domain-Driven Design (DDD) - Analytics Bounded Context
 * Component: Multilingual Stop-Word & Character Dictionary
 * 
 * Provides comprehensive stop-word culling for English, German, French,
 * Spanish, and Russian, alongside Unicode vowel detection to prevent
 * false-positive corruption flags in non-English documents.
 */

// Universal stop words mapped by ISO 639-1 language code
const STOP_WORDS_BY_LANG = {
    en: new Set([
        "a", "about", "an", "and", "are", "as", "at", "be", "by", "for",
        "from", "how", "i", "in", "is", "it", "of", "on", "or", "that",
        "the", "this", "to", "was", "what", "when", "where", "who", "will", "with"
    ]),
    de: new Set([
        "der", "die", "das", "und", "in", "von", "mit", "für", "den", "ein",
        "eine", "auf", "ist", "im", "dem", "nicht", "des", "sich", "auch",
        "als", "nach", "wie", "bei", "aus", "durch", "oder", "über", "zur",
        "eines", "einem", "einer", "hat", "haben", "waren", "wurde", "werden"
    ]),
    fr: new Set([
        "le", "la", "les", "de", "des", "un", "une", "et", "est", "en",
        "du", "dans", "qui", "pour", "sur", "au", "aux", "avec", "ce",
        "ces", "ont", "ses", "par", "pas", "sont", "cette", "plus",
        "dans", "leur", "comme", "mais", "nous", "vous", "ils", "elles"
    ]),
    es: new Set([
        "el", "la", "los", "las", "de", "del", "un", "una", "en", "y",
        "es", "por", "con", "para", "su", "sus", "al", "como", "más",
        "pero", "este", "esta", "son", "fue", "se", "lo", "había", "entre"
    ]),
    ru: new Set([
        "и", "в", "не", "на", "я", "с", "что", "а", "по", "это",
        "он", "как", "к", "но", "они", "из", "у", "от", "о", "же",
        "был", "были", "до", "так", "для", "было", "мы", "его", "все"
    ])
};

// Global composite stop-word set for cross-lingual culling
const ALL_STOP_WORDS = new Set();
for (const set of Object.values(STOP_WORDS_BY_LANG)) {
    for (const w of set) {
        ALL_STOP_WORDS.add(w);
    }
}

// Unicode vowels regex: ASCII vowels + Latin with diacritics/ligatures + Cyrillic vowels + Greek
const UNICODE_VOWELS_REGEX = /[aeiouyAEIOUYàáâãäåæèéêëìíîïòóôõöøœùúûüýÿÀÁÂÃÄÅÆÈÉÊËÌÍÎÏÒÓÔÕÖØŒÙÚÛÜÝаеёиоуыэюяАЕЁИОУЫЭЮЯ]/gu;

/**
 * Checks if a word is a stop word in the given language (or any supported language).
 * @param {string} word - Word to test
 * @param {string} [lang='en'] - Language code ('en', 'de', 'fr', 'es', 'ru')
 * @returns {boolean}
 */
function isStopWord(word, lang = 'en') {
    if (!word || typeof word !== 'string') return false;
    const lower = word.toLowerCase();
    const langSet = STOP_WORDS_BY_LANG[lang];
    if (langSet && langSet.has(lower)) return true;
    return STOP_WORDS_BY_LANG.en.has(lower);
}

/**
 * Counts all vowels across Latin, accented, and Cyrillic character spaces.
 * @param {string} text - Input text
 * @returns {number} Count of Unicode vowels
 */
function countUnicodeVowels(text) {
    if (!text || typeof text !== 'string') return 0;
    const matches = text.match(UNICODE_VOWELS_REGEX);
    return matches ? matches.length : 0;
}

module.exports = {
    STOP_WORDS_BY_LANG,
    ALL_STOP_WORDS,
    UNICODE_VOWELS_REGEX,
    isStopWord,
    countUnicodeVowels
};
