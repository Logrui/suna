# Suna Agent Tools Review - Comprehensive Analysis

This document provides a detailed analysis of all tools available to agents in the Suna platform, including both internally built AgentPress tools and external MCP (Model Context Protocol) tools, and how they are presented in the constructed system prompt.

---

## Table of Contents
1. [Overview](#overview)
2. [Internally Built Tools (AgentPress)](#internally-built-tools-agentpress)
3. [External MCP Tools](#external-mcp-tools)
4. [Agent Builder Tools](#agent-builder-tools)
5. [System Prompt Construction](#system-prompt-construction)
6. [Tool Registration Process](#tool-registration-process)
7. [Tool Discovery & Availability](#tool-discovery--availability)

---

## Overview

The Suna platform provides agents with two main categories of tools:

1. **AgentPress Tools** - Internally built, native platform capabilities
2. **MCP Tools** - External integrations via Model Context Protocol (Composio, custom HTTP/SSE servers)

These tools are dynamically registered based on agent configuration and made available through a constructed system prompt that includes tool schemas, descriptions, and usage instructions.

---

## Internally Built Tools (AgentPress)

AgentPress tools are native capabilities built into the Suna platform. They are enabled/disabled per agent via the `agentpress_tools` configuration.

### Core Tool Categories

#### 1. Sandbox & Code Execution Tools
Located in: `backend/core/tools/`

| Tool Name | Description | Key Functions |
|-----------|-------------|---------------|
| **sb_shell_tool** | Execute shell commands in isolated sandbox | Command execution, script running, system operations |
| **sb_files_tool** | File operations (read, write, edit, append) | File management, content manipulation |
| **sb_expose_tool** | Expose local services to internet | Port exposure, public URL generation |

**Configuration Key:** `sb_shell_tool`, `sb_files_tool`, `sb_expose_tool`

#### 2. Web & Search Tools
Located in: `backend/core/tools/`

| Tool Name | Description | Key Functions | API Requirements |
|-----------|-------------|---------------|------------------|
| **web_search_tool** | Web search via Tavily/Firecrawl | Search queries, result ranking | TAVILY_API_KEY or FIRECRAWL_API_KEY |
| **browser_tool** | Browser automation | Page navigation, interaction, scraping | None |
| **image_search_tool** | Image search via Serper | Image queries, visual search | SERPER_API_KEY |

**Configuration Keys:** `web_search_tool`, `browser_tool`, `image_search_tool`

#### 3. Visual & Media Tools
Located in: `backend/core/tools/`

| Tool Name | Description | Key Functions |
|-----------|-------------|---------------|
| **sb_vision_tool** | Image analysis and understanding | Image loading, analysis, context management |
| **sb_image_edit_tool** | Image generation and editing | Generate images, edit existing images |
| **sb_designer_tool** | Professional design creation | Social media graphics, marketing materials, presentations |
| **sb_presentation_tool** | HTML presentation creation | Slide creation, template loading, presentation assembly |

**Configuration Keys:** `sb_vision_tool`, `sb_image_edit_tool`, `sb_design_tool`, `sb_presentation_tool`

#### 4. Data & Research Tools
Located in: `backend/core/tools/`

| Tool Name | Description | Key Functions | API Requirements |
|-----------|-------------|---------------|------------------|
| **data_providers_tool** | Structured data from providers | LinkedIn, Twitter, Zillow, Amazon, Yahoo Finance data | RAPID_API_KEY |
| **paper_search_tool** | Academic paper search | Search academic papers, citations | SEMANTIC_SCHOLAR_API_KEY |
| **people_search_tool** | Professional people search | Find professionals, enrich profiles | EXA_API_KEY |
| **company_search_tool** | Company research | Find companies, company data | EXA_API_KEY |

**Configuration Keys:** `data_providers_tool`, `paper_search_tool`, `people_search_tool`, `company_search_tool`

#### 5. Utility Tools
Located in: `backend/core/tools/`

| Tool Name | Description | Key Functions |
|-----------|-------------|---------------|
| **sb_upload_file_tool** | Upload files to cloud storage | File upload to Supabase S3, signed URL generation |
| **sb_kb_tool** | Knowledge base operations | Store/retrieve agent knowledge |
| **sb_docs_tool** | Document parsing | Parse PDFs, extract structured data |
| **message_tool** | Message handling | Ask user questions, get input |
| **task_list_tool** | Task management | Create, update, complete tasks |
| **expand_msg_tool** | Message expansion | Expand/collapse message content |
| **vapi_voice_tool** | Voice interaction | Voice calls, speech integration |

**Configuration Keys:** `sb_upload_file_tool`, `sb_kb_tool`, `sb_docs_tool`, `vapi_voice_tool`

### Tool Registration Logic

Tools are registered in `backend/core/run.py` (lines 140-320):

```python
# Core tools (always registered)
self.thread_manager.add_tool(ExpandMessageTool, thread_id=self.thread_id, thread_manager=self.thread_manager)
self.thread_manager.add_tool(MessageTool)
self.thread_manager.add_tool(TaskListTool, project_id=self.project_id, thread_manager=self.thread_manager, thread_id=self.thread_id)

# Conditional registration based on agent configuration
if 'web_search_tool' not in disabled_tools:
    enabled_methods = self._get_enabled_methods_for_tool('web_search_tool')
    self.thread_manager.add_tool(SandboxWebSearchTool, function_names=enabled_methods, ...)

if 'sb_shell_tool' not in disabled_tools:
    enabled_methods = self._get_enabled_methods_for_tool('sb_shell_tool')
    self.thread_manager.add_tool(SandboxShellTool, function_names=enabled_methods, ...)
```

**Tool Configuration Structure:**
```json
{
  "agentpress_tools": {
    "sb_shell_tool": true,
    "sb_files_tool": true,
    "web_search_tool": false,
    "browser_tool": {
      "enabled": true,
      "description": "Browse websites and interact with web pages"
    }
  }
}
```

---

## External MCP Tools

MCP (Model Context Protocol) tools allow agents to integrate with external services through:
1. **Composio Integration** - 2700+ pre-built app integrations
2. **Custom MCP Servers** - HTTP, SSE, or JSON-based custom servers

### MCP Tool Types

#### 1. Configured MCPs (Composio)
Located in: Agent config → `configured_mcps`

These are pre-built integrations from Composio's catalog:

**Structure:**
```json
{
  "configured_mcps": [
    {
      "name": "Gmail",
      "qualifiedName": "composio.gmail",
      "config": {
        "profile_id": "prof_xxx",
        "toolkit_slug": "gmail",
        "mcp_qualified_name": "gmail"
      },
      "enabledTools": [
        "GMAIL_SEND_EMAIL",
        "GMAIL_CREATE_EMAIL_DRAFT",
        "GMAIL_GET_PROFILE"
      ]
    }
  ]
}
```

**Popular Composio Toolkits:**
- Gmail (email operations)
- Slack (messaging)
- GitHub (repository management)
- Linear (issue tracking)
- Notion (note-taking)
- Google Calendar (scheduling)
- Airtable (database)
- And 2700+ more...

#### 2. Custom MCPs
Located in: Agent config → `custom_mcps`

Custom integrations for proprietary or specialized services:

**Structure:**
```json
{
  "custom_mcps": [
    {
      "name": "Custom API",
      "type": "http",
      "customType": "http",
      "config": {
        "url": "https://api.example.com/mcp"
      },
      "enabledTools": ["custom_tool_1", "custom_tool_2"],
      "isCustom": true
    }
  ]
}
```

**Custom MCP Types:**
- **HTTP**: Standard HTTP-based MCP servers
- **SSE**: Server-Sent Events for streaming
- **Composio**: Composio-hosted integrations
- **JSON**: JSON-RPC based servers

### MCP Tool Loading Process

**File:** `backend/core/run.py` (MCPManager class, line 326+)

```python
async def register_mcp_tools(self, agent_config: dict) -> Optional[MCPToolWrapper]:
    all_mcps = []
    
    # Load configured MCPs (Composio)
    if agent_config.get('configured_mcps'):
        all_mcps.extend(agent_config['configured_mcps'])
    
    # Load custom MCPs
    if agent_config.get('custom_mcps'):
        for custom_mcp in agent_config['custom_mcps']:
            # Process custom MCP configuration
            # Handle different custom types (composio, sse, http, json)
            all_mcps.append(mcp_config)
    
    # Initialize MCP wrapper
    mcp_wrapper_instance = MCPToolWrapper(mcp_configs=all_mcps)
    await mcp_wrapper_instance.initialize_and_register_tools()
    
    return mcp_wrapper_instance
```

**MCP Tool Discovery:**
- Tools are discovered dynamically from MCP servers
- Each server exposes its own tool schemas
- Only `enabledTools` are registered and made available

---

## Agent Builder Tools

Special tools that allow agents to modify themselves and create other agents.

Located in: `backend/core/tools/agent_builder_tools/`

### Available Builder Tools

| Tool Name | Description | Key Functions |
|-----------|-------------|---------------|
| **agent_config_tool** | Self-configuration | Update own system prompt, tools, MCPs |
| **mcp_search_tool** | MCP discovery | Search MCP servers, explore integrations |
| **credential_profile_tool** | Credential management | Create auth profiles, manage connections |
| **trigger_tool** | Automation triggers | Create scheduled/event triggers |
| **agent_creation_tool** | Agent creation | Create new specialized agents |

**Configuration:**
```json
{
  "agentpress_tools": {
    "agent_config_tool": true,
    "mcp_search_tool": true,
    "credential_profile_tool": true,
    "trigger_tool": true,
    "agent_creation_tool": true
  }
}
```

### Builder Tool Functions

#### AgentConfigTool
**File:** `agent_config_tool.py`

**Key Method:**
```python
@openapi_schema({
    "type": "function",
    "function": {
        "name": "update_agent",
        "description": "Update the agent's configuration including name, tools, and MCP servers...",
        "parameters": {
            "name": {"type": "string"},
            "system_prompt": {"type": "string"},
            "agentpress_tools": {"type": "object"},
            "configured_mcps": {"type": "array"}
        }
    }
})
async def update_agent(self, name, system_prompt, agentpress_tools, configured_mcps):
    # Updates current agent configuration
    # Creates new version in version history
```

#### MCPSearchTool
**File:** `mcp_search_tool.py`

**Key Methods:**
- `search_mcp_servers(search_query, limit=5)` - Search Composio catalog
- `get_popular_mcp_servers(limit=10)` - Get trending integrations
- `get_mcp_server_details(toolkit_slug)` - Get app details
- `discover_user_mcp_servers(profile_id)` - Discover authenticated tools

#### CredentialProfileTool
**File:** `credential_profile_tool.py`

**Key Methods:**
- `create_credential_profile(app_name, toolkit_slug)` - Creates auth profile + link
- `get_credential_profiles()` - List connected accounts
- `configure_profile_for_agent(profile_id, enabled_tools)` - Add to agent config

#### AgentCreationTool
**File:** `agent_creation_tool.py`

**Key Method:**
```python
@openapi_schema({
    "function": {
        "name": "create_new_agent",
        "description": "Create a completely new AI agent...",
        "parameters": {
            "name": {"type": "string"},
            "system_prompt": {"type": "string"},
            "agentpress_tools": {"type": "object"},
            "configured_mcps": {"type": "array"}
        }
    }
})
async def create_new_agent(self, name, system_prompt, agentpress_tools, configured_mcps):
    # Creates new agent with specified configuration
```

---

## System Prompt Construction

The system prompt is dynamically built based on agent configuration and available tools.

**File:** `backend/core/run.py` - `PromptManager.build_system_prompt()` (line 394+)

### Prompt Building Process

```python
async def build_system_prompt(
    model_name: str, 
    agent_config: Optional[dict], 
    thread_id: str, 
    mcp_wrapper_instance: Optional[MCPToolWrapper],
    client=None,
    tool_registry=None,
    xml_tool_calling: bool = True
) -> dict:
```

#### Step 1: Base System Prompt
```python
# Default system content
default_system_content = get_system_prompt()  # From prompts/prompt.py

# Use agent's custom prompt if configured
if agent_config and agent_config.get('system_prompt'):
    system_content = agent_config['system_prompt'].strip()
else:
    system_content = default_system_content
```

#### Step 2: Agent Builder Prompt (Conditional)
```python
# Check if agent has builder tools enabled
if agent_config:
    agentpress_tools = agent_config.get('agentpress_tools', {})
    has_builder_tools = any(
        agentpress_tools.get(tool, False) 
        for tool in ['agent_config_tool', 'mcp_search_tool', 
                     'credential_profile_tool', 'trigger_tool']
    )
    
    if has_builder_tools:
        # Append the full agent builder prompt
        builder_prompt = get_agent_builder_prompt()  # From agent_builder_prompt.py
        system_content += f"\n\n{builder_prompt}"
```

**Agent Builder Prompt Includes:**
- Self-configuration capabilities
- MCP integration instructions
- Agent creation guidelines
- Credential management workflows
- Trigger setup instructions

#### Step 3: Knowledge Base Context
```python
# Add agent-specific knowledge base
if agent_config and client and 'agent_id' in agent_config:
    kb_result = await client.rpc('get_agent_knowledge_base_context', {
        'p_agent_id': agent_config['agent_id']
    }).execute()
    
    if kb_result.data:
        kb_section = f"""
        === AGENT KNOWLEDGE BASE ===
        {kb_result.data}
        === END AGENT KNOWLEDGE BASE ===
        """
        system_content += kb_section
```

#### Step 4: MCP Tools Information
```python
# Add MCP tool listings and instructions
if agent_config and (agent_config.get('configured_mcps') or agent_config.get('custom_mcps')):
    if mcp_wrapper_instance and mcp_wrapper_instance._initialized:
        mcp_info = "\n\n--- MCP Tools Available ---\n"
        mcp_info += "You have access to external MCP (Model Context Protocol) server tools.\n"
        
        # List available MCP tools
        registered_schemas = mcp_wrapper_instance.get_schemas()
        for method_name, schema_list in registered_schemas.items():
            for schema in schema_list:
                if schema.schema_type == SchemaType.OPENAPI:
                    func_info = schema.schema.get('function', {})
                    description = func_info.get('description', 'No description')
                    mcp_info += f"- **{method_name}**: {description}\n"
                    
                    params = func_info.get('parameters', {})
                    props = params.get('properties', {})
                    if props:
                        mcp_info += f"  Parameters: {', '.join(props.keys())}\n"
        
        # Add critical MCP usage instructions
        mcp_info += "\n🚨 CRITICAL MCP TOOL RESULT INSTRUCTIONS 🚨\n"
        mcp_info += "1. ALWAYS read and use the EXACT results returned by the MCP tool\n"
        mcp_info += "2. For search tools: ONLY cite URLs, sources from actual search results\n"
        mcp_info += "3. DO NOT fabricate, invent, hallucinate, or make up any sources\n"
        # ... more instructions
        
        system_content += mcp_info
```

#### Step 5: XML Tool Calling Instructions
```python
# Add tool schemas in XML format
if xml_tool_calling and tool_registry:
    openapi_schemas = tool_registry.get_openapi_schemas()
    
    if openapi_schemas:
        schemas_json = json.dumps(openapi_schemas, indent=2)
        
        examples_content = f"""
In this environment you have access to a set of tools you can use to answer the user's question.

You can invoke functions by writing a <function_calls> block like the following:

<function_calls>
<invoke name="{{tool_name}}">
<parameter name="param1">value1</parameter>
</invoke>
</function_calls>

Here are the functions available in JSON Schema format:

```json
{schemas_json}
```

When using the tools:
- Use the exact function names from the JSON schema above
- Include all required parameters as specified in the schema
- Format complex data (objects, arrays) as JSON strings within the parameter tags
"""
        
        system_content += examples_content
```

#### Step 6: Current Date/Time Information
```python
# Add current date and time context
now = datetime.datetime.now(datetime.timezone.utc)
datetime_info = f"\n\n=== CURRENT DATE/TIME INFORMATION ===\n"
datetime_info += f"Today's date: {now.strftime('%A, %B %d, %Y')}\n"
datetime_info += f"Current year: {now.strftime('%Y')}\n"
# ... more datetime info

system_content += datetime_info
```

#### Final Output
```python
system_message = {"role": "system", "content": system_content}
return system_message
```

### Complete System Prompt Structure

```
┌─────────────────────────────────────────┐
│ 1. Base System Prompt                  │
│    - General agent instructions         │
│    - Or custom agent system prompt      │
├─────────────────────────────────────────┤
│ 2. Agent Builder Prompt (if enabled)   │
│    - Self-configuration capabilities    │
│    - MCP integration instructions       │
│    - Agent creation guidelines          │
├─────────────────────────────────────────┤
│ 3. Knowledge Base Context (if exists)  │
│    - Agent-specific knowledge           │
│    - Domain expertise data              │
├─────────────────────────────────────────┤
│ 4. MCP Tools Information (if MCPs)     │
│    - Available MCP tool listings        │
│    - Tool descriptions & parameters     │
│    - Critical usage instructions        │
├─────────────────────────────────────────┤
│ 5. XML Tool Calling Instructions       │
│    - OpenAPI schemas for all tools      │
│    - Function calling syntax            │
│    - Parameter formatting rules         │
├─────────────────────────────────────────┤
│ 6. Current Date/Time Information       │
│    - Current date and time              │
│    - Timezone context                   │
└─────────────────────────────────────────┘
```

---

## Tool Registration Process

### ToolRegistry Architecture

**File:** `backend/core/agentpress/tool_registry.py`

```python
class ToolRegistry:
    def __init__(self):
        self.tools = {}  # OpenAPI-style tools and schemas
    
    def register_tool(self, tool_class: Type[Tool], function_names: Optional[List[str]] = None, **kwargs):
        """Register a tool with optional function filtering."""
        tool_instance = tool_class(**kwargs)
        schemas = tool_instance.get_schemas()
        
        for func_name, schema_list in schemas.items():
            if function_names is None or func_name in function_names:
                for schema in schema_list:
                    if schema.schema_type == SchemaType.OPENAPI:
                        self.tools[func_name] = {
                            "instance": tool_instance,
                            "schema": schema
                        }
    
    def get_openapi_schemas(self) -> List[Dict[str, Any]]:
        """Get OpenAPI schemas for function calling."""
        return [
            tool_info['schema'].schema 
            for tool_info in self.tools.values()
            if tool_info['schema'].schema_type == SchemaType.OPENAPI
        ]
```

### Registration Flow

```
1. Agent starts execution
   ↓
2. ToolManager initializes
   ↓
3. For each enabled AgentPress tool:
   - Check if tool is in disabled_tools list
   - Get enabled_methods from agent config
   - Call thread_manager.add_tool(ToolClass, function_names=enabled_methods, **kwargs)
   ↓
4. ToolRegistry.register_tool():
   - Instantiate tool class
   - Get tool schemas
   - Filter by function_names if specified
   - Store in registry with OpenAPI schema
   ↓
5. For MCP tools:
   - MCPManager.register_mcp_tools()
   - Load configured_mcps and custom_mcps
   - Initialize MCPToolWrapper with all MCPs
   - Discover tools from each MCP server
   - Register only enabledTools from each MCP
   ↓
6. System prompt constructed:
   - PromptManager.build_system_prompt()
   - Get all OpenAPI schemas from ToolRegistry
   - Get all MCP schemas from MCPToolWrapper
   - Combine into comprehensive tool documentation
   ↓
7. Agent receives complete system prompt with:
   - Base instructions
   - Available tool schemas
   - MCP tool documentation
   - Usage instructions
```

---

## Tool Discovery & Availability

### AgentPress Tool Discovery

**Granular Method-Level Control:**

Tools can have individual methods enabled/disabled:

```json
{
  "agentpress_tools": {
    "web_search_tool": {
      "enabled": true,
      "enabled_methods": ["web_search", "scrape_webpage"]
    },
    "sb_files_tool": {
      "enabled": true,
      "enabled_methods": ["read_file", "write_file", "edit_file"]
    }
  }
}
```

**File:** `backend/core/utils/tool_discovery.py`

```python
def get_enabled_methods_for_tool(tool_name: str, tools_config: dict) -> Optional[List[str]]:
    """Get list of enabled methods for a specific tool."""
    if tool_name not in tools_config:
        return None
    
    tool_config = tools_config[tool_name]
    
    if isinstance(tool_config, bool):
        return None  # All methods enabled
    
    if isinstance(tool_config, dict):
        if tool_config.get('enabled', False):
            return tool_config.get('enabled_methods', None)
    
    return None
```

### MCP Tool Discovery

**Composio Tool Discovery:**

**File:** `backend/core/composio_integration/composio_profile_service.py`

```python
async def discover_tools(self, profile_id: str, entity_id: str):
    """Discover available tools for an authenticated profile."""
    # Get connected account
    connected_account = await self.composio_client.connected_accounts.get(
        entity_id=entity_id,
        connected_account_id=profile.connected_account_id
    )
    
    # Get available actions/tools
    tools_response = await self.composio_client.actions.list(
        connected_account_ids=[connected_account.id]
    )
    
    return tools_response.items  # List of available tools
```

**Custom MCP Discovery:**

**File:** `backend/core/tools/utils/custom_mcp_handler.py`

```python
async def _initialize_http_mcp(self, server_name: str, server_config: Dict, enabled_tools: List[str]):
    """Initialize HTTP-based MCP server."""
    # Connect to MCP server
    session = mcp_client.ClientSession(...)
    await session.initialize()
    
    # List available tools
    tools_list = await session.list_tools()
    
    # Filter by enabled_tools
    registered_tools = [
        tool for tool in tools_list.tools 
        if tool.name in enabled_tools
    ]
    
    return registered_tools
```

### Tool Availability API

**Endpoint:** `/agents/{agent_id}/tools`

**File:** `backend/core/agent_tools.py` (line 363+)

```python
@router.get("/agents/{agent_id}/tools")
async def get_agent_tools(agent_id: str, user_id: str):
    """Get all available tools for an agent."""
    # Get agent config
    agent_config = extract_agent_config(agent, version_data)
    
    # Process AgentPress tools
    agentpress_tools = []
    for name, enabled in agent_config['agentpress_tools'].items():
        is_enabled = bool(enabled.get('enabled', False)) if isinstance(enabled, dict) else bool(enabled)
        agentpress_tools.append({"name": name, "enabled": is_enabled})
    
    # Process MCP tools
    mcp_tools = []
    for mcp in (configured_mcps + custom_mcps):
        server = mcp.get('name')
        enabled_tools = mcp.get('enabledTools', [])
        for tool_name in enabled_tools:
            mcp_tools.append({
                "name": tool_name, 
                "server": server, 
                "enabled": True
            })
    
    return {
        "agentpress_tools": agentpress_tools, 
        "mcp_tools": mcp_tools
    }
```

**Response Format:**
```json
{
  "agentpress_tools": [
    {"name": "sb_shell_tool", "enabled": true},
    {"name": "web_search_tool", "enabled": false}
  ],
  "mcp_tools": [
    {"name": "GMAIL_SEND_EMAIL", "server": "Gmail", "enabled": true},
    {"name": "SLACK_POST_MESSAGE", "server": "Slack", "enabled": true}
  ]
}
```

---

## Summary

### What Tools Are Available?

**1. AgentPress Tools (Native)**
- 25+ built-in tools across categories:
  - Sandbox & execution (shell, files, expose)
  - Web & search (web search, browser, image search)
  - Visual & media (vision, image editing, design, presentations)
  - Data & research (data providers, papers, people, companies)
  - Utilities (upload, knowledge base, documents, voice)

**2. MCP Tools (External)**
- **Composio**: 2700+ pre-built app integrations
  - Gmail, Slack, GitHub, Linear, Notion, Calendar, etc.
- **Custom MCPs**: Proprietary/specialized integrations
  - HTTP, SSE, JSON-RPC based servers

**3. Agent Builder Tools (Special)**
- Self-configuration tools
- MCP discovery and integration
- Credential management
- Agent creation
- Trigger setup

### How Are They Made Available?

**1. Configuration-Based Enablement**
```json
{
  "agentpress_tools": {
    "sb_shell_tool": true,
    "web_search_tool": {"enabled": true, "enabled_methods": ["web_search"]}
  },
  "configured_mcps": [
    {"name": "Gmail", "enabledTools": ["GMAIL_SEND_EMAIL"]}
  ],
  "custom_mcps": [
    {"name": "Custom", "type": "http", "enabledTools": ["custom_tool"]}
  ]
}
```

**2. Dynamic Registration**
- Tools registered based on agent config
- Methods filtered by enabled_methods
- MCPs initialized and tools discovered
- Schemas collected from all sources

**3. System Prompt Construction**
The constructed system prompt includes:

```
[Base Agent Instructions]
  ↓
[Agent Builder Capabilities] (if builder tools enabled)
  ↓
[Knowledge Base Context] (if knowledge exists)
  ↓
[MCP Tools Available]
  - Tool names
  - Tool descriptions
  - Required parameters
  - Critical usage instructions
  ↓
[All Tool Schemas in JSON]
  - OpenAPI schemas for AgentPress tools
  - OpenAPI schemas for MCP tools
  - Function calling syntax
  - Parameter types and requirements
  ↓
[Current Date/Time Context]
```

### Key Insights

1. **Tool Granularity**: Tools can be enabled/disabled at both tool-level and method-level for fine-grained control

2. **Dynamic Discovery**: MCP tools are discovered dynamically from servers, not hardcoded

3. **Schema-Driven**: All tools expose OpenAPI schemas that are included in the system prompt

4. **Conditional Prompting**: Agent builder instructions only added if builder tools are enabled

5. **MCP Authentication**: Composio tools require credential profiles with OAuth authentication

6. **Versioning**: Tool configurations are versioned - each change creates a new agent version

7. **Security**: Tool access controlled per agent, user-isolated MCP credentials, signed URLs for uploads

8. **Extensibility**: Easy to add new AgentPress tools or integrate new MCP servers

---

## Files Referenced

- `backend/core/run.py` - Main tool registration and prompt construction
- `backend/core/agentpress/tool_registry.py` - Tool registry system
- `backend/core/tools/` - All AgentPress tool implementations
- `backend/core/tools/agent_builder_tools/` - Agent builder tools
- `backend/core/tools/mcp_tool_wrapper.py` - MCP integration wrapper
- `backend/core/prompts/prompt.py` - Base system prompt
- `backend/core/prompts/agent_builder_prompt.py` - Agent builder instructions
- `backend/core/agent_tools.py` - Agent tools API endpoints
- `backend/core/composio_integration/` - Composio integration services
- `sdk/kortix/tools.py` - SDK tool definitions

---

**Generated:** November 2, 2025
**Platform:** Suna AI Agent Platform
**Version:** Current (feature/ollama branch)
