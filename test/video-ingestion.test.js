process.env.NODE_ENV = 'test';

const test = require('node:test');
const { after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

// Global synchronization macro guard to prevent WebAssembly unmanaged heap access violations on process exit
after(async () => {
    // Explicitly give the unmanaged WebAssembly memory space time to flush before process exit
    await new Promise((resolve) => setTimeout(resolve, 1500));
});

const { ingestDirectory } = require('../src/ingestion/file-ingestion');

test('Video Ingestion System Unit Suite', async (t) => {
    await t.test('ingestDirectory parses mock_video.mp4 and returns standard intermediate representation', async () => {
        const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'uap-video-'));
        const mockVideoPath = path.join(fixtureRoot, 'mock_video.mp4');
        
        try {
            // Write a dummy empty file to represent the video file
            await fs.writeFile(mockVideoPath, 'dummy binary content');
            
            const ingestionResult = await ingestDirectory(fixtureRoot, { workers: 1 });
            
            assert.equal(ingestionResult.files.length, 1);
            const doc = ingestionResult.files[0];
            
            // Validate intermediate representation schema
            assert.equal(doc.fileName, 'mock_video.mp4');
            assert.equal(doc.extension, '.mp4');
            assert.ok(doc.filePath.endsWith('mock_video.mp4'));
            
            // Check that transcripts and OCR frame visual text were consolidated
            assert.ok(doc.textContent.includes('Mock transcription of UAP event'));
            assert.ok(doc.textContent.includes('Mock visual text overlay'));
            
            // Check video specific metadata
            assert.ok(doc.metadata);
            assert.equal(doc.metadata.duration, 30);
            assert.equal(doc.metadata.transcripts.length, 1);
            assert.equal(doc.metadata.transcripts[0].text, 'Mock transcription of UAP event');
            assert.equal(doc.metadata.ocrFrames.length, 1);
            assert.equal(doc.metadata.ocrFrames[0].text, 'Mock visual text overlay');
            
        } finally {
            await fs.rm(fixtureRoot, { recursive: true, force: true });
        }
    });
});
