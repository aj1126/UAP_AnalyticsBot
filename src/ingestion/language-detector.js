/**
 * Domain-Driven Design (DDD) - Ingestion Bounded Context
 * Component: Language Detector
 * 
 * Provides 100% offline, zero-dependency language identification using
 * Unicode script ranges, characteristic letter frequencies, and high-frequency indicator tokens.
 */

// Core stop-word / function-word signatures per language
const INDICATORS = {
    de: new Set([
        'der', 'die', 'das', 'und', 'in', 'von', 'mit', 'für', 'den', 'ein',
        'eine', 'auf', 'ist', 'im', 'dem', 'nicht', 'des', 'sich', 'auch',
        'als', 'nach', 'wie', 'bei', 'aus', 'durch', 'oder', 'über', 'zur'
    ]),
    fr: new Set([
        'le', 'la', 'les', 'de', 'des', 'un', 'une', 'et', 'est', 'en',
        'du', 'dans', 'qui', 'pour', 'sur', 'au', 'aux', 'avec', 'ce',
        'ces', 'ont', 'ses', 'par', 'pas', 'sont', 'cette', 'plus'
    ]),
    es: new Set([
        'el', 'la', 'los', 'las', 'de', 'del', 'un', 'una', 'en', 'y',
        'es', 'por', 'con', 'para', 'su', 'sus', 'al', 'como', 'más',
        'pero', 'sus', 'este', 'esta', 'son', 'fue', 'se'
    ]),
    ru: new Set([
        'и', 'в', 'не', 'на', 'я', 'с', 'что', 'а', 'по', 'это',
        'он', 'как', 'к', 'но', 'они', 'из', 'у', 'от', 'о', 'же',
        'был', 'были', 'до', 'так', 'для', 'же', 'было', 'мы'
    ]),
    en: new Set([
        'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
        'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
        'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she'
    ])
};

/**
 * Detect script family
 */
function detectScript(text) {
    let cyrillicCount = 0;
    let latinCount = 0;
    let totalLetters = 0;

    for (const char of text) {
        const cp = char.codePointAt(0);
        // Cyrillic range: 0x0400 - 0x04FF
        if (cp >= 0x0400 && cp <= 0x04FF) {
            cyrillicCount++;
            totalLetters++;
        } else if ((cp >= 0x0041 && cp <= 0x005A) || (cp >= 0x0061 && cp <= 0x007A) || (cp >= 0x00C0 && cp <= 0x024F)) {
            latinCount++;
            totalLetters++;
        }
    }

    if (totalLetters === 0) return 'unknown';
    if (cyrillicCount / totalLetters > 0.4) return 'cyrillic';
    return 'latin';
}

/**
 * Detects the language of a given text string.
 * @param {string} text - Raw text to inspect
 * @returns {{ language: string, confidence: number, isEnglish: boolean, script: string }}
 */
function detectLanguage(text) {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return { language: 'en', confidence: 1.0, isEnglish: true, script: 'latin' };
    }

    const script = detectScript(text);
    if (script === 'cyrillic') {
        return { language: 'ru', confidence: 0.95, isEnglish: false, script: 'cyrillic' };
    }

    // Tokenize words using Unicode property escapes
    const words = text
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[^\p{L}\s]/gu, ' ')
        .split(/\s+/)
        .filter(w => w.length > 1);

    if (words.length === 0) {
        return { language: 'en', confidence: 0.5, isEnglish: true, script: 'latin' };
    }

    // Inspect first 300 words for speed and accuracy
    const sample = words.slice(0, 300);
    const scores = { en: 0, de: 0, fr: 0, es: 0 };

    for (const word of sample) {
        for (const [lang, indicatorSet] of Object.entries(INDICATORS)) {
            if (indicatorSet.has(word)) {
                scores[lang]++;
            }
        }
    }

    // Diacritic bonus detection for Latin scripts
    const sampleText = sample.join(' ');
    if (/[äöüß]/i.test(sampleText)) scores.de += 3;
    if (/[éèêëàâçîïôùû]/i.test(sampleText)) scores.fr += 3;
    if (/[áéíóúñ¿¡]/i.test(sampleText)) scores.es += 3;

    // Determine highest score
    let bestLang = 'en';
    let bestScore = scores.en;

    for (const [lang, score] of Object.entries(scores)) {
        if (score > bestScore) {
            bestLang = lang;
            bestScore = score;
        }
    }

    const totalMatches = Object.values(scores).reduce((a, b) => a + b, 0);
    const confidence = totalMatches > 0 ? Math.min(1.0, parseFloat((bestScore / totalMatches).toFixed(2))) : 0.5;

    return {
        language: bestLang,
        confidence,
        isEnglish: bestLang === 'en',
        script
    };
}

module.exports = {
    detectLanguage,
    detectScript,
    INDICATORS
};
