# Plan: Fix Backend LLM System and Optimize Error Propagation

## Phase 1: Investigation & Reproduction
- [x] Task: Audit Gemini & Bedrock Credentials.
    - [x] Sub-task: Inspect `backend/.env` to identify the active Gemini account/key and Bedrock credentials.
    - [x] Sub-task: Identify if the system is hitting Vertex AI or Google AI Studio.
- [x] Task: Reproduce LLM Failures.
    - [x] Sub-task: Run unit tests in `backend/core/models/tests` using `uv run` to verify `litellm.BadRequestError` (Gemini) and `RateLimitError` (Bedrock).
    - [x] Sub-task: Create a minimal reproduction script for Gemini provider issues if tests are insufficient.
- [x] Task: Map Current Error Flow.
    - [x] Sub-task: Trace how errors travel from `LiteLLM` -> `thread_manager.py` -> Frontend `useAgentStream.ts`.
- [x] Task: Conductor - User Manual Verification 'Investigation & Reproduction' (Protocol in workflow.md)

## Phase 2: LiteLLM Configuration Fixes
- [x] Task: Fix Gemini Provider Arguments.
    - [x] Sub-task: Modify `backend/core/models` to explicitly pass the provider (e.g., `google_ai/` or `vertex_ai/`) to `LiteLLM`.
- [x] Task: Refine Bedrock Error Handling.
    - [x] Sub-task: Implement specific catch blocks for `RateLimitError` to classify it as a "Fatal/Immediate" error for the UI.
- [x] Task: Verify Fixes via Unit Tests.
    - [x] Sub-task: Rerun tests in `backend/core/models/tests` to confirm successful model calls.
- [x] Task: Conductor - User Manual Verification 'LiteLLM Configuration Fixes' (Protocol in workflow.md)

## Phase 3: Error Propagation Optimization
- [x] Task: Implement Backend "Fast-Fail" Notification.
    - [x] Sub-task: Modify `backend/core/agentpress/thread_manager.py` to send an immediate error signal over the stream for fatal errors (BadRequest, RateLimit).
- [x] Task: Update Frontend Error Handling.
    - [x] Sub-task: Update `frontend/src/hooks/useAgentStream.ts` to detect immediate error events and trigger a Toast notification.
- [x] Task: Refine Toast Content.
    - [x] Sub-task: Ensure the Toast message is descriptive (e.g., "Bedrock Rate Limit Exceeded" instead of "Internal Server Error").
- [x] Task: Conductor - User Manual Verification 'Error Propagation Optimization' (Protocol in workflow.md)

## Phase 4: Final Verification & Documentation
- [x] Task: End-to-End Testing.
    - [x] Sub-task: Run an Agent Run from the frontend using Gemini and Bedrock models to verify connectivity and error feedback.
- [x] Task: Update Documentation.
    - [x] Sub-task: Update any relevant architecture notes regarding error handling and LLM configuration.
- [x] Task: Conductor - User Manual Verification 'Final Verification & Documentation' (Protocol in workflow.md)