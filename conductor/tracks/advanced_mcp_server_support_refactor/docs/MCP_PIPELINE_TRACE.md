# MCP Pipeline Architecture: Complete System Trace

**Date**: 2026-02-15
**Scope**: Maps all 6 stages of MCP integration from registration to execution

---

## Executive Summary

The MCP pipeline spans **THREE distinct systems**:

1. **Core MCP Module** (`backend/core/mcp_module/`) — Stages 1-4 (Registration through Tool Caching)
2. **JIT System** (`backend/core/jit/`) — Stages 4-5 (Build cached tool map, defer schema loading)
3. **Execution Layer** — Stage 6 (Tool execution at runtime)

**Key Finding**: **JIT does NOT re-discover tools**. It reads cached tool configs from the agent config. Discovery happens ONCE in Stage 3, stored in agent version, then JIT loads from cache.

---

## Stage-by-Stage Pipeline Map

### **STAGE 1: Register MCP Server (Frontend → Backend API)**

**System**: Core MCP Module
**Entry Point**: `backend/core/mcp_module/api.py` lines 56-93

```python
@router.post("/mcp/discover-custom-tools")
async def discover_custom_mcp_tools(request: CustomMCPDiscoverRequest, user_id: str):
    # Line 75: CORE DISCOVERY (Stage 3 happens inline here)
    result = await mcp_service.discover_custom_tools(request.type, service_config)
```

**What Happens**:
- User submits URL + optional OAuth config from frontend
- Calls `mcp_service.discover_custom_tools()` to probe MCP server
- **Stage 1 + Stage 3 happen together** — no tools are registered yet, just discovered

**Files Involved**:
- `backend/core/mcp_module/api.py:56-93` — API endpoint
- `backend/core/mcp_module/mcp_service.py:405-549` — Discovery logic

---

### **STAGE 2: Configure MCP Server (OAuth Flow)**

**System**: Core MCP Module (Auth Service)
**Entry Point**: `backend/core/mcp_module/api.py` lines 106-178 (OAuth flow initiation)

```python
@router.get("/mcp/auth/start")
async def mcp_auth_start(url: str, return_url: str, agent_id: Optional[str]):
    # Line 124: Discover OAuth metadata
    metadata = await mcp_auth_service.discover_oauth_metadata(url)

    # Lines 135-146: Generate PKCE challenge + state
    code_verifier, code_challenge = mcp_auth_service.generate_code_verifier_challenge()
    state = mcp_auth_service.generate_state(...)
```

**Complete OAuth Flow**:

1. **`/mcp/auth/start`** (lines 106-178):
   - Discover OAuth metadata from MCP server (SEP-985 compliant)
   - Generate PKCE challenge & state token
   - Redirect user to authorization endpoint

2. **`/mcp/auth/callback`** (lines 203-467):
   - Receive auth code from OAuth provider
   - Exchange code for access token (line 243)
   - Store credentials in DB (lines 350-367)
   - **Stage 3 happens here too** — proactive tool discovery (lines 308-346)
   - If agent_id provided, auto-link MCP to agent (lines 370-436)
   - Redirect to frontend with success flag

**Files Involved**:
- `backend/core/mcp_module/api.py:106-467` — OAuth endpoints
- `backend/core/mcp_module/auth_service.py` — OAuth metadata discovery, PKCE, state management
- `backend/core/credentials/credential_service.py` — Token storage

---

### **STAGE 3: Discover and Cache Tools**

**System**: Core MCP Module (Discovery Services)
**Triggered By**:
- Explicit discovery call from frontend
- OAuth callback (proactive discovery)
- Manual agent configuration save

**Discovery Entry Points**:

1. **Non-OAuth Discovery** (`api.py:56-93`):
   ```python
   result = await mcp_service.discover_custom_tools(request.type, service_config)
   ```
   → `mcp_service.py:405-549` (MCPService.discover_custom_tools)

2. **OAuth Callback Discovery** (`api.py:308-346`):
   ```python
   discovery_result = await mcp_service.discover_custom_tools("http", config_payload)
   if discovery_result.success and discovery_result.tools:
       discovered_tools = discovery_result.tools
       # Lines 393-403: Cache tools in agent config
       enabled_tool_names = [t["name"] for t in discovered_tools]
       new_custom_mcp = {
           ...
           "tools": discovered_tools  # Cache!
       }
   ```

3. **Registry-Based Discovery** (`custom_mcp_registry_service.py:34-362`):
   - Alternative discovery service (not always used)
   - Uses same HTTP/SSE probing as mcp_service

**Discovery Mechanisms**:

| Transport | File | Method | Lines |
|-----------|------|--------|-------|
| **HTTP** | `mcp_service.py` | `_discover_http_tools()` | 413-480 |
| **SSE** | `mcp_service.py` | `_discover_sse_tools()` | 482-549 |
| **HTTP** | `custom_mcp_registry_service.py` | `_discover_http_tools()` | 75-206 |
| **SSE** | `custom_mcp_registry_service.py` | `_discover_sse_tools()` | 208-362 |

**Where Tools Are Stored (Cached)**:

After discovery, tools are stored in **agent version config**:

```python
# api.py:393-403 (OAuth callback)
new_custom_mcp = {
    "name": display_name,
    "qualifiedName": qualified_name,
    "type": discovery_type,
    "config": config_payload,
    "enabledTools": enabled_tool_names,  # Tool NAMES only
    "tools": discovered_tools  # Full tool objects cached here
}

# Then saved to agent version
new_version = await version_service.create_version(
    custom_mcps=updated_custom_mcps  # Includes new_custom_mcp
)
```

**Database Schema**:
```
agents table:
  ├─ current_version_id → agent_versions table

agent_versions table:
  ├─ config (JSON) → tools → custom_mcp → [array of MCP configs]
  │   └─ Each MCP config includes:
  │       ├─ name, qualifiedName, type
  │       ├─ config (contains URL, auth tokens)
  │       ├─ enabledTools: ["tool1", "tool2"]  # Tool names
  │       └─ tools: [{name, description, inputSchema}]  # Full schemas
```

---

### **STAGE 4: Enable/Disable Specific Tools**

**System**: Both Core MCP Module + Agent Tools API
**Entry Points**:

1. **During OAuth Callback** (`api.py:392-393`):
   ```python
   enabled_tool_names = [t["name"] for t in discovered_tools]
   # Enable ALL discovered tools by default
   ```

2. **Agent Tools API** (`agent_tools.py:102-233`):
   ```python
   @router.post("/agents/{agent_id}/custom-mcp-tools")
   async def update_custom_mcp_tools_for_agent():
       # Update enabledTools list for a specific MCP
       custom_mcps[i]['enabledTools'] = enabled_tools

       # Save new version
       new_version = await version_service.create_version(
           custom_mcps=custom_mcps
       )
   ```

3. **Bulk Agent MCPs Update** (`agent_tools.py:235-364`):
   ```python
   @router.put("/agents/{agent_id}/custom-mcp-tools")
   async def update_agent_custom_mcps(agent_id: str, request: dict):
       # Update multiple MCPs at once
       new_custom_mcps = request.get('custom_mcps', [])
       # Each MCP in new_custom_mcps has its own enabledTools list
   ```

**Where enabledTools Are Stored**:
```
agent_versions.config.tools.custom_mcp[i].enabledTools = ["tool_a", "tool_b"]
```

**Files Involved**:
- `backend/core/agent_tools.py:16-233` — Tool enable/disable endpoints
- `backend/core/versioning/version_service.py` — Version creation with updated configs

---

### **STAGE 5: Worker Gets Access to Tools (Runtime Injection)**

**System**: JIT System + Agent Runner
**Entry Point**: `backend/core/run/agent_runner.py:34-98` (setup_bootstrap)

```python
async def setup_bootstrap(self):
    # Line 46-49: Create JIT config from agent config
    jit_config = JITConfig.from_run_context(
        agent_config=self.config.agent_config,
        disabled_tools=disabled_tools
    )

    # Line 51-58: Initialize ThreadManager with JIT config
    self.thread_manager = ThreadManager(
        jit_config=jit_config
    )

    # Line 72: Initialize MCP JIT loader (cache-only mode)
    await self._initialize_mcp_jit_loader(cache_only=False)
```

**JIT Loader Initialization** (`agent_runner.py:lines ~1000+`, from broader context):
```python
async def _initialize_mcp_jit_loader(self, cache_only: bool = False):
    from core.jit.mcp_loader import MCPJITLoader

    # Extract tool configs from agent config (stored in Stage 4)
    agent_config = self.config.agent_config

    # MCPJITLoader reads from agent config ONLY
    # It does NOT re-discover from MCP servers
    mcp_loader = MCPJITLoader(agent_config)

    # Build tool map from cached configs (Stage 5 entry point)
    await mcp_loader.build_tool_map(cache_only=cache_only)

    self.thread_manager.mcp_loader = mcp_loader
```

**MCPJITLoader.build_tool_map()** (`mcp_loader.py:92-146`):

```python
async def build_tool_map(self, cache_only: bool = False, force_rebuild: bool = False):
    # Line 103-104: Extract MCPs from agent config
    custom_mcps = self.agent_config.get("custom_mcps") or self.agent_config.get("custom_mcp", [])
    configured_mcps = self.agent_config.get("configured_mcps", [])

    # Line 116-120: Process each MCP config (does NOT re-discover)
    for mcp_config in custom_mcps:
        await self._process_mcp_config(mcp_config, "custom", cache_only=cache_only)
```

**_process_mcp_config()** (`mcp_loader.py:148-215`):

```python
async def _process_mcp_config(self, mcp_config, config_type, cache_only: bool):
    # Line 169-187: If enabledTools are in config, use them directly
    enabled_tools = mcp_config.get('enabledTools', [])
    if enabled_tools:
        logger.info(f"Using enabledTools DIRECTLY from config (bypassing registry cache)")
        for tool_name in enabled_tools:
            self.tool_map[tool_name] = MCPToolInfo(
                tool_name=tool_name,
                toolkit_slug=toolkit_slug,
                mcp_config=mcp_config
            )
        return  # <-- KEY: Does NOT re-discover from server

    # Line 192-215: Only if enabledTools missing, try registry (cache-only mode)
    if cache_only:
        logger.info(f"No cached tools for {toolkit_slug} - will discover in enrichment")
        return
```

**Critical Finding**:
- **JIT DOES NOT call the MCP server to re-discover tools**
- It reads `enabledTools` from agent config directly
- If enabledTools are missing and cache_only=True, tools are deferred to enrichment phase
- This means JIT stage 5 is purely a **cache load operation**, not a discovery operation

**Files Involved**:
- `backend/core/run/agent_runner.py:34-98` — Bootstrap entry, MCP loader init
- `backend/core/jit/mcp_loader.py:24-215` — Tool map building from cached config
- `backend/core/jit/config.py` — JITConfig creation

---

### **STAGE 6: Worker Executes Tools (MCP Server Calls)**

**System**: Execution Layer (MCPToolWrapper + MCPToolExecutor)
**Entry Point**: When ThreadManager tries to execute a tool

**Path 1: Legacy MCPToolWrapper** (`mcp_tool_wrapper.py:119-150+`):

```python
class MCPToolWrapper(Tool):
    async def initialize_and_register_tools(self):
        # Lazy initialization of MCP connections
        # Called during thread manager setup

    async def execute_tool(self, tool_name, arguments):
        # Actually execute the tool via MCP server
```

**Path 2: JIT-Activated MCP Tools** (`loader.py:167-242`):

```python
@staticmethod
async def activate_mcp_tool(tool_name: str, thread_manager):
    # Line 176: Get mcp_loader from thread_manager
    mcp_loader = getattr(thread_manager, 'mcp_loader', None)

    # Line 188: mcp_loader.activate_tool() handles lazy loading
    result = await mcp_loader.activate_tool(tool_name)
```

**MCPJITLoader.activate_tool()** (`mcp_loader.py:453-498`):

```python
async def activate_tool(self, tool_name: str) -> ActivationResult:
    # Line 461: Get tool info from cached tool_map
    tool_info = self.tool_map[tool_name]

    # Line 473: Load schema (this DOES connect to MCP server)
    schema = await self._load_tool_schema(tool_name, tool_info)

    # Line 475-478: Cache schema
    self.schema_cache[tool_name] = schema
    tool_info.schema = schema
    tool_info.loaded = True
```

**_load_tool_schema()** (`mcp_loader.py:523-611`):

```python
async def _load_tool_schema(self, tool_name: str, tool_info: MCPToolInfo):
    custom_type = mcp_config.get("customType", mcp_config.get("type", "standard"))

    if custom_type == "composio":
        return await self._load_composio_schema(tool_name, toolkit_slug, mcp_config)
    elif custom_type in ("sse", "http", "json"):
        return await self._load_custom_mcp_schema(tool_name, toolkit_slug, mcp_config, custom_type)
```

**_load_custom_mcp_schema()** → **_load_http_schema()** (`mcp_loader.py:662-686`):

```python
async def _load_http_schema(self, tool_name: str, url: str, config, headers):
    # Line 669: ACTUAL MCP SERVER CALL to get tool schema
    async with streamablehttp_client(url, headers=headers) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            tool_result = await session.list_tools()  # <-- Calls MCP server

            # Find matching tool and extract schema
            for tool in tools:
                if tool.name == tool_name:
                    schema = {
                        "name": tool.name,
                        "description": tool.description,
                        "input_schema": tool.inputSchema
                    }
                    return schema
```

**Tool Execution** (`mcp_tool_wrapper.py` or via MCPToolExecutor):

```python
# When LLM calls tool, ThreadManager routes to MCPToolWrapper
# MCPToolWrapper finds the tool in mcp_service and executes it

# OR via JIT: ThreadManager calls dynamic wrapper created in loader.py:195

# Both paths eventually call:
await connection.session.call_tool(tool_name, arguments)
```

**Files Involved**:
- `backend/core/jit/loader.py:167-242` — JIT tool activation
- `backend/core/jit/mcp_loader.py:453-720` — Schema loading (STAGE 6 real discovery)
- `backend/core/tools/mcp_tool_wrapper.py` — Tool wrapper registration
- `backend/core/mcp_module/mcp_service.py:339-392` — Tool execution in mcp_service

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ STAGE 1-2: Frontend User Flow                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  User registers MCP URL → Frontend calls /mcp/discover-tools    │
│  OR initiates OAuth → Frontend calls /mcp/auth/start            │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ STAGE 3: CORE MCP MODULE - Tool Discovery                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  mcp_service.discover_custom_tools()                            │
│  ├─ HTTP probe + SSE fallback                                  │
│  └─ Returns: tools list = [{name, description, schema}]        │
│                                                                  │
│  custom_mcp_registry_service.discover_custom_tools() [alt]      │
│  ├─ Similar HTTP/SSE probing                                   │
│  └─ Returns: same tool list structure                          │
│                                                                  │
│  For OAuth: After token exchange, proactive discovery           │
│  ├─ Tries HTTP first, SSE as fallback                          │
│  └─ Stores credentials + discovered tools in agent config       │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ STAGE 4: AGENT CONFIG - Tool Caching                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  agent_versions.config = {                                     │
│    "tools": {                                                   │
│      "custom_mcp": [{                                          │
│        "name": "My MCP",                                       │
│        "qualifiedName": "custom_http_mymcp",                  │
│        "type": "http",                                         │
│        "config": {url, auth tokens},                          │
│        "enabledTools": ["tool_a", "tool_b"],  ← Stage 4       │
│        "tools": [{name, description, schema}]  ← Cached!      │
│      }]                                                         │
│    }                                                             │
│  }                                                               │
│                                                                  │
│  Updated via agent_tools.py endpoints:                         │
│  ├─ PUT /agents/{id}/custom-mcp-tools                         │
│  └─ POST /agents/{id}/custom-mcp-tools                        │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ STAGE 5: JIT LOADER - Build Tool Map (Cache Read Only)          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Agent Runner calls setup_bootstrap()                        │
│  2. Creates JITConfig from agent_config                         │
│  3. Initializes MCPJITLoader(agent_config)                      │
│  4. MCPJITLoader.build_tool_map(cache_only=False/True)         │
│                                                                  │
│  MCPJITLoader reads ONLY FROM AGENT CONFIG:                     │
│  ├─ Extracts custom_mcp[]                                      │
│  ├─ Reads enabledTools[] from each MCP                         │
│  ├─ Creates MCPToolInfo entries (NO server calls yet)          │
│  └─ Stores in self.tool_map = {                                │
│       "tool_a": MCPToolInfo(...),                              │
│       "tool_b": MCPToolInfo(...)                               │
│     }                                                            │
│                                                                  │
│  ⚠️ KEY: Does NOT call MCP servers in Stage 5                   │
│     Only reads cached enabledTools from config                  │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ STAGE 6: JIT EXECUTOR - Load Schemas + Execute Tools            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  When ThreadManager needs to execute tool_a:                   │
│  1. Calls loader.activate_mcp_tool("tool_a")                   │
│  2. JITLoader.activate_tool("tool_a")                          │
│  3. _load_tool_schema("tool_a")                                │
│     ├─ Resolves mcp_config from tool_map[tool_a]              │
│     ├─ CONNECTS TO MCP SERVER (HTTP/SSE)                       │
│     ├─ Calls session.list_tools()  ← FIRST SERVER CALL         │
│     ├─ Extracts schema for tool_a                              │
│     └─ Caches in schema_cache                                  │
│  4. create_mcp_tool_wrapper() wraps tool for execution          │
│  5. MCPToolWrapper.execute() or                                │
│     MCPToolExecutor.execute_tool() calls session.call_tool()   │
│     └─ Sends: {tool_name, arguments}                           │
│     └─ Receives: result from MCP server                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files by Stage

| Stage | System | Files | Purpose |
|-------|--------|-------|---------|
| **1-2** | Core MCP | `api.py:56-178` | Registration & OAuth |
| **3** | Core MCP | `mcp_service.py:405-549`, `custom_mcp_registry_service.py` | Discovery |
| **4** | Version Service | `agent_tools.py:102-364`, `version_service.py` | Tool config storage |
| **5** | JIT | `agent_runner.py:34-98`, `mcp_loader.py:92-215` | Tool map building |
| **6** | JIT + Executor | `mcp_loader.py:453-720`, `mcp_tool_wrapper.py` | Schema loading + execution |

---

## Detailed File Cross-Reference

### `backend/core/mcp_module/api.py`

| Lines | Function | Stage | Purpose |
|-------|----------|-------|---------|
| 56-93 | `discover_custom_mcp_tools()` | 1+3 | Discover tools from URL |
| 106-178 | `mcp_auth_start()` | 2 | Initiate OAuth |
| 203-467 | `mcp_auth_callback()` | 2+3 | Complete OAuth, proactive discovery |
| 181-200 | `mcp_client_metadata()` | 2 | SEP-991 client identity |

### `backend/core/mcp_module/mcp_service.py`

| Lines | Function | Stage | Purpose |
|-------|----------|-------|---------|
| 116-235 | `connect_server()` | 5-6 | Connect to MCP server (runtime) |
| 236-257 | `connect_all()` | 5-6 | Connect multiple servers |
| 339-392 | `execute_tool()` | 6 | Execute tool via MCP server |
| 405-549 | `discover_custom_tools()` | 3 | HTTP/SSE discovery |
| 413-480 | `_discover_http_tools()` | 3 | HTTP transport discovery |
| 482-549 | `_discover_sse_tools()` | 3 | SSE transport discovery |

### `backend/core/mcp_module/custom_mcp_registry_service.py`

| Lines | Function | Stage | Purpose |
|-------|----------|-------|---------|
| 34-40 | `discover_custom_tools()` | 3 | Route to HTTP/SSE discovery |
| 75-206 | `_discover_http_tools()` | 3 | HTTP discovery (alt) |
| 208-362 | `_discover_sse_tools()` | 3 | SSE discovery (alt) |

### `backend/core/mcp_module/auth_service.py`

| Lines | Function | Stage | Purpose |
|-------|----------|-------|---------|
| 23-50 | `generate_state()` | 2 | Create secure state token |
| 52-65 | `validate_state()` | 2 | Validate callback state |
| 67-124 | `discover_oauth_metadata()` | 2 | SEP-985 metadata discovery |
| 126-136 | `generate_code_verifier_challenge()` | 2 | PKCE challenge generation |
| 138-167 | `get_auth_headers()` | 4 | Retrieve stored OAuth tokens |

### `backend/core/agent_tools.py`

| Lines | Function | Stage | Purpose |
|-------|----------|-------|---------|
| 16-100 | `get_custom_mcp_tools_for_agent()` | 4 | Fetch agent's MCP tools |
| 102-233 | `update_custom_mcp_tools_for_agent()` | 4 | Update enabledTools |
| 235-364 | `update_agent_custom_mcps()` | 4 | Bulk MCP update |
| 366-433 | `get_agent_tools()` | 4 | Get all enabled tools |

### `backend/core/run/agent_runner.py`

| Lines | Function | Stage | Purpose |
|-------|----------|-------|---------|
| 34-98 | `setup_bootstrap()` | 5 | Initialize JIT loader |
| 44-58 | JIT config creation | 5 | Create JITConfig |
| 72 | MCP loader init | 5 | Initialize MCPJITLoader |

### `backend/core/jit/mcp_loader.py`

| Lines | Function | Stage | Purpose |
|-------|----------|-------|---------|
| 24-32 | `__init__()` | 5 | Initialize MCPJITLoader |
| 92-146 | `build_tool_map()` | 5 | Build tool map from config |
| 148-215 | `_process_mcp_config()` | 5 | Process single MCP config |
| 453-498 | `activate_tool()` | 6 | Lazy-load tool schema |
| 523-611 | `_load_tool_schema()` | 6 | Load tool schema from server |
| 662-686 | `_load_http_schema()` | 6 | HTTP schema loading |
| 613-660 | `_load_sse_schema()` | 6 | SSE schema loading |

### `backend/core/jit/loader.py`

| Lines | Function | Stage | Purpose |
|-------|----------|-------|---------|
| 43-107 | `activate_tool()` | 6 | Activate regular/JIT tools |
| 167-242 | `activate_mcp_tool()` | 6 | Activate MCP tools (calls mcp_loader) |
| 168-176 | Get mcp_loader | 6 | Retrieve loader from thread_manager |
| 188-190 | Call mcp_loader | 6 | Delegate to MCPJITLoader |

### `backend/core/tools/mcp_tool_wrapper.py`

| Lines | Function | Stage | Purpose |
|-------|----------|-------|---------|
| 119-150 | `MCPToolWrapper.__init__()` | 5-6 | Initialize MCP wrapper |
| 136-149 | `_ensure_initialized()` | 5-6 | Lazy init MCP servers |
| 150+ | `initialize_and_register_tools()` | 5-6 | Connect + register tools |
| 150+ | `execute_tool()` | 6 | Execute tool via MCP |

### `backend/core/run/mcp_manager.py`

| Lines | Function | Stage | Purpose |
|-------|----------|-------|---------|
| 12-69 | `register_mcp_tools()` | 5-6 | Register MCPs in thread manager |
| 53-66 | Initialize wrapper | 5-6 | Create MCPToolWrapper |

---

## Critical Insight: When Tools Are Discovered

### Discovery Happens ONLY in Stage 3

```
Stage 1: User submits URL
         ↓
Stage 3: discover_custom_tools() → Connects to MCP server → Lists tools
         ↓
Stage 4: Tools stored in agent config as:
         {
           "enabledTools": ["tool_a", "tool_b"],
           "tools": [{full schema objects}]
         }

Stage 5: JIT reads enabledTools from agent config (NO server call)

Stage 6: When executing, JIT connects to server ONLY to get schema
         for that specific tool (if not cached)
```

### Why JIT Doesn't Re-Discover

1. **Performance**: Avoids redundant discovery calls
2. **Consistency**: Tool set doesn't change mid-thread
3. **Caching**: Tools cached in agent config as "source of truth"
4. **Deferred**: Schema loading deferred to actual tool activation (lazy loading)

---

## Configuration Flow Example

### OAuth Flow → Agent Auto-Link

```python
# api.py:308-346 (OAuth callback)
discovered_tools = []
try:
    discovery_result = await mcp_service.discover_custom_tools("http", config_payload)
    if discovery_result.success:
        discovered_tools = discovery_result.tools

        # Create MCP config with cached tools
        new_custom_mcp = {
            "name": display_name,
            "qualifiedName": qualified_name,
            "type": "http",
            "config": config_payload,
            "enabledTools": [t["name"] for t in discovered_tools],  # Stage 4
            "tools": discovered_tools  # Cache full schemas
        }

        # Store in agent version
        new_version = await version_service.create_version(
            agent_id=agent_id,
            custom_mcps=[new_custom_mcp]
        )

# Later: agent_runner.py:72 (Stage 5)
await self._initialize_mcp_jit_loader(cache_only=False)

# Inside _initialize_mcp_jit_loader():
mcp_loader = MCPJITLoader(agent_config)  # agent_config has new_custom_mcp
await mcp_loader.build_tool_map()

# mcp_loader reads enabledTools from agent_config.custom_mcp[0].enabledTools
# Does NOT call discovery again
```

---

## Tool Execution Flow

```
ThreadManager executes tool "tool_a"
    ↓
loader.activate_mcp_tool("tool_a")
    ↓
MCPJITLoader.activate_tool("tool_a")
    ├─ Find tool_a in self.tool_map
    ├─ tool_info = self.tool_map["tool_a"]
    └─ Load schema:
        └─ mcp_config = tool_info.mcp_config
        └─ Connect to mcp_config.url (STAGE 6 server call)
        └─ Call session.list_tools()
        └─ Extract schema for tool_a
        └─ Cache in self.schema_cache["tool_a"]
    ↓
Create dynamic tool wrapper with schema
    ↓
When LLM calls tool_a(args):
    └─ MCPToolWrapper.execute()
    └─ Find tool_a in mcp_service connections OR
    └─ Call mcp_loader wrapper
    └─ Call session.call_tool("tool_a", args)
    └─ Return result
```

---

## Summary Table

| Aspect | Stage 1-2 | Stage 3 | Stage 4 | Stage 5 | Stage 6 |
|--------|-----------|---------|---------|---------|---------|
| **System** | Core MCP | Core MCP | Version Service | JIT | JIT + Executor |
| **Server Calls** | Auth only | ✅ Discovery | ❌ | ❌ | ✅ Schema load + execution |
| **Data Stored** | Tokens | Tool schemas | enabledTools + cached tools | Tool map (in-memory) | Schema cache |
| **Location** | Credentials DB | Agent config | Agent config | ThreadManager | JITLoader |
| **Deferred?** | ❌ | ❌ | ❌ | Enrichment phase | Yes (lazy load) |

