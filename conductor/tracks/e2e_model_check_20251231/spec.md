# Spec: E2E Model Connectivity Test

## Overview
Create a comprehensive end-to-end integration test/script that iterates through all registered online (non-local) AI models and verifies their availability by sending a real inference request. The test should simulate a real user message using the AgentPress framework's message structure.

## Functional Requirements
- **Target Models:** All models in `ModelRegistry` where `provider` is NOT `OLLAMA` or `LM_STUDIO`.
- **Message Construction:**
  - Use `core.api_models.chat.Message` (or equivalent) to construct a valid conversation history.
  - Include a standard System Prompt (from `core.prompts`) if applicable, or a minimal one.
  - **User Message:** "This is a network connectivity test, respond with a short generic one sentence response".
- **Execution:**
  - Use `litellm.acompletion` directly but with the parameters and message structure exactly as the backend would generate them.
  - Ideally, reuse `ModelRegistry.get_litellm_params`.
- **Verification:** Check if the response status is success and content is non-empty.
- **Output:**
  - Print a report of PASS/FAIL for each model.
  - If FAIL, print the error message.
- **Cost Awareness:** Use `max_tokens=50`.

## Non-Functional Requirements
- **No Side Effects:** Do not create threads or messages in the Supabase database.
- **Isolation:** Standalone script.

## Acceptance Criteria
- Script at `backend/core/ai_models/tests/e2e_model_check.py`.
- Simulates AgentPress message structure.
- Verifies connectivity for all cloud models.
