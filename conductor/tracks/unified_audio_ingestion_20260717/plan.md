# Implementation Plan: Unified Audio Ingestion

## Phase 1: Test Scaffolding (TDD Red Phase)
- [ ] Task: Scaffold Ingestor Test Suite
  - [ ] Create `test/audio-ingestion.test.js` containing failing tests for audio file extensions detection.
  - [ ] Write failing test cases validating Whisper transcription parsing and fallback conditions when dependencies are missing.
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2: Python Audio Ingestion Component
- [ ] Task: Create Python Audio Processor
  - [ ] Create `scripts/audio_ingestion.py` to calculate audio file duration and perform Whisper transcription.
  - [ ] Implement error handling and JSON structured outputs matching video ingestion formats.
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3: Integrate with Ingestion Pipeline (Green Phase)
- [ ] Task: Update File Walker
  - [ ] Modify `walkFiles` in `src/ingestion/file-ingestion.js` to search for `.mp3`, `.wav`, `.ogg`, and `.flac`.
- [ ] Task: Implement Worker Processing Logic
  - [ ] Add `.mp3`, `.wav`, `.ogg`, and `.flac` branches to `src/ingestion/worker.js`.
  - [ ] Implement `processAudioFile` inside `src/ingestion/worker.js` to spawn the `scripts/audio_ingestion.py` subprocess.
- [ ] Task: Run Tests and Refactor
  - [ ] Execute `npm test` and verify all tests pass.
  - [ ] Verify that test coverage exceeds 80% for the modified and newly created modules.
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
