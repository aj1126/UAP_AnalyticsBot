# Learned Security Pipeline & Incident Remediation Playbook

**Origin**: Ingested from `.agy/LEARNED_PATTERNS.md` (Project: `UAPBot` / `UAP_AnalyticsBot`)  
**Scope**: Universal Security Toolchain (Gitleaks, Semgrep, Trivy, Renovate), GitHub Actions CI/CD Hardening, and Agent Code-Delivery Protocols.

---

## 1. Zero-Cost Open-Source Security Toolchain Reference

| Security Domain | Tool Selected | Execution Scope | Configuration / Artifact |
| :--- | :--- | :--- | :--- |
| **Secrets Scanning** | **Gitleaks** | Commit history, staging area, CI pull requests | `.gitleaks.toml` allowlist |
| **SAST & Quality** | **Semgrep OSS** | Application code (JS/TS/Python/C#), workflow YAMLs | `semgrep scan --config auto` |
| **SCA & IaC** | **Aqua Trivy** | Dependencies (`package-lock.json`, etc.), configs | `trivy fs`, `trivy config` |
| **Dependency PRs** | **Renovate Bot** | Automated scheduled dependency updates | `renovate.json` |

---

## 2. Identified Incident Patterns & Diagnostic Runbooks

### Pattern A: Trivy Docker Credential Lookup Failure
- **Symptom**: `FATAL DB error: OCI repository error: exec: "docker-credential-desktop": executable file not found in %PATH%`.
- **Root Cause**: Trivy inspects default Docker configuration directories when pulling vulnerability databases from OCI registries (`mirror.gcr.io/aquasec/trivy-db`). If Docker Desktop is stopped or uninstalled, the credential store helper fails.
- **Remediation**: Override `DOCKER_CONFIG` in the PowerShell session to point to `$env:TEMP` before invoking Trivy:
  ```powershell
  $env:DOCKER_CONFIG = "$env:TEMP"
  trivy fs --scanners vuln .
  ```

---

### Pattern B: Workflow Shell-Injection Vulnerability
- **Symptom**: Semgrep rule `yaml.github-actions.security.run-shell-injection` triggers blocking findings in release workflows.
- **Root Cause**: Directly interpolating untrusted GitHub context variables (e.g., `${{ github.ref_name }}`) inside inline script blocks (`run: |`) enables arbitrary shell injection.
- **Anti-Pattern**:
  ```yaml
  run: |
    gh release create ${{ github.ref_name }} --title "Release ${{ github.ref_name }}"
  ```
- **Corrective Pattern (Environment Variable Indirection)**:
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
- **Symptom**: Semgrep rule `github-actions-mutable-action-tag` flags floating tags (`@v4`, `@v1.1`).
- **Root Cause**: Git tags can be force-updated upstream if maintainer accounts are compromised.
- **Remediation**: Pin actions to immutable 40-character commit SHAs with version annotations:
  ```yaml
  uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
  ```

---

### Pattern D: Gitleaks Virtual Environment False Positives
- **Symptom**: Gitleaks scans index cryptographic test keys inside third-party dependencies (`.venv/Lib/site-packages/...` for `numpy`, `torch`, `cryptography`, `pypdfium2`).
- **Root Cause**: Virtual environments tracked or indexed in Git expose upstream mock secrets.
- **Remediation**:
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

### Pattern E: Transitive Dependency Vulnerability Remediation
- **Symptom**: High-severity DoS vulnerability flagged on nested/transitive dependencies (e.g., `brace-expansion <= 1.1.17`).
- **Remediation Workflow**:
  ```powershell
  # 1. Patch lockfile
  npm audit fix

  # 2. Verify dev-dependencies are clean via Trivy
  trivy fs --scanners vuln --include-dev-deps .

  # 3. Verify regression test suite
  npm test
  ```

---

## 3. Agent Modular Payload Delivery Protocol

When generating multi-line markdown documents or scripts containing nested code fences:
1. **Never dump unbuffered nested markdown blocks** directly into conversational chat.
2. **Chunk into single-quoted PowerShell here-strings** (`@'...'@`) in scratch scripts or atomic tool calls (`write_to_file`, `replace_file_content`) to prevent expansion errors and premature UI truncation.