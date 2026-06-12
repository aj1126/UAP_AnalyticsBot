---
description: "Implement NLP Extraction in file-ingestion.js"
name: "Execute Roadmap Stage 1"
agent: "agent"
---
Implement Stage 1 from `docs/ROADMAP.md` into `src/ingestion/file-ingestion.js`.

Use this workflow:
1. Inspect `src/ingestion/file-ingestion.js`. Notice the regex implementations for `extractDates` and `extractLocations`.
2. Replace these functions using the `compromise` NLP library.
3. Keep the function signatures the same. They must return an array of strings.
4. Maintain the non-destructive, read-only architectural rules.
5. Do not alter the async stream processing logic, only the text extraction logic.

Output requirements:
- Edit `src/ingestion/file-ingestion.js` directly.
- Ensure the changes pass the existing tests in `test/pipeline.test.js`.