# Sprint 3: Automation, Delivery Surfaces, and CLI UX

## Overview
This sprint focuses on the outward-facing reliability and usability of the bot. It introduces automated testing pipelines, expanded export formats for data scientists, and power-user terminal controls.

## 🛠️ Task 1: Continuous Integration (CI/CD)
- [x] Create .github/workflows/test.yml to trigger on push and pull_request.
- [x] Configure the action to run npm ci and npm test across latest Node.js versions.
- [x] Ensure the action verifies npm run docs:check to enforce documentation standards.

## ✨ Task 2: CSV Data Export Generation
- [x] Create src/delivery/csv-generator.js.
- [x] Implement flat-mapping logic to translate nested Diagnostic and Predictive JSON arrays into tabular CSV rows.
- [x] Update src/index.js to accept --format=csv and route the JSON telemetry to the new generator.

## 🛠️ Task 3: Advanced CLI Argument Parsing
- [x] Implement a lightweight argument parser in src/index.js.
- [x] Add --clear-cache to delete the local .analytics_cache.json before a run.
- [x] Add --workers=<num> to allow users to override default OS CPU core limits.

## Definition of Done
- [x] GitHub Actions badge displays "Passing" on the README.
- [x] Running with --format=csv outputs a valid, spreadsheet-readable file in the data_exports directory.
- [x] npm run docs:generate is updated to reflect the new command-line flags.
