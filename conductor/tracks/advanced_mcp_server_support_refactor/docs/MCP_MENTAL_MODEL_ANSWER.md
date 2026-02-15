# Your Mental Model: Corrected & Validated

**This document confirms your mental model is correct, with one critical clarification**

---

## Your Mental Model (Correct ✅)

```
1. Register MCP Server         (frontend → backend API)          ✅
2. Configure MCP Server        (OAuth flow if needed)            ✅
3. Discover and cache tools    (save to worker/agent config)     ✅
4. Enable/disable specific     (per agent)                       ✅
5. Worker gets access to tools (runtime injection)               ✅
6. Worker calls and executes   (actual MCP server calls)         ✅
```

---

## System Breakdown (Precise Answer)

### Stage 1: Register MCP Server
**Files**: `backend/core/mcp_module/api.py:56-93`
**Class**: `APIRouter` (FastAPI)
**Method**: `discover_custom_mcp_tools()`

**What Happens**:
- Frontend POSTs to `/mcp/discover-custom-tools`
- Line 75: `result = await mcp_service.discover_custom_tools(request.type, service_config)`
- mcp_service probes the URL and returns tool list
- API returns response to frontend

**NOT part of Stage 1**: Storage of tools (that's Stage 3)

---

### Stage 2: Configure MCP Server (OAuth)
**Files**: `backend/core/mcp_module/api.py:106-467` + `backend/core/mcp_module/auth_service.py`
**Classes**: `APIRouter` + `MCPAuthService`
**Methods**:
- `mcp_auth_start()` — Lines 106-178
- `mcp_auth_callback()` — Lines 203-467

**What Happens**:

**Part A** (`auth_start`):
1. Line 124: `metadata = await mcp_auth_service.discover_oauth_metadata(url)` — Find OAuth endpoints
2. Line 135: `code_verifier, code_challenge = mcp_auth_service.generate_code_verifier_challenge()` — PKCE
3. Line 139-147: Generate state token with encrypted context
4. Line 166: Redirect user to OAuth provider

**Part B** (`auth_callback`):
1. Line 216: `state_data = mcp_auth_service.validate_state(state)` — Extract context
2. Line 243: `response = await client.post(token_endpoint, data=exchange_data)` — Get token
3. Line 250: `access_token = token_data.get("access_token")` — Extract token
4. Line 350-367: Store credentials in Supabase

**Critical**: Lines 308-346 also do **Stage 3 (discovery)** inside the callback

---

### Stage 3: Discover and Cache Tools
**Files**:
- Primary: `backend/core/mcp_module/mcp_service.py:405-549`
- Alternative: `backend/core/mcp_module/custom_mcp_registry_service.py:34-362`

**Classes**: `MCPService` + `CustomMCPRegistryService`
**Methods**:
- `discover_custom_tools()` — Router to HTTP/SSE
- `_discover_http_tools()` — HTTP transport — Lines 413-480
- `_discover_sse_tools()` — SSE transport — Lines 482-549

**What Happens**:

**HTTP Discovery** (`mcp_service.py:413-480`):
```python
async with streamablehttp_client(url, headers=headers) as (read_stream, write_stream, _):
    async with ClientSession(read_stream, write_stream) as session:
        await session.initialize()
        tool_result = await session.list_tools()  # ← Calls MCP server

        tools_info = []
        for tool in tool_result.tools:
            tools_info.append({
                "name": tool.name,
                "description": tool.description,
                "inputSchema": tool.inputSchema
            })

        return CustomMCPConnectionResult(
            success=True,
            tools=tools_info,
            ...
        )
```

**Where cached** (`api.py:393-403` during OAuth callback):
```python
new_custom_mcp = {
    "name": display_name,
    "qualifiedName": qualified_name,
    "type": discovery_type,
    "config": config_payload,
    "enabledTools": enabled_tool_names,        # Tool NAMES only
    "tools": discovered_tools                  # Full schemas cached
}

# Saved to agent version
new_version = await version_service.create_version(
    custom_mcps=[new_custom_mcp]
)
```

**Cached in**: `agent_versions.config.tools.custom_mcp[i].tools`

**System**: Core MCP Module — Does discovery, returns data

---

### Stage 4: Enable/Disable Specific Tools
**Files**: `backend/core/agent_tools.py:102-364`
**Class**: `APIRouter` (FastAPI)
**Methods**:
- `update_custom_mcp_tools_for_agent()` — Lines 102-233
- `update_agent_custom_mcps()` — Lines 235-364

**What Happens**:

```python
# Line 151: Update enabledTools for existing MCP
custom_mcps[i]['enabledTools'] = enabled_tools

# Line 209-217: Save new version
new_version = await version_service.create_version(
    agent_id=agent_id,
    custom_mcps=custom_mcps
)
```

**Stored in**: `agent_versions.config.tools.custom_mcp[i].enabledTools = ["tool_a", "tool_b"]`

**System**: Agent Tools API — Frontend calls this to enable/disable per agent

---

### Stage 5: Worker Gets Access to Tools (Runtime Injection)
**Files**:
- `backend/core/run/agent_runner.py:34-98` — Bootstrap entry
- `backend/core/jit/mcp_loader.py:92-146` — Tool map building

**Classes**: `AgentRunner` + `MCPJITLoader`
**Methods**:
- `setup_bootstrap()` — Lines 34-98
- `build_tool_map()` — Lines 92-146

**What Happens**:

**Part A** (`agent_runner.py:34-98` setup_bootstrap):
```python
# Line 46-49: Create JIT config
jit_config = JITConfig.from_run_context(
    agent_config=self.config.agent_config,
    disabled_tools=disabled_tools
)

# Line 51-58: Create ThreadManager
self.thread_manager = ThreadManager(
    jit_config=jit_config
)

# Line 72: Initialize MCP loader
await self._initialize_mcp_jit_loader(cache_only=False)
```

**Inside _initialize_mcp_jit_loader()** (from context):
```python
from core.jit.mcp_loader import MCPJITLoader

mcp_loader = MCPJITLoader(self.config.agent_config)
await mcp_loader.build_tool_map(cache_only=False)
self.thread_manager.mcp_loader = mcp_loader
```

**Part B** (`mcp_loader.py:92-146` build_tool_map):
```python
# Line 103-104: Extract MCPs from agent config
custom_mcps = self.agent_config.get("custom_mcp", [])
configured_mcps = self.agent_config.get("configured_mcps", [])

# Line 116-120: Process each MCP
for mcp_config in custom_mcps:
    await self._process_mcp_config(mcp_config, "custom", cache_only=False)

# Line 127: Mark as built
self._tool_map_built = True
```

**Inside _process_mcp_config** (`mcp_loader.py:148-215`):
```python
# Line 169-187: Read enabledTools from config
enabled_tools = mcp_config.get('enabledTools', [])
if enabled_tools:
    for tool_name in enabled_tools:
        if tool_name not in self.tool_map:
            self.tool_map[tool_name] = MCPToolInfo(
                tool_name=tool_name,
                toolkit_slug=toolkit_slug,
                mcp_config=mcp_config
            )
    return  # ← KEY: Does NOT call MCP server
```

**Result**: `MCPJITLoader.tool_map` populated with MCPToolInfo objects

**System**: JIT System — Reads cached config, builds in-memory tool map
**Server calls**: ❌ ZERO — Only reads from agent config
**Data stored**: In-memory in ThreadManager.mcp_loader

---

### Stage 6: Worker Calls and Executes Tools
**Files**:
- `backend/core/jit/loader.py:167-242` — Tool activation
- `backend/core/jit/mcp_loader.py:453-720` — Schema loading + execution

**Classes**: `JITLoader` + `MCPJITLoader` + `MCPToolWrapper`
**Methods**:
- `activate_mcp_tool()` — Lines 167-242 in loader.py
- `activate_tool()` — Lines 453-498 in mcp_loader.py
- `_load_tool_schema()` — Lines 523-611 in mcp_loader.py
- `_load_http_schema()` — Lines 662-686 in mcp_loader.py
- `call_tool()` — Via mcp_service or wrapper

**What Happens**:

**Part A** (Activation - First Stage 6 server call):

```python
# loader.py:185-192: JIT calls mcp_loader.activate_tool()
result = await mcp_loader.activate_tool(tool_name)

# Inside mcp_loader.activate_tool() (lines 453-498):
tool_info = self.tool_map[tool_name]

# Line 473: Load schema from MCP server
schema = await self._load_tool_schema(tool_name, tool_info)

# Inside _load_tool_schema → _load_http_schema (lines 662-686):
# ✅ FIRST STAGE 6 SERVER CALL HAPPENS HERE
async with streamablehttp_client(url, headers=headers) as (read, write, _):
    async with ClientSession(read, write) as session:
        await session.initialize()
        tool_result = await session.list_tools()  # ← SERVER CALL #1

        for tool in tools:
            if tool.name == tool_name:
                schema = {
                    "name": tool.name,
                    "description": tool.description,
                    "input_schema": tool.inputSchema
                }
                return schema
```

**Part B** (Registration):
```python
# loader.py:217-223: Register in tool registry
tool_wrapper = await JITLoader._create_mcp_tool_wrapper(tool_name, schema, tool_info)

thread_manager.tool_registry.tools[tool_name] = {
    "instance": tool_wrapper,
    "schema": tool_schema
}
```

**Part C** (Execution - Second Stage 6 server call):

```python
# When LLM tries to use the tool:
# ThreadManager.execute("tool_name", arguments)
#   └─ Finds tool in tool_registry
#   └─ Calls tool_wrapper.execute()
#   └─ Dynamic wrapper or MCPToolWrapper calls:

# ✅ SECOND STAGE 6 SERVER CALL HAPPENS HERE
result = await connection.session.call_tool(tool_name, arguments)
```

**System**: JIT + Execution Layer
**Server calls**: ✅ TWO calls
  1. list_tools() to get schema
  2. call_tool() to execute
**Data stored**: Schema cache in MCPJITLoader.schema_cache

---

## System Assignment Summary

| Stage | System | Files | Server Calls? | Is JIT? |
|-------|--------|-------|---------------|---------|
| 1 | Core MCP Module | `api.py:56-93` | ❌ (but calls discovery) | ❌ |
| 2 | Core MCP Module | `api.py:106-467`, `auth_service.py` | ✅ OAuth | ❌ |
| 3 | Core MCP Module | `mcp_service.py:405-549` | ✅ Discovery | ❌ |
| 4 | Agent Tools API | `agent_tools.py:102-364` | ❌ | ❌ |
| 5 | **JIT System** | `mcp_loader.py:92-146` | ❌ | ✅ |
| 6 | **JIT System** | `mcp_loader.py:453-720` | ✅ Schema+Execute | ✅ |

---

## Critical JIT Clarification

### Your Question: "Does JIT RE-discover tools from MCP servers, or does it read cached configs?"

**ANSWER: JIT reads CACHED configs in Stage 5, but connects to servers in Stage 6**

**Stage 5 (build_tool_map)**:
```python
# Line 169-187 in mcp_loader.py:_process_mcp_config()
enabled_tools = mcp_config.get('enabledTools', [])  # ← READ FROM CONFIG
if enabled_tools:
    for tool_name in enabled_tools:
        self.tool_map[tool_name] = MCPToolInfo(...)  # ← NO SERVER CALL
    return
```

**Stage 6 (activate_tool → _load_tool_schema)**:
```python
# Lines 662-686 in mcp_loader.py:_load_http_schema()
async with streamablehttp_client(url, headers=headers) as (read, write, _):
    async with ClientSession(read, write) as session:
        await session.initialize()
        tool_result = await session.list_tools()  # ✅ SERVER CALL (gets schema)

        for tool in tools:
            if tool.name == tool_name:
                return tool schema
```

**Summary**:
- Stage 5: JIT reads `enabledTools` from agent config → builds tool_map (NO server calls)
- Stage 6: JIT connects to server to get schema for specific tool (YES server calls)

This is **intentional design**:
- Stage 5: Fast bootstrap (cache read only)
- Stage 6: Deferred schema loading (only when tool actually executes)

---

## Data Flow Chart (Exact Answer)

```
┌─────────────────────────────────────────────┐
│ Stage 1: Register                           │
│ api.py:56-93 discover_custom_mcp_tools()    │
│ Input: User URL from frontend               │
│ Output: Tool list to frontend (no store)    │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│ Stage 2: OAuth Configure                    │
│ api.py:106-467 + auth_service.py            │
│ Input: OAuth callback code + state          │
│ Output: Stored token in credentials DB      │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│ Stage 3: Discover & Cache                   │
│ mcp_service.py:405-549                      │
│ Input: Config with URL + token              │
│ Output: Tool list → cached in agent config  │
│                                             │
│ Stored in:                                  │
│ agent_versions.config.tools.custom_mcp[i]  │
│   ├─ enabledTools: ["tool_a", ...]          │
│   └─ tools: [{name, desc, schema}, ...]     │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│ Stage 4: Enable/Disable                     │
│ agent_tools.py:102-364                      │
│ Input: Tool name list                       │
│ Output: Updated agent version               │
│                                             │
│ Updates:                                    │
│ agent_versions.config.tools.custom_mcp[i]  │
│   └─ enabledTools: ["tool_b", "tool_c"]     │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│ Stage 5: Runtime Injection (Cache Read)     │
│ agent_runner.py:34-98 → mcp_loader.py:92    │
│ Input: agent_config from agent_versions     │
│ Processing:                                 │
│   1. Read custom_mcp[] from agent_config    │
│   2. Read enabledTools[] from each MCP      │
│   3. Create MCPToolInfo for each tool       │
│ Output: tool_map in-memory                  │
│   tool_map = {                              │
│     "tool_b": MCPToolInfo(...),              │
│     "tool_c": MCPToolInfo(...)               │
│   }                                         │
│                                             │
│ ✅ ZERO server calls in this stage          │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│ Stage 6a: Load Schema (First Server Call)   │
│ mcp_loader.py:453-720                       │
│ Input: tool_name = "tool_b"                 │
│ Processing:                                 │
│   1. tool_info = tool_map["tool_b"]         │
│   2. _load_tool_schema(tool_b)              │
│      └─ Connect to mcp_config.url           │
│      └─ Call session.list_tools()  ← #1     │
│      └─ Extract schema for tool_b           │
│   3. Cache in schema_cache["tool_b"]        │
│ Output: Schema ready for execution          │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│ Stage 6b: Execute Tool (Second Server Call) │
│ mcp_tool_wrapper.py + mcp_service.py        │
│ Input: tool_name, arguments                 │
│ Processing:                                 │
│   1. Find MCP connection                    │
│   2. Call session.call_tool()   ← #2        │
│   3. Return result to LLM                   │
│ Output: Tool execution result               │
└─────────────────────────────────────────────┘
```

---

## JIT is NOT a Discovery System

**Common Misconception**:
> "JIT re-discovers tools from MCP servers at runtime"

**Reality**:
- JIT is a **lazy-loading system**
- It reads cached configs (Stage 5)
- It defers schema loading (Stage 6, only when needed)
- It does NOT re-discover what tools exist
- It assumes `enabledTools` is the source of truth

**Why**: Performance and consistency
- Discovery happens once during config
- Tool set doesn't change mid-execution
- Schema loading is deferred for speed

---

## Answer to Your Key Question

> Which stages are JIT-only vs. shared vs. Core MCP only?

**Core MCP Module ONLY** (Stages 1-4):
- Stage 1: Register MCP URL
- Stage 2: OAuth flows
- Stage 3: Discover tools from server
- Stage 4: Enable/disable in agent config

**JIT System ONLY** (Stages 5):
- Stage 5: Build tool_map from agent config (NO server calls)

**Shared/Execution Layer** (Stage 6):
- Stage 6a: Load schema (JIT defers to mcp_service/direct connection)
- Stage 6b: Execute tool (MCPToolWrapper or dynamic wrapper)

**Not JIT-dependent**: Stages 1-4 (all Core MCP Module)
**JIT-required**: Stage 5 (tool_map building)
**Optional JIT in Stage 6**: Can use MCPToolWrapper directly or JIT activation

---

## Your Mental Model: Final Grade

✅ **CORRECT**

Your 6-stage model accurately describes the pipeline. The only clarification:

- **You asked**: "Does JIT handle stages 5-6?"
- **Answer**: JIT handles Stage 5 (build tool map from cache) and part of Stage 6 (lazy schema load). But Stage 6 execution can be via MCPToolWrapper OR JIT-created wrappers.

The key insight you had right: **Tool discovery (Stage 3) and execution (Stage 6) are separate**. Discovery caches tools in the agent config. Execution reads from cache, not re-discovering.

