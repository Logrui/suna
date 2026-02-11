# Track: MCP Test Harness & Lab (Dynamic Isolation)

Implementation of an interactive CLI tool ("MCP Lab") to onboard, discover, and execute MCP tools without a full stack.

## Goals
1.  **Dynamic Onboarding (`add`)**: 
    - Probe unknown MCP URLs.
    - **OAuth Support (Scenario A)**: Print Auth URL, accept redirect code from user, and exchange for tokens.
    - **Query Auth Support (Scenario C)**: Detect and store URLs with embedded keys (e.g., Valyu).
2.  **JIT Verification (`discover`)**: 
    - Use the `MCPJITLoader` to list tools.
    - Verify `PromptManager` generates human-readable summary.
3.  **Simulated Agent Run (`run`)**: 
    - **Scripted Simulation (Scenario A)**: Execute a hardcoded multi-turn flow (Discovery -> Prompt -> Tool Call -> Result) to verify local plumbing.
4.  **Traceability**: 
    - Link harness runs to Langfuse.
    - Generate local `trace.json` for manual inspection.

## Interaction Model
- **Secrets**: Stored in gitignored `backend/core/test_harness/layouts/secrets.json`.
- **Layout**: Stored in `backend/core/test_harness/layouts/local_lab.json`.

## Success Criteria
- [ ] `add https://mcp.desktopcommander.app/mcp` triggers OAuth flow and saves token.
- [ ] `add https://mcp.valyu.ai/mcp?valyuApiKey=...` saves config immediately.
- [ ] `discover` lists all tools from both servers.
- [ ] `run --prompt "list files"` executes `discover_mcp_tools` and then `execute_mcp_tool` (e.g. `list_devices`).
- [ ] Results and traces are visible in stdout and Langfuse.
