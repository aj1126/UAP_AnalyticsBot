/**
 * Domain-Driven Design (DDD) - Ingestion Bounded Context
 * Component: Multilingual Translation Engine & Sidecar Generator
 * 
 * Multi-tier offline/free translation coordinator:
 * 1. Local AI Daemon (Ollama http://127.0.0.1:11434)
 * 2. Local Python Argos Translate subprocess (scripts/translate_helper.py)
 * 3. Zero-dependency heuristic & terminology translation fallback
 */

const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { detectLanguage } = require('./language-detector');

// Common historical UAP military & technical terminology for deterministic offline fallback
const DOMAIN_LEXICON = {
    de: {
        'flugkörper': 'missile/aircraft',
        'flugzeug': 'aircraft',
        'sichtung': 'sighting',
        'ufo': 'UFO',
        'objekt': 'object',
        'unbekannt': 'unknown',
        'unbekanntes': 'unknown',
        'geschwindigkeit': 'velocity',
        'flughöhe': 'altitude',
        'höhe': 'altitude',
        'beobachtung': 'observation',
        'leuchtend': 'luminous',
        'datum': 'Date',
        'ort': 'Location',
        'radar': 'radar',
        'bericht': 'report',
        'militär': 'military',
        'luftwaffe': 'air force'
    },
    fr: {
        'phénomène': 'phenomenon',
        'phénomènes': 'phenomena',
        'aéronef': 'aircraft',
        'ovni': 'UFO',
        'soucoupe': 'saucer',
        'volante': 'flying',
        'témoin': 'witness',
        'témoignage': 'testimony',
        'vitesse': 'speed',
        'altitude': 'altitude',
        'lumière': 'light',
        'date': 'Date',
        'lieu': 'Location',
        'rapport': 'report',
        'défense': 'defense',
        'aérospatial': 'aerospace'
    },
    es: {
        'objeto': 'object',
        'volador': 'flying',
        'no identificado': 'unidentified',
        'ovni': 'UFO',
        'avistamiento': 'sighting',
        'velocidad': 'speed',
        'altura': 'altitude',
        'testigo': 'witness',
        'informe': 'report',
        'fecha': 'Date',
        'lugar': 'Location'
    },
    ru: {
        'нло': 'UFO',
        'объект': 'object',
        'неопознанный': 'unidentified',
        'наблюдение': 'sighting/observation',
        'скорость': 'speed',
        'высота': 'altitude',
        'дата': 'Date',
        'место': 'Location',
        'отчет': 'report',
        'военный': 'military'
    }
};

/**
 * Tier 1: Query Local Ollama API (if accessible)
 */
async function translateViaOllama(text, sourceLang, model = 'qwen2.5:3b') {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    try {
        const prompt = `Translate the following ${sourceLang} document into clear English. Preserve dates, technical acronyms, and geographical locations faithfully. Return ONLY the English translation without preamble:\n\n${text.slice(0, 3000)}`;
        const resp = await fetch('http://127.0.0.1:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                prompt,
                stream: false
            }),
            signal: controller.signal
        });
        clearTimeout(timeout);

        if (resp.ok) {
            const data = await resp.json();
            if (data.response && data.response.trim().length > 0) {
                return data.response.trim();
            }
        }
        return null;
    } catch {
        clearTimeout(timeout);
        return null;
    }
}

/**
 * Tier 2: Query Python Argos Translate helper script
 */
function translateViaPythonArgos(text, sourceLang) {
    return new Promise((resolve) => {
        const helperPath = path.join(__dirname, '..', '..', 'scripts', 'translate_helper.py');
        const py = spawn('python', [helperPath, '--from', sourceLang, '--to', 'en']);

        let stdout = '';
        let stderr = '';

        const timer = setTimeout(() => {
            py.kill();
            resolve(null);
        }, 5000);

        py.stdout.on('data', (d) => { stdout += d.toString(); });
        py.stderr.on('data', (d) => { stderr += d.toString(); });

        py.on('close', (code) => {
            clearTimeout(timer);
            if (code === 0 && stdout.trim().length > 0) {
                try {
                    const parsed = JSON.parse(stdout);
                    if (parsed.translatedText) {
                        return resolve(parsed.translatedText);
                    }
                } catch {}
            }
            resolve(null);
        });

        py.on('error', () => {
            clearTimeout(timer);
            resolve(null);
        });

        py.stdin.write(text.slice(0, 5000));
        py.stdin.end();
    });
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Tier 3: Deterministic lexicon-augmented transliteration fallback
 */
function translateViaFallbackLexicon(text, sourceLang) {
    const dict = DOMAIN_LEXICON[sourceLang] || {};
    let translated = text;

    for (const [foreign, english] of Object.entries(dict)) {
        const pattern = `(?<!\\p{L})${escapeRegex(foreign)}(?!\\p{L})`;
        const regex = new RegExp(pattern, 'giu');
        translated = translated.replace(regex, english);
    }

    return `[Translated from ${sourceLang.toUpperCase()} - Offline Fallback]\n${translated}`;
}

/**
 * Translates a non-English text to English using the best available local tier.
 * @param {string} text - Source text
 * @param {string} sourceLang - Detected ISO code ('de', 'fr', 'es', 'ru', etc.)
 * @returns {Promise<{ translatedText: string, provider: string }>}
 */
async function translateToEnglish(text, sourceLang) {
    if (!text || sourceLang === 'en') {
        return { translatedText: text, provider: 'none' };
    }

    // Try Tier 1: Local Ollama
    const ollamaResult = await translateViaOllama(text, sourceLang);
    if (ollamaResult) {
        return { translatedText: ollamaResult, provider: 'ollama' };
    }

    // Try Tier 2: Python Argos Translate
    const argosResult = await translateViaPythonArgos(text, sourceLang);
    if (argosResult) {
        return { translatedText: argosResult, provider: 'argos' };
    }

    // Tier 3: Offline Lexicon Fallback
    const fallbackResult = translateViaFallbackLexicon(text, sourceLang);
    return { translatedText: fallbackResult, provider: 'fallback_lexicon' };
}

/**
 * Generates an English translation copy (sidecar file) for non-English source files.
 * @param {string} filePath - Absolute path to original file
 * @param {string} textContent - Original text content
 * @param {Object} [options={}] - Options (e.g. sidecarDir, dryRun)
 * @returns {Promise<{ sidecarPath: string|null, detectedLanguage: string, isEnglish: boolean, translatedText: string, provider: string }>}
 */
async function generateEnglishCopy(filePath, textContent, options = {}) {
    const langInfo = detectLanguage(textContent);
    
    if (langInfo.isEnglish) {
        return {
            sidecarPath: null,
            detectedLanguage: 'en',
            isEnglish: true,
            translatedText: textContent,
            provider: 'none'
        };
    }

    const { translatedText, provider } = await translateToEnglish(textContent, langInfo.language);

    let sidecarPath = null;
    if (!options.dryRun && filePath) {
        const parsedPath = path.parse(filePath);
        // Default sidecar name: <basename>.en.txt
        const defaultSidecar = path.join(parsedPath.dir, `${parsedPath.name}.en.txt`);
        
        try {
            await fs.writeFile(defaultSidecar, translatedText, 'utf-8');
            sidecarPath = defaultSidecar;
        } catch {
            // If the source directory is read-only, write to local translation cache
            try {
                const fallbackDir = options.sidecarDir || path.join(process.cwd(), '.analytics_translations');
                await fs.mkdir(fallbackDir, { recursive: true });
                const cachedSidecar = path.join(fallbackDir, `${parsedPath.name}.en.txt`);
                await fs.writeFile(cachedSidecar, translatedText, 'utf-8');
                sidecarPath = cachedSidecar;
            } catch {
                // Non-blocking fallback
            }
        }
    }

    return {
        sidecarPath,
        detectedLanguage: langInfo.language,
        isEnglish: false,
        translatedText,
        provider
    };
}

module.exports = {
    translateToEnglish,
    generateEnglishCopy,
    translateViaFallbackLexicon,
    DOMAIN_LEXICON
};
