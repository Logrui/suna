# Specification: Advanced MCP Server Support Refactor

## 1. Overview

This is a **master track** consolidating all MCP (Model Context Protocol) work into a single comprehensive refactor. It merges 4 prior tracks, incorporates findings from a full-stack codemap analysis (`mcp-systems-codemap.md`) and pipeline trace (`MCP_PIPELINE_TRACE.md`), and addresses blocking runtime bugs, execution layer duplication, and frontend integration issues.

### Consolidated Tracks (Archived)

| Prior Track | Status at Archive | Key Deliverables |
|-------------|-------------------|------------------|
| `mcp_dynamic_auth_20260211` | [~] ~83% | OAuth 2.1 endpoints, auth service, PKCE, DCR |
| `feature_custom_mcp_oauth_2stage_20260212` | [x] ~85% | 2-stage registration UI, CustomMCPCard, agent_id resilience |
| `mcp_test_harness_20260213` | [~] ~78% | CLI harness (add/discover/auth/run), mock infrastructure |
| `agent_harness_20260215` | [x] marked complete | Agent-level CLI harness spec (tasks not implemented in plan) |

### Architecture: Three-Layer Pipeline (Corrected Understanding)

The MCP system is **not** two competing systems. It is a **three-layer pipeline** where each layer handles different stages:

```
┌─────────────────────────────────────────────────────────────────────┐
│  LAYER 1: Core MCP Module (mcp_module/)          Stages 1-4       │
│  Registration, OAuth, Discovery, Tool Caching                       │
│  Files: api.py, mcp_service.py, auth_service.py,                   │
│         custom_mcp_registry_service.py, credential_service.py       │
├─────────────────────────────────────────────────────────────────────┤
│  LAYER 2: JIT Loader (jit/)                      Stage 5           │
│  Build in-memory tool map from cached agent config (ZERO server     │
│  calls). Reads enabledTools[], creates MCPToolInfo entries.         │
│  Files: mcp_loader.py, loader.py, config.py                        │
├─────────────────────────────────────────────────────────────────────┤
│  LAYER 3: Execution (jit/ + tools/)              Stage 6           │
│  Lazy schema loading, tool activation, actual MCP server calls.     │
│  Files: jit/mcp_loader.py (schema), jit/loader.py (activation),    │
│         tools/mcp_tool_wrapper.py, tools/utils/mcp_tool_executor.py │
│         ⚠️ DUPLICATE EXECUTORS — consolidation target               │
└─────────────────────────────────────────────────────────────────────┘
```

**The six-stage MCP pipeline:**

| Stage | Description | Layer | Server Calls? |
|-------|-------------|-------|---------------|
| 1 | **Register** MCP server (frontend → backend API) | Core MCP Module | No |
| 2 | **Configure** MCP server (OAuth flow if needed) | Core MCP Module | Yes (OAuth provider) |
| 3 | **Discover & cache** tools (probe MCP server, save to agent config) | Core MCP Module | Yes (MCP server) |
| 4 | **Enable/disable** specific tools per agent | Agent Tools API | No |
| 5 | **Build runtime tool map** from cached config | JIT Loader | No (reads cache only) |
| 6 | **Execute** tools (lazy schema load + call MCP server) | Execution Layer | Yes (MCP server) |

**Key insight**: Layers 1 and 2 are complementary and correctly separated. The problem is **only in Layer 3 (Execution)**, where two parallel execution paths exist:

| Execution Path | Entry | Used When |
|----------------|-------|-----------|
| **JIT path** | `jit/loader.py` → `jit/mcp_loader.py` → dynamic wrapper | JIT activates tool lazily, creates wrapper |
| **Legacy path** | `run/mcp_manager.py` → `tools/mcp_tool_wrapper.py` → `tools/utils/mcp_tool_executor.py` | Eager bootstrap fallback, runs redundantly |

Both paths run during every agent start. JIT activates tools lazily, then Legacy eagerly connects to all servers anyway, then Legacy's registrations get cleaned up. The Legacy path does redundant work and has a separate `MCPToolExecutor` class with different behavior.

## 2. Problem Statement

### 2.1 Stage 6 Execution Layer Duplication
- **Two `MCPToolExecutor` classes**: `jit/mcp_tool_wrapper.py::MCPToolExecutor` and `tools/utils/mcp_tool_executor.py::MCPToolExecutor` — same class name, different implementations, different behavior
- **Redundant eager loading**: `run/mcp_manager.py` registers `MCPToolWrapper` which eagerly connects to all MCP servers, even though JIT already handles lazy activation — wasted startup time
- **SSRF protection gap**: Legacy executor (`tools/utils/mcp_tool_executor.py`) has SSRF validation via `is_safe_url()`. JIT executor (`jit/mcp_tool_wrapper.py`) does not. Since JIT's wrappers win at runtime, **production has no SSRF protection**
- **Different return types**: Legacy returns `ToolResult` objects; JIT returns raw output — inconsistent contract for ThreadManager

### 2.2 Core MCP Module Bugs (Stages 1-4)
These bugs exist in the registration/discovery/auth layer:

1. `mcp_service.py`: `_get_composio_headers()` not async but called with `await` → TypeError at runtime
2. `custom_mcp_registry_service.py`: Missing `import time` → NameError on `time.time()`
3. `credential_service.py`: Silent decryption failure returns `{}` → MCPs run without credentials
4. **Duplicate dataclasses**: `CustomMCPConnectionResult` defined identically in both `mcp_service.py` and `custom_mcp_registry_service.py`
5. **Duplicate exceptions**: `mcp_service.py` re-defines all exception classes already in `exceptions.py`
6. **Discovery service mismatch**: `api.py` calls `mcp_service.discover_custom_tools()` (simple, no path probing) instead of `custom_mcp_registry_service.discover_custom_tools()` (advanced, with path probing and OAuth detection)
7. **Mutable default**: `config: Optional[Dict] = {}` in Pydantic model (should be `= None`)

### 2.3 JIT Loader Bugs (Stage 5-6)
These bugs exist in the runtime/execution layer:

1. `jit/mcp_registry.py`: Variable name typo `toolkit_start` → NameError
2. `tools/utils/mcp_tool_executor.py`: Undefined variable `config` in `_get_headers()` → NameError
3. **No SSRF protection** in JIT execution path
4. **Redundant schema loading**: JIT connects to MCP server to `list_tools()` in Stage 6 even though full schemas were already cached in agent config during Stage 3

### 2.4 Configuration Key Chaos (All Stages)
Same concept uses different keys depending on which layer handles it:

| Concept | Stage 1-4 (Core MCP) | Stage 5 (JIT) | Frontend |
|---------|----------------------|---------------|----------|
| Tool whitelist | `enabled_tools` | `enabledTools` | `enabledTools` |
| Unique ID | `qualified_name` | `qualifiedName` | `qualifiedName` |
| Server type | `type` or `customType` | `customType` or `type` | `type` |
| Server URL | `config.url` | `config.url` or `config.serverUrl` | `url` or `config.url` |
| Custom headers | `custom_headers` | `config.headers` | `custom_headers` |

### 2.5 Header Extraction Duplication (Cross-Layer)
`_get_headers()` is implemented 4+ times across files with subtle differences:
- `tools/utils/mcp_tool_executor.py`
- `tools/utils/mcp_connection_manager.py`
- `jit/mcp_loader.py`
- `mcp_module/mcp_service.py`

### 2.6 Frontend Issues
- OAuth URL construction uses hardcoded `/mcp-success` path
- Query key instability from URL fallback pattern in `use-custom-mcp-tools.ts`
- Mixed proxy and direct API routes in `use-secure-mcp.ts`
- Missing OAuth confirmation UI (exists in upstream `apps/frontend/` but not in our `frontend/`)

## 3. Implementation Order

**Backend first, frontend second.** All backend layers (1-3) must be fixed, tested, and verified before any frontend work begins. This ensures the frontend is built against stable, tested API contracts rather than a moving target.

```
Phase A: Backend Layer 1 fixes (Core MCP Module, stages 1-4)
Phase B: Backend Layer 2 fixes (JIT Loader, stage 5)
Phase C: Backend Layer 3 consolidation (Execution, stage 6)
Phase D: Backend config key normalization (cross-layer)
Phase E: Backend unit tests for all MCP endpoints, services, and logic
Phase F: Test harness completion + E2E CLI verification
Phase G: Frontend 2-stage OAuth & MCP configuration
Phase H: Full-stack E2E production verification
```

### Composio Compatibility Constraint

The existing Composio MCP integration is **fully operational** and must remain working throughout this refactor. Every phase must include a Composio regression check:
- Composio app discovery still returns tools
- Composio tool execution still works in agent threads
- Composio credential/profile flow is unaffected
- No changes to Composio-specific code paths unless explicitly required for a bug fix

### Testing Requirement

Every phase of backend work must produce runnable unit tests. Tests must be executable in two ways:
1. **Individual tests via Docker**: `docker compose exec backend uv run pytest <path>` for isolated service/endpoint testing
2. **Test harness CLI**: `uv run python -m core.test_harness.mcp_lab.runner <command>` for integration-level verification

Test coverage must include:
- **Stage 1-2**: All `/v1/mcp/` API endpoints (discover, auth/start, auth/callback, client-metadata)
- **Stage 3**: Discovery services (`MCPService.discover_custom_tools`, `CustomMCPRegistryService.discover_custom_tools`) for both HTTP and SSE transports
- **Stage 4**: Agent tools API (`update_custom_mcp_tools_for_agent`, `update_agent_custom_mcps`)
- **Stage 5**: JIT tool map building (`MCPJITLoader.build_tool_map`, `_process_mcp_config`)
- **Stage 6**: Unified executor (schema loading, tool execution for SSE/HTTP/JSON transports)
- **Auth**: OAuth metadata discovery, PKCE generation, state validation, token exchange, credential encryption/decryption
- **Composio**: Regression tests for Composio discovery and execution paths

## 4. Requirements

### 4.1 Layer 3 Execution Consolidation (Stage 6)
- **Unify executors**: Consolidate the two `MCPToolExecutor` classes into one canonical implementation
- **Port SSRF protection**: Bring `is_safe_url()` from Legacy executor into the unified executor so all execution paths are protected
- **Standardize return type**: All execution paths return `ToolResult` consistently
- **Remove redundant eager loading**: Clean up `run/mcp_manager.py`'s redundant `MCPToolWrapper` registration that duplicates what JIT already does
- **Consolidate `_get_headers()`**: Extract into a single shared utility in `core/utils/mcp_helpers.py`, imported by all layers

### 4.2 Layer 1 Bug Fixes (Core MCP Module, Stages 1-4)
- Fix `_get_composio_headers()` async/await mismatch
- Add `import time` to `custom_mcp_registry_service.py`
- Fix credential decryption to raise/log on failure instead of silent empty return
- Remove duplicate `CustomMCPConnectionResult` — define in one file, import everywhere
- Remove duplicate exception classes from `mcp_service.py` — import from `exceptions.py`
- Route `api.py` discovery to `CustomMCPRegistryService` (advanced) instead of `MCPService` (simple)
- Fix mutable default `config = {}` → `config = None` in Pydantic models

### 4.3 Layer 2 Bug Fixes (JIT Loader, Stage 5-6)
- Fix variable name typo in `jit/mcp_registry.py`
- Fix undefined `config` variable in `tools/utils/mcp_tool_executor.py`
- Add SSRF validation to JIT execution path
- Evaluate whether Stage 6 schema loading can use cached schemas from agent config (Stage 3) instead of reconnecting to the MCP server

### 4.4 Configuration Key Normalization (All Layers)
- Define canonical config key names in a single location (e.g., `core/utils/mcp_config_schema.py`)
- Normalize at API boundaries: frontend sends camelCase, backend normalizes to snake_case on ingress
- Ensure `enabledTools`/`enabled_tools` and `qualifiedName`/`qualified_name` resolve consistently across all 3 layers

### 4.5 Test Harness Completion
- Finish harness Phase 5: Langfuse tracing, trace export, reliability tests
- Verify harness works with the unified execution layer
- E2E validation against Desktop Commander (OAuth) and Valyu (API Key)

### 4.6 Frontend: 2-Stage OAuth & MCP Configuration
- Fix OAuth redirect URL construction
- Stabilize React Query keys for custom MCP tools
- Port `CustomMCPAuthConfirmation` component from upstream reference (`apps/frontend/`)
- Implement full 2-stage flow: register (URL/name) → configure (OAuth) as separate steps
- Complete E2E production verification of the add → configure → use flow

## 5. Reference Documents

Located in repo root (generated during analysis):
- `mcp-systems-codemap.md` — Full-stack architecture codemap with file trees, data flows, and issue registry
- `MCP_PIPELINE_TRACE.md` — Stage-by-stage pipeline trace with exact line numbers
- `MCP_MENTAL_MODEL_ANSWER.md` — Pipeline stage ownership clarification
- `MCP_SYSTEM_CLASSIFICATION.md` — System membership, cross-dependencies, data flow
- `MCP_QUICK_REFERENCE.md` — Quick lookup for stages, files, and debugging

Prior track specs and plans archived in `conductor/tracks/` (see Section 1).

## 6. Success Criteria

### 6.1 Architecture & Code Quality
1. ✅ **Unified Stage 6 executor**: One `MCPToolExecutor` class with dual-mode (Legacy + Direct), used by both JIT activation and backward-compat paths — *Phase 3*
2. ✅ **No redundant eager loading**: JIT lazy activation is primary; eager path only for Composio-style configs — *Phase 3*
3. ✅ **Zero runtime bugs**: All blocking bugs fixed (async/await, import time, toolkit_start typo, undefined config var, decryption silence) — *Phases 1-2*
4. ✅ **Consistent config keys**: `get_config_value()` + `CanonicalMCPConfig` + `normalize_to_snake/camel()` — *Phase 4*
5. ✅ **SSRF protection on all execution paths**: `is_safe_url()` in JIT discovery, JIT execution, and unified executor — *Phases 2-3*
6. ✅ **Credential safety**: `map_to_credential()` raises ValueError on decryption failure — *Phase 1*
7. ✅ **Shared utilities**: `build_mcp_headers()` in `mcp_helpers.py`, `get_config_value()` in `mcp_config_schema.py` — *Phases 3-4*
8. ✅ **No duplicate definitions**: Single `CustomMCPConnectionResult` in `custom_mcp_registry_service.py`, single exception hierarchy in `exceptions.py` — *Phase 1*

### 6.2 Composio Regression
9. ✅ **Composio discovery intact**: 12 Composio regression tests across Phases 1-5, all passing — *Phases 1-5*
10. ⏳ **Composio execution intact**: Unit-tested via mock dispatch; real agent thread verification pending — *Phase 8*
11. ✅ **Composio credentials intact**: Config detection, qualified_name format, mcp_manager path all tested — *Phases 4-5*

### 6.3 MCP Server Registration (Full Pipeline, Stages 1-4)
12. ⏳ **Unsecured server registration**: Backend API tested; frontend 2-stage flow pending — *Phase 7*
13. ⏳ **OAuth server registration**: Backend OAuth flow tested; frontend UI pending — *Phase 7*
14. ⏳ **2-stage UX**: Backend contracts stable; frontend implementation pending — *Phase 7*

### 6.4 Tool Discovery (Schema + Display + Execution, Stages 3-6)
15. ✅ **Unsecured tool discovery**: Valyu AI 11 tools discovered via streamable HTTP in harness E2E — *Phase 6 verified*
16. ⏳ **OAuth tool discovery**: Desktop Commander returns 401 with mock token (expected); needs real OAuth tokens — *Phase 6/8*
17. ✅ **Tool execution**: `valyu_search` executed successfully (14.1s) via unified MCPToolExecutor in harness E2E — *Phase 6 verified*

### 6.5 Test Harness (CLI Verification)
18. ✅ **Harness `discover` command**: All 4 steps pass (JIT→Registry→Schemas→Prompt), 11 tools from Valyu — *Phase 6 verified*
19. ✅ **Harness `run` command**: 3-turn E2E (JIT+prompt → discover_mcp_tools → execute_mcp_tool) succeeds with real results — *Phase 6 verified*
20. ⏳ **Harness OAuth workflow**: Harness `auth` command exists; requires user for OAuth code exchange — *Phase 6*

### 6.6 Unit Test Coverage
21. ✅ **Stage 1-2 API tests**: discover, auth/start, auth/callback, client-metadata all tested — *Phases 1, 5*
22. ✅ **Stage 3 discovery tests**: `CustomMCPRegistryService` tested for URL requirements, path probing, unsupported types — *Phase 5*
23. ✅ **Stage 4 agent tools tests**: Config detection in `agent_tools.py` tested via Composio regression — *Phase 5*
24. ✅ **Stage 5 JIT tests**: `build_tool_map`, `_process_mcp_config`, `activate_tool` all tested — *Phase 2*
25. ✅ **Stage 6 execution tests**: Unified executor tested for SSE/HTTP/JSON/Composio dispatch, SSRF, headers, result types — *Phase 3*
26. ✅ **Auth tests**: OAuth metadata discovery (RFC 9419 chain), PKCE S256, state round-trip, state tampering — *Phase 5*
27. ✅ **Composio regression tests**: 12 dedicated Composio tests across all 5 phases — *Phases 1-5*
28. ✅ **Executable in Docker**: All 143 tests run via single Docker command in ~0.83s — *Phase 5*

### 6.7 Frontend Integration
29. ⏳ **Frontend OAuth works**: Pending — *Phase 7*
30. ⏳ **Frontend tool management**: Pending — *Phase 7*

## 7. Out of Scope
- Composio integration refactor (separate track)
- Mobile frontend tool views
- Knowledge base / embeddings changes
- Browser extension MCP support
- Replacing Core MCP Module with JIT (they are complementary layers, not competing)
- Replacing JIT Loader with Core MCP Module (each handles different pipeline stages)
