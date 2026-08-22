# Learning Proposal v4 — Session 2026-08-22 (UAPBot Setup & Action Pinning)

## Summary of Recent Behaviors & Invariants Identified

During this session, we completed the Antigravity & Serena project setup for `UAPBot`, performed memory indexing, ingested the learned pattern playbook into cross-project knowledge layers, resolved a GitHub Actions resolution failure, and verified/committed all workflows.

The following three core operational guardrails were discovered and isolated for codification:

---

## 1. Classification Matrix

| # | Type | Name | Target File | Status |
|---|---|---|---|---|
| 1 | **Rule** | GitHub Actions Commit SHA Verification Protocol | `~/.gemini/GEMINI.md` | ⬜ Proposed |
| 2 | **Rule** | Serena Cross-Project Memory Prefix Invariant | `~/.gemini/GEMINI.md` | ⬜ Proposed |
| 3 | **Rule** | Project Rename & Template Metadata Sweep Protocol | `~/.gemini/GEMINI.md` | ⬜ Proposed |
| 4 | **Memory** | Global Security & Payload Delivery Memories | `.serena/memories/global/*` | ✅ Applied during session |
| 5 | **Knowledge** | Ingested Security & Incident Playbook | `~/.gemini/antigravity/knowledge/*` | ✅ Applied during session |

---

## 2. Proposed Rule Additions (`~/.gemini/GEMINI.md`)

```diff
+  - **GitHub Actions Commit SHA Verification Protocol:** When pinning GitHub Actions to immutable 40-character commit SHAs in `.github/workflows/*.yml`, never construct arbitrary or unverified hashes. Always query upstream action tags via `git ls-remote --tags https://github.com/<owner>/<repo> "*<tag>*"` to confirm exact SHA existence prior to editing workflow files. This prevents `Unable to resolve action, repository or version not found` validation errors in IDEs and CI runners.
+  - **Serena Cross-Project Memory Prefix Invariant:** When saving universal security playbooks, troubleshooting runbooks, or cross-cutting engineering conventions into Serena MCP, always namespace the memory under the `global/` prefix (e.g. `global/security_pipeline_patterns`, `global/agent_modular_payload_delivery`). Local domain memories must remain unprefixed (e.g. `core`, `conventions`, `telemetry/core`).
+  - **Project Rename & Template Metadata Sweep Protocol:** When renaming a repository or initializing a workspace from a template, perform an AST/grep sweep across `.github/workflows/` (specifically release note scripts, PR title generators, and package descriptors) to replace legacy boilerplate strings with the canonical project name before executing pre-exit or commit gates.
```

---

## 3. Rationale & Analysis

1. **GitHub Actions SHA Verification**:
   - *Problem*: In `pr-opened.yml`, `actions/add-to-project@10b9af2db54e580e214d0f507ba918be750b372f` failed action resolution because `10b9af...` was non-existent.
   - *Fix*: Running `git ls-remote --tags https://github.com/actions/add-to-project` isolated the real `v1.0.2` SHA `244f685bbc3b7adfa8466e08b698b5577571133e`. Codifying this protocol guarantees all automated action pinning remains valid and testable.

2. **Serena Global Memory Namespace**:
   - *Problem*: Project-level memories are local to `B:\Repos\UAP_AnalyticsBot\.serena\memories\`.
   - *Fix*: Using the `global/` prefix allows Serena to index patterns across all Antigravity projects on the machine.

3. **Template Metadata Sweep**:
   - *Problem*: `.github/workflows/release.yml` contained a legacy reference to `Winget Diagnostic Tool` in the release note script heredoc.
   - *Fix*: Establishing a systematic sweep during project setup ensures zero leftover template identifiers.

---

## 4. Staging & Execution Plan (Post-Approval)

Upon user approval:
1. Run `Backup-GlobalConfigs.ps1` before any global config mutations.
2. Apply the 3 new rules to `~/.gemini/GEMINI.md` (UTF-8 no-BOM).
3. Mirror `GEMINI.md` to `B:\Repos\dotfiles\dot-gemini\GEMINI.md`.
4. Copy `learning_proposal.md` to `.agents/plans/learning_proposal.md` and `~/.gemini/antigravity/knowledge/learning_proposal.md`.
5. Quad-sync `DEVELOPER_LOG.md` across all 4 targets.
6. Commit & push dotfiles and workspace repos.
