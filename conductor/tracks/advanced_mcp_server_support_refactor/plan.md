# Implementation Plan: Advanced MCP Server Support Refactor

> **Implementation Order**: Backend first (Phases 1-6), Frontend second (Phase 7), Full-stack verification last (Phase 8).
> **Testing**: Every backend phase includes unit tests as tasks. Tests must pass before the phase is complete.
> **Composio**: Every phase includes a Composio regression check as the final task.
> **VCS**: All commits via `jj describe -m` + `jj new` per workflow.md.

---

## Phase 1: Layer 1 Bug Fixes — Core MCP Module (Stages 1-4)

Fix blocking runtime bugs and remove duplicate definitions in the registration/discovery/auth layer. This phase touches `mcp_module/` and `credentials/` only.

### 1.1 Re-verify existing Core MCP Module implementation
- [x] Task: Read and audit all files in `backend/core/mcp_module/` — verify current state matches codemap expectations (api.py, mcp_service.py, auth_service.py, custom_mcp_registry_service.py, exceptions.py, __init__.py)
- [x] Task: Read and audit `backend/core/credentials/credential_service.py` — verify encryption/decryption logic and error handling

### 1.2 Fix blocking bugs
- [x] Task: Fix `mcp_service.py` — `_get_composio_headers()` async/await mismatch (add `async` keyword)
- [x] Task: Fix `custom_mcp_registry_service.py` — add missing `import time`
- [x] Task: Fix `credential_service.py` — replace silent decryption failure (returns `{}`) with raised ValueError

### 1.3 Remove duplicate definitions
- [x] Task: Remove duplicate `CustomMCPConnectionResult` dataclass from `mcp_service.py` — import from `custom_mcp_registry_service.py`
- [x] Task: Remove duplicate exception classes from `mcp_service.py` — import from `exceptions.py` instead
- [x] Task: Fix mutable default `config: Optional[Dict] = {}` → `config: Optional[Dict] = None` in Pydantic models in `api.py`

### 1.4 Fix discovery service routing
- [x] Task: Update `api.py:discover_custom_mcp_tools()` to use `CustomMCPRegistryService.discover_custom_tools()` (advanced, with path probing and OAuth detection) instead of `MCPService.discover_custom_tools()` (simple)
- [x] Task: Fix HTTPException being swallowed by generic `except Exception` in auth/start endpoint

### 1.5 Unit tests for Phase 1
- [x] Task: Write tests for `/v1/mcp/discover-custom-tools` endpoint (3 tests: routing, HTTP+SSE, requires_auth)
- [x] Task: Write tests for `/v1/mcp/auth/start` endpoint (2 tests: redirect URL generation, missing metadata 400)
- [x] Task: Write tests for `/v1/mcp/auth/callback` endpoint (1 test: state validation + token exchange + credential storage)
- [x] Task: Write tests for `credential_service.py` encrypt/decrypt (4 tests: round-trip, wrong hash, corrupted data, map_to_credential raises)
- [x] Task: Write Composio regression test (2 tests: discovery path routing, _get_composio_headers is async)
- [x] Task: Write exception identity test (1 test: all exceptions come from exceptions.py)

### 1.6 Phase 1 Verification
- [x] Task: Run all Phase 1 tests — 13/13 passed (`docker compose exec backend uv run pytest tests/test_mcp_phase1_core.py`)
- [x] Task: Run existing MCP tests — 2/3 passed (1 pre-existing failure in callback test due to non-UUID mock user_id)
- [x] Task: Verify Composio discovery path unaffected (test_composio_discovery_path_unaffected PASSED)
- [ ] Task: Conductor — User Manual Verification 'Phase 1: Layer 1 Bug Fixes' (Protocol in workflow.md)

---

## Phase 2: Layer 2 Bug Fixes — JIT Loader (Stage 5-6)

Fix bugs in the JIT tool map builder and execution path. This phase touches `jit/` and `tools/utils/` only.

### 2.1 Re-verify existing JIT implementation
- [ ] Task: Read and audit `backend/core/jit/mcp_loader.py` — verify `build_tool_map()`, `_process_mcp_config()`, `activate_tool()`, `_load_tool_schema()` match codemap expectations
- [ ] Task: Read and audit `backend/core/jit/mcp_registry.py` — identify the `toolkit_start` typo and verify registry query paths
- [ ] Task: Read and audit `backend/core/jit/loader.py` — verify `activate_mcp_tool()` integration with `mcp_loader`
- [ ] Task: Read and audit `backend/core/tools/utils/mcp_tool_executor.py` — identify the undefined `config` variable in `_get_headers()`

### 2.2 Fix blocking bugs
- [ ] Task: Fix `jit/mcp_registry.py` — correct variable name typo `toolkit_start`
- [ ] Task: Fix `tools/utils/mcp_tool_executor.py` — define `config` variable in `_get_headers()` (extract from `mcp_config.get("config", {})`)
- [ ] Task: Add SSRF validation (`is_safe_url()`) to JIT execution path in `jit/mcp_loader.py` before connecting to MCP servers in `_load_http_schema()` and `_load_sse_schema()`

### 2.3 Evaluate cached schema reuse
- [ ] Task: Analyze whether Stage 6 `_load_tool_schema()` can use the `tools[]` array already cached in agent config (from Stage 3 discovery) instead of reconnecting to the MCP server. Document findings and implement if feasible without breaking activation flow.

### 2.4 Unit tests for Phase 2
- [ ] Task: Write tests for `MCPJITLoader.build_tool_map()` with mock agent configs (both `enabledTools` present and absent)
- [ ] Task: Write tests for `MCPJITLoader._process_mcp_config()` for custom MCP (SSE, HTTP, JSON types) and Composio configs
- [ ] Task: Write tests for `MCPJITLoader.activate_tool()` with mocked MCP server connection
- [ ] Task: Write tests for SSRF validation in JIT path — verify private IPs, localhost, and metadata endpoints are blocked
- [ ] Task: Write Composio regression test — verify Composio tool map building works with mock agent config containing Composio MCPs

### 2.5 Phase 2 Verification
- [ ] Task: Run all Phase 1 + Phase 2 tests together
- [ ] Task: Verify Composio path unaffected (Composio configs still build tool_map correctly)
- [ ] Task: Conductor — User Manual Verification 'Phase 2: Layer 2 Bug Fixes' (Protocol in workflow.md)

---

## Phase 3: Layer 3 Execution Consolidation (Stage 6)

Unify the duplicate execution paths into a single executor. This is the most architecturally significant phase.

### 3.1 Audit both executors
- [ ] Task: Read `backend/core/jit/mcp_tool_wrapper.py` (JIT MCPToolExecutor) — document all methods, transport handling, return types
- [ ] Task: Read `backend/core/tools/utils/mcp_tool_executor.py` (Legacy MCPToolExecutor) — document all methods, transport handling, SSRF protection, return types
- [ ] Task: Read `backend/core/run/mcp_manager.py` — document how it registers Legacy MCPToolWrapper and where it overlaps with JIT
- [ ] Task: Diff the two executors — create a feature matrix showing what each has that the other lacks

### 3.2 Unify executor
- [ ] Task: Create unified `MCPToolExecutor` combining the best of both (JIT's lazy activation + Legacy's SSRF + Legacy's ToolResult return type). Place in `backend/core/tools/utils/mcp_tool_executor.py` (keep the existing location, rewrite contents)
- [ ] Task: Update `jit/mcp_loader.py` and `jit/loader.py` to use the unified executor instead of `jit/mcp_tool_wrapper.py`
- [ ] Task: Remove or deprecate `jit/mcp_tool_wrapper.py` (the duplicate JIT executor)

### 3.3 Consolidate shared utilities
- [ ] Task: Extract `_get_headers()` into `core/utils/mcp_helpers.py` as a single shared function. Update all callers across `mcp_tool_executor.py`, `mcp_connection_manager.py`, `jit/mcp_loader.py`, and `mcp_service.py` to import from the shared location.

### 3.4 Remove redundant eager loading
- [ ] Task: Audit `run/mcp_manager.py` — determine if its `MCPToolWrapper` registration is still needed alongside JIT. If fully redundant, remove the eager-loading path. If partially needed (e.g., for Composio), refactor to delegate to JIT.
- [ ] Task: Verify agent startup no longer connects to all MCP servers eagerly — only JIT lazy activation should trigger connections

### 3.5 Unit tests for Phase 3
- [ ] Task: Write tests for unified `MCPToolExecutor` — SSE, HTTP, JSON transport execution with mocked MCP servers
- [ ] Task: Write tests verifying SSRF protection is active on all execution paths
- [ ] Task: Write tests verifying `ToolResult` return type consistency
- [ ] Task: Write Composio regression test — verify Composio tool execution works through the unified executor

### 3.6 Phase 3 Verification
- [ ] Task: Run all Phase 1 + 2 + 3 tests together
- [ ] Task: Verify no eager MCP connections during agent bootstrap (check logs)
- [ ] Task: Verify Composio tools still execute correctly
- [ ] Task: Conductor — User Manual Verification 'Phase 3: Execution Consolidation' (Protocol in workflow.md)

---

## Phase 4: Configuration Key Normalization (Cross-Layer)

Standardize the config key naming chaos across all 3 layers.

### 4.1 Define canonical schema
- [ ] Task: Create `backend/core/utils/mcp_config_schema.py` with canonical key names, normalization functions, and documentation. Define the single source of truth for: `enabled_tools` (snake_case canonical), `qualified_name`, `server_type`, `server_url`, `custom_headers`
- [ ] Task: Add normalization helpers: `normalize_mcp_config(raw_config) -> CanonicalMCPConfig` that handles both camelCase and snake_case inputs

### 4.2 Apply normalization at boundaries
- [ ] Task: Update `mcp_module/api.py` — normalize incoming frontend configs on ingress (camelCase → snake_case)
- [ ] Task: Update `agent_tools.py` — normalize configs when reading from / writing to agent versions
- [ ] Task: Update `jit/mcp_loader.py` — use canonical keys when building tool map (handle both formats for backward compatibility with existing agent configs in DB)
- [ ] Task: Update `mcp_module/mcp_service.py` — use canonical keys internally

### 4.3 Unit tests for Phase 4
- [ ] Task: Write tests for `normalize_mcp_config()` — verify camelCase input, snake_case input, mixed input, missing keys, extra keys
- [ ] Task: Write integration tests verifying a config saved via `api.py` (camelCase from frontend) is correctly read by `mcp_loader.py` (snake_case at runtime)
- [ ] Task: Write Composio regression test — verify Composio configs (which use their own key format) are normalized correctly

### 4.4 Phase 4 Verification
- [ ] Task: Run full test suite (Phases 1-4)
- [ ] Task: Verify existing agent configs in DB still load correctly (backward compatibility)
- [ ] Task: Conductor — User Manual Verification 'Phase 4: Config Normalization' (Protocol in workflow.md)

---

## Phase 5: Comprehensive Test Suite (Gap Fill)

Fill any test coverage gaps from Phases 1-4. Ensure every MCP endpoint, service, and logic path has a dedicated test.

### 5.1 API endpoint tests
- [ ] Task: Verify/write test for `GET /v1/mcp/client-metadata.json` endpoint
- [ ] Task: Verify/write test for `GET /v1/secure-mcp/credentials` endpoint
- [ ] Task: Verify/write test for `POST /v1/secure-mcp/credentials` endpoint
- [ ] Task: Verify/write test for `DELETE /v1/secure-mcp/credentials/{name}` endpoint

### 5.2 Service-level tests
- [ ] Task: Verify/write tests for `MCPAuthService` — `discover_oauth_metadata()` (mock well-known endpoints, test RFC 9419 discovery chain), `generate_state()` / `validate_state()` round-trip, `generate_code_verifier_challenge()` PKCE S256
- [ ] Task: Verify/write tests for `CustomMCPRegistryService` — path probing logic (tries multiple paths), SSE-to-HTTP fallback, OAuth detection from 401 responses
- [ ] Task: Verify/write tests for `MCPService` — LRU connection cache behavior, connection TTL expiry, `execute_tool()` routing

### 5.3 Composio-specific regression suite
- [ ] Task: Write dedicated Composio test file `backend/tests/test_mcp_composio_regression.py` covering: Composio config detection in `agent_tools.py`, Composio tool map building in JIT, Composio tool execution through unified executor, Composio credential/profile retrieval

### 5.4 Test infrastructure
- [ ] Task: Create shared test fixtures/factories for common mock objects: mock MCP server responses, mock agent configs with custom MCPs, mock OAuth metadata, mock credential entries
- [ ] Task: Verify all tests run successfully via `docker compose exec backend uv run pytest backend/tests/test_mcp_*.py` and document the command in the test harness README

### 5.5 Phase 5 Verification
- [ ] Task: Run complete test suite — all tests passing
- [ ] Task: Verify test coverage meets 80% threshold for all MCP-related modules
- [ ] Task: Conductor — User Manual Verification 'Phase 5: Test Suite' (Protocol in workflow.md)

---

## Phase 6: Test Harness Completion + E2E CLI Verification

Complete the CLI test harness and verify against real MCP servers.

### 6.1 Re-verify existing harness
- [ ] Task: Read and audit `backend/core/test_harness/mcp_lab/runner.py` — verify `add`, `discover`, `auth`, `run` commands work with refactored backend
- [ ] Task: Run `discover` command against existing `local_lab.json` config — verify it works with the unified executor and normalized config keys

### 6.2 Harness fixes for refactored backend
- [ ] Task: Update harness imports and calls to use unified `MCPToolExecutor` (if changed from Phase 3)
- [ ] Task: Update harness to use canonical config keys (from Phase 4)
- [ ] Task: Verify harness `add` command works for both SSE and HTTP server types
- [ ] Task: Verify harness `auth` command completes OAuth flow for Desktop Commander

### 6.3 Harness Phase 5 completion (from prior track)
- [ ] Task: Initialize Langfuse client in harness and flush on exit
- [ ] Task: Wrap `mcp_loader` and `mcp_service` calls in Langfuse spans
- [ ] Task: Generate local `latest_trace.json` after each harness run
- [ ] Task: Add reliability tests for connection timeouts and 5xx errors

### 6.4 E2E CLI verification against real servers
- [ ] Task: E2E test — Valyu AI (API Key): `add` → `discover` → `run` a tool call → verify result
- [ ] Task: E2E test — Desktop Commander (OAuth): `add` → `auth` → exchange tokens → `discover` → `run` a tool call → verify result
- [ ] Task: Document the E2E test procedure and expected outputs in harness README

### 6.5 Phase 6 Verification
- [ ] Task: Run full unit test suite (Phases 1-5 tests still passing)
- [ ] Task: Run harness E2E against both reference servers
- [ ] Task: Conductor — User Manual Verification 'Phase 6: Test Harness + E2E' (Protocol in workflow.md)

---

## Phase 7: Frontend — 2-Stage OAuth & MCP Configuration

All backend work is complete. Now update the frontend to match the stabilized API contracts.

### 7.1 Audit current frontend state
- [ ] Task: Read and audit `frontend/src/components/agents/mcp/` — all components, verify against current backend API contracts
- [ ] Task: Read and audit `frontend/src/hooks/agents/use-custom-mcp-tools.ts` — verify API calls match refactored endpoints
- [ ] Task: Read upstream reference `apps/frontend/src/components/agents/mcp/custom-mcp-auth-confirmation.tsx` — understand the OAuth confirmation UI pattern

### 7.2 Fix API integration issues
- [ ] Task: Fix OAuth redirect URL construction — use dynamic URL based on current origin instead of hardcoded `/mcp-success`
- [ ] Task: Stabilize React Query keys in `use-custom-mcp-tools.ts` — normalize the query key to use `qualifiedName` instead of fallback URL pattern
- [ ] Task: Fix mixed proxy/direct API routes in `use-secure-mcp.ts` — use consistent routing strategy

### 7.3 Implement 2-stage registration flow
- [ ] Task: Update `custom-mcp-dialog.tsx` — simplify to capture URL/name only (Stage 1: register). Remove inline OAuth/tool-discovery from the add dialog.
- [ ] Task: Update `custom-mcp-card.tsx` — show "Configuration Required" status for servers needing OAuth. Add "Configure" button that opens confirmation dialog.
- [ ] Task: Port `CustomMCPAuthConfirmation` component from `apps/frontend/` — adapt to our routing and API patterns. Show summary of upcoming OAuth redirect before initiating.
- [ ] Task: Wire "Configure" button → confirmation dialog → `window.location.href = /v1/mcp/auth/start?...` with correct params (url, return_url, agent_id)

### 7.4 Implement success callback handling
- [ ] Task: Update `frontend/src/app/(auth)/mcp-success/page.tsx` — handle OAuth callback redirect, show success toast, redirect to agent config page
- [ ] Task: Verify React Query cache invalidation after OAuth success — tools should auto-refresh in the tool selector

### 7.5 Tool management UI
- [ ] Task: Verify `custom-mcp-tools-manager.tsx` works with refactored backend — tools load correctly, selection persists
- [ ] Task: Verify `custom-mcp-tools-selector.tsx` displays all discovered tools with correct names and descriptions
- [ ] Task: Verify tool enable/disable saves correctly to agent config via `update_custom_mcp_tools_for_agent` endpoint

### 7.6 Phase 7 Verification
- [ ] Task: Run backend test suite — all still passing (no backend changes in this phase)
- [ ] Task: Manual walkthrough: add Valyu (unsecured) — verify 2-stage flow, tools appear, selectable
- [ ] Task: Manual walkthrough: add Desktop Commander (OAuth) — verify 2-stage flow, "Configure" button, OAuth redirect, callback, tools appear
- [ ] Task: Conductor — User Manual Verification 'Phase 7: Frontend' (Protocol in workflow.md)

---

## Phase 8: Full-Stack E2E Production Verification

Final verification across the entire stack in production-like environment.

### 8.1 Docker build verification
- [ ] Task: `docker compose down && docker compose up -d --build` — verify backend and frontend build successfully with all changes
- [ ] Task: Verify all backend tests pass inside the container: `docker compose exec backend uv run pytest backend/tests/test_mcp_*.py`

### 8.2 Unsecured MCP server E2E (Valyu)
- [ ] Task: Add Valyu AI via frontend 2-stage flow → verify tools discovered → select tools → start agent thread → verify `discover_mcp_tools` returns Valyu tools → verify `execute_mcp_tool` returns valid result

### 8.3 OAuth MCP server E2E (Desktop Commander)
- [ ] Task: Add Desktop Commander via frontend 2-stage flow → server shows "Configuration Required" → click "Configure" → OAuth redirect → complete auth → callback stores tokens → tools discovered → select tools → start agent thread → verify tool execution works

### 8.4 Composio final regression
- [ ] Task: Verify existing Composio apps still appear in integrations UI
- [ ] Task: Verify Composio tool discovery works in an agent thread
- [ ] Task: Verify Composio tool execution works in an agent thread

### 8.5 Multi-domain verification
- [ ] Task: Verify MCP flows work via `http://localhost:9990` (Docker)
- [ ] Task: Verify MCP flows work via `https://suna.syhc.dev` (Cloudflare Tunnel) — especially OAuth callback URLs

### 8.6 Phase 8 Verification
- [ ] Task: All backend unit tests passing
- [ ] Task: Harness E2E passing for both reference servers
- [ ] Task: Frontend manual walkthrough passing for both server types
- [ ] Task: Composio regression passing
- [ ] Task: Conductor — User Manual Verification 'Phase 8: Full-Stack E2E' (Protocol in workflow.md)

---

## Task Summary

| Phase | Focus | Task Count | Layer |
|-------|-------|------------|-------|
| 1 | Core MCP Module bug fixes | 16 | Backend Layer 1 |
| 2 | JIT Loader bug fixes | 15 | Backend Layer 2 |
| 3 | Execution consolidation | 16 | Backend Layer 3 |
| 4 | Config key normalization | 12 | Backend Cross-Layer |
| 5 | Comprehensive test suite | 11 | Backend Testing |
| 6 | Test harness + E2E CLI | 13 | Backend Integration |
| 7 | Frontend 2-stage OAuth | 15 | Frontend |
| 8 | Full-stack E2E verification | 11 | Full-Stack |
| **Total** | | **109** | |
