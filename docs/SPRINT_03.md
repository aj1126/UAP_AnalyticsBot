# Sprint 3: Automation, Delivery Surfaces, and CLI UX

## Overview
This sprint focuses on the outward-facing reliability and usability of the bot. It introduces automated testing pipelines, expanded export formats for data scientists, and power-user terminal controls.

## 🛠️ Task 1: Continuous Integration (CI/CD)
- [ ] Create .github/workflows/test.yml to trigger on push and pull_request.
- [ ] Configure the action to run 
pm ci and 
pm test across latest Node.js versions.
- [ ] Ensure the action verifies 
pm run docs:check to enforce documentation standards.

## ✨ Task 2: CSV Data Export Generation
- [ ] Create src/delivery/csv-generator.js.
- [ ] Implement flat-mapping logic to translate nested Diagnostic and Predictive JSON arrays into tabular CSV rows.
- [ ] Update src/index.js to accept --format=csv and route the JSON telemetry to the new generator.

## 🛠️ Task 3: Advanced CLI Argument Parsing
- [ ] Implement a lightweight argument parser in src/index.js.
- [ ] Add --clear-cache to delete the local .analytics_cache.json before a run.
- [ ] Add --workers=<num> to allow users to override default OS CPU core limits.

## Definition of Done
- [ ] GitHub Actions badge displays "Passing" on the README.
- [ ] Running with --format=csv outputs a valid, spreadsheet-readable file in the data_exports directory.
- [ ] 
pm run docs:generate is updated to reflect the new command-line flags.
