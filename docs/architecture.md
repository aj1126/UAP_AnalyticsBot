# System Architecture: UAP AnalyticsBot

## Current Implementation

The repository currently ships a Node.js CLI-centered analytics flow:

1. **CLI Orchestrator (`src/index.js`)** resolves the source directory, supports watch mode, and routes report output to stdout or export files.
2. **Read-Only Ingestion (`src/ingestion/file-ingestion.js`)** recursively scans supported files (including text, PDF, images, and video), dispatches parsing and extraction work to Node.js worker threads, and memoizes compatible results in `.analytics_cache.json`. It outputs a standard intermediate representation (SIR) schema.
3. **Analytics Pipeline (`src/pipeline.js`)** consumes the SIR schema and builds the descriptive, diagnostic, predictive, and prescriptive tiers. This layer is decoupled from filesystem access and media decoding.
* **Ingestion/Analytics Separation:** The Ingestion Layer handles raw file loading, OCR, and transcription, producing a unified JSON schema. The Analytics Layer remains file-format agnostic and performs natural language processing, clustering, and trend mapping.

## Current Runtime Boundaries

Implemented in the active system:

- **Supported Formats:** Recursive read-only ingestion for `.txt`, `.md`, `.json`, `.csv`, `.log`, `.pdf`, `.png`, `.jpg`, `.jpeg`, and `.mp4`.
- **Multithreading & Caching:** A multithreaded worker pool (`node:worker_threads`) with fingerprint-based memoization cache (`.analytics_cache.json`).
- **Scanned PDF Fallback:** PDF text extraction via `pdf-parse` with automated vector-to-raster fallback (MuPDF + Tesseract) to OCR corrupted/scanned documents.
- **Image OCR:** Direct image text extraction via `tesseract.js` for `.png`/`.jpg`/`.jpeg`.
- **Video Processing Pipeline:** Decoupled video processing for `.mp4` that offloads ffmpeg keyframe extraction, Whisper speech-to-text, and frame OCR to a local Python handler script (`scripts/video_ingestion.py`).
- **Process & Thread Safety:**
  - **Dynamic DB Path Isolation:** Configures isolated `:memory:` databases when `NODE_ENV=test` to prevent test contamination.
  - **Graceful Thread Teardown:** Employs deferred worker termination (`setImmediate(() => worker.terminate())`) to prevent re-entrancy heap access violations (exit code `3221225477` / `0xC0000005`) on Windows.
- **Named Entity Recognition (NER):** Entity extraction for dates and locations via the `compromise` NLP library, with regex-based fallbacks for structured fields.
- **Mathematical Modeling:**
  - **Diagnostic Tier:** Cosine Similarity matrices and TF-IDF weighting cross-referencing document vectors.
  - **Predictive Tier:** Weighted moving average forecasting for timeline hot-spot analysis.
- **Delivery Formats:** Outputs unified reports to standard output (JSON) or exports formatted Markdown (`--format=md`) and flat-mapped CSV (`--format=csv`) reports.
- **Continuous Monitoring:** Real-time watch mode (`--watch`) via `chokidar` that recalculates analytics upon file changes.
- **Local Web GUI:** Web-based browser interface (`src/gui/server.js`) for interactive directory scanning and metric graphs.
- **Telemetry & Extension:** GitHub webhook parsing, SQL persistence (`uap_telemetry.db`), automated configuration drift analysis, and virtual subagent handoff simulation (`invoke_subagent`).

## Planned Expansion

The long-term architecture still targets a broader pipeline:

1. **Ingestion Engine** for broader file discovery and routing
2. **Extraction Node** for richer text and metadata extraction
3. **NLP & Entity Recognition Pipeline** for deeper semantic analysis
4. **Analytics Engine** for the four analytics tiers
5. **Output Layer** for JSON plus additional delivery surfaces

These planned components should be treated as roadmap concepts unless the implementation in `src/` explicitly supports them.

## Diagram References

- [Architecture flowchart](diagrams/architectureDiagram.mermaid)
- [Execution sequence diagram](diagrams/sequenceDiagram.mermaid)

Both diagrams distinguish between current components and planned extensions so documentation stays aligned with the codebase.

## Documentation Boundaries

- [README.md](../README.md) is the operational guide for the active Node CLI.
- [legacy-prototype.md](legacy-prototype.md) preserves the historical Python prototype.
- This architecture document remains hand-authored and should be updated when the implementation changes system boundaries or roadmap assumptions.
