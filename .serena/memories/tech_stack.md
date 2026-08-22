# Tech Stack & Runtime Environment

- **Runtime**: Node.js v22+ (CommonJS module system, `package.json` `"type": "commonjs"`).
- **Database**:
  - Primary: Native `node:sqlite` (Node.js built-in experimental SQLite).
  - Test / Fallback: Mock file-based JSON storage (`db.js`).
- **Dependencies**:
  - `chokidar` (^5.0.0) — Filesystem watcher for directory ingestion.
  - `compromise` (^14.16.0) — Natural language text processing and NLP extraction.
  - `mupdf` (^1.27.0) & `pdf-parse` (^2.4.5) — PDF text and layout parsing.
  - `tesseract.js` (^7.0.0) — OCR processing with offline trained models.
- **Python Subprocess Bridges**:
  - Python 3.10+ virtual environment (`.venv`) for multimedia offloading (video frame parsing, Whisper audio transcripts, MCP client bridges).
- **Test Runner**:
  - Native Node.js test runner (`node:test`, `node:assert`, `node --test --experimental-test-coverage`).
