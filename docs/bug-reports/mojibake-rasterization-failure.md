### 📋 Copilot Ingestion Prompt: PDF Vector-to-Raster Fallback Failure

**System Architecture Context:**
We are developing `UAP_AnalyticsBot`, a multithreaded Node.js CLI tool handling asynchronous document ingestion via a `worker_threads` pool. The system parses PDF files using a WebAssembly vector extraction node (`pdf-parse` / `pdf.js`).

**Current State & Bug Description:**
The target PDFs contain corrupted vector geometry (hidden mojibake). We attempted to implement an automated fallback mechanism: a boolean node evaluates the initial vector text extraction for scrambled alphanumeric geometry. If flagged, the pipeline dynamically bridges to `mupdf` to rasterize the PDF into a 2D sprite sheet, which is then piped into an AI-accelerated OCR node (`tesseract.js`).

Currently, the fallback is failing silently. The standard text extraction bypasses the boolean node, logging no errors, and the vector engine throws standard font dictionary warnings without halting execution.

**Diagnostic Hypotheses (The "Silent Bypass"):**

1. **Heuristic Boolean Failure:** The corrupted vector data consists of standard English characters `[a-zA-Z]` mapped to incorrect Unicode indices. A simple string length or basic vowel density check is returning `true`, causing the garbage data to bypass the OCR node entirely.
2. **Thread Pool Path Resolution:** The `standardFontDataUrl` injection to silence the `pdf.js` asset pipeline is failing to resolve paths dynamically within the isolated `worker_threads` context.
3. **WASM Memory Pointer Crash:** `mupdf` may be failing to initialize the memory pointer for the document buffer, or it is crashing at the C++ binding level. In a worker pool, unhandled rejections at this level often fail to bubble up to the main `try/catch` block, resulting in a silent logic exit.

**Directives for Copilot:**
Please rewrite the `processPdfFile` function in `src/ingestion/worker.js` adhering to the following constraints:

1. **AI-Accelerated Heuristics:** Implement a more robust, automated heuristic boolean node to detect mojibake. Instead of basic vowel density, use an n-gram frequency analyzer or a dictionary-matching threshold to accurately flag scrambled English text.
2. **Safe Memory Handoff:** Ensure the `mupdf` rasterization pipeline safely allocates and frees memory pointers (`doc.destroy()`, `page.destroy()`). Wrap the buffer handoff in an explicit promise execution block to catch WebAssembly binding failures.
3. **Thread-Safe Asset Paths:** Ensure any path resolutions for font dictionaries are strictly absolute and thread-safe.
4. **Terminology & Syntax:** Use clean, modern JavaScript. Do not provide BASH instructions; assume a Windows 11 environment running PowerShell. Document the code using Game Dev and CS terminology (e.g., "rasterization pass," "boolean node," "memory pointers," "sprite sheets").

---

### Next Steps Once Copilot Generates the Fix

Once Copilot outputs the new `worker.js` logic, you can trigger a fresh test batch in PowerShell to observe if the new heuristic node successfully catches the corrupted geometry:

```powershell
node src/index.js "D:\Downloads (D)\.2026\WARdotGOV\UAPs\Test_Batch" --format=md --clear-cache

```

If the worker threads hang or crash silently after this implementation, we will know the issue lies directly in how `mupdf` is handling the buffer memory pointers within the thread pool.