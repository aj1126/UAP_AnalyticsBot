# Conventions & Architectural Invariants

## Worker Thread Management
- **Deferred Worker Termination**: When terminating a `worker_threads` Worker instance inside any of its own event callbacks (`message`, `error`, etc.), wrap `worker.terminate()` in `setImmediate()` or `setTimeout()` to allow the callback stack to unwind before destroying the V8 isolate. Prevents exit code `3221225477` / `0xC0000005`.
- **Graceful Worker Teardown**: Inside worker scripts, call `parentPort.close()` inside `setImmediate()`. Never call `process.exit(0)` directly inside workers under test coverage.

## Ingestion & PDF/OCR Invariants
- **PDFParse Arguments**: Always instantiate `new PDFParse({ data: wasmData, disableFontFace: false, standardFontDataUrl: standardFontsPath })` as a single consolidated options object.
- **Font Paths**: `standardFontDataUrl` must use forward slashes (`/`) and end with a trailing `/`.
- **Offline OCR Assets**: Tesseract workers must load `eng.traineddata` from local workspace filesystem paths, never external CDNs.

## Database & Test Isolation
- **Test Database Isolation**: SQLite database layer must dynamically isolate tests by routing to `:memory:` or temporary test files when `process.env.NODE_ENV === 'test'`.
- **Mock vs Binary Extensions**: Use `.json` for mock fallback storage and `.db`/`.sqlite` exclusively for binary SQLite databases to avoid `ERR_SQLITE_ERROR`.
