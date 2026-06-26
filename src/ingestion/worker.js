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
]);

parentPort.on("message", async (task) => {
    try {
        const extension = path.extname(task.filePath).toLowerCase();
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

        if (TEXT_EXTENSIONS.has(extension)) {
            await processTextFile();
        } else if (extension === ".pdf") {
            await processPdfFile();
        } else if (IMAGE_EXTENSIONS.has(extension)) {
            await processImageFile();
        }

        parentPort.postMessage({
            success: true,
            filePath: task.filePath,
            fingerprint: task.fingerprint,
            result: {
                fileName: task.filePath.split(/[/\\]/).pop(),
                relativePath: task.rootDirectory
                    ? path.relative(task.rootDirectory, task.filePath)
                    : task.filePath,
                extension,
                size: stats.size,
                modifiedAt: stats.mtime.toISOString(),
                textContent,
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
