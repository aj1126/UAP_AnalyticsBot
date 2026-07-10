# Copilot to Gemini Migration Playbook

This playbook implements a staged migration from GitHub Copilot workflows to Google Gemini workflows, without a hard cutover.

## 1) Inventory Current Copilot Usage

Capture every Copilot touchpoint before changing tooling:

- IDE autocomplete and inline chat usage
- PR review and comment workflows
- CLI/agent task usage
- Prompt snippets and instruction files
- Memory/workflow habits that affect quality gates

Use this checklist:

- [ ] List Copilot-powered IDE features currently used by the team.
- [ ] List Copilot-specific automation in CI, PR review, and developer scripts.
- [ ] List reusable prompts and review checklists to preserve.
- [ ] Define baseline metrics: cycle time, defect rate, CI failure rate, and review turnaround time.

## 2) Map Use Cases to Google Tooling

Use a one-to-one replacement matrix:

| Current Need | Target Google Tooling | Migration Goal |
| --- | --- | --- |
| Inline code completion and chat in IDE | Gemini Code Assist | Replace day-to-day coding assistance |
| Scripted generation, analysis, and automation | Gemini API / AI Studio / Vertex AI | Replace Copilot-specific automation |
| Prompt playbooks and guardrails | Shared Gemini prompt library | Preserve quality and consistency |

Notes:

- Keep repo quality controls unchanged (`npm test`, `npm run docs:check`) during tool migration.
- Replace only assistant/provider dependencies, not project validation standards.

## 3) Parallel Run (1-2 Weeks)

Run Gemini as the default while retaining Copilot as fallback.

Track these metrics daily:

- Output correctness against existing tests
- Delivery speed (task completion time)
- PR review quality (rework/defect escape)
- CI impact (new failure patterns)

Exit criteria:

- [ ] No regression in test pass rate.
- [ ] No sustained regression in review quality.
- [ ] Team can complete primary workflows with Gemini as default.

## 4) Migrate Prompts and Instructions

Create a shared Gemini playbook with these sections:

1. Task framing template (goal, constraints, acceptance criteria)
2. Validation template (tests/checks required before completion)
3. Review template (risk, edge cases, rollback notes)

Minimum migration checklist:

- [ ] Port high-value Copilot prompts to Gemini-friendly templates.
- [ ] Recreate security and test guardrails as explicit Gemini instructions.
- [ ] Version control the playbook and require updates in PRs when workflows change.

## 5) Cut Over

After parallel-run exit criteria are met:

- Disable Copilot IDE extensions in team/dev environment baselines.
- Disable Copilot org policy access where applicable.
- Remove Copilot billing seats.
- Keep a short rollback window with a named owner and deadline.

## 6) Stabilize (2-4 Weeks)

Post-cutover, review:

- Productivity trend vs. baseline
- Defect trend vs. baseline
- CI stability and review latency

Then:

- [ ] Retune Gemini prompts/playbook where gaps appear.
- [ ] Archive outdated Copilot-only docs and references.
- [ ] Keep migration status visible in team operations docs until stable.

## Open Item: "Google Antigravity"

No generally available Google developer product is currently identified as "Google Antigravity" in this repository context.

Action:

- [ ] Confirm the exact product name or internal tool reference.
- [ ] Add a mapping section to this playbook once confirmed.
