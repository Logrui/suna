# Plan: MCP Test Harness Implementation (Dynamic)

## Phase 1: Interactive CLI & Mocks ✅
- [x] Create directory structure at `backend/core/test_harness/mcp_lab`.
- [x] Implement `mocks.py` (File-driven for layout/secrets).
- [x] Implement CLI sub-command structure (`add`, `discover`, `auth`, `run`) in `runner.py`.

## Phase 2: Dynamic Onboarding (`add` & `auth`) ✅
- [x] Implement Probing logic in `cmd_add`.
- [x] Implement **OAuth Flow A** in `cmd_auth`:
    - [x] Discover metadata.
    - [x] Dynamic Client Registration (DCR) fallback.
    - [x] Print authorization URL.
    - [x] Accept code input from user (Complete - CLI flow working).
- [x] Implement Save logic for Query Auth into `local_lab.json`.

## Phase 3: Discovery & Prompting (`discover`) ✅
- [x] Integrate `MCPJITLoader` to read from `local_lab.json`.
- [x] Verify JIT tool map handles both Desktop Commander and Valyu.
- [x] Implement display of human-readable names via `PromptManager`.

## Phase 4: Scripted Simulation (`run`) ✅
- [x] Implement basic `cmd_run` loop.
- [x] Implement **Scripted Flow A**:
    - [x] Turn 1: Print System Prompt summary.
    - [x] Turn 2: Mock Agent calling `discover_mcp_tools`.
    - [x] Turn 3: Mock Agent calling a specific tool (e.g., `list_devices` or `research`).
- [x] Handle Tool result propagation back to "Agent" turn.

## Phase 5: Traceability & Reliability
- [ ] Ensure `langfuse` client is initialized and flushed in the harness.
- [ ] Wrap `mcp_loader` and `mcp_service` calls in spans.
- [ ] Generate local `latest_trace.json`.
- [ ] Add reliability tests for connection timeouts and 5xx errors in the harness.

