# Specification: Expose All Preconfigured AI Models in Backend

## 1. Overview
The current Suna Kortix backend restricts the models available to the frontend to a few presets ("Kortix Basic", "Kortix Advanced", "Kortix Test"), even though additional model configurations exist within the backend code (specifically in the `ai_models` directory/modules). This track focuses on fixing the backend wiring to correctly expose all preconfigured models via the existing API endpoint, ensuring the frontend receives the full list of available options without requiring UI changes.

## 2. Functional Requirements
*   **Audit Model Definitions:** Identify all hardcoded model preconfigurations currently existing in the backend source code (e.g., in `ai_models`).
*   **Fix API Response:** Refactor the API endpoint responsible for returning the model list (likely `GET /models` or similar) to aggregate and return *all* defined model configurations, not just the active presets.
*   **Preserve Presets:** Ensure existing presets ("Kortix Basic", "Kortix Advanced") remain functional and identifiable while adding the missing models to the list.

## 3. Technical Implementation Strategy
*   **Target Area:** Backend `ai_models` directory and the API router handling model lists.
*   **Logic Change:** Modify the retrieval logic to iterate through available model definitions/classes and serialize them for the API response.
*   **Constraint:** This is a backend-only fix. The JSON response structure must remain compatible with the existing frontend parser.

## 4. Acceptance Criteria
*   The API endpoint for fetching models returns a JSON list including the previously missing preconfigured models found in the source code.
*   "Kortix Basic", "Kortix Advanced", and "Kortix Test" remain available.
*   No frontend code changes are required for these models to appear in the existing UI selector.

## 5. Out of Scope
*   Frontend UI changes (dropdowns, grouping, etc.).
*   Database schema changes for models.
*   Dynamic fetching from external providers (LiteLLM) beyond what is already preconfigured in code.
