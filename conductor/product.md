# Product Definition: UAP AnalyticsBot

## Vision & Overview
UAP AnalyticsBot is a robust file analytics engine and telemetry extension designed to process multiple document and media ingestion types (text, markdown, PDF, images via OCR, and video files) for descriptive, diagnostic, predictive, and prescriptive analysis. The system supports native multithreaded worker pools, fingerprint caching, SQLite database storage, dynamic file watching, a local dashboard, and a simulated subagent handoff workflow for automated telemetry reporting.

## Target Audience
- Data analysts and engineers monitoring workspace telemetry.
- Developers looking to run automated analysis on mixed-media pipelines.
- Teams wanting to run localized NLP analysis on documents.

## Core Features
1. **Multi-Source Ingestion**: Support for text, PDFs, image OCR, and video keyframes.
2. **Analysis Pipeline**:
   - Descriptive: Entity extraction (dates, locations) via compromise.
   - Diagnostic: TF-IDF calculation and Cosine Similarity matrices.
   - Predictive: Forecasting hot-spots via weighted moving averages.
   - Prescriptive: Alerts and directory recommendations.
3. **Local Dashboard**: A completely local/offline desktop launcher dashboard (HTML/JS) to browse and view analytics.
4. **Telemetry & Handoff**: Local SQLite persistence for telemetry logs and automated subagent handoff simulation.

## Quality & Compliance Standards
- **Air-Gapped Compatibility**: All model runtimes, OCR tools, and dependency layers must operate fully offline. No external CDN loads or remote API connections are permitted.
- **Cache Policy**: Simple fingerprint caching (`.analytics_cache.json`) without auto-pruning, optimized for static or slow-changing workspaces.
- **Testing & Coverage**: High test coverage (>80%) with Node.js native test runner.
- **Module Structure**: Clean CommonJS module structure with database isolates and path resolution bridges.
