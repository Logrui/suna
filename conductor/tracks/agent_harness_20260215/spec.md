# Specification: Agent Harness (Isolated CLI Agent Execution)

## Overview
This track implements a dedicated CLI-based test harness (`agent_harness.py`) to execute agent runs in an isolated environment. The primary goal is to verify the reliable operation of `discover_mcp_tools` and tool execution for both authenticated (OAuth) and unauthenticated (API Key) MCP servers. This harness serves as foundational groundwork for headless Kortix execution and E2E verification of the worker infrastructure.

## Functional Requirements
- **Scripted Execution**: Support for pre-defined "agent actions" provided via a JSON/YAML script file to simulate the LLM's decision-making process.
- **Production Logic**: Use real production components including `AgentRunner`, `ToolManager`, and `MCPToolWrapper`.
- **MCP Discovery Support**: Full E2E testing of the `discover_mcp_tools` workflow, ensuring schemas are correctly fetched and injected into the prompt context.
- **Authenticated Tool Calls**: Ability to make authenticated tool calls using tokens stored in the harness's local secrets registry.
- **Message History Injection**: Support for loading and injecting local conversation history to set the agent's context.
- **CLI Outputs**:
    - Real-time terminal logging of payloads and tool results.
    - Generation of `latest_run_trace.json` for deep analysis.
    - Export of generated tool schemas (Snapshot) for schema validation.

## Non-Functional Requirements
- **Isolation**: The harness should use the existing mock infrastructure (`mocks.py`) for Supabase/DB dependencies where appropriate, while keeping the core agent logic real.
- **Performance**: Rapid initialization using cached JIT schemas when available.

## Acceptance Criteria
- [ ] A new script `backend/core/test_harness/mcp_lab/agent_harness.py` exists.
- [ ] The harness can execute a multi-turn scripted agent run.
- [ ] A run against a "Bearer Token" server (e.g., Desktop Commander) successfully returns a tool result.
- [ ] A run against an "API Key" server (e.g., Valyu) successfully returns a tool result.
- [ ] The harness produces a trace file and a schema snapshot file.

## Out of Scope
- Real LLM inference integration (initial focus is infrastructure reliability via scripted mocks).
- Full production Supabase database connection (using mocks for persistence).
- Frontend UI components or browser-based auth loops (handled via CLI auth/exchange scripts).
