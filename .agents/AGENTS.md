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

## Code Injection & Boilerplate Safety

- **Avoid Redundant/Duplicate Declarations:** When prepending or injecting boilerplate blocks (such as WebAssembly memory teardowns, test runner imports, or setup/cleanup macros) into existing scripts or test files:
  - Do not blindly prepend duplicate `require` or `import` blocks.
  - Scan the file first to check if the modules or symbols (e.g. `const test = require('node:test')`) are already imported or declared.
  - Integrate the new logic cleanly by merging imports and combining hook functions (e.g., merging multiple `after()` handlers) to avoid compilation failures (`SyntaxError`).

## SQLite & Mock Database Hygiene

- **Isolate Test Databases:** During tests, always configure the SQLite database path to use `:memory:` or a temporary test file. This prevents unit tests from polluting or corrupting workspace database files.
- **Differentiate Mock and Binary File Extensions:** Never use the same filename or extension for binary SQLite databases (e.g., `.db` or `.sqlite`) and text-based mock fallbacks (e.g., JSON mock files). Use distinct extensions like `.json` for the text fallback to prevent native database engines from crashing with `ERR_SQLITE_ERROR: file is not a database` when attempting to load JSON files.

- **Graceful Worker Thread Teardown:** Inside the worker script itself, do not call `process.exit(0)` to shut down. Under test runner coverage modes, an abrupt `process.exit` kills the V8 thread before coverage results can be written, resulting in access violations. Instead, call `parentPort.close()` wrapped inside `setImmediate()` to permit a graceful and clean teardown.
  ```javascript
  if (task.action === 'close') {
      setImmediate(() => {
          parentPort.close();
      });
      return;
  }
  ```

## Data Mapping & Metadata Invariants

- **Metadata Integrity Preservation:** When mapping ingested files or structures in downstream processors (such as the Analytics Engine or custom database handlers), ensure that original parsing metadata fields are preserved using `metadata: file.metadata || {}` rather than overwritten with default blank objects.
