# Plan: E2E Model Connectivity Test

## Phase 1: Script Implementation
- [ ] Task: Create `backend/core/ai_models/tests/e2e_model_check.py`.
- [ ] Task: Implement logic to list non-local models from `ModelRegistry`.
- [ ] Task: Implement message construction using `core.api_models` and `core.prompts` (if available) to simulate a real agent request.
- [ ] Task: Implement the inference loop using `litellm` with `ModelRegistry` parameters.
- [ ] Task: Add reporting logic (Pass/Fail summary).
- [ ] Task: Conductor - User Manual Verification 'Script Implementation' (Protocol in workflow.md)

## Phase 2: Execution & Verification
- [ ] Task: Run the script manually to verify it works (it will likely fail for some models if keys are missing, which is expected).
- [ ] Task: Verify that no DB records were created (by code inspection/design).
- [ ] Task: Conductor - User Manual Verification 'Execution & Verification' (Protocol in workflow.md)
