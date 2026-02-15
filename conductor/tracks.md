# Project Tracks

This file tracks all major tracks for the project. Each track has its own detailed plan in its respective folder.

---

## [x] Track: Fix backend LLM system reliability issues (Gemini BadRequest, Bedrock RateLimit) and optimize error propagation to the frontend.
*Link: [./conductor/tracks/fix_backend_llm_20251226/](./conductor/tracks/fix_backend_llm_20251226/)*

---

## [x] Track: Expose all preconfigured AI models in the backend API.
*Link: [./conductor/tracks/expose_all_models_20251230/](./conductor/tracks/expose_all_models_20251230/)*
---

## [x] Track: Integration of Ollama and LM Studio local models into the main registry.
*Link: [./conductor/tracks/local_model_registry_20251231/](./conductor/tracks/local_model_registry_20251231/)*

---

## [x] Track: Create an E2E connectivity test for all online AI models.
*Link: [./conductor/tracks/e2e_model_check_20251231/](./conductor/tracks/e2e_model_check_20251231/)*

---

## [x] Track: Implement a new frontend page and backend API for diagnostics and model status.
*Link: [./conductor/tracks/admin_model_dashboard_20251231/](./conductor/tracks/admin_model_dashboard_20251231/)*

---

## [x] Track: Update ollama and lm studio models to properly display ollama.svg and lmstudio.svg on the frontend.
*Link: [./conductor/tracks/local_model_icons_20251231/](./conductor/tracks/local_model_icons_20251231/)*

---

- [x] **Track: Frontend support for conversation branch and editing and resending messages in threads**
*Link: [./tracks/thread_branching_20260131/](./tracks/thread_branching_20260131/)*

---

## [~] Track: Kortix Browser Operator Chrome Extension (~50% Complete)
*Allows AI agents to control the user's local Chrome browser via WebSocket extension.*
*Link: [./conductor/tracks/kortix_browser_extension_20260204/](./conductor/tracks/kortix_browser_extension_20260204/)*

**Status**: Core infrastructure complete, but **2 of 4 browser tools NOT FUNCTIONAL**:
- ✅ `navigate`, `screenshot`: Full parity with sandbox
- 🔴 `act`, `extract`: **NOT FUNCTIONAL** - Primary focus for Phase 6
- Remaining: fix act/extract, popup polish, E2E testing, deployment prep


- [~] **Track: Project-Based Memories**
*Allows manual knowledge management and project-specific context injection.*
*Link: [./conductor/tracks/project_memories_20260210/](./conductor/tracks/project_memories_20260210/)*

- [~] **Track: Advanced MCP Server Support Refactor (Master Track)**
*Comprehensive refactor of the full MCP pipeline: bug fixes, execution layer consolidation, config normalization, test harness, 2-stage OAuth frontend. Consolidates 4 prior MCP tracks.*
*Link: [./conductor/tracks/advanced_mcp_server_support_refactor/](./conductor/tracks/advanced_mcp_server_support_refactor/)*
**Status**: Spec and plan complete. 8 phases, 109 tasks. Backend first, frontend second.

---

### Archived MCP Tracks (Consolidated into Advanced MCP Server Support Refactor)

- [archived] **Track: Dynamic MCP OAuth & Advanced Configuration**
*Link: [./conductor/tracks/mcp_dynamic_auth_20260211/](./conductor/tracks/mcp_dynamic_auth_20260211/)*

- [archived] **Track: Refine Custom MCP OAuth (2-Stage Flow)**
*Link: [./conductor/tracks/feature_custom_mcp_oauth_2stage_20260212/](./conductor/tracks/feature_custom_mcp_oauth_2stage_20260212/)*

- [archived] **Track: MCP Test Harness & Lab (Component Isolation)**
*Link: [./conductor/tracks/mcp_test_harness_20260213/](./conductor/tracks/mcp_test_harness_20260213/)*

- [archived] **Track: Agent Harness (Isolated CLI Agent Execution)**
*Link: [./conductor/tracks/agent_harness_20260215/](./conductor/tracks/agent_harness_20260215/)*
