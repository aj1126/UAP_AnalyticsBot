# Project Rules: UAP_AnalyticsBot Telemetry Extension

## Worker Thread Management

- **Defer Worker Termination:** When terminating a `worker_threads` Worker instance inside any of its own event callbacks (`message`, `error`, etc.), always wrap `worker.terminate()` in `setImmediate()` or `setTimeout()` to allow the callback execution stack to unwind before destroying the V8 isolate. This prevents segmentation faults/access violations (exit code `3221225477` / `0xC0000005`), especially when running under test coverage/test runner environments.
  ```javascript
  worker.on("message", (msg) => {
      if (isFinished) {
          // Defer termination to avoid re-entrancy segfaults
          setImmediate(() => {
              worker.terminate().then(resolve);
          });
      }
  });
  ```

## PDF.js / Ingestion Invariant Rules

- **Unified PDFParse Arguments:** When instantiating `pdf-parse`'s `PDFParse` class, always pass the document data buffer and other options as a single consolidated options object:
  ```javascript
  // CORRECT:
  const parser = new PDFParse({
      data: wasmData,
      disableFontFace: false,
      standardFontDataUrl: standardFontsPath
  });

  // INCORRECT (ignores options):
  const parser = new PDFParse(wasmData, options);
  ```
- **Cross-Platform Font Paths:** Always ensure that `standardFontDataUrl` uses forward slashes (`/`) and ends with a trailing `/` (even on Windows). Convert backslashes using `.replace(/\\/g, '/')` to ensure PDF.js can resolve and append font file names correctly.
