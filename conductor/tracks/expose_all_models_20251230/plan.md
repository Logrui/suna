# Plan: Expose All Preconfigured AI Models in Backend

## Phase 1: Discovery & Baseline
- [x] Task: Locate all model configuration files in `backend/core/ai_models/` (or equivalent directory).
- [x] Task: Identify the FastAPI router/endpoint responsible for returning the model list to the frontend.
- [x] Task: Create a reproduction script (or curl command) to document the current "limited" model list returned by the API.
- [x] Task: Conductor - User Manual Verification 'Phase 1: Discovery & Baseline' (Protocol in workflow.md)

## Phase 2: Implementation
- [x] Task: Refactor the model registry/listing logic to iterate through all detected model configurations.
- [x] Task: Ensure that "Kortix Basic", "Advanced", and "Test" metadata is preserved as priority presets.
- [x] Task: Update the API response to include the full list of missing models (e.g., specific GPT/Claude versions found in code).
- [x] Task: Conductor - User Manual Verification 'Phase 2: Implementation' (Protocol in workflow.md)

## Phase 3: Verification & Cleanup
- [x] Task: Verify the API response via reproduction script to confirm all models are now visible.
- [x] Task: (Optional) Add a unit test in `backend/tests/` to ensure the model list remains comprehensive in the future.
- [x] Task: Run `pytest` on the backend to ensure no regressions in thread initialization or model selection.
- [x] Task: Conductor - User Manual Verification 'Phase 3: Verification & Cleanup' (Protocol in workflow.md)