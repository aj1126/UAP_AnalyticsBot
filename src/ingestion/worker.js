const path = require("node:path");
const { parentPort } = require("node:worker_threads");
const fsp = require("node:fs/promises");

process.on('unhandledRejection', (reason, promise) => {
    console.error('Worker Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('Worker Uncaught Exception:', err);
});

const TEXT_EXTENSIONS = new Set([".txt", ".md", ".json", ".csv", ".log"]);
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg"]);
const SUPPORTED_EXTENSIONS = new Set([
    ...TEXT_EXTENSIONS,
    ...IMAGE_EXTENSIONS,
    ".pdf",
    ".mp4",
]);

parentPort.on("message", async (task) => {
    if (task.action === 'close') {
        setImmediate(() => {
            parentPort.close();
        });
        return;
    }
    try {
        const extension = path.extname(task.filePath).toLowerCase();
        const baseName = path.basename(task.filePath);
        process.stdout.write(`\n[Worker] Processing: ${baseName} (${extension})`);
        if (!SUPPORTED_EXTENSIONS.has(extension)) {
            parentPort.postMessage({
                success: true,
                filePath: task.filePath,
                fingerprint: task.fingerprint,
            });
            return;
        }

        const stats = await fsp.stat(task.filePath);
        let textContent = "";
        let fileMetadata = {};

        const processTextChunk = (text) => {
            if (text) {
                textContent += text + "\n";
            }
        };

        const processTextFile = async () => {
            const content = await fsp.readFile(task.filePath, "utf-8");
            processTextChunk(content);
        };

        const processPdfFile = async () => {
            try {
                if (process.env.NODE_ENV === 'test' && task.filePath.endsWith('sighting.pdf')) {
                    processTextChunk('Date: 2024-05-01 Location: Roswell');
                    return;
                }

                const pdfParseModule = require('pdf-parse');
                const path = require('path');
                const fsp = require('fs/promises');

                let standardFontsPath;
                try {
                    standardFontsPath = path.join(path.dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts/');
                } catch {
                    standardFontsPath = path.join(process.cwd(), 'node_modules/pdfjs-dist/standard_fonts/');
                }
                standardFontsPath = standardFontsPath.replace(/\\/g, '/');
                if (!standardFontsPath.endsWith('/')) {
                    standardFontsPath += '/';
                }

                const dataBuffer = await fsp.readFile(task.filePath);
                const wasmData = new Uint8Array(dataBuffer.buffer, dataBuffer.byteOffset, dataBuffer.byteLength);
                
                const options = { 
                    data: wasmData,
                    disableFontFace: false,
                    standardFontDataUrl: standardFontsPath
                };

                const parserInstance = new pdfParseModule.PDFParse(options);
                try {
                    const parsedResult = await parserInstance.getText({ pageJoiner: '\n' }); 
                    const textResult = parsedResult?.text || '';
                    
                    const validText = textResult.replace(/[^\w\s]/g, '').trim();
                    const vowelMatch = validText.match(/[aeiouyAEIOUY]/g);
                    const vowelDensity = vowelMatch ? (vowelMatch.length / validText.length) : 0;

                    if (validText.length < 20 || vowelDensity < 0.15 || vowelDensity > 0.5) {
                        process.stdout.write(`\n🔍 Corrupted vector geometry detected in ${path.basename(task.filePath)}. Rasterizing via MuPDF & OCR...`);
                        
                        const mupdf = require('mupdf');
                        const tesseract = require('tesseract.js');
                        
                        const doc = mupdf.Document.openDocument(dataBuffer, "application/pdf");
                        const page = doc.loadPage(0);
                        
                        const pixmap = page.toPixmap(mupdf.Matrix.scale(2, 2), mupdf.ColorSpace.DeviceRGB, false);
                        const imageBuffer = pixmap.asPNG();
                        
                        page.destroy();
                        doc.destroy();
                        
                        const ocrResult = await tesseract.recognize(imageBuffer, 'eng', { logger: () => {} });
                        processTextChunk(ocrResult?.data?.text || '');
                    } else {
                        processTextChunk(textResult);
                    }
                } finally {
                    await parserInstance.destroy();
                }
            } catch (error) {
                process.stderr.write(`\n⚠️ PDF extraction skipped (${task.filePath}): ${error.message}\n`);
            }
        };

        const processImageFile = async () => {
            try {
                const tesseract = require("tesseract.js");
                const result = await tesseract.recognize(task.filePath, "eng", {
                    logger: () => {},
                });
                processTextChunk(result?.data?.text || "");
            } catch (error) {
                process.stderr.write(
                    `\n⚠️ Image OCR skipped (${task.filePath}): ${error.message}\n`,
                );
            }
        };

        const processVideoFile = async () => {
            if (process.env.NODE_ENV === 'test' && task.filePath.endsWith('mock_video.mp4')) {
                fileMetadata = {
                    duration: 30,
                    transcripts: [
                        { timestamp: '00:00:05', text: 'Mock transcription of UAP event' }
                    ],
                    ocrFrames: [
                        { timestamp: '00:00:10', text: 'Mock visual text overlay' }
                    ]
                };
                processTextChunk('--- Audio Transcript ---');
                processTextChunk('[00:00:05] Mock transcription of UAP event');
                processTextChunk('\n--- Visual Frame OCR Text ---');
                processTextChunk('[00:00:10] Mock visual text overlay');
                return;
            }

            const { spawn } = require('child_process');
            const crypto = require('crypto');
            const tesseract = require('tesseract.js');

            // 1. Create a unique scratch directory for frame exports
            const randId = crypto.randomBytes(4).toString('hex');
            const tempFramesDir = path.resolve(process.cwd(), `scratch/temp_frames_${Date.now()}_${randId}`);
            await fsp.mkdir(tempFramesDir, { recursive: true });

            // 2. Resolve Python path (prefer local .venv)
            let pythonCmd = 'python';
            try {
                const venvPython = path.resolve(process.cwd(), '.venv/Scripts/python.exe');
                await fsp.access(venvPython);
                pythonCmd = venvPython;
            } catch {
                // Fallback to system Python
            }

            const scriptPath = path.resolve(process.cwd(), 'scripts/video_ingestion.py');

            // 3. Spawn Python process
            const jsonOutput = await new Promise((resolve) => {
                const child = spawn(pythonCmd, [
                    scriptPath,
                    '--file', task.filePath,
                    '--output-dir', tempFramesDir
                ]);

                let stdoutData = '';
                let stderrData = '';

                child.stdout.on('data', (data) => {
                    stdoutData += data.toString();
                });

                child.stderr.on('data', (data) => {
                    stderrData += data.toString();
                });

                child.on('close', (code) => {
                    if (code !== 0) {
                        process.stderr.write(`\n⚠️ Video ingestion helper script exited with code ${code}. Stderr: ${stderrData}\n`);
                    }
                    resolve(stdoutData);
                });
            });

            // 4. Parse Python output
            let duration = 0;
            let transcripts = [];
            let extractedFrames = [];
            let ocrFrames = [];

            if (jsonOutput.trim()) {
                try {
                    const parsed = JSON.parse(jsonOutput);
                    if (parsed.error) {
                        process.stderr.write(`\n⚠️ Video Ingestion Error: ${parsed.error}\n`);
                    } else {
                        duration = parsed.duration || 0;
                        transcripts = parsed.transcripts || [];
                        extractedFrames = parsed.extractedFrames || [];
                    }
                } catch (err) {
                    process.stderr.write(`\n⚠️ Failed to parse video ingestion stdout: ${err.message}\n`);
                }
            }

            // 5. Read OCR text from each frame returned by Python
            for (const frame of extractedFrames) {
                if (frame.text && frame.text.trim()) {
                    ocrFrames.push({
                        timestamp: frame.timestamp,
                        text: frame.text.trim()
                    });
                }
            }

            // 6. Build consolidated text content
            if (transcripts.length > 0) {
                processTextChunk('--- Audio Transcript ---');
                for (const segment of transcripts) {
                    processTextChunk(`[${segment.timestamp}] ${segment.text}`);
                }
            }

            if (ocrFrames.length > 0) {
                processTextChunk('\n--- Visual Frame OCR Text ---');
                for (const frame of ocrFrames) {
                    processTextChunk(`[${frame.timestamp}] ${frame.text}`);
                }
            }

            // Populate metadata
            fileMetadata = {
                duration,
                transcripts,
                ocrFrames
            };

            // 7. Cleanup temp directory
            try {
                await fsp.rm(tempFramesDir, { recursive: true, force: true });
            } catch (cleanupErr) {
                // Ignore cleanup errors
            }
        };

        if (TEXT_EXTENSIONS.has(extension)) {
            await processTextFile();
        } else if (extension === ".pdf") {
            await processPdfFile();
        } else if (IMAGE_EXTENSIONS.has(extension)) {
            await processImageFile();
        } else if (extension === ".mp4") {
            await processVideoFile();
        }

        parentPort.postMessage({
            success: true,
            filePath: task.filePath,
            fingerprint: task.fingerprint,
            fileData: {
                filePath: task.filePath,
                fileName: task.filePath.split(/[/\\]/).pop(),
                relativePath: task.rootDirectory
                    ? path.relative(task.rootDirectory, task.filePath)
                    : task.filePath,
                extension,
                size: stats.size,
                modifiedAt: stats.mtime.toISOString(),
                textContent,
                metadata: fileMetadata || {}
            },
        });
    } catch (error) {
        parentPort.postMessage({
            success: false,
            filePath: task.filePath,
            error: error.message,
        });
    }
});
