---
description: "Update README.md to reflect current implementation and usage in UAP AnalyticsBot"
name: "Update README"
argument-hint: "What changed that README should include?"
agent: "agent"
---
Update [README.md](../../README.md) to match the current state of this repository.

Use this workflow:
1. Inspect the code and docs to identify behavior, CLI usage, dependencies, and architecture status.
2. Revise only the sections that are now inaccurate or incomplete.
3. Preserve the core domain framing: Ingest -> Analyze -> Report.
4. Keep the analytics tiers explicitly categorized as Descriptive, Diagnostic, Predictive, and Prescriptive.
5. Preserve the non-destructive guarantee: source folder operations are read-only.

Output requirements:
- Edit [README.md](../../README.md) directly.
- Keep language concise, technically accurate, and contributor-friendly.
- Prefer incremental edits over full rewrites unless requested.
- Keep setup and usage examples runnable on Windows PowerShell.

Input from user:
- {{$ARGUMENTS}}

If user input is empty, infer updates from repository changes and refresh the most likely outdated sections (implementation status, usage, supported types, and architecture notes).
