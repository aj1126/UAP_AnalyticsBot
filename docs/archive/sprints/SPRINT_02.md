# Sprint 2: Entity Unification and Semantic Cross-Linking

## Overview
This sprint introduces string entity normalization loops to prevent metadata token fragmentation and establishes cross-document vector mapping using similarity metrics.

## 🛠️ Task 1: Named Entity Token Unification (NLP)
- [x] Refactor extractLocations in src/ingestion/file-ingestion.js to clear formatting symbols and possessives.
- [x] Enforce upper or title-case uniformity over extracted proper noun objects before array set compilation.

## 🛠️ Task 2: Cosine Similarity Scoring Nodes (Diagnostic Tier)
- [x] Create a vector generator module inside src/analytics/diagnostic.js.
- [x] Calculate a multi-dimensional matrix cross-referencing document vectors based on unique TF-IDF weights.
- [x] Append a relatedDocuments array listing high-correlation file matches into individual descriptive metadata blocks.

## ✨ Task 3: Nonlinear Forecasting Tweaks (Predictive Tier)
- [x] Refactor forecastNextValue in src/analytics/predictive.js to replace standard linear delta metrics with weighted moving averages.
- [x] Adjust time-series arrays to support empty intervals gracefully when data contains chronological gaps.

## Definition of Done
- [x] Test cases validate that casing discrepancies (e.g., 'Roswell' vs 'ROSWELL') match safely.
- [x] The CLI output provides semantic vector cross-references in the final JSON payload.
- [x] All npm run docs:generate checkpoints complete successfully.
