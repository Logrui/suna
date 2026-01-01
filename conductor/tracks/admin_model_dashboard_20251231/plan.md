# Plan: Admin Model Diagnostics Dashboard

## Phase 1: Backend API Implementation
- [ ] Task: Create `backend/core/admin/models_api.py`.
- [ ] Task: Implement `GET /models` endpoint to list models with detailed metadata.
- [ ] Task: Implement `POST /models/test` endpoint with fallback disabling logic (reusing E2E test logic).
- [ ] Task: Register the new router in `backend/api.py`.
- [ ] Task: Verify endpoints with unit tests (using `uv run`).
- [ ] Task: Conductor - User Manual Verification 'Backend API Implementation' (Protocol in workflow.md)

## Phase 2: Frontend Data Fetching & State
- [ ] Task: Create API client functions in `frontend/src/lib/api/admin.ts` (or new `models.ts`).
- [ ] Task: Create React Query hooks for fetching models and running tests.
- [ ] Task: Define TypeScript interfaces for Model and TestResult.
- [ ] Task: Conductor - User Manual Verification 'Frontend Data Fetching & State' (Protocol in workflow.md)

## Phase 3: Frontend UI Implementation
- [ ] Task: Create `frontend/src/app/(dashboard)/admin/models/page.tsx`.
- [ ] Task: Implement the Model Table component.
- [ ] Task: Implement the "Inspection Modal" for detailed JSON view.
- [ ] Task: Implement the "Test Logs Modal".
- [ ] Task: Implement the "Run Tests" logic and controls (toggles).
- [ ] Task: Conductor - User Manual Verification 'Frontend UI Implementation' (Protocol in workflow.md)

## Phase 4: Integration & Polish
- [ ] Task: Connect the "Run All" button to the backend endpoint.
- [ ] Task: Verify that toggling "Disable Fallbacks" actually affects the backend test logic.
- [ ] Task: Polish UI (loading states, error handling, icons).
- [ ] Task: Conductor - User Manual Verification 'Integration & Polish' (Protocol in workflow.md)
