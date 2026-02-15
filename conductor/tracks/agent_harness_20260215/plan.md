# Implementation Plan: Agent Harness (Isolated CLI Agent Execution)

## Phase 1: Scaffolding & Agent Integration
- [ ] Task: Create `backend/core/test_harness/mcp_lab/agent_harness.py` with basic CLI structure.
- [ ] Task: Integrate `AgentRunner` with mocked `DBConnection` and `CredentialService`.
- [ ] Task: Implement `MockThreadManager` to bypass real Supabase message persistence.
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Scaffolding & Agent Integration' (Protocol in workflow.md)

## Phase 2: Scripting & Context Management
- [ ] Task: Implement `ScriptLoader` to parse JSON/YAML action sequences (e.g., call tool X with args Y).
- [ ] Task: Implement `ContextManager` to inject conversation history from local files.
- [ ] Task: Implement state management for the "Harness Agent" to track tool result history.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Scripting & Context Management' (Protocol in workflow.md)

## Phase 3: Discovery & Tool Execution
- [ ] Task: Implement `discover_mcp_tools` simulation that pulls schemas from the JIT loader.
- [ ] Task: Implement tool result propagation logic (returning results from MCP server to the "Agent").
- [ ] Task: Add support for "Bearer Token" authentication injection during execution.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Discovery & Tool Execution' (Protocol in workflow.md)

## Phase 4: Reporting & Traceability
- [ ] Task: Implement real-time terminal logging for tool requests and responses.
- [ ] Task: Implement `TraceGenerator` to write the `latest_run_trace.json`.
- [ ] Task: Implement `SchemaSnapshot` to export generated JSON schemas.
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Reporting & Traceability' (Protocol in workflow.md)

## Phase 5: Verification & E2E Validation
- [ ] Task: Write integration tests for the harness itself using `pytest`.
- [ ] Task: Execute E2E run against Valyu AI (API Key) and verify success.
- [ ] Task: Execute E2E run against Desktop Commander (OAuth) and verify success.
- [ ] Task: Conductor - User Manual Verification 'Phase 5: Verification & E2E Validation' (Protocol in workflow.md)
