---
description: "Update README.md and related docs to reflect the current implementation in UAP AnalyticsBot"
name: "Update README"
argument-hint: "What changed that the active docs should include?"
agent: "agent"
---
Update the active documentation set to match the current state of this repository.

Use this workflow:
1. Inspect the code and docs to identify behavior, CLI usage, dependencies, and architecture status.
2. Revise only the sections that are now inaccurate or incomplete.
3. Preserve the core domain framing: Ingest -> Analyze -> Report.
4. Keep the analytics tiers explicitly categorized as Descriptive, Diagnostic, Predictive, and Prescriptive.
5. Preserve the non-destructive guarantee: source folder operations are read-only.
6. Keep [docs/architecture.md](../../docs/architecture.md) hand-authored and aligned with current-vs-planned system boundaries.
7. Keep Python prototype details in [docs/legacy-prototype.md](../../docs/legacy-prototype.md), not in the main README.
8. If command reference, supported file types, or repo layout metadata changed, update [docs/docs-source.json](../../docs/docs-source.json) and regenerate README via `npm run docs:generate`.

Output requirements:
- Edit [README.md](../../README.md) directly.
- Update related docs when needed.
- Keep language concise, technically accurate, and contributor-friendly.
- Prefer incremental edits over full rewrites unless requested.
- Keep narrative docs hand-authored and generated sections bounded.

Input from user:
- {{$ARGUMENTS}}

If user input is empty, infer updates from repository changes and refresh the most likely outdated sections (implementation status, usage, supported types, architecture notes, and legacy Python references).
