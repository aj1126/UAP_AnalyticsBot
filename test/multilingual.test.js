process.env.NODE_ENV = 'test';

const test = require('node:test');
const { after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const { detectLanguage, detectScript } = require('../src/ingestion/language-detector');
const { isStopWord, countUnicodeVowels } = require('../src/analytics/multilingual-dictionary');
const { analyzeFile } = require('../src/analytics/analyzer');
const { translateToEnglish, generateEnglishCopy, translateViaFallbackLexicon, DOMAIN_LEXICON } = require('../src/ingestion/translator');
const { ingestDirectory } = require('../src/ingestion/file-ingestion');

// WebAssembly unmanaged heap flush guard
after(async () => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
});

test('Language Detector - script detection and language classification', () => {
    // 1. English
    const enText = 'The military aircraft reported an unidentified flying object hovering at high altitude.';
    const enResult = detectLanguage(enText);
    assert.equal(enResult.language, 'en');
    assert.equal(enResult.isEnglish, true);
    assert.equal(enResult.script, 'latin');

    // 2. German
    const deText = 'Der Flugkörper flog mit hoher Geschwindigkeit über das militärische Sperrgebiet in der Nähe von Berlin.';
    const deResult = detectLanguage(deText);
    assert.equal(deResult.language, 'de');
    assert.equal(deResult.isEnglish, false);
    assert.equal(deResult.script, 'latin');

    // 3. French
    const frText = 'Le témoin a observé un phénomène aérospatial non identifié dans le ciel au-dessus de Paris avec une grande vitesse.';
    const frResult = detectLanguage(frText);
    assert.equal(frResult.language, 'fr');
    assert.equal(frResult.isEnglish, false);

    // 4. Spanish
    const esText = 'El testigo informó sobre un objeto volador no identificado avistado cerca de la base militar con velocidad extrema.';
    const esResult = detectLanguage(esText);
    assert.equal(esResult.language, 'es');
    assert.equal(esResult.isEnglish, false);

    // 5. Russian
    const ruText = 'Военный пилот доложил о неопознанном объекте на высоте 10000 метров.';
    const ruResult = detectLanguage(ruText);
    assert.equal(ruResult.language, 'ru');
    assert.equal(ruResult.isEnglish, false);
    assert.equal(ruResult.script, 'cyrillic');
    assert.equal(detectScript(ruText), 'cyrillic');

    // Edge cases: empty / whitespace
    assert.equal(detectLanguage('').isEnglish, true);
    assert.equal(detectLanguage('   ').isEnglish, true);
    assert.equal(detectLanguage(null).isEnglish, true);
});

test('Multilingual Dictionary - stop-word culling & Unicode vowel density', () => {
    // English stop-words
    assert.equal(isStopWord('the', 'en'), true);
    assert.equal(isStopWord('and', 'en'), true);
    assert.equal(isStopWord('ufo', 'en'), false);

    // German stop-words
    assert.equal(isStopWord('der', 'de'), true);
    assert.equal(isStopWord('für', 'de'), true);
    assert.equal(isStopWord('flugkörper', 'de'), false);

    // French stop-words
    assert.equal(isStopWord('dans', 'fr'), true);
    assert.equal(isStopWord('avec', 'fr'), true);
    assert.equal(isStopWord('aéronef', 'fr'), false);

    // Russian stop-words
    assert.equal(isStopWord('что', 'ru'), true);
    assert.equal(isStopWord('для', 'ru'), true);
    assert.equal(isStopWord('самолет', 'ru'), false);

    // Case-insensitivity check
    assert.equal(isStopWord('DER', 'de'), true);
    assert.equal(isStopWord('The', 'en'), true);

    // Unicode vowel counts
    assert.equal(countUnicodeVowels('hello'), 2);
    assert.equal(countUnicodeVowels('Flugkörper'), 3); // u, ö, e
    assert.equal(countUnicodeVowels('НЛО'), 1); // О
    assert.equal(countUnicodeVowels('неопознанный'), 5); // е, о, о, а, ы
    assert.equal(countUnicodeVowels('12345!@#$'), 0);
    assert.equal(countUnicodeVowels(''), 0);
    assert.equal(countUnicodeVowels(null), 0);
});

test('Analyzer - Unicode tokenization and multilingual entity extraction', () => {
    // German document with umlauts and structured header
    const deDoc = {
        fileName: 'german_sighting.txt',
        textContent: [
            'Ort: Berlin',
            'Datum: 2024-06-15',
            'Ein unbekannter Flugkörper flog über das Gelände mit extremer Geschwindigkeit.'
        ].join('\n')
    };

    const deAnalyzed = analyzeFile(deDoc);
    assert.equal(deAnalyzed.language, 'de');
    assert.equal(deAnalyzed.isEnglish, false);
    assert.ok(deAnalyzed.locations.includes('Berlin'));
    assert.ok(deAnalyzed.dates.includes('2024-06-15'));
    // Ensure "flugkörper" with umlaut ö is preserved intact and counted
    assert.equal(deAnalyzed.wordFrequency['flugkörper'], 1);
    // Ensure stop words "ein", "das", "über" were culled
    assert.equal(deAnalyzed.wordFrequency['ein'], undefined);
    assert.equal(deAnalyzed.wordFrequency['das'], undefined);

    // Russian document with Cyrillic tokens
    const ruDoc = {
        fileName: 'russian_report.txt',
        textContent: [
            'Место: Москва',
            'Дата: 2024-07-20',
            'Неопознанный объект наблюдался в небе над военной базой.'
        ].join('\n')
    };

    const ruAnalyzed = analyzeFile(ruDoc);
    assert.equal(ruAnalyzed.language, 'ru');
    assert.equal(ruAnalyzed.isEnglish, false);
    assert.ok(ruAnalyzed.locations.includes('Москва'));
    assert.ok(ruAnalyzed.dates.includes('2024-07-20'));
    assert.ok(ruAnalyzed.wordFrequency['объект'] >= 1);
    assert.ok(ruAnalyzed.wordFrequency['неопознанный'] >= 1);

    // Dual-text: English translation sidecar alongside foreign document
    const dualDoc = {
        fileName: 'foreign_doc.txt',
        textContent: 'Ort: Hamburg\nDatum: 2024-08-01\nUnbekanntes Flugzeug gesichtet.',
        translatedText: 'Location: Hamburg\nDate: 2024-08-01\nUnknown aircraft sighted.'
    };

    const dualAnalyzed = analyzeFile(dualDoc);
    assert.ok(dualAnalyzed.locations.includes('Hamburg'));
    assert.ok(dualAnalyzed.dates.includes('2024-08-01'));
    assert.equal(dualAnalyzed.translatedText, dualDoc.translatedText);
});

test('Translator & Sidecar Generator - translation tiers and file generation', async () => {
    // English text bypass
    const enRes = await translateToEnglish('A fast moving object was detected.', 'en');
    assert.equal(enRes.provider, 'none');
    assert.equal(enRes.translatedText, 'A fast moving object was detected.');

    // Fallback translation with deterministic lexicon substitution
    const deText = 'Der flugkörper hatte eine hohe geschwindigkeit und es gab eine sichtung.';
    const fallbackRes = translateViaFallbackLexicon(deText, 'de');
    assert.ok(fallbackRes.toLowerCase().includes('missile/aircraft'));
    assert.ok(fallbackRes.toLowerCase().includes('velocity'));
    assert.ok(fallbackRes.toLowerCase().includes('sighting'));

    // Tiered translation (Ollama / Argos / Fallback)
    const deRes = await translateToEnglish(deText, 'de');
    assert.ok(['ollama', 'argos', 'fallback_lexicon'].includes(deRes.provider));
    assert.ok(deRes.translatedText && deRes.translatedText.length > 0);

    // Sidecar generation test
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'uap-trans-'));
    try {
        const originalFile = path.join(tempDir, 'incident_report.txt');
        const sourceContent = 'Ort: Dresden\nDatum: 2024-09-01\nSichtung eines unidentifizierten Flugkörpers.';
        await fs.writeFile(originalFile, sourceContent, 'utf-8');

        const copyResult = await generateEnglishCopy(originalFile, sourceContent);
        assert.equal(copyResult.isEnglish, false);
        assert.equal(copyResult.detectedLanguage, 'de');
        assert.ok(copyResult.sidecarPath);
        assert.ok(copyResult.sidecarPath.endsWith('incident_report.en.txt'));

        // Verify sidecar was created and contains translation
        const sidecarContent = await fs.readFile(copyResult.sidecarPath, 'utf-8');
        assert.ok(sidecarContent.length > 0);
    } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
    }
});

test('Integration - ingestDirectory handles multilingual files and generates sidecars', async () => {
    const tempWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), 'uap-multi-ingest-'));

    try {
        // Create an English file
        await fs.writeFile(
            path.join(tempWorkspace, 'us_report.txt'),
            'Date: 2024-01-01\nLocation: Roswell\nA metallic disc hovered over the desert.'
        );

        // Create a German file
        await fs.writeFile(
            path.join(tempWorkspace, 'de_report.txt'),
            'Datum: 2024-02-15\nOrt: Berlin\nEin leuchtender Flugkörper wurde in der Nacht beobachtet.'
        );

        // Ingest directory
        const result = await ingestDirectory(tempWorkspace, { workers: 1 });
        assert.equal(result.files.length, 2);

        const deFile = result.files.find(f => f.fileName === 'de_report.txt');
        assert.ok(deFile);
        assert.equal(deFile.language, 'de');
        assert.equal(deFile.isEnglish, false);
        assert.ok(deFile.sidecarPath);
        assert.ok(deFile.sidecarPath.endsWith('de_report.en.txt'));

        // Check that sidecar exists on disk
        const sidecarExists = await fs.stat(deFile.sidecarPath).then(() => true).catch(() => false);
        assert.equal(sidecarExists, true);

        // Second pass: Ensure walkFiles skips the generated .en.txt sidecar
        const secondPass = await ingestDirectory(tempWorkspace, { workers: 1, clearCache: true });
        assert.equal(secondPass.files.length, 2);
    } finally {
        await fs.rm(tempWorkspace, { recursive: true, force: true });
    }
});
