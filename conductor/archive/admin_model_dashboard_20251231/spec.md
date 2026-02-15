# Spec: Admin Model Diagnostics Dashboard

## Overview
Implement a comprehensive admin dashboard for monitoring, inspecting, and testing AI models registered in the system. This includes both a frontend interface and backend API endpoints to support model listing, detailed inspection, and connectivity testing.

## Functional Requirements

### Backend API (`backend/core/admin/models_api.py`)
- **`GET /api/admin/models`**: Returns a list of all registered models with enhanced metadata:
  - Basic: ID, Name, Provider, Enabled, Context Window, Max Output.
  - Pricing: Input/Output cost.
  - Routing: LiteLLM Model ID, Fallback list (IDs).
  - Source: Registry type (Main, Local, Fallback, AWS).
- **`POST /api/admin/models/test`**: Triggers a connectivity test for models.
  - **Parameters:**
    - `include_local` (bool, default=False): Whether to test local models (Ollama/LM Studio).
    - `disable_fallbacks` (bool, default=True): Whether to disable LiteLLM fallbacks during the test.
  - **Logic:**
    - Iterates through selected models.
    - Sends a standardized test message ("Network connectivity test...").
    - Measures latency and captures the response or error.
    - **Critical:** If `disable_fallbacks` is true, must temporarily patch/configure LiteLLM Router to ignore fallback chains for these requests to ensure we are testing the *primary* model.
  - **Response:** List of test results (Model ID, Status, Latency, Error/Response Snippet).

### Frontend Page (`frontend/src/app/(dashboard)/admin/models/page.tsx`)
- **Model Table:**
  - Columns: Name/ID, Provider, Context Window, Pricing, Status (Enabled/Disabled).
  - Actions: "Inspect" button, "Test" button (individual).
- **Global Actions:**
  - "Run All Tests" button.
  - Toggle: "Include Local Models".
  - Toggle: "Disable Fallbacks for Testing" (Default: ON).
- **Inspection Modal:**
  - Shows raw JSON details of the model configuration, routing parameters, and full fallback chain.
- **Test Results:**
  - "Run All" shows a loading state (spinner).
  - Upon completion, updates a "Last Test Status" column in the table (Pass/Fail icon).
  - Clicking the status icon opens a "Test Logs" modal showing the full request/response/error.

## Non-Functional Requirements
- **Performance:** The "Run All" test might take time. The frontend should handle long-running requests (or we accept it takes 10-30s and show a spinner).
- **Security:** Admin-only access (using `require_admin` dependency).

## Acceptance Criteria
- Admin can view all 40+ models (including local ones).
- Admin can run a test suite and see which models are actually failing (e.g., Credit Balance low).
- Admin can verify that `disable_fallbacks` works (e.g., verifying a model fails instantly instead of falling back to a working one).
