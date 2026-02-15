# Specification: Fix Backend LLM System and Optimize Error Propagation

## 1. Overview
The current backend LLM system in `backend/core/models` is experiencing reliability issues preventing successful Agent Runs. Specifically, Google Gemini models fail with `BadRequestError` (missing provider), and Claude/Bedrock models fail with `RateLimitError`. Additionally, the error feedback loop to the frontend is slow and lacks clarity, often waiting for max retries before notifying the user.

## 2. Objectives
1.  **Fix Gemini Configuration:** Resolve the `litellm.BadRequestError` by ensuring the correct provider arguments are passed for Google Gemini models.
2.  **Verify Gemini Connection & Quotas:**
    *   Identify authentication method (API Key vs Service Account) and target endpoint (Vertex AI vs Google AI Studio).
    *   **Identify Account:** Determine which specific account is configured in `.env`.
    *   **Verify Quotas:** Check the associated quotas for that account to rule out legitimate rate limits.
3.  **Investigate Bedrock Rate Limits:** Determine if the `RateLimitError` is consistent across unit tests and runtime, and verify if it's a configuration or quota issue.
4.  **Optimize Error Propagation:** Implement a "fail-fast" or "notify-fast" mechanism. The frontend should receive immediate feedback on critical errors (like Rate Limits or Bad Requests) without waiting for the full retry cycle.

## 3. Scope
*   **Backend:**
    *   `backend/core/models`: Fix LiteLLM provider passing for Gemini. Audit auth code.
    *   `backend/core/agentpress/thread_manager.py`: Modify error handling logic to support immediate notification.
    *   `backend/core/models/tests`: Create/Run reproduction scripts.
    *   `.env` (Analysis only): Identify configured accounts.
*   **Frontend:**
    *   `frontend/src/hooks/useAgentStream.ts`: Update to handle immediate error events/signals and display them via Toast.

## 4. Implementation Strategy
1.  **Reproduction:** Use `backend/core/models/tests` and custom scripts to reproduce both Gemini and Bedrock errors in isolation.
2.  **Investigation:**
    *   **Audit:** Inspect `.env` and code to identify the active Gemini account/key and Bedrock credentials.
    *   **Gemini Audit:** Confirm auth method (API Key/Service Account) and Endpoint (Vertex/Studio).
    *   **Flow Analysis:** Analyze `thread_manager.py` and `useAgentStream.ts` to map the current error flow.
3.  **Refactoring:**
    *   Modify `LiteLLM` calls to include the missing provider for Gemini.
    *   Implement an error classification system in the backend to distinguish between "retriable" and "fatal" errors.
    *   Update the frontend to react to these "fatal" errors immediately.

## 5. Success Criteria
*   [ ] Google Gemini 3 Pro/Flash Preview models run successfully without `BadRequestError`.
*   [ ] Gemini/Bedrock Authentication details (Account, Method, Endpoint, Quota status) are documented.
*   [ ] Bedrock Rate Limit behavior is characterized.
*   [ ] Frontend displays a Toast notification immediately upon a fatal LLM error instead of hanging/retrying.
