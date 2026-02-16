# Track: Advanced MCP Server Support Refactor

**Status**: Phases 1-6 COMPLETE, Phase 7 READY (Frontend)
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
| 7 | **READY** | — | Frontend post-OAuth refresh (critical) + UX alignment. 23 tasks. |
| 8 | NOT STARTED | — | Full-stack E2E production verification |

**Total tests**: 143 passing in ~0.83s

## Test Files

| File | Phase | Tests | Classes |
|------|-------|-------|---------|
| `tests/test_mcp_phase1_core.py` | 1 | 13 | API endpoints, encryption, Composio regression |
| `tests/test_mcp_phase2_jit.py` | 2 | 22 | JIT loader, SSRF validation, Composio regression |
| `tests/test_mcp_phase3_executor.py` | 3 | 31 | Unified executor: dual-mode, SSRF, dispatch, headers |
| `tests/test_mcp_phase4_config.py` | 4 | 32 | Config normalization, CanonicalMCPConfig, backward compat |
| `tests/test_mcp_phase5_coverage.py` | 5 | 45 | Auth service, registry, helpers, Composio, edge cases |

## Run All Tests

```bash
docker compose exec backend bash -c "cd /app && .venv/bin/python -m pytest tests/test_mcp_phase1_core.py tests/test_mcp_phase2_jit.py tests/test_mcp_phase3_executor.py tests/test_mcp_phase4_config.py tests/test_mcp_phase5_coverage.py -v"
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

## Phase 7 Frontend Analysis Summary

**Completed code audit** of all frontend MCP components (6 files in `frontend/src/components/agents/mcp/` + `/mcp-success` page). Compared against upstream reference (`apps/frontend/`).

### What Already Works ✅
- **OAuth detection**: Dialog reads `requires_auth` from backend, saves as `requires_config` ✅
- **Button rendering**: Card shows "Configure" vs "Manage Tools" based on `requires_config` ✅
- **OAuth popup initiation**: `handleConfigureMCP()` calls `/mcp/auth/start` with correct params ✅
- **Component wiring**: `ConfiguredMcpList` → `CustomMCPCard` → callbacks properly connected ✅

### Critical Gap ❌
- **Post-OAuth state refresh**: After OAuth popup closes, parent window doesn't know. Card stays stuck on "Configure". User has to click Configure again. Fix: `postMessage` from popup → event listener in parent → auto re-probe → flip state.

### UX Gaps (nice-to-have)
- **No OAuth confirmation dialog**: Upstream has `CustomMCPAuthConfirmation` (Shield icon + "Proceed to Login"). We go straight to redirect.
- **No tool selection on add**: We auto-enable all discovered tools. Upstream has 2-step dialog with checkboxes.
- **oauth_metadata discarded**: Backend returns it, frontend ignores it, forces re-probe every Configure click.

### Phase 7 Priority Order
1. **7.2** Post-OAuth state refresh (4 tasks) — **CRITICAL, the main bug**
2. **7.3** OAuth confirmation dialog (2 tasks) — nice UX
3. **7.4** Tool selection in add dialog (4 tasks) — nice UX
4. **7.5** Cache oauth_metadata (2 tasks) — optimization
5. **7.6** Verification + testing (7 tasks) — required
