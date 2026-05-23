# UAP AnalyticsBot

## Core Loop: Ingest -> Analyze -> Report

UAP AnalyticsBot is a file-first analytics system built around a repeatable three-stage loop:

1. **Ingest**: Discover source files from a target folder using read-only access.
2. **Analyze**: Extract and model text + metadata into analytics outputs.
3. **Report**: Produce structured summaries and recommendations for decision-making.

This loop is the domain model Copilot should assume when assisting in this repository.

## Analytics Scope

The analysis stage is intentionally split into four tiers:

1. **Descriptive**: What happened? (term frequencies, glossaries, dates, locations)
2. **Diagnostic**: Why did it happen? (correlations across terms, dates, and locations)
3. **Predictive**: What is likely to happen? (trend forecasting from historical timestamps)
4. **Prescriptive**: What should we do? (actionable recommendations and data-quality flags)

## Current Implementation Status

The repository currently includes the **Ingestion Engine** as the executable entry point:

- Recursively scans a source directory
- Filters supported file types
- Emits discovered files for downstream processing
- Enforces non-destructive, read-only behavior on source data

Planned modules (Extraction, NLP/NER, full Analytics Engine, and reporting output layer) are documented in `docs/architecture.md`.

## Supported File Types

Current ingestion scan targets:

- `.pdf`
- `.mp4`
- `.jpg`
- `.jpeg`
- `.png`

## Setup

### 1) Create and activate a virtual environment

Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### 2) Install dependencies

```powershell
pip install -r requirements.txt
```

## Usage

Run ingestion against a folder path:

```powershell
python ingestion.py "C:\path\to\source_folder"
```

You can also run with a relative path:

```powershell
python ingestion.py .\data
```

## Expected Runtime Behavior

On a successful run, the CLI:

1. Prints a scan banner
2. Lists each matching file as `[FOUND] <name>`
3. Exits with code `0`

If the folder does not exist, it prints an error and exits with code `1`.

## Non-Destructive Guarantee

The bot must never modify, move, or delete ingested source files. Ingestion is read-only by design.

## Repository Layout

```text
.
|- ingestion.py
|- requirements.txt
|- README.md
`- docs/
	`- architecture.md
```

## Architecture Reference

See `docs/architecture.md` for the planned full pipeline:

1. Ingestion Engine
2. Extraction Node
3. NLP + Entity Recognition
4. Analytics Engine (Descriptive, Diagnostic, Predictive, Prescriptive)
5. Output Layer (JSON/dashboard)

## Notes for Contributors and Copilot

- Keep ingestion logic modular and separate from analytics logic.
- Prefer asynchronous and streaming patterns for large datasets.
- Preserve strict read-only behavior for source directories.
- When adding analytics, classify behavior under one of the four analytics tiers.
