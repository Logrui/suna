# MCP Lab Harness - Quick Reference

## Overview
The MCP Lab Harness is a **local testing environment** that mimics the Suna/Kortix worker's MCP integration flow without requiring a live database, authentication services, or deployed infrastructure.

## Key Features
✅ **Native Agent Flow**: Uses the exact same code paths as real agents (`MCPRegistry`, `MCPJITLoader`, `MCPToolExecutor`)  
✅ **Three Scenarios**: Handles OAuth (Desktop Commander), unauthenticated (Context7), and query-param API keys (Valyu)  
✅ **Langfuse Integration**: Optional tracing for debugging multi-turn flows  
✅ **SSRF-Safe**: Uses production SSRF protection from `mcp_tool_executor.py`

---

## Setup

### 1. Directory Structure
```
backend/core/test_harness/
├── mcp_lab/
│   ├── runner.py          # Main CLI
│   ├── mocks.py           # Mock services (DB, Auth, Credentials)
│   └── layouts/
│       ├── local_lab.json # MCP server configs
│       └── secrets.json   # OAuth tokens (gitignored)
```

### 2. Initialize Layout Files
The harness auto-creates these on first run, but you can pre-populate:

**layouts/local_lab.json**:
```json
{
  "account_id": "harness_user",
  "custom_mcp": []
}
```

**layouts/secrets.json** (optional, for OAuth):
```json
{
  "credentials": {
    "mcp_desktopcommander_app": {
      "access_token": "your_oauth_token_here",
      "refresh_token": "...",
      "expires_in": 3600
    }
  }
}
```

---

## Commands

### `add` - Onboard a New MCP Server

#### Scenario A: OAuth-Protected Server (e.g., Desktop Commander)
```bash
python runner.py add https://mcp.desktopcommander.app/mcp \
  --client-id kortix-harness-cli \
  --redirect-uri http://localhost:8080/callback
```

**Flow**:
1. Probes SSE and HTTP transports
2. Detects OAuth requirement (401/403)
3. Discovers OAuth endpoints via `.well-known/oauth-authorization-server`
4. Generates PKCE challenge
5. Prints auth URL → user opens in browser → pastes code
6. Exchanges code for token → saves to `secrets.json`
7. Adds server to `local_lab.json`

#### Scenario B: Unauthenticated Server (e.g., Context7)
```bash
python runner.py add https://mcp.context7.com/mcp
```

**Flow**:
1. Probes SSE and HTTP transports
2. Succeeds immediately (no auth required)
3. Discovers tools
4. Adds server to `local_lab.json`

#### Scenario C: Query-Param API Key (e.g., Valyu)
```bash
python runner.py add "https://mcp.valyu.ai/mcp?valyuApiKey=sk_test_abc123"
```

**Flow**:
1. Detects API key in URL query params
2. Probes with key embedded in URL
3. Succeeds if key is valid
4. Adds server to `local_lab.json` (URL with key preserved)

---

### `discover` - List Tools (Native Agent Flow)

Mirrors the exact flow of `discover_mcp_tools` in production:

```bash
python runner.py discover
```

**What It Does**:
1. **MCPJITLoader** builds tool map from `local_lab.json`
2. **MCPRegistry** syncs from loader (same as `init_mcp_registry_from_loader`)
3. **MCPRegistry.get_discovery_info()** fetches full schemas (same as agent calling `discover_mcp_tools`)
4. Shows system prompt injection preview
5. Builds `MCPToolExecutor` custom_tools dict

**Output**:
```
📡 [Step 1] Building JIT tool map...
   ✅ JIT Loader found 47 tools:
      - list_contexts (toolkit: custom_http_context7_com)
      - search_contexts (toolkit: custom_http_context7_com)
      ...

🔄 [Step 2] Syncing to MCPRegistry (native discover_mcp_tools path)...
   ✅ MCPRegistry synced: 47 tools registered

🔍 [Step 3] Calling MCPRegistry.get_discovery_info() (native agent path)...

✨ Discovery Result (native format):
   Total tools: 47
   Toolkits: 1

   📦 custom_http_context7_com (47 tools):
      - list_contexts — List all available contexts
      - search_contexts — Search contexts by query
      ...

📝 [Step 4] System Prompt Injection Preview:
   ### MCP Tools (Just-In-Time Discovery)
   **Toolkit:** custom_http_context7_com (47 tools) ...
```

---

### `run` - Simulate Full Agent Turn (Discovery + Execution)

Mirrors a complete agent interaction using **native MCPToolExecutor**:

```bash
python runner.py run \
  --prompt "List all contexts" \
  --tool list_contexts \
  --args '{}'
```

**What It Does**:
1. **[Turn 1]** Generates system prompt with MCP tool info (`PromptManager._append_jit_mcp_info`)
2. **[Turn 2]** Calls `discover_mcp_tools` (via `MCPRegistry.get_discovery_info`)
3. **[Turn 3]** Calls `execute_mcp_tool` (via `MCPToolExecutor.execute_tool`)
   - Routes to `_execute_sse_tool` or `_execute_http_tool` based on server type
   - Uses production SSRF validation
   - Handles authentication headers from `secrets.json`

**Auto-Tool Selection**:
If you omit `--tool`, the harness auto-selects a safe tool (e.g., `list_*`, `get_*`, `search_*`):

```bash
python runner.py run --prompt "What can you do?"
# Auto-selects first list/get/search tool
```

**Output**:
```
[Turn 1] Generating System Prompt...
   ✅ Prompt generated (1847 chars)

[Turn 2] Agent calls discover_mcp_tools (native MCPRegistry)...
   ✅ discover_mcp_tools returned 47 tools across 1 toolkits

[Turn 3] Agent calls execute_mcp_tool('list_contexts')...
   🚀 Executing via MCPToolExecutor (http transport)...
   📎 URL: https://mcp.context7.com/mcp
   📎 Args: {}

✅ MCPToolExecutor Result:
--------------------------------------------------
[{
  "name": "general",
  "description": "General knowledge context"
}, ...]
--------------------------------------------------
```

---

## Advanced Usage

### Testing OAuth Token Refresh
1. Add server with OAuth
2. Manually expire token in `secrets.json` (set `expires_in: -1`)
3. Run `discover` or `run` → should trigger refresh flow (if implemented)

### Testing Error Handling
```bash
# Invalid URL
python runner.py add https://invalid.mcp.server/mcp

# Invalid tool name
python runner.py run --prompt "test" --tool NONEXISTENT_TOOL

# Invalid args JSON
python runner.py run --prompt "test" --tool list_contexts --args 'not_json'
```

### Langfuse Tracing
If `langfuse` is installed and configured:
```bash
export LANGFUSE_PUBLIC_KEY=pk_...
export LANGFUSE_SECRET_KEY=sk_...
python runner.py run --prompt "test" --tool list_contexts
```

Check Langfuse UI for trace with:
- System Prompt generation
- Tool execution span
- Input/output captured

---

## Troubleshooting

### "No MCP servers configured"
Run `python runner.py add <URL>` first.

### "Tool not found in tool map"
Run `python runner.py discover` to see available tools, then use exact tool name.

### "❌ Execution failed: SSRF blocked"
The harness uses production SSRF validation. Localhost/private IPs are blocked by design.

### OAuth flow fails
- Verify `--client-id` and `--redirect-uri` match server config
- Check browser console for CORS errors
- Ensure server's OAuth metadata is accessible at `/.well-known/oauth-authorization-server`

---

## Architecture Notes

### Why Native Flows?

The harness was **redesigned** to use the exact same code paths as production:

| Component | Production Path | Harness Path |
|-----------|----------------|--------------|
| Tool Discovery | `expand_msg_tool.py::_discover_tools()` → `MCPRegistry.get_discovery_info()` | Same |
| Tool Execution | `expand_msg_tool.py::_call_tool()` → `MCPRegistry.execute_tool()` → `MCPToolExecutor` | Same |
| JIT Loading | `AgentRunner._initialize_mcp_jit_loader()` → `MCPJITLoader` | Same |
| Prompt Injection | `PromptManager._append_jit_mcp_info()` | Same |

**Benefits**:
- Bugs found in harness = bugs in production
- Zero drift between test and prod environments
- Uses production SSRF, auth, and error handling

### What's Mocked?

- **Database**: Returns harness-local configs from `local_lab.json`
- **Credentials**: Returns OAuth tokens from `secrets.json`
- **Version Service**: Returns agent config from `local_lab.json`
- **Transport Clients**: Logged but passed through to real MCP servers

Everything else is **production code**.

---

## Example Workflows

### 1. Test a New MCP Server
```bash
# Add server
python runner.py add https://new-mcp-server.com/mcp

# Discover tools
python runner.py discover

# Test first tool
python runner.py run --prompt "test" --tool FIRST_TOOL_NAME --args '{}'
```

### 2. Debug OAuth Flow
```bash
# Add with OAuth
python runner.py add https://oauth-server.com/mcp --client-id my-client

# Check token saved
cat layouts/secrets.json

# Test tool execution uses token
python runner.py run --prompt "test"
```

### 3. Verify Multi-Server Support
```bash
# Add multiple servers
python runner.py add https://mcp.context7.com/mcp
python runner.py add https://mcp.valyu.ai/mcp?valyuApiKey=sk_test_abc

# Verify all tools discovered
python runner.py discover
# Should show tools from both servers
```

---

## Next Steps

To integrate with CI/CD:
1. Create `layouts/ci_lab.json` with test servers
2. Create `layouts/ci_secrets.json` with test tokens
3. Add pytest tests that import `runner.py` functions
4. Run `discover` and `run` in test suites

Example pytest:
```python
import asyncio
from core.test_harness.mcp_lab.runner import cmd_discover, cmd_add

@pytest.mark.asyncio
async def test_mcp_discovery():
    # Mock args
    class Args:
        command = "discover"
    
    await cmd_discover(Args())
    # Assert expected tools are discovered
```
