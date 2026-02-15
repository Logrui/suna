# MCP Pipeline: Quick Reference Card

**Print this page for desk reference**

---

## The 6 Stages at a Glance

```
┌──────────────────┐
│ Stage 1: Register│  Frontend submits URL
│   MCP Server     │
└────────┬─────────┘
         ↓
┌──────────────────────────────┐
│ Stage 2: OAuth (if needed)   │  User authorizes, gets token
│   auth_service.py            │
└────────┬─────────────────────┘
         ↓
┌──────────────────────────────┐
│ Stage 3: Discover & Cache    │  mcp_service probes server
│   Tools from Server          │  Finds list of tools
│   mcp_service.py             │
└────────┬─────────────────────┘
         ↓
┌──────────────────────────────┐
│ Stage 4: Enable/Disable      │  agent_tools.py API
│   Tools per Agent            │  Select which tools to use
│   agent_tools.py             │
└────────┬─────────────────────┘
         ↓
┌──────────────────────────────┐
│ Stage 5: Build Tool Map      │  MCPJITLoader reads config
│   (Cache Read Only)          │  NO server calls here
│   mcp_loader.py              │
└────────┬─────────────────────┘
         ↓
┌──────────────────────────────┐
│ Stage 6: Execute Tools       │  Load schema on demand
│   Call MCP Server            │  Execute tool via MCP
│   mcp_loader.py              │
└──────────────────────────────┘
```

---

## Stage Cheat Sheet

| Stage | When? | System | Server Calls? | Stores To | Key Code |
|-------|-------|--------|---------------|-----------|----------|
| **1** | User action | Core MCP | ❌ | - | `api.py:56` |
| **2** | User action | Core MCP | ✅ OAuth | Credentials | `api.py:106,203` |
| **3** | During 1+2 | Core MCP | ✅ Discovery | Agent config | `mcp_service.py:405` |
| **4** | Anytime | Agent Tools | ❌ | Agent config | `agent_tools.py:102` |
| **5** | Agent starts | JIT | ❌ | In-memory | `mcp_loader.py:92` |
| **6** | Tool executes | JIT + Executor | ✅ Schema+Execute | Schema cache | `mcp_loader.py:453,662` |

---

## Critical Files (Most Important)

### For Registration (Stages 1-2)
- `backend/core/mcp_module/api.py:56-178` ← Everything starts here
- `backend/core/mcp_module/auth_service.py` ← OAuth handling

### For Discovery (Stage 3)
- `backend/core/mcp_module/mcp_service.py:405-549` ← HTTP/SSE probing
- `backend/core/mcp_module/custom_mcp_registry_service.py` ← Alternative

### For Tool Management (Stage 4)
- `backend/core/agent_tools.py:102-364` ← Enable/disable API

### For Bootstrap (Stage 5)
- `backend/core/run/agent_runner.py:34-98` ← Agent startup
- `backend/core/jit/mcp_loader.py:92-146` ← Build tool map

### For Execution (Stage 6)
- `backend/core/jit/mcp_loader.py:453-720` ← Schema loading + execution
- `backend/core/jit/loader.py:167-242` ← Tool activation

---

## Data Structure Reference

### Agent Config (Stored in agent_versions.config)

```python
{
    "tools": {
        "custom_mcp": [
            {
                # Stage 3 data
                "name": "My MCP Server",
                "qualifiedName": "custom_http_mymcp",
                "type": "http",  # or "sse", "json"
                "config": {
                    "url": "https://example.com/mcp",
                    "access_token": "oauth_token_here",  # Stage 2
                    "refresh_token": "...",
                    "expires_in": 3600
                },

                # Stage 4 data
                "enabledTools": [  # List of tool NAMES
                    "read_file",
                    "write_file",
                    "execute_command"
                ],

                # Stage 3 cached data (informational)
                "tools": [
                    {
                        "name": "read_file",
                        "description": "Read a file",
                        "inputSchema": {...}
                    }
                ]
            }
        ]
    }
}
```

### MCPToolInfo (In-Memory in JIT, Stage 5)

```python
@dataclass
class MCPToolInfo:
    tool_name: str  # "read_file"
    toolkit_slug: str  # "custom_http_mymcp"
    mcp_config: Dict  # Reference to MCP config above
    loaded: bool = False
    schema: Optional[Dict] = None
    load_time_ms: Optional[float] = None
```

---

## Function Call Chains

### OAuth → Auto-Link to Agent

```
POST /mcp/auth/start
    ↓
GET /mcp/auth/callback
    ├─ Exchange code for token
    ├─ mcp_service.discover_custom_tools()  ← Stage 3
    ├─ Store credentials
    ├─ Create agent version with custom_mcp
    └─ Redirect to /agents/config/{agent_id}
```

### Agent Startup → Tool Map

```
agent_runner.setup_bootstrap()
    ├─ Fetch agent_config from agent_versions
    ├─ Create JITConfig
    ├─ Create MCPJITLoader(agent_config)
    └─ await mcp_loader.build_tool_map()
        ├─ Read custom_mcp[] from agent_config
        ├─ For each MCP:
        │  └─ _process_mcp_config()
        │     ├─ Read enabledTools[]
        │     └─ Create MCPToolInfo for each tool
        └─ tool_map = {"tool_a": MCPToolInfo(...)}
```

### Tool Execution

```
ThreadManager.execute("read_file", args)
    ↓
loader.activate_mcp_tool("read_file")
    ↓
mcp_loader.activate_tool("read_file")
    ├─ tool_info = tool_map["read_file"]
    ├─ await _load_tool_schema("read_file")
    │  ├─ Connect to mcp_config.url
    │  ├─ Call session.list_tools()
    │  └─ Extract schema for "read_file"
    └─ Register in tool_registry
    ↓
thread_manager.tool_registry.tools["read_file"]()
    ├─ MCPToolWrapper.execute() or dynamic wrapper
    └─ Call session.call_tool("read_file", args)
```

---

## Key Lines of Code

### Discovery Entry Point
```python
# api.py:56-93
@router.post("/mcp/discover-custom-tools")
async def discover_custom_mcp_tools(request, user_id):
    result = await mcp_service.discover_custom_tools(request.type, config)
```

### Tool Map Building
```python
# mcp_loader.py:92-146
async def build_tool_map(self, cache_only: bool = False):
    custom_mcps = self.agent_config.get("custom_mcp", [])
    for mcp_config in custom_mcps:
        await self._process_mcp_config(mcp_config, "custom")
```

### Read enabledTools from Config
```python
# mcp_loader.py:169-187
enabled_tools = mcp_config.get('enabledTools', [])
if enabled_tools:
    for tool_name in enabled_tools:
        self.tool_map[tool_name] = MCPToolInfo(...)
```

### Load Schema (First Stage 6 Server Call)
```python
# mcp_loader.py:662-686
async def _load_http_schema(self, tool_name, url, config, headers):
    async with streamablehttp_client(url, headers=headers) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            tool_result = await session.list_tools()  # ← SERVER CALL
            for tool in tools:
                if tool.name == tool_name:
                    return tool schema
```

### Execute Tool (Second Stage 6 Server Call)
```python
# mcp_service.py:363 or through wrapper
result = await connection.session.call_tool(tool_name, arguments)
```

---

## Decision Tree: Which System Handles What?

```
Is it about...

┌─ REGISTERING/DISCOVERING tools?
│  └─ Core MCP Module (api.py, mcp_service.py)
│
├─ HANDLING OAUTH?
│  └─ Core MCP Module (auth_service.py)
│
├─ ENABLING/DISABLING SPECIFIC TOOLS?
│  └─ Agent Tools API (agent_tools.py)
│
├─ BUILDING TOOL MAPS AT AGENT STARTUP?
│  └─ JIT System (mcp_loader.py:build_tool_map)
│
├─ LAZY-LOADING SCHEMAS?
│  └─ JIT System (mcp_loader.py:_load_*_schema)
│
├─ EXECUTING INDIVIDUAL TOOLS?
│  └─ Execution Layer (mcp_tool_wrapper.py or dynamic wrappers)
│
└─ WHERE IS DATA STORED?
   ├─ Credentials? → Supabase credentials table
   ├─ Tool configs? → agent_versions.config JSON
   ├─ Tool map? → In-memory in MCPJITLoader
   └─ Schemas? → Schema cache in MCPJITLoader
```

---

## Common Questions Answered

### Q: Does JIT re-discover tools from servers?
**A**: No. JIT reads enabledTools from agent config only. Discovery happens once in Stage 3, stored in agent config.

### Q: When does tool_map get created?
**A**: Stage 5, during agent_runner.setup_bootstrap() → MCPJITLoader.build_tool_map()

### Q: When do we first call the MCP server?
**A**:
- Stage 3: Discovery (list tools)
- Stage 6: Load schema (list tools again, extract one tool's schema)
- Stage 6: Execute tool (call_tool)

### Q: Where are OAuth tokens stored?
**A**:
- Immediately after auth: credentials table (via credential_service)
- In agent config: config.access_token field

### Q: What happens if enabledTools is empty?
**A**: JIT skips that MCP during tool_map building. Tools won't be available for execution.

### Q: Can I change enabledTools at runtime?
**A**: Only by calling agent_tools.py API, which creates a new agent version. Current execution thread won't see the change.

### Q: Why does Stage 6 call list_tools() again?
**A**: To get the full schema for that specific tool. Alternative would be to cache all schemas in Stage 3 (memory cost).

---

## Testing Checklist

- [ ] Can discover tools from HTTP MCP server
- [ ] Can discover tools from SSE MCP server
- [ ] OAuth flow stores token correctly
- [ ] Can enable/disable tools via agent_tools.py API
- [ ] Tool map builds correctly with enabledTools
- [ ] Schema loads successfully in Stage 6
- [ ] Tool executes successfully with correct arguments
- [ ] Tool execution returns correct result

---

## Performance Considerations

| Operation | Cost | Where |
|-----------|------|-------|
| HTTP Discovery | ~500ms | Stage 3 (api.py:56) |
| SSE Discovery | ~1000ms | Stage 3 (api.py:56) |
| Build Tool Map | <50ms | Stage 5 (mcp_loader.py:92) |
| Load Single Schema | ~200-500ms | Stage 6 (mcp_loader.py:662) |
| Execute Tool | Varies | Stage 6 (mcp_service.py:363) |

**Optimization**: Schema cache in MCPJITLoader prevents re-loading same schema.

---

## Debugging Tips

### Print Tool Map State
```python
# In agent_runner.py or similar
stats = self.thread_manager.mcp_loader.get_activation_stats()
logger.info(f"Tool map: {stats}")
# Shows: total_tools, loaded_tools, toolkit_breakdown
```

### Check Agent Config
```sql
SELECT config FROM agent_versions
WHERE agent_id = ? AND account_id = ?
ORDER BY created_at DESC LIMIT 1
\x -> 'tools' ->'custom_mcp'
```

### Trace Discovery Call
```python
# Look for logs:
# "🔍 [MCP API] Discovering http tools for URL: ..."
# "✅ [MCP API] Discovery successful ... Found N tools."
```

### Trace Tool Activation
```python
# Look for logs:
# "⚡ [JIT MCP] Activating MCP tool '...'"
# "✅ [JIT MCP] Tool '...' activated successfully in X ms"
```

---

## One-Minute Summary

1. **Stage 1-2**: User registers MCP + OAuth (api.py)
2. **Stage 3**: Server discovery happens (mcp_service.py)
3. **Stage 4**: Select which tools to enable (agent_tools.py)
4. **Stage 5**: At agent startup, JIT builds tool_map from config (mcp_loader.py)
5. **Stage 6**: When tool runs, load schema then execute (mcp_loader.py + executor)

**Key insight**: Tools discovered once (Stage 3), cached in agent config (Stage 4), loaded from cache at startup (Stage 5), executed with deferred schema loading (Stage 6).

