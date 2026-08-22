# Artifact: Antigravity Session Context & Problem-Pattern Playbook

**Target Destination:** `.agy/LEARNED_PATTERNS.md` (or direct ingest into Antigravity context memory)

**Scope:** Security Pipeline Hardening, Incident Remediation, CI/CD Standards, and Agent Code-Delivery Protocols.

---

## 1. Architectural Decisions & Stack Composition

To replace proprietary monolithic scanners (e.g., Snyk), the repository uses a modular, zero-cost, open-source security toolchain:

| Security Domain | Tool Selected | Execution Scope | Configuration / Artifact |
| --- | --- | --- | --- |
| **Secrets Scanning** | **Gitleaks** | Commit history, staging area, CI pull requests | `.gitleaks.toml` allowlist |
| **SAST & Quality** | **Semgrep OSS** | Application code (JS/Node), workflow YAMLs | `semgrep scan --config auto` |
| **SCA & IaC** | **Aqua Trivy** | Dependencies (`package-lock.json`), configs | `trivy fs`, `trivy config` |
| **Dependency PRs** | **Renovate Bot** | Automated scheduled dependency updates | `renovate.json` |

---

## 2. Identified Incident Patterns & Diagnostic Runbooks

### Pattern A: Trivy Docker Credential Lookup Failure

* **Symptom:** `FATAL DB error: OCI repository error: exec: "docker-credential-desktop": executable file not found in %PATH%`.
* **Root Cause:** Trivy inspects default Docker configuration directories when pulling vulnerability databases from OCI registries (`mirror.gcr.io/aquasec/trivy-db`). If Docker Desktop is stopped or uninstalled, the credential store helper fails.
* **Remediation:** Override `DOCKER_CONFIG` in the PowerShell session to point to `$env:TEMP` before invoking Trivy:
```powershell
$env:DOCKER_CONFIG = "$env:TEMP"
trivy fs --scanners vuln .

```



---

### Pattern B: Workflow Shell-Injection Vulnerability

* **Symptom:** Semgrep rule `yaml.github-actions.security.run-shell-injection` triggers blocking findings in release workflows.
* **Root Cause:** Directly interpolating untrusted GitHub context variables (e.g., `${{ github.ref_name }}`) inside inline script blocks (`run: |`) enables arbitrary shell injection.
* **Anti-Pattern:**
```yaml
run: |
  gh release create ${{ github.ref_name }} --title "Release ${{ github.ref_name }}"

```


* **Corrective Pattern (Environment Variable Indirection):**
```yaml
env:
  RELEASE_TAG: ${{ github.ref_name }}
steps:
  - name: Create Release
    shell: pwsh
    run: |
      gh release create "$env:RELEASE_TAG" --title "Release $env:RELEASE_TAG"

```



---

### Pattern C: GitHub Actions Supply-Chain Tag Mutability

* **Symptom:** Semgrep rule `github-actions-mutable-action-tag` flags floating tags (`@v4`, `@v1.1`).
* **Root Cause:** Git tags can be force-updated upstream if maintainer accounts are compromised.
* **Remediation:** Pin actions to immutable 40-character commit SHAs with version annotations:
```yaml
uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2

```



---

### Pattern D: Gitleaks Virtual Environment False Positives

* **Symptom:** Gitleaks scans index cryptographic test keys inside third-party dependencies (`.venv/Lib/site-packages/...` for `numpy`, `torch`, `cryptography`, `pypdfium2`).
* **Root Cause:** Virtual environments tracked or indexed in Git expose upstream mock secrets.
* **Remediation:**
1. Add `.gitleaks.toml` with regex path exclusions:
```toml
[allowlist]
description = "Ignore vendor and virtual environment directories"
paths = [
  '''^\.venv/''',
  '''^venv/''',
  '''^node_modules/''',
  '''^bin/''',
  '''^obj/'''
]

```


2. Untrack `.venv` from Git index: `git rm -r --cached .venv` and append to `.gitignore`.



---

### Pattern E: Transitive Dependency Vulnerability (CVE-2026-69152)

* **Symptom:** High-severity DoS vulnerability flagged on `brace-expansion <= 1.1.17` by Dependabot and `npm audit`.
* **Remediation Workflow:**
```powershell
# 1. Patch lockfile
npm audit fix

# 2. Verify dev-dependencies are clean via Trivy
trivy fs --scanners vuln --include-dev-deps .

# 3. Verify regression test suite
npm test

```



---

## 3. Agent Delivery & Formatting Protocol

When generating multi-line markdown files containing nested code blocks, tables, or complex shell scripts:

### The Chat-Render Failure Mode

Delivering complete markdown documents containing embedded markdown fences (`````) inside standard chat code blocks causes the markdown renderer to collapse prematurely, cutting off outputs and breaking copy-paste workflows.

### The Standard Delivery Solution: Modular PowerShell Payloads

Chunk large files into PowerShell here-string payloads executed via `Set-Content` and `Add-Content`.

```powershell
# Part 1: Header and Initial Sections
$part1 = @'
# Target File Content Line 1
# Target File Content Line 2
'@
Set-Content -Path "path/to/target.ext" -Value $part1 -Encoding utf8

# Part 2: Subsequent Sections
$part2 = @'
## Next Section
- Item 1
- Item 2
'@
Add-Content -Path "path/to/target.ext" -Value $part2 -Encoding utf8

```

---

## 4. Repository State & Quality Gate Reference

| Gate / Metric | Value | Verification Command |
| --- | --- | --- |
| **Unit / Integration Tests** | 39 Passed / 0 Failed | `npm test` |
| **Line Coverage Baseline** | 86.54% | `node --test --experimental-test-coverage` |
| **Doc Sync Verification** | Passing | `npm run docs:check` |
| **Secrets Status** | 0 Leaks | `gitleaks detect --config .gitleaks.toml` |
| **SAST Status** | 0 Blocking Findings | `semgrep scan --config auto` |
| **SCA / CVE Status** | 0 Vulnerabilities | `trivy fs --scanners vuln --include-dev-deps .` |

---

## 5. Agent Operational Directives for `agy`

1. **OS Target**: Windows 11 only. Generate execution scripts strictly for PowerShell (`pwsh`) or Command Prompt (`cmd`). Never provide Bash syntax.
2. **Persistence Boundary**: Use native `node:sqlite` within `src/telemetry/db.js` and JSON storage for pool manifests (`uap_datapools.json`).
3. **Commit Gate Protocol**: Always execute documentation generation (`scripts/generate-docs.js`) and tests prior to finalizing commits. Ensure the pre-commit hook runs `gitleaks` and `semgrep`.