# Technology Stack: UAP AnalyticsBot

## Core Runtime & Languages
- **Runtime Environment**: Node.js (version >= 20.x, CommonJS module type)
- **Languages**: 
  - JavaScript (ES6+ for backend application and frontend dashboard)
  - Python (version >= 3.10 required for standalone subprocesses and MCP clients)

## External System Dependencies
- **FFmpeg**: Required system-level utility for video decoding, audio track extraction, and keyframe generation in the video ingestion pipeline.

## Python Dependency Management
- **Environment**: Standard Python virtual environment (`.venv`) initialized via standard `venv`.
- **Manifest**: Dependencies declared in `requirements.txt` in the project root.

## Persistence Layer
- **SQLite Database**: Native `node:sqlite` (`DatabaseSync` API).
- **Test Isolation**: Database configuration must automatically isolate test suites by routing connection paths to `:memory:` or temporary test files when `process.env.NODE_ENV === 'test'`.
- **Fallback Mock Database**: Custom in-memory/JSON-file mock database handler (`MockDatabaseSync` inside `src/telemetry/db.js`) used as fallback under Node versions where native SQLite is disabled or unsupported.

## Ingestion & Processing Libraries
- **PDF Extraction**: `pdf-parse` (primary parsing) and `mupdf` (direct rasterization fallback).
- **OCR Engine**: `tesseract.js` (configured to run fully offline using local workers and local `.traineddata` files).
- **Folder Watcher**: `chokidar` (version 5.x, for filesystem event handling in `--watch` mode).
- **NLP Engine**: `compromise` (lightweight rule-based entity extraction for dates and locations).

## UI/UX Design System
- **Technologies**: Vanilla HTML5, Vanilla CSS3 (dynamic HSL color tokens, dark mode gradients, glassmorphism), and Client-Side Vanilla JS.
- **Typography**: Google Fonts (`Outfit` for headings, `Inter` for body).

## Tooling & Verification
- **Test Runner**: Native Node.js test runner (`node --test`) with native coverage analysis (`--experimental-test-coverage`).
- **Git Hooks**: `husky` for linting and pre-commit checks.
- **Releasing**: `commit-and-tag-version` for automated CHANGELOG updates and git tagging.
