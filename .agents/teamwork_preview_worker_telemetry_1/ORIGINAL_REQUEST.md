## 2026-06-19T13:42:25Z
Your working directory is: E:\Repos\UAP_AnalyticsBot\.agents\teamwork_preview_worker_telemetry_1
Your task is to implement the UAP_AnalyticsBot telemetry extension following the designs from our explorers.

1. Read the research and designs in:
   - E:\Repos\UAP_AnalyticsBot\.agents\teamwork_preview_explorer_telemetry_1\handoff.md (hybrid node:sqlite / JSON DB layer)
   - E:\Repos\UAP_AnalyticsBot\.agents\teamwork_preview_explorer_telemetry_2\handoff.md (webhook shapes, math formulations, drift rulesets)
   - E:\Repos\UAP_AnalyticsBot\.agents\teamwork_preview_explorer_telemetry_3\handoff.md (simulated handoff function, verify.js script, and test/telemetry.test.js)

2. Implement these files:
   - `src/telemetry/db.js`
   - `src/telemetry/ingestion.js`
   - `src/telemetry/analytics.js`
   - `src/telemetry/handoff.js`
   - `verify.js` (at project root)
   - `test/telemetry.test.js`

3. Run the test suite: `npm test` using run_command.
4. Run the E2E verification script: `node verify.js` using run_command.
5. Verify test coverage is at least 80% using the native coverage output.
6. Write your output/results to your `handoff.md` (E:\Repos\UAP_AnalyticsBot\.agents\teamwork_preview_worker_telemetry_1\handoff.md).

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Once done, send a message back to the orchestrator (conversation ID: 69261d7e-1c62-4494-a793-2616af08613e).
