# Sprint 1: Concurrency, Memoization, and Algorithmic Depth

## Overview
This sprint focuses on eliminating main-thread bottlenecks during WebAssembly PDF rasterization and deepening the analytical accuracy of the Diagnostic tier.

## 🛠️ Task 1: Worker Pool Implementation (Performance)
- [x] Create src/ingestion/worker.js to house the mupdf and Tesseract logic.
- [x] Update src/ingestion/file-ingestion.js to utilize node:worker_threads to spawn a pool sized dynamically to the host's CPU core count.
- [x] Implement a thread-safe queue for the directory walker to dispatch file paths to idle workers.

## 🛠️ Task 2: State Caching (Memoization)
- [x] Implement a fingerprinting function in the ingestion node using file stats (size + mtime).
- [x] Create a non-destructive .analytics_cache.json to store parsed data arrays.
- [x] Add a short-circuit boolean check to bypass worker dispatch if the fingerprint matches the cache.

## ✨ Task 3: TF-IDF Engine (Diagnostic Tier)
- [x] Update src/analytics/diagnostic.js to calculate Inverse Document Frequency across the total fileCount.
- [x] Map the TF-IDF weight for each word in individual files.
- [x] Output the top 5 most highly weighted (unique) keywords per file into the final Diagnostic JSON.

## Definition of Done
- [x] All test/pipeline.test.js unit tests passing.
- [x] Pipeline runs fully non-destructively (source files unmodified).
- [x] Performance benchmark shows >50% reduction in processing time for a cached directory.
