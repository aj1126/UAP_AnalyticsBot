# System Architecture: UAP AnalyticsBot

## Current Implementation

The repository currently ships a Node.js CLI-centered analytics flow:

1. **CLI Orchestrator (`src/index.js`)** resolves the source directory and writes the final report to stdout.
2. **Read-Only Ingestion (`src/ingestion/file-ingestion.js`)** recursively scans supported text files, streams file content, and extracts words, dates, locations, and filesystem metadata.
3. **Analytics Pipeline (`src/pipeline.js`)** builds the descriptive, diagnostic, predictive, and prescriptive tiers from the ingested file set.
4. **Output Layer** returns a single structured JSON report for the requested directory.

## Current Runtime Boundaries

Implemented today:

- recursive read-only ingestion for `.txt`, `.md`, `.json`, `.csv`, and `.log`
- tokenization plus lightweight date/location extraction
- descriptive, diagnostic, predictive, and prescriptive analytics modules
- JSON report delivery through the Node CLI

Not yet implemented in the active system:

- binary or multimedia extraction
- Named Entity Recognition (NER)
- dashboard or alternate export formats
- background scheduling or directory watching

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
