# Sprint 1: Concurrency, Memoization, and Algorithmic Depth

## Overview
This sprint focuses on eliminating main-thread bottlenecks during WebAssembly PDF rasterization and deepening the analytical accuracy of the Diagnostic tier.

## 🛠️ Task 1: Worker Pool Implementation (Performance)
- [ ] Create src/ingestion/worker.js to house the mupdf and Tesseract logic.
- [ ] Update src/ingestion/file-ingestion.js to utilize 
ode:worker_threads to spawn a pool sized dynamically to the host's CPU core count.
- [ ] Implement a thread-safe queue for the directory walker to dispatch file paths to idle workers.

## 🛠️ Task 2: State Caching (Memoization)
- [ ] Implement a fingerprinting function in the ingestion node using file stats (size + mtime).
- [ ] Create a non-destructive .analytics_cache.json to store parsed data arrays.
- [ ] Add a short-circuit boolean check to bypass worker dispatch if the fingerprint matches the cache.

## ✨ Task 3: TF-IDF Engine (Diagnostic Tier)
- [ ] Update src/analytics/diagnostic.js to calculate Inverse Document Frequency across the total ileCount.
- [ ] Map the TF-IDF weight for each word in individual files.
- [ ] Output the top 5 most highly weighted (unique) keywords per file into the final Diagnostic JSON.

## Definition of Done
- [ ] All 	est/pipeline.test.js unit tests passing.
- [ ] Pipeline runs fully non-destructively (source files unmodified).
- [ ] Performance benchmark shows >50% reduction in processing time for a cached directory.
