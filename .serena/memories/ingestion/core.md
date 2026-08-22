# Ingestion Subsystem Architecture

Multi-format file ingestion engine converting diverse document types into Standard Intermediate Representation (SIR).

## Ingestion Pipeline (`src/ingestion/`)
- `file-ingestion.js`: Ingestion orchestrator managing worker thread pools, file scanning, and metadata extraction.
- `worker.js`: Dedicated worker thread executing text parsing, PDF rendering (`pdf-parse`, `mupdf`), and OCR processing (`tesseract.js`).
- Metadata Preservation: Always preserve existing metadata fields via `metadata: file.metadata || {}`.
- Multimedia Offloading: Video frame extraction and audio decoding offloaded to Python subprocess bridges (`child_process.spawn`).
