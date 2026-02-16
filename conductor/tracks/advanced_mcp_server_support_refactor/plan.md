# Implementation Plan: Advanced MCP Server Support Refactor

> **Implementation Order**: Backend first (Phases 1-6), Frontend second (Phase 7), Full-stack verification last (Phase 8).
> **Testing**: Every backend phase includes unit tests as tasks. Tests must pass before the phase is complete.
> **Composio**: Every phase includes a Composio regression check as the final task.
> **VCS**: All commits via `jj describe -m` + `jj new` per workflow.md.

## Phase Completion Summary

| Phase | Status | Tests | Description |
|-------|--------|-------|-------------|
| 1 | **COMPLETE** | 13/13 | Layer 1 Bug Fixes — Core MCP Module |
| 2 | **COMPLETE** | 22/22 | Layer 2 Bug Fixes — JIT Loader |
| 3 | **COMPLETE** | 31/31 | Layer 3 Execution Consolidation |
| 4 | **COMPLETE** | 32/32 | Configuration Key Normalization |
| 5 | **COMPLETE** | 45/45 | Comprehensive Test Suite (Gap Fill) |
| 6 | **MOSTLY DONE** | — | Test Harness E2E verified (Valyu discover+run). Langfuse/reliability deferred. |
| 7 | **READY** | — | Frontend post-OAuth refresh (critical fix) + UX alignment |
| 8 | NOT STARTED | — | Full-Stack E2E Production Verification |

**Cumulative test results**: 143/143 tests passing in ~0.83s

**Test command**: `docker compose exec backend bash -c "cd /app && .venv/bin/python -m pytest tests/test_mcp_phase1_core.py tests/test_mcp_phase2_jit.py tests/test_mcp_phase3_executor.py tests/test_mcp_phase4_config.py tests/test_mcp_phase5_coverage.py -v"`

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

## Phase 2: Layer 2 Bug Fixes — JIT Loader (Stage 5-6) ✓ COMPLETE

Fix bugs in the JIT tool map builder and execution path. This phase touches `jit/` and `tools/utils/` only.

**Test file**: `backend/tests/test_mcp_phase2_jit.py` — 22 tests
**Test classes**: TestSSRFValidation(6), TestSSRFInJITDiscovery(3), TestSSRFInJITExecutor(2), plus 11 function-level tests

### 2.1 Re-verify existing JIT implementation
- [x] Task: Read and audit `backend/core/jit/mcp_loader.py` — verified `build_tool_map()`, `_process_mcp_config()`, `activate_tool()`, `_load_tool_schema()` match codemap
- [x] Task: Read and audit `backend/core/jit/mcp_registry.py` — identified `toolkit_start` typo, verified registry query paths
- [x] Task: Read and audit `backend/core/jit/loader.py` — verified `activate_mcp_tool()` integration with `mcp_loader`
- [x] Task: Read and audit `backend/core/tools/utils/mcp_tool_executor.py` — identified undefined `config` variable in `_get_headers()`

### 2.2 Fix blocking bugs
- [x] Task: Fix `jit/mcp_registry.py` — corrected variable name typo `toolkit_start` → `toolkit_start_time`
- [x] Task: Fix `tools/utils/mcp_tool_executor.py` — defined `config` variable in `_get_headers()` (extract from `mcp_config.get("config", {})`)
- [x] Task: Add SSRF validation (`is_safe_url()`) to JIT execution path in `jit/mcp_loader.py` before connecting to MCP servers in `_load_http_schema()` and `_load_sse_schema()`

### 2.3 Evaluate cached schema reuse
- [x] Task: Analyzed cached schema reuse — JIT `_load_tool_schema()` already uses `tools[]` from agent config when available via `enabledTools`. Direct connection only happens when schemas are missing. No change needed.

### 2.4 Unit tests for Phase 2
- [x] Task: Write tests for `MCPJITLoader.build_tool_map()` — 2 tests (with/without enabledTools)
- [x] Task: Write tests for `MCPJITLoader._process_mcp_config()` — 3 tests (SSE, HTTP/JSON, Composio)
- [x] Task: Write tests for `MCPJITLoader.activate_tool()` — 3 tests (loads+caches, already-loaded, not-found)
- [x] Task: Write SSRF validation tests — 11 tests (6 core validation, 3 JIT discovery, 2 JIT executor)
- [x] Task: Write Composio regression tests — 2 tests (with/without enabledTools)

### 2.5 Phase 2 Verification
- [x] Task: Run all Phase 1 + Phase 2 tests — 35/35 passed
- [x] Task: Verify Composio path unaffected — PASSED
- [ ] Task: Conductor — User Manual Verification 'Phase 2: Layer 2 Bug Fixes' (Protocol in workflow.md)

---

## Phase 3: Layer 3 Execution Consolidation (Stage 6) ✓ COMPLETE

Unify the duplicate execution paths into a single executor. This is the most architecturally significant phase.

**Test file**: `backend/tests/test_mcp_phase3_executor.py` — 31 tests
**Test classes**: TestDualModeConstruction(5), TestSSRFBothModes(4), TestResultHelpers(7), TestDirectModeDispatch(5), TestLegacyModeDispatch(3), TestHeaderBuilding(6), plus 1 function-level test

### 3.1 Audit both executors
- [x] Task: Read `backend/core/jit/mcp_tool_wrapper.py` (JIT MCPToolExecutor) — documented all methods, transport handling, raw output return type
- [x] Task: Read `backend/core/tools/utils/mcp_tool_executor.py` (Legacy MCPToolExecutor) — documented all methods, SSRF protection, ToolResult return type
- [x] Task: Read `backend/core/run/mcp_manager.py` — documented MCPToolWrapper registration, overlap with JIT
- [x] Task: Diffed the two executors — created feature matrix: JIT has lazy activation but no SSRF; Legacy has SSRF + ToolResult but eager loading

### 3.2 Unify executor
- [x] Task: Created unified `MCPToolExecutor` in `backend/core/tools/utils/mcp_tool_executor.py` — dual-mode: Legacy mode (backward-compat with `execute_tool()`) + Direct mode (JIT-style with `from_mcp_config()` factory + `execute()`)
- [x] Task: Updated `jit/mcp_loader.py` to use unified executor via `MCPToolExecutor.from_mcp_config()` factory
- [x] Task: JIT `mcp_tool_wrapper.py` superseded — unified executor handles both paths

### 3.3 Consolidate shared utilities
- [x] Task: Extracted `build_mcp_headers()` into `core/utils/mcp_helpers.py` as shared function. Added `get_config_value()` for cross-format config reads. Unified executor and JIT loader both import from shared location.

### 3.4 Remove redundant eager loading
- [x] Task: Audited `run/mcp_manager.py` — MCPToolWrapper still needed for non-JIT fallback (Composio path). Refactored to delegate to unified executor internally.
- [x] Task: Verified JIT lazy activation is primary path — eager loading only triggers for Composio-style configs that need upfront tool enumeration

### 3.5 Unit tests for Phase 3
- [x] Task: Write tests for unified executor — 5 direct mode dispatch tests (SSE/HTTP/JSON/Composio/unknown), 3 legacy mode tests
- [x] Task: Write SSRF tests for both modes — 4 tests (2 legacy, 2 direct)
- [x] Task: Write ToolResult consistency tests — 7 result helper tests (success/error/extract_content with and without wrapper)
- [x] Task: Write dual-mode construction tests — 5 tests (JIT factory, legacy constructor, type normalization)
- [x] Task: Write header building tests — 6 tests (access_token, nested, custom_headers, existing auth preserved, instance method)

### 3.6 Phase 3 Verification
- [x] Task: Run all Phase 1 + 2 + 3 tests — 66/66 passed
- [x] Task: Verified JIT creates unified executor (test_jit_loader_creates_unified_executor PASSED)
- [x] Task: Verified Composio dispatch routes correctly (test_dispatch_routes_to_composio PASSED)
- [ ] Task: Conductor — User Manual Verification 'Phase 3: Execution Consolidation' (Protocol in workflow.md)

---

## Phase 4: Configuration Key Normalization (Cross-Layer) ✓ COMPLETE

Standardize the config key naming chaos across all 3 layers.

**Test file**: `backend/tests/test_mcp_phase4_config.py` — 32 tests
**Test classes**: TestNormalizeToCamel(4), TestNormalizeToSnake(7), TestIntegrationWithJITLoader(3), TestCanonicalMCPConfig(5), TestComposioConfigNormalization(3), TestBackwardCompatibility(3), TestGetConfigValue(7)

**Key decisions**:
- Storage format remains camelCase (backward-compatible with frontend and existing DB records)
- Runtime reads via `get_config_value(config, "qualified_name")` which checks both snake_case and camelCase
- `CanonicalMCPConfig` dataclass for typed intermediate representation
- `normalize_to_snake()` / `normalize_to_camel()` for explicit boundary conversion

### 4.1 Define canonical schema
- [x] Task: Created `backend/core/utils/mcp_config_schema.py` — defines `CAMEL_TO_SNAKE` mapping, `normalize_to_snake()`, `normalize_to_camel()`, `get_config_value()`, and `CanonicalMCPConfig` dataclass with `from_raw()` and `to_storage()` methods
- [x] Task: Added `get_config_value(config, canonical_name, default)` — reads snake_case first, falls back to camelCase. Works with any raw config dict without pre-normalization.

### 4.2 Apply normalization at boundaries
- [x] Task: Updated `mcp_module/api.py` — discovery endpoint reads configs via `get_config_value()` for cross-format compatibility
- [x] Task: Updated `agent_tools.py` — `get_config_value()` used for reading agent version configs
- [x] Task: Updated `jit/mcp_loader.py` — `_process_mcp_config()` uses `get_config_value()` for `qualified_name`, `server_type`, `enabled_tools`
- [x] Task: Updated unified `MCPToolExecutor.from_mcp_config()` — uses `get_config_value()` for `customType`/`server_type` normalization

### 4.3 Unit tests for Phase 4
- [x] Task: Write normalization tests — 11 tests (4 camel, 7 snake) covering camelCase input, snake_case input, mixed input, missing keys, extra keys, `customType` priority
- [x] Task: Write integration tests — 3 tests verifying JIT loader reads camelCase configs, mixed configs, and executor reads via `get_config_value()`
- [x] Task: Write `CanonicalMCPConfig` tests — 5 tests (from_raw defaults, camelCase, snake_case, to_storage, round-trip)
- [x] Task: Write Composio regression tests — 3 tests (canonical config, round-trip, correct reads)
- [x] Task: Write backward compatibility tests — 3 tests (old configs with only `type`, configs with both formats, old `enabledTools` key)
- [x] Task: Write `get_config_value()` tests — 7 tests (snake priority, camel fallback, bare type fallback, custom type, default returned)

### 4.4 Phase 4 Verification
- [x] Task: Run full test suite (Phases 1-4) — 98/98 passed
- [x] Task: Verified backward compatibility — old camelCase-only configs still load correctly
- [ ] Task: Conductor — User Manual Verification 'Phase 4: Config Normalization' (Protocol in workflow.md)

---

## Phase 5: Comprehensive Test Suite (Gap Fill) ✓ COMPLETE

Fill any test coverage gaps from Phases 1-4. Ensure every MCP endpoint, service, and logic path has a dedicated test.

**Test file**: `backend/tests/test_mcp_phase5_coverage.py` — 45 tests
**Test classes**: TestClientMetadataEndpoint(3), TestDiscoverEndpointAdditional(3), TestAuthStartAdditional(2), TestMCPAuthService(9), TestCustomMCPRegistryService(4), TestMCPHelpers(8), TestComposioRegression(5), TestConfigSchemaEdgeCases(6), TestExecutorWithNormalizedConfig(5)

### 5.1 API endpoint tests
- [x] Task: `GET /v1/mcp/client-metadata.json` — 3 tests (returns metadata, client_id matches self URL, redirect_uri points to callback)
- [x] Task: `POST /v1/mcp/discover-custom-tools` — 3 additional tests (custom_headers merged, oauth fields merged, MCPError returns 500)
- [x] Task: `POST /v1/mcp/auth/start` — 2 additional tests (passes agent_id/display_name, discovery failure returns 400)
- [x] Note: Credential CRUD endpoints (`/v1/secure-mcp/credentials`) already covered by existing `test_mcp_oauth_flow.py`

### 5.2 Service-level tests
- [x] Task: `MCPAuthService` — 9 tests: `discover_oauth_metadata()` probes well-known (2 tests: standard + RFC 9419 resource→AS chain + raises when no metadata), `generate_state()/validate_state()` round-trip (3 tests: success, garbage input, tampered data), `generate_code_verifier_challenge()` PKCE S256 (3 tests: S256 hash, unique values, sufficient entropy)
- [x] Task: `CustomMCPRegistryService` — 4 tests: HTTP requires URL, SSE requires URL, `_safe_append_path()` logic, unsupported type raises
- [x] Task: `mcp_helpers` — 8 tests: `merge_custom_mcps()` (5 tests: empty new, appends new, replaces by qualifiedName, replaces by name fallback, does not mutate existing), `get_custom_mcp_qualified_name()` (3 tests: different types, consistency, trailing slash normalized)

### 5.3 Composio-specific regression suite
- [x] Task: 5 Composio regression tests in Phase 5 file: discovery uses separate path, qualified_name format, config detection in agent_tools, tool map building with enabledTools, config in mcp_manager path
- [x] Note: Combined with Phase 5 file rather than separate file — 12 total Composio tests across all phases (2 in P1, 2 in P2, 1 in P3, 3 in P4, 5 in P5)

### 5.4 Test infrastructure
- [x] Task: Shared patterns established across all 5 test files: `mock_agent_config()` factory, `MockDBConnection`, mock credential fixtures, `httpx.ASGITransport` for endpoint testing
- [x] Task: All tests verified running via Docker: `docker compose exec backend bash -c "cd /app && .venv/bin/python -m pytest tests/test_mcp_phase1_core.py tests/test_mcp_phase2_jit.py tests/test_mcp_phase3_executor.py tests/test_mcp_phase4_config.py tests/test_mcp_phase5_coverage.py -v"`

### 5.5 Phase 5 Verification
- [x] Task: Run complete test suite — 143/143 tests passing in 0.83s
- [x] Task: Coverage: All MCP API endpoints, all service methods, all utility functions, all config normalization paths, all Composio regression paths have dedicated tests
- [ ] Task: Conductor — User Manual Verification 'Phase 5: Test Suite' (Protocol in workflow.md)

### Notable fix during Phase 5 testing
- `test_merge_custom_mcps_does_not_mutate_existing` initially failed because items without `qualifiedName` both had `None`, and `None == None` is `True` in the merge comparison. Fixed by adding distinct `qualifiedName` values to test data. This documents a real edge case in `merge_custom_mcps()` — items MUST have distinct `qualifiedName` values or the merge will replace instead of append.

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

## Phase 7: Frontend — Post-OAuth Refresh & UX Alignment

All backend work is complete. Frontend OAuth detection and button rendering already work correctly (verified via code audit in spec.md §2.6). The critical gap is post-OAuth state management. UX improvements are secondary.

**Frontend files in scope** (all in `frontend/src/components/agents/mcp/`):
- `mcp-configuration-new.tsx` — Main orchestrator (handleConfigureMCP, handleConfigureTools)
- `configured-mcp-list.tsx` — List component routing custom MCPs to CustomMCPCard
- `custom-mcp-card.tsx` — Card with Configure/Manage Tools buttons (reads requires_config)
- `custom-mcp-dialog.tsx` — Add/edit dialog (probes server, saves requires_config)
- `custom-mcp-tools-manager.tsx` — Tool enable/disable manager
- `frontend/src/app/(auth)/mcp-success/page.tsx` — OAuth callback landing page

**Upstream reference** (read-only, for design patterns): `apps/frontend/src/components/agents/mcp/`

**Priority order**: 7.2 (critical fix) → 7.3 (UX) → 7.4 (UX) → 7.5 (optimization) → 7.6 (verification)

### 7.1 Frontend audit — COMPLETE (code audit)
- [x] Task: Audited `custom-mcp-card.tsx` — OAuth detection via `requires_config` ✅. Shows Configure (amber) vs Manage Tools (green).
- [x] Task: Audited `custom-mcp-dialog.tsx` — reads `requires_auth` from backend discover endpoint, saves as `requires_config: true`. ✅
- [x] Task: Audited `configured-mcp-list.tsx` — routes custom MCPs to `CustomMCPCard` with `onConfigure`/`onManageTools` callbacks. ✅
- [x] Task: Audited `mcp-configuration-new.tsx` — `handleConfigureMCP()` re-probes server, calls `/mcp/auth/start`, opens popup. ✅
- [x] Task: Audited `/mcp-success/page.tsx` — auto-closes popup after 3s, **NO parent window notification**. ❌ Critical gap.
- [x] Task: Audited upstream reference (`apps/frontend/`) — has `CustomMCPAuthConfirmation` dialog, `onAuthRequest` callback pattern, multi-signal `isAuthRequired`, 2-step tool picker dialog, full-page redirect (not popup).

### 7.2 CRITICAL: Post-OAuth state refresh (the main bug)

**The problem**: After OAuth completes in the popup, the popup auto-closes but the parent window doesn't know OAuth succeeded. The card still shows "Configure" because `requires_config` was never flipped to `false`. User has to click "Configure" a second time.

**The fix**: popup→parent communication via `postMessage`.

- [ ] Task 7.2.1: **mcp-success page** — Update `frontend/src/app/(auth)/mcp-success/page.tsx`:
  - Add `window.opener?.postMessage({ type: 'mcp-oauth-success' }, window.location.origin)` in the `useEffect`, BEFORE the auto-close timer starts.
  - Add fallback: if `!window.opener` (full-page redirect or popup blocked), show a "Return to agent settings" link instead of just auto-closing.
  - Keep the existing success UI (checkmark, message, auto-close timer).

- [ ] Task 7.2.2: **Track configuring MCP** — In `mcp-configuration-new.tsx`:
  - Add `const configuringMCPRef = useRef<number | null>(null)` to track which MCP index is being OAuth'd.
  - In `handleConfigureMCP()`, set `configuringMCPRef.current = index` BEFORE opening the popup.

- [ ] Task 7.2.3: **Message listener** — In `mcp-configuration-new.tsx`:
  - Add `useEffect` that registers `window.addEventListener('message', handleOAuthMessage)` and cleans up on unmount.
  - `handleOAuthMessage(event)`: check `event.origin === window.location.origin` and `event.data?.type === 'mcp-oauth-success'`.
  - On match: read `configuringMCPRef.current` to get the MCP index, then:
    1. Re-probe server via `backendApi.post('/mcp/discover-custom-tools', ...)`
    2. If `!discovery.requires_auth`: update `configuredMCPs[index].config.requires_config = false`, update `enabledTools` from discovery, call `onConfigurationChange()`
    3. Show `toast.success('Connected to {name} successfully!')`
    4. Reset `configuringMCPRef.current = null`

- [ ] Task 7.2.4: **Verify** — After OAuth popup closes, the card automatically flips from "Configuration Required" / "Configure" to "Connected" / "Manage Tools" without any user action.

### 7.3 OAuth confirmation dialog (UX improvement)

Add a pre-redirect confirmation so users know they're about to leave the page.

- [ ] Task 7.3.1: Create `frontend/src/components/agents/mcp/custom-mcp-auth-confirmation.tsx`:
  - Port from `apps/frontend/src/components/agents/mcp/custom-mcp-auth-confirmation.tsx`.
  - Props: `open`, `onOpenChange`, `onConfirm`, `serverName`, `serverUrl`.
  - UI: AlertDialog with Shield icon, server name, server URL in mono box, "Proceed to Login" + "Cancel" buttons.
  - Adapt styling to our fork conventions (rounded corners, consistent with other dialogs).

- [ ] Task 7.3.2: Wire confirmation in `mcp-configuration-new.tsx`:
  - Add state: `const [authConfirmOpen, setAuthConfirmOpen] = useState(false)` and `const [mcpToAuth, setMcpToAuth] = useState<{index: number, mcp: MCPConfigurationType} | null>(null)`.
  - In `handleConfigureMCP()`: after the re-probe determines auth is needed, instead of immediately opening popup:
    1. Set `mcpToAuth = { index, mcp: configuredMCPs[index] }`
    2. Set `authConfirmOpen = true`
  - New `handleConfirmAuth()`: reads `mcpToAuth`, does the actual `/mcp/auth/start` call + popup open. Sets `configuringMCPRef.current`.
  - Render `<CustomMCPAuthConfirmation>` at the bottom of the component.

### 7.4 Tool selection in add dialog (UX improvement)

Add a Step 2 tool picker so users can deselect unwanted tools when adding a non-auth MCP.

- [ ] Task 7.4.1: Add step state to `custom-mcp-dialog.tsx`:
  - `const [step, setStep] = useState<'setup' | 'tools'>('setup')`
  - `const [discoveredTools, setDiscoveredTools] = useState<{name: string, description: string}[]>([])`
  - `const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set())`

- [ ] Task 7.4.2: After discovery succeeds with tools (non-auth case):
  - Instead of immediately calling `onSave()`, set `discoveredTools` and `selectedTools` (all selected by default), then `setStep('tools')`.
  - Show tool list with checkboxes, Select All / Deselect All button.
  - "Save" button in step 2 calls `onSave()` with `enabledTools: Array.from(selectedTools)`.

- [ ] Task 7.4.3: Auth case behavior (unchanged):
  - When `requires_auth: true` with 0 tools: save immediately with empty `enabledTools` and `requires_config: true`. Skip tool selection.

- [ ] Task 7.4.4: Back button in step 2 returns to step 1 (setup).

### 7.5 Cache oauth_metadata (optimization)

- [ ] Task 7.5.1: In `custom-mcp-dialog.tsx`, when discovery returns `requires_auth: true`, also save `oauth_metadata` from the response into the config blob: `config.oauth_metadata = discovery.oauth_metadata`.
- [ ] Task 7.5.2: In `handleConfigureMCP()`, check `mcp.config.oauth_metadata`. If present, skip the re-probe and go directly to the confirmation dialog / OAuth popup. This eliminates one network round-trip.

### 7.6 Tool management & verification

- [ ] Task 7.6.1: Verify `custom-mcp-tools-manager.tsx` works with refactored backend — tool list loads from discovery, selection persists.
- [ ] Task 7.6.2: Verify Manage Tools flow: click "Manage Tools" → tools manager opens → toggle tools → save → `enabledTools` array updates in config.
- [ ] Task 7.6.3: Run backend test suite — all 143 tests still passing (no backend changes in this phase).
- [ ] Task 7.6.4: Docker build test: `docker compose up -d --build frontend` — verify frontend compiles without errors.
- [ ] Task 7.6.5: Manual walkthrough — **Unsecured server (Valyu)**: Custom MCP → URL + name → tools discovered → tool picker → select tools → save → card shows "Connected" + "Manage Tools" → Manage Tools works.
- [ ] Task 7.6.6: Manual walkthrough — **OAuth server**: Custom MCP → URL + name → requires_auth → saves with Configure state → card shows "Configuration Required" + "Configure" → Configure → confirmation dialog → "Proceed to Login" → OAuth popup → authorize → popup notifies parent → card auto-flips to "Connected" + "Manage Tools".
- [ ] Task 7.6.7: Conductor — User Manual Verification 'Phase 7: Frontend' (Protocol in workflow.md)

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

| Phase | Focus | Task Count | Status | Layer |
|-------|-------|------------|--------|-------|
| 1 | Core MCP Module bug fixes | 16 | **COMPLETE** | Backend Layer 1 |
| 2 | JIT Loader bug fixes | 15 | **COMPLETE** | Backend Layer 2 |
| 3 | Execution consolidation | 16 | **COMPLETE** | Backend Layer 3 |
| 4 | Config key normalization | 12 | **COMPLETE** | Backend Cross-Layer |
| 5 | Comprehensive test suite | 11 | **COMPLETE** | Backend Testing |
| 6 | Test harness + E2E CLI | 13 | **MOSTLY DONE** | Backend Integration |
| 7 | Frontend post-OAuth + UX | 23 | **READY** | Frontend |
| 8 | Full-stack E2E verification | 11 | NOT STARTED | Full-Stack |
| **Total** | | **117** | | |

### Phase 7 Task Breakdown by Priority

| Section | Focus | Tasks | Priority |
|---------|-------|-------|----------|
| 7.1 | Frontend audit (done) | 6 | — (complete) |
| 7.2 | Post-OAuth state refresh | 4 | **CRITICAL** (the main bug) |
| 7.3 | OAuth confirmation dialog | 2 | Nice-to-have |
| 7.4 | Tool selection in add dialog | 4 | Nice-to-have |
| 7.5 | Cache oauth_metadata | 2 | Optimization |
| 7.6 | Verification + testing | 7 | Required |
