# Plan: Local Model Registry Integration

## Phase 1: Preparation & Scaffolding
- [ ] Task: Create `backend/core/ai_models/local_registry.py` with basic class structure.
- [ ] Task: Update `backend/core/ai_models/__init__.py` to export `LocalModelRegistry`.
- [ ] Task: Create unit test file `backend/core/tests/test_local_registry.py`.
- [ ] Task: Conductor - User Manual Verification 'Preparation & Scaffolding' (Protocol in workflow.md)

## Phase 2: Ollama Integration
- [ ] Task: Implement `Ollama` discovery logic in `LocalModelRegistry`.
- [ ] Task: Write tests to mock `OllamaClient` and verify model conversion.
- [ ] Task: Implement graceful handling for unreachable Ollama endpoint.
- [ ] Task: Conductor - User Manual Verification 'Ollama Integration' (Protocol in workflow.md)

## Phase 3: LM Studio Integration
- [ ] Task: Implement `LM Studio` discovery logic in `LocalModelRegistry`.
- [ ] Task: Write tests to mock `LMStudioClient` and verify model conversion.
- [ ] Task: Implement graceful handling for unreachable LM Studio endpoint.
- [ ] Task: Conductor - User Manual Verification 'LM Studio Integration' (Protocol in workflow.md)

## Phase 4: Main Registry Merging
- [ ] Task: Update `ModelRegistry` in `backend/core/ai_models/registry.py` to initialize and merge `LocalModelRegistry`.
- [ ] Task: Verify that `LocalModelRegistry` initialization is called during `ModelRegistry.__init__`.
- [ ] Task: Update `backend/core/tests/test_model_exposure.py` to include checks for local models (using mocks).
- [ ] Task: Conductor - User Manual Verification 'Main Registry Merging' (Protocol in workflow.md)

## Phase 5: End-to-End Verification
- [ ] Task: Run all `ai_models` related tests.
- [ ] Task: Verify `/api/ai-models/` endpoint in the running application (if possible).
- [ ] Task: Conductor - User Manual Verification 'End-to-End Verification' (Protocol in workflow.md)
