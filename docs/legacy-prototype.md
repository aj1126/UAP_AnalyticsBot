# Legacy Python Prototype

This document preserves the historical Python ingestion prototype so the main README can stay focused on the active Node.js CLI.

## Status

The Python prototype is a legacy reference. It is not the primary execution path for the current repository and is not part of the active Node analytics pipeline.

## Legacy Scope

The prototype in `/tmp/workspace/aj1126/UAP_AnalyticsBot/ingestion.py` provided:

- recursive directory scanning with asynchronous generators
- supported file type filtering for `.pdf`, `.mp4`, `.jpg`, `.jpeg`, and `.png`
- a manual CLI trigger with an explicit folder argument
- file discovery output for downstream processing concepts
- read-only behavioral guarantees

## Legacy Setup

Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Legacy Usage

Run the prototype against a folder path:

```powershell
python ingestion.py "C:\path\to\source_folder"
```

Show CLI help:

```powershell
python ingestion.py -h
```

## Legacy Runtime Behavior

On a successful run, the prototype:

1. Prints a scan banner.
2. Prints a separator line.
3. Lists each matching file as `[FOUND] <name>`.
4. Prints a "no supported files" message when nothing matches.
5. Exits with code `0`.

If the folder does not exist, it prints an error and exits with code `1`.

## Legacy Dependencies

`requirements.txt` captures the exploratory Python dependency set, including analytics, OCR, and multimedia libraries associated with the prototype direction.

## Relationship to the Active System

- Use the Node CLI in [README.md](../README.md) for current execution.
- Use [docs/architecture.md](architecture.md) for the current-vs-planned architecture.
- Keep this document only for historical context or future migration analysis.
