# File: SECURITY.md
# Security Policy & CI Pipeline Architecture

## Supported Versions

| Version | Supported          |
| :------ | :----------------- |
| 1.0.x   | :white_check_mark: |
| < 1.0.0 | :x:                |

## Reporting a Vulnerability

Please do not report security vulnerabilities through public GitHub issues. If you discover a potential security flaw in this repository:

1. Email the maintainer directly at `AJJUKES1126@gmail.com`.
2. Include a detailed description of the vulnerability, steps to reproduce, and potential impact.
3. Allow up to 48 hours for an initial response before taking further action.

---

## Open-Source CI/CD Security Architecture

This repository utilizes a multi-layered, low-cost security stack to enforce secrets scanning, static analysis (SAST), Software Composition Analysis (SCA), and infrastructure validation.

| Tool | Target Scope | Primary Function |
| :--- | :--- | :--- |
| **Gitleaks** | Git History & Diffs | Secrets & Credential Detection |
| **Semgrep OSS** | JS/Node.js Codebase | Static Application Security Testing (SAST) |
| **Trivy** | NPM Dependencies & Config | Vulnerability Scanner (SCA) & IaC Auditing |

### 1. Secrets Detection (Gitleaks)
* **Scope**: Scans all tracked files, commit history, and staged commits for exposed keys, tokens, and credentials.
* **Allowlist Management**: Configured via `.gitleaks.toml` at the repository root.
* **Suppression Logic**: Third-party Python dependencies (`.venv/Lib/site-packages/...`) containing cryptographic test vectors (e.g., `numpy`, `torch`, `cryptography`, `pypdfium2`) are explicitly ignored to eliminate false positives while preserving strict scanning across application code.

### 2. Static Application Security Testing (Semgrep OSS)
* **Scope**: Evaluates JavaScript/Node.js, workflow YAMLs, and server scripts against standard security rulesets.
* **Rulesets Applied**: `p/default`, `p/javascript`, `p/github-actions`.
* **Zero-Trust Rules**: Identifies code injection, unsafe deserialization, shell command injections, and insecure file system operations.

### 3. Software Composition Analysis & Misconfiguration (Trivy)
* **Scope**: Scans `package-lock.json` and directory manifests for known CVEs.
* **Configuration Auditing**: Evaluates infrastructure-as-code and configuration targets for security policy violations.

---

## Remediation & Hardening Audit Log

### 1. `.venv` Cryptographic Test Vector Remediation
* **Issue**: Gitleaks flagged 11 findings inside `.venv` site-packages (`numpy`, `torch`, `cryptography`).
* **Fix**: Added `.gitleaks.toml` with path rules blocking vendor and virtual environment directories. Removed `.venv` from the Git tracking index and added it to `.gitignore`.

### 2. Workflow Shell-Injection Elimination
* **Issue**: GitHub Actions variables referenced inline within PowerShell execution blocks allowed potential injection risks.
* **Fix**: Enforced environment variable indirection (`$env:RELEASE_TAG = "${{ github.ref_name }}"`) across release workflows to isolate context untrusted input.

### 3. Action Supply-Chain Pinning
* **Issue**: GitHub Actions pinned to floating tags (e.g., `@v4`) are susceptible to upstream tag-mutability attacks.
* **Fix**: Actions pinned to immutable 40-character commit SHAs (e.g., `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683`).

---

## Local Auditor Runbook (Windows PowerShell)

Run these commands locally prior to committing code or pushing releases.

### 1. Run Secrets Scan
```powershell
# Verify zero unflagged leaks across entire git history
gitleaks detect --config .gitleaks.toml --verbose
```
### 2. Run SAST Code Audit
```powershell
# Run Semgrep OSS auto-configured ruleset
semgrep scan --config auto
```
### 3. Run Vilnerability & Config Audit
```powershell
# Temporary environment override to bypass Docker Desktop lookup issues on Windows
$env:DOCKER_CONFIG = "$env:TEMP"

# Scan file system for package vulnerabilities
trivy fs --scanners vuln .

# Scan misconfigurations
trivy config .
```
