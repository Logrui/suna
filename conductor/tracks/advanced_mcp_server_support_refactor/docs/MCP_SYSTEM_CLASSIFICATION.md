# MCP System Classification & Dependencies

**Maps which system each file belongs to and cross-system dependencies**

---

## System Membership

### Core MCP Module System
**Purpose**: Handle registration, discovery, authentication, and credential storage
**Location**: `backend/core/mcp_module/`

| File | Role | Stage(s) |
|------|------|----------|
| `api.py` | HTTP API endpoints | 1-2-3-4 |
| `mcp_service.py` | MCP connection & discovery | 3,5-6 |
| `custom_mcp_registry_service.py` | Alternative discovery service | 3 |
| `auth_service.py` | OAuth flow & metadata discovery | 2 |
| `exceptions.py` | Exception definitions | All |

**Key Characteristics**:
- Direct MCP server interaction (HTTP/SSE connections)
- Tool discovery (probing servers, listing tools)
- Credential management
- OAuth state/token handling
- **Does NOT** build tool maps or lazy-load schemas

**External Dependencies**:
```python
# api.py imports:
from .mcp_service import mcp_service
from .auth_service import mcp_auth_service
from core.credentials import get_credential_service, get_profile_service
from core.versioning.version_service import get_version_service

# mcp_service.py imports:
from core.credentials import EncryptionService, get_credential_service
from core.services.supabase import DBConnection

# auth_service.py imports:
from core.credentials import EncryptionService
from core.services.supabase import DBConnection
```

---

### JIT System
**Purpose**: Build in-memory tool map from cached configs, lazy-load schemas, activate tools
**Location**: `backend/core/jit/`

| File | Role | Stage(s) |
|------|------|----------|
| `loader.py` | JIT tool activation orchestrator | 5-6 |
| `mcp_loader.py` | MCP-specific JIT loader | 5-6 |
| `config.py` | JIT configuration class | 5 |
| `dependencies.py` | Tool dependency resolution | 5 |
| `detector.py` | Parameter detection for init | 5 |
| `mcp_registry.py` | Static tool registry (Composio/built-ins) | 5 |
| `result_types.py` | Activation result classes | 5-6 |

**Key Characteristics**:
- Reads ONLY from agent config (no fresh discovery)
- Builds in-memory tool_map from cached enabledTools
- Lazy-loads schemas on tool activation
- Handles both regular tools and MCP tools
- **Does NOT** store anything to database
- **Does NOT** re-discover tools from MCP servers (except when loading schema in Stage 6)

**External Dependencies**:
```python
# loader.py imports:
from core.tools.tool_registry import get_tool_info, get_tool_class
from .config import JITConfig
from .result_types import ActivationResult, ActivationSuccess, ActivationError

# mcp_loader.py imports:
from core.jit.mcp_registry import get_toolkit_tools
from core.tools.utils.mcp_connection_manager import MCPConnectionManager
from core.services.supabase import DBConnection
from core.credentials import get_credential_service
```

---

### Agent Runner System
**Purpose**: Orchestrate agent execution, bootstrap, MCP initialization
**Location**: `backend/core/run/`

| File | Role | Stage(s) |
|------|------|----------|
| `agent_runner.py` | Main agent execution orchestrator | 5 (bootstrap) |
| `mcp_manager.py` | MCP tool registration in thread manager | 5-6 |
| `config.py` | AgentConfig dataclass | 5 |
| `tool_manager.py` | Tool management (not MCP-specific) | 5 |
| `prompt_manager.py` | Prompt/context management | All |

**Key Characteristics**:
- Entry point for agent execution
- Calls `setup_bootstrap()` which initializes JIT loaders
- Creates ThreadManager with JITConfig
- Manages overall execution flow

**Key Code**:
```python
# agent_runner.py:34-98 setup_bootstrap()
async def setup_bootstrap(self):
    from core.jit.config import JITConfig

    jit_config = JITConfig.from_run_context(
        agent_config=self.config.agent_config,
        disabled_tools=[]
    )

    self.thread_manager = ThreadManager(
        jit_config=jit_config
    )

    await self._initialize_mcp_jit_loader(cache_only=False)
```

**External Dependencies**:
```python
from core.jit.config import JITConfig
from core.jit.mcp_loader import MCPJITLoader
from core.agentpress.thread_manager import ThreadManager
from core.mcp_module import mcp_service
```

---

### Execution Layer System
**Purpose**: Execute tools at runtime via MCP servers
**Location**: `backend/core/tools/`

| File | Role | Stage |
|------|------|-------|
| `mcp_tool_wrapper.py` | Legacy MCPToolWrapper for tool execution | 6 |
| `mcp_connection_manager.py` | Manage MCP server connections | 6 |
| `custom_mcp_handler.py` | Handle custom MCP execution | 6 |
| `mcp_tool_executor.py` | Execute tool calls to MCP servers | 6 |
| `dynamic_tool_builder.py` | Build dynamic tool classes | 6 |

**Key Characteristics**:
- Executes already-discovered tools
- Uses MCPConnectionManager to maintain connections
- Lazy initialization of connections
- Tool schema already loaded by JIT system

**Key Code**:
```python
# mcp_tool_wrapper.py:119+ MCPToolWrapper
@tool_metadata(...)
class MCPToolWrapper(Tool):
    async def _ensure_initialized(self):
        await self._initialize_servers()
        await self._create_dynamic_tools()
        self._initialized = True

    async def execute_tool(self, tool_name, arguments):
        # Actual tool execution to MCP server
```

**External Dependencies**:
```python
from core.mcp_module import mcp_service
from core.tools.utils.mcp_connection_manager import MCPConnectionManager
from core.tools.utils.custom_mcp_handler import CustomMCPHandler
from core.tools.utils.mcp_tool_executor import MCPToolExecutor
```

---

### Agent Tools API System
**Purpose**: API endpoints for tool management (Stage 4 operations)
**Location**: `backend/core/agent_tools.py`

| File | Role | Stage(s) |
|------|------|----------|
| `agent_tools.py` | API endpoints for tool enable/disable | 4 |

**Key Code**:
```python
# agent_tools.py:102-233
@router.post("/agents/{agent_id}/custom-mcp-tools")
async def update_custom_mcp_tools_for_agent(agent_id, request):
    # Update enabledTools for an MCP
    custom_mcps[i]['enabledTools'] = enabled_tools

    # Create new version with updated config
    new_version = await version_service.create_version(
        custom_mcps=custom_mcps
    )
```

**External Dependencies**:
```python
from core.versioning.version_service import get_version_service
from core.mcp_module import mcp_service  # For discovery only
```

---

## Cross-System Dependencies

### When Core MCP → JIT
**Trigger**: Agent execution starts
**Path**: Agent runner initializes JIT loader with agent config

```
agent_runner.py:72
    ↓
MCPJITLoader(agent_config)
    ↓
mcp_loader.py:26 reads:
    - custom_mcp[]
    - configured_mcps[]
    - account_id
```

**Data Passed**: agent_config (contains all MCP configs with enabledTools)

### When JIT → Core MCP (Credential Lookup)
**Trigger**: JIT needs to load schema for tool with OAuth token
**Path**: mcp_loader._discover_tools_with_fallback()

```python
# mcp_loader.py:304-323
if not access_token:
    qualified_name = config.get('qualifiedName')
    account_id = self.agent_config.get('account_id')

    if qualified_name and account_id:
        from core.credentials import get_credential_service
        from core.services.supabase import DBConnection

        db = DBConnection()
        service = get_credential_service(db)
        credential = await service.get_credential(account_id, qualified_name)

        if credential:
            access_token = credential.config["access_token"]
```

**Data Passed**: qualified_name, account_id
**Data Received**: OAuth token from credentials DB

### When Agent Runner → JIT
**Trigger**: setup_bootstrap() phase
**Path**: Direct method calls

```python
# agent_runner.py:46-49
jit_config = JITConfig.from_run_context(
    agent_config=self.config.agent_config
)

# agent_runner.py:72
await self._initialize_mcp_jit_loader(cache_only=False)

# Internally:
mcp_loader = MCPJITLoader(self.config.agent_config)
await mcp_loader.build_tool_map(cache_only=False)
```

**Data Passed**: agent_config
**Returns**: JIT loader attached to thread_manager

### When JIT → Executor
**Trigger**: Tool activation + execution
**Path**: JIT creates wrapper, executor runs it

```python
# loader.py:217-223
tool_wrapper = await JITLoader._create_mcp_tool_wrapper(
    tool_name, schema, tool_info
)

thread_manager.tool_registry.tools[tool_name] = {
    "instance": tool_wrapper,
    "schema": tool_schema
}
```

**Data Passed**: Tool name, schema, tool_info
**Execution**: ThreadManager calls wrapper methods

---

## Data Flow Through Systems

### Discovery Data Flow (Stage 3)

```
User Input (URL + optional OAuth config)
    ↓
api.py:discover_custom_mcp_tools()
    ↓
mcp_service.discover_custom_tools()
    ├─ Connects to MCP server
    ├─ Calls session.list_tools()
    └─ Returns: {tools: [{name, description, inputSchema}]}
    ↓
api.py returns CustomMCPConnectionResponse
    ↓
Frontend receives tool list
```

### Storage Data Flow (Stage 3→4)

```
Discovered tools + config
    ↓
api.py:mcp_auth_callback():393-403
    └─ Creates new_custom_mcp = {
        name, qualifiedName, type, config,
        enabledTools: [tool names],
        tools: [full schemas]
      }
    ↓
version_service.create_version()
    ↓
Stored in agent_versions table:
    config → tools → custom_mcp → [new_custom_mcp]
    ↓
agents.current_version_id → points to new version
```

### Bootstrap Data Flow (Stage 4→5)

```
Agent execution starts
    ↓
agent_runner.py:setup_bootstrap()
    ↓
Fetch agent_config from agent_versions:
    config → tools → {
        custom_mcp: [
            {name, config, enabledTools: [tool names]}
        ]
    }
    ↓
MCPJITLoader(agent_config)
    ↓
build_tool_map() reads enabledTools
    ↓
tool_map = {
    "tool_a": MCPToolInfo(...),
    "tool_b": MCPToolInfo(...)
}
    ↓
Attached to thread_manager.mcp_loader
```

### Execution Data Flow (Stage 5→6)

```
ThreadManager.execute("tool_a", args)
    ↓
loader.activate_mcp_tool("tool_a")
    ↓
MCPJITLoader.activate_tool("tool_a")
    ├─ tool_info = tool_map["tool_a"]
    ├─ Load schema:
    │  ├─ Connect to mcp_config.url
    │  ├─ Call session.list_tools()
    │  └─ Extract schema for tool_a
    └─ Cache in schema_cache
    ↓
Create dynamic wrapper
    ↓
ThreadManager.tool_registry.tools["tool_a"] = {
    instance: wrapper,
    schema: schema
}
    ↓
When LLM calls tool_a:
    └─ wrapper.execute(args)
    └─ Call session.call_tool("tool_a", args)
    └─ Return result
```

---

## System Boundaries (What Each System Does NOT Do)

### Core MCP Module Does NOT:
- ❌ Store tool schemas in memory (passes through only)
- ❌ Build tool maps
- ❌ Lazy-load schemas
- ❌ Activate individual tools
- ❌ Route tool execution
- ❌ Make runtime MCP connections (except for discovery)

### JIT System Does NOT:
- ❌ Call MCP servers for discovery (only reads cached config)
- ❌ Store anything to database
- ❌ Store credentials
- ❌ Perform OAuth flows
- ❌ Update agent configs
- ❌ Handle execution (except schema loading for that specific tool)

### Execution Layer Does NOT:
- ❌ Discover tools
- ❌ Create tool maps
- ❌ Load full schemas (assumes JIT did this)
- ❌ Update agent configs
- ❌ Store data

---

## Key Import Patterns

### Circular Dependency Prevention

**Good Pattern** (async import):
```python
# mcp_loader.py:310-315
if not access_token:
    from core.credentials import get_credential_service
    from core.services.supabase import DBConnection

    db = DBConnection()
    service = get_credential_service(db)
```

**Why**: JIT doesn't import Core MCP at module level, only when needed during discovery.

### Singleton Pattern

```python
# mcp_service.py:635
mcp_service = MCPService()

# auth_service.py:169
mcp_auth_service = MCPAuthService()

# Custom MCP Registry:
mcp_registry_service = CustomMCPRegistryService()

# JIT Loader:
class JITLoader:
    _instance = None
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
```

**Why**: Single instance per service ensures consistent state and connection pooling.

---

## Testing Considerations

### Unit Test Organization

**Core MCP Module Tests**:
- Mock MCP servers (HTTP/SSE)
- Test discovery paths (HTTP, SSE, fallback)
- Test OAuth flows
- Test credential storage

**JIT System Tests**:
- Mock agent_config structures
- Test tool_map building from configs
- Test schema loading (mock MCP servers needed here)
- Test lazy activation

**Agent Runner Tests**:
- Test bootstrap phase
- Mock JIT loader initialization
- Verify JITConfig creation

---

## Troubleshooting Guide

### Tool Not Found in Stage 5-6

**Likely Cause**: enabledTools not in agent config

```python
# Check agent_versions.config structure
SELECT config FROM agent_versions
WHERE agent_id = ?
ORDER BY created_at DESC LIMIT 1;

# Expected structure:
{
  "tools": {
    "custom_mcp": [{
      "enabledTools": ["tool_a", "tool_b"],  ← Must exist
      "config": {...}
    }]
  }
}
```

**Fix**: Re-enable tools via agent_tools.py API:
```
PUT /agents/{agent_id}/custom-mcp-tools
{
  "custom_mcps": [{
    "name": "My MCP",
    "enabledTools": ["tool_a", "tool_b"]
  }]
}
```

### Schema Not Loading in Stage 6

**Likely Causes**:
1. MCP server not reachable from worker
2. OAuth token expired
3. Tool name changed/removed on server

**Fix**:
```python
# Check:
# 1. MCP server URL accessible
# 2. OAuth token valid
# 3. Tool exists on server:
#    curl -H "Authorization: Bearer TOKEN" https://mcp-server/mcp
```

### tools[] Cached But Not Used

**Fact**: tools[] field in agent config is informational only

```python
# This field:
"tools": [{name, description, inputSchema}]

# Is used for:
# - UI display (immediate tool info without schema load)
# - Documentation
# - NOT used for execution

# Actual execution relies on:
"enabledTools": ["tool_a", "tool_b"]
```

---

## Configuration Checklist

- [ ] MCP server URL valid and accessible
- [ ] OAuth tokens stored correctly if auth required
- [ ] enabledTools populated in agent config
- [ ] agent.current_version_id points to version with MCP config
- [ ] MCPJITLoader receives agent_config with custom_mcp[]
- [ ] Schema loading works (Stage 6 server call succeeds)

