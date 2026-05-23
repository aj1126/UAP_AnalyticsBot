# UAP AnalyticsBot

## Core Loop: Ingest → Analyze → Report

The UAP AnalyticsBot operates on a continuous three-stage pipeline:

1. **Ingest**: Collects and ingests raw data from various sources into the analytics pipeline
2. **Analyze**: Processes ingested data to extract insights, identify patterns, and perform computations
3. **Report**: Generates and distributes analytical reports to stakeholders

This cycle repeats continuously, enabling real-time analytics and monitoring of UAP-related information.

## Initial implementation

The repository now contains a minimal Node.js implementation that:

- walks a source directory in read-only mode
- streams supported text files for ingestion
- produces descriptive, diagnostic, predictive, and prescriptive analytics in JSON

### Usage

```bash
npm start -- /absolute/path/to/source-folder
```

### Testing

```bash
npm test
```
