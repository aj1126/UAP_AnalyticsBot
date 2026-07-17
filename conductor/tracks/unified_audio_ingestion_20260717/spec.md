# Specification: Unified Audio Ingestion

## 1. Overview
This feature introduces unified audio ingestion for UAP AnalyticsBot, supporting standalone audio files (`.mp3`, `.wav`, `.ogg`, and `.flac`). It unifies the transcription pipeline with the existing video audio path, leveraging a local Whisper model to transcribe speech into structured timestamped text.

## 2. Goals & Scope
- **Standalone Ingestion**: Ingest and index `.mp3`, `.wav`, `.ogg`, and `.flac` files found in the target directories.
- **Whisper Transcription**: Transcribe audio files using the local Whisper ("tiny") model.
- **Structured Metadata**: Extract duration and populate transcripts formatted identically to video metadata.
- **Offline-First Fallback**: If the required local Whisper environment (Python dependencies) is not present, log a warning and fallback gracefully to basic file indexing (size, duration) without crashing the pipeline.

## 3. Functional Requirements
1. **File Detection**:
   - `walkFiles` in `src/ingestion/file-ingestion.js` must scan for `.mp3`, `.wav`, `.ogg`, and `.flac` files.
2. **Worker Processing**:
   - `src/ingestion/worker.js` must delegate audio file types to a processing block.
3. **Python Ingestion Helper**:
   - A Python helper script (`scripts/audio_ingestion.py`) must extract the audio duration and run Whisper transcription when Python dependencies are available.
4. **Data Contract**:
   - Returned metadata structure:
     ```json
     {
       "duration": 124.5,
       "transcripts": [
         { "timestamp": "00:00:05", "text": "Hello world" }
       ]
     }
     ```
   - The file's main text content must compile the transcript:
     ```text
     --- Audio Transcript ---
     [00:00:05] Hello world
     ```

## 4. Non-Functional Requirements
- **Process Decoupling**: Offload Python/Whisper execution from the main Node thread using `child_process.spawn`.
- **Test Isolation**: Provide mock fallbacks during unit tests to ensure that tests run in sandboxed/offline environments without needing a fully initialized local Whisper Python stack.

## 5. Out of Scope
- Real-time/streaming audio capture (e.g., microphone feeds).
- Speaker identification/diarization.
- Support for external/cloud-based speech-to-text APIs.
