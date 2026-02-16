# Track: Advanced MCP Server Support Refactor

**Status**: Phases 1-6 COMPLETE, Phase 7 IN PROGRESS (Frontend — core fixes done, transport persistence done, UX polish remaining)
**Priority**: High
**Created**: 2026-02-15

## Progress

| Phase | Status | Tests | Key Deliverable |
|-------|--------|-------|-----------------|
| 1 | **COMPLETE** | 13 | Core MCP Module bug fixes (async/await, imports, dedup, routing) |
| 2 | **COMPLETE** | 22 | JIT Loader bug fixes (SSRF, typos, config var) |
| 3 | **COMPLETE** | 31 | Unified MCPToolExecutor (dual-mode: legacy + direct) |
| 4 | **COMPLETE** | 32 | Config normalization (`get_config_value()`, `CanonicalMCPConfig`) |
| 5 | **COMPLETE** | 45 | Comprehensive gap-fill test suite |
| 6 | **MOSTLY DONE** | — | Harness E2E verified: discover (4/4 steps), run (3 turns), Valyu 11 tools |
| 7 | **IN PROGRESS** | 14 | Post-OAuth refresh, credential lookup, graceful fallback, qualifiedName standardization, Streamable HTTP transport detection + persistence. UX polish remaining (7.3-7.5). |
| 8 | NOT STARTED | — | Full-stack E2E production verification |

**Total tests**: 157 passing (143 core + 14 transport)

## Test Files

| File | Phase | Tests | Classes |
|------|-------|-------|---------|
| `tests/test_mcp_phase1_core.py` | 1 | 13 | API endpoints, encryption, Composio regression |
| `tests/test_mcp_phase2_jit.py` | 2 | 22 | JIT loader, SSRF validation, Composio regression |
| `tests/test_mcp_phase3_executor.py` | 3 | 31 | Unified executor: dual-mode, SSRF, dispatch, headers |
| `tests/test_mcp_phase4_config.py` | 4 | 32 | Config normalization, CanonicalMCPConfig, backward compat |
| `tests/test_mcp_phase5_coverage.py` | 5 | 45 | Auth service, registry, helpers, Composio, edge cases |
| `tests/test_mcp_registry_transport.py` | 7+ | 14 | SSE→Streamable HTTP fallback, transport detection, direct dispatch |

## Run All Tests

```bash
docker compose exec backend bash -c "cd /app && .venv/bin/python -m pytest tests/test_mcp_phase1_core.py tests/test_mcp_phase2_jit.py tests/test_mcp_phase3_executor.py tests/test_mcp_phase4_config.py tests/test_mcp_phase5_coverage.py tests/test_mcp_registry_transport.py -v"
```

## Documents

- **Specification**: [spec.md](./spec.md)
- **Implementation Plan**: [plan.md](./plan.md)
- **Metadata**: [metadata.json](./metadata.json)

## Reference Documents

- [MCP Pipeline Trace](./docs/MCP_PIPELINE_TRACE.md) — Stage-by-stage pipeline trace
- [MCP Mental Model](./docs/MCP_MENTAL_MODEL_ANSWER.md) — Pipeline stage ownership
- [MCP System Classification](./docs/MCP_SYSTEM_CLASSIFICATION.md) — System membership and dependencies
- [MCP Quick Reference](./docs/MCP_QUICK_REFERENCE.md) — Quick lookup reference
- [MCP Architecture Codemap](./docs/mcp-architecture-codemap.md) — Full-stack architecture codemap

## Archived Tracks (Consolidated Into This One)

- [../mcp_dynamic_auth_20260211/](../mcp_dynamic_auth_20260211/) — Dynamic MCP OAuth
- [../feature_custom_mcp_oauth_2stage_20260212/](../feature_custom_mcp_oauth_2stage_20260212/) — 2-Stage OAuth
- [../mcp_test_harness_20260213/](../mcp_test_harness_20260213/) — MCP Test Harness
- [../agent_harness_20260215/](../agent_harness_20260215/) — Agent Harness

## Key Architecture Decisions

1. **Dual-mode unified executor**: `MCPToolExecutor` supports both Legacy mode (backward-compat `execute_tool()`) and Direct mode (JIT-style `from_mcp_config()` + `execute()`). This avoided a big-bang migration.

2. **Config normalization via `get_config_value()`**: Rather than normalizing all configs at ingress, we added a reader function that checks both snake_case and camelCase. Storage remains camelCase for backward compatibility with existing DB records and frontend.

3. **`CanonicalMCPConfig` dataclass**: Typed intermediate representation with `from_raw()` (reads any format) and `to_storage()` (outputs camelCase). Used when explicit normalization is needed.

4. **Shared `build_mcp_headers()`**: Single header-building function in `mcp_helpers.py`, replacing 4+ duplicate implementations across layers.

5. **SSRF protection on all paths**: `is_safe_url()` validation added to JIT discovery and execution paths, matching the existing protection in the legacy executor.

6. **Canonical qualifiedName format**: `custom_mcp_{normalized_name}_{url_hash[:6]}` — human-readable, deterministic, transport-agnostic. `generate_custom_mcp_qualified_name()` in `mcp_helpers.py`. Fallback credential lookup (`get_credential_with_fallback()`) checks legacy formats for backward compatibility.

7. **Streamable HTTP transport support**: SSE→Streamable HTTP fallback in schema loading and tool execution. Discovery detects actual transport type and returns `detected_transport` field. Frontend persists as `detectedTransport` in agent config. Runtime uses `detectedTransport` for direct dispatch — skips SSE attempt when transport is known, eliminating fallback overhead.

## Phase 7 Frontend — Implementation Progress

**Code audit** complete. Core functionality implemented and deployed. UX polish tasks remain.

### Completed ✅
- **7.1 Frontend audit** — All 6 MCP frontend files + mcp-success page audited against upstream
- **7.2 Post-OAuth state refresh** — CRITICAL FIX DONE:
  - `mcp-success/page.tsx`: Added `window.opener.postMessage({ type: 'mcp-oauth-success' })` with retry mechanism and fallback UI
  - `mcp-configuration-new.tsx`: Added `useEffect` message listener for `mcp-oauth-success`, auto-refreshes MCP state via `queryClient.invalidateQueries`
  - Card now auto-flips from "Configure" → "Manage Tools" after OAuth popup completes
- **7.2+ Backend bug: OAuth credential lookup for live discovery** — FIXED:
  - `agent_tools.py`: Live tool discovery (refresh=true) now looks up OAuth tokens from `user_mcp_credentials` table via `credential_service.get_credential()`, not just from agent config JSON
  - Token injected into `mcp_config['access_token']` → flows through `_get_custom_headers()` → `Authorization: Bearer` header
- **7.2+ Backend bug: Graceful fallback on discovery failure** — FIXED:
  - `agent_tools.py`: Wrapped `mcp_service.discover_custom_tools()` in try/except. On failure with cached tools, returns cached data with `from_cache: True` + `refresh_error` field
  - `use-custom-mcp-tools.ts`: `refreshFromServer` protects cache — won't replace good data with empty result from failed refresh
  - `custom-mcp-tools-manager.tsx`: Refresh button stays visible as long as tools exist (not just when from_cache)
- **Connectors Refresh button** — Added to `mcp-configuration-new.tsx` Connectors modal (not in original plan, user-requested)
- **Manage Tools scroll fix** — Fixed invalid Tailwind class `min-h-400` → `min-h-0 h-full` in `custom-mcp-tools-selector.tsx`
- **Backend: PostgreSQL trigger search_path fix** — Migration for `credential_profile` triggers to use explicit `public.` schema
- **Backend: try/except guard around store_profile** — Prevents crash if profile storage fails during OAuth callback

### Completed (Post-7.2) ✅
- **qualifiedName standardization** — Canonical `custom_mcp_{name}_{url_hash[:6]}` format across 11 files (backend + frontend). Fallback credential lookup supports legacy formats. Frontend preserves `qualifiedName` through save round-trips.
- **Streamable HTTP transport detection** — Backend discovery returns `detected_transport` field. Frontend persists as `detectedTransport` in agent config. Runtime uses it for direct dispatch (skips SSE when `streamable-http` detected).
- **SSE→Streamable HTTP fallback** — Schema loading (`mcp_registry.py`) and tool execution (`mcp_tool_wrapper.py`, `mcp_tool_executor.py`) all fall back from SSE to Streamable HTTP on connection failure. Handles `ExceptionGroup` from anyio TaskGroup.
- **Transport test suite** — 14 tests in `test_mcp_registry_transport.py`: 9 unit tests (schema loading fallback, direct dispatch, ExceptionGroup handling) + 5 integration tests (full discovery→execute pipeline with transport routing).

### Remaining 🔲
- **7.3** OAuth confirmation dialog (port `CustomMCPAuthConfirmation` from upstream) — nice UX
- **7.4** Tool selection in add dialog (2-step flow with checkboxes) — nice UX
- **7.5** Cache `oauth_metadata` from discovery response — optimization
- **7.6** Verification + manual testing (Valyu unsecured + Desktop Commander OAuth E2E)

### Key Files Modified (Phase 7)
| File | Changes |
|------|---------|
| `frontend/src/app/(auth)/mcp-success/page.tsx` | postMessage to parent, retry, fallback UI |
| `frontend/src/components/agents/mcp/mcp-configuration-new.tsx` | OAuth message listener, Connectors Refresh button |
| `frontend/src/components/agents/mcp/custom-mcp-tools-selector.tsx` | Scroll fix (min-h-0 h-full) |
| `frontend/src/components/agents/mcp/custom-mcp-tools-manager.tsx` | Refresh button visibility fix |
| `frontend/src/hooks/agents/use-custom-mcp-tools.ts` | Cache protection, refresh_error type |
| `backend/core/agent_tools.py` | Credential lookup + graceful discovery fallback |
| `backend/supabase/migrations/20260216000000_fix_credential_profile_triggers.sql` | PostgreSQL trigger search_path fix |
| `backend/core/agentpress/mcp_registry.py` | SSE→Streamable HTTP fallback in schema loading, `detectedTransport` direct dispatch |
| `backend/core/jit/mcp_tool_wrapper.py` | SSE→Streamable HTTP fallback in JIT execution |
| `backend/core/tools/utils/mcp_tool_executor.py` | SSE→Streamable HTTP fallback in unified execution |
| `backend/core/mcp_module/custom_mcp_registry_service.py` | `detected_transport` in `CustomMCPConnectionResult` |
| `backend/core/mcp_module/api.py` | `detected_transport` in API response + qualifiedName standardization |
| `backend/core/utils/mcp_helpers.py` | `generate_custom_mcp_qualified_name()`, `resolve_qualified_name_from_config()` |
| `backend/core/credentials/credential_service.py` | `get_credential_with_fallback()` for legacy format compat |
| `backend/tests/test_mcp_registry_transport.py` | 14 transport routing tests (unit + integration) |
| `frontend/src/components/agents/mcp/types.ts` | `detectedTransport` field in `MCPConfiguration` interface |
| `frontend/src/components/agents/agent-mcp-configuration.tsx` | `detectedTransport` + `qualifiedName` persistence in round-trips |
| `frontend/src/components/agents/mcp/custom-mcp-dialog.tsx` | Reads `detected_transport` from backend discovery response |
| `frontend/src/components/agents/mcp/mcp-configuration-new.tsx` | Persists `detectedTransport` in save paths, deterministic qualifiedName |
