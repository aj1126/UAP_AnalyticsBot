# Task Completion Verification Gates

Execute these gates before marking any feature, bug fix, or refactor complete:

1. **Unit & Integration Test Suite**:
   ```powershell
   npm test
   ```
   Must pass with 100% tests green and no unhandled promise rejections.

2. **E2E Simulation Pipeline**:
   ```powershell
   node verify.js
   ```
   Must pass all 7 validation steps (Ingestion, DB, Webhook Parsing, Drift Alerts, Handoffs, Metrics Summary).

3. **Documentation Integrity Gate**:
   ```powershell
   npm run docs:check
   ```
