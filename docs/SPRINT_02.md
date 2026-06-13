# Sprint 2: Entity Unification and Semantic Cross-Linking

## Overview
This sprint introduces string entity normalization loops to prevent metadata token fragmentation and establishes cross-document vector mapping using similarity metrics.

## 🛠️ Task 1: Named Entity Token Unification (NLP)
- [ ] Refactor xtractLocations in src/ingestion/file-ingestion.js to clear formatting symbols and possessives.
- [ ] Enforce upper or title-case uniformity over extracted proper noun objects before array set compilation.

## 🛠️ Task 2: Cosine Similarity Scoring Nodes (Diagnostic Tier)
- [ ] Create a vector generator module inside src/analytics/diagnostic.js.
- [ ] Calculate a multi-dimensional matrix cross-referencing document vectors based on unique TF-IDF weights.
- [ ] Append a elatedDocuments array listing high-correlation file matches into individual descriptive metadata blocks.

## ✨ Task 3: Nonlinear Forecasting Tweaks (Predictive Tier)
- [ ] Refactor orecastNextValue in src/analytics/predictive.js to replace standard linear delta metrics with weighted moving averages.
- [ ] Adjust time-series arrays to support empty intervals gracefully when data contains chronological gaps.

## Definition of Done
- [ ] Test cases validate that casing discrepancies (e.g., 'Roswell' vs 'ROSWELL') match safely.
- [ ] The CLI output provides semantic vector cross-references in the final JSON payload.
- [ ] All 
pm run docs:generate checkpoints complete successfully.
