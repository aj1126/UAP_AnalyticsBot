# Development Roadmap: UAP AnalyticsBot

This document tracks the active expansion phases for the AnalyticsBot pipeline.

## Stage 1: Extraction Node Upgrade (NLP Integration)
**Goal:** Replace hardcoded Regex date/location extraction with Named Entity Recognition (NER).
- [x] Install NLP library (e.g., `npm install compromise`).
- [x] Refactor `extractDates` in `src/ingestion/file-ingestion.js` to use NLP `#Date` tagging.
- [x] Refactor `extractLocations` in `src/ingestion/file-ingestion.js` to use NLP `#Place` tagging.
- [x] Ensure the output schema matches the existing `dates: []` and `locations: []` arrays so downstream analytics engines do not break.

## Stage 2: Multimedia Ingestion Routing
**Goal:** Reintroduce legacy Python capabilities to parse PDFs and Images via the Node pipeline.
- [ ] Install extraction dependencies (`npm install pdf-parse tesseract.js`).
- [ ] Update `TEXT_EXTENSIONS` set to include `.pdf`, `.png`, `.jpg`.
- [ ] Abstract `readTextFile` into a routing function (`readFileData`).
- [ ] Implement PDF buffer streaming and OCR image processing before passing text strings to the normalizer.

## Stage 3: Alternate Delivery Surfaces
**Goal:** Abstract the output layer to support CSV and Markdown reports instead of just stdout JSON.
- [ ] Create `src/delivery/` directory.
- [ ] Implement `src/delivery/markdown-generator.js`.
- [ ] Update `src/index.js` to accept CLI flags (e.g., `--format=md`).
- [ ] Route generated reports to a local ignored folder (e.g., `/data_exports/`).

## Stage 4: Continuous Event Loop
**Goal:** Allow the bot to monitor a directory and update analytics dynamically.
- [ ] Install filesystem watcher (`npm install chokidar`).
- [ ] Implement a `--watch` flag in the CLI orchestrator.
- [ ] Hook `chokidar` file events (add, change, unlink) into the `pipeline.js` to update the corpus index without full application restarts.