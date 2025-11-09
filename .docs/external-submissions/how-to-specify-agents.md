# Specifying Agents in Suna Headless API

## Overview

The Suna API allows you to specify which agent to use when starting an agent run. If no agent is specified, the system uses the default agent for your account.

---

## 1. List Available Agents

Before starting an agent run, you can list all available agents for your account:

```powershell
curl.exe -X GET "https://kortix.syhc.dev/api/agents" `
  -H "X-API-Key: pk_cLYtpCsc8raT3KyJzZRdbBSxPjJQluO0:sk_p6g2PzCygtl8PlwJVGeCartqgIymjhdQ"
```

**Optional Query Parameters:**

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `page` | int | Page number (1-based, default: 1) | `?page=2` |
| `limit` | int | Items per page (1-100, default: 20) | `?limit=50` |
| `search` | string | Search by agent name | `?search=research` |
| `sort_by` | string | Sort field: `name`, `created_at`, `updated_at`, `tools_count` | `?sort_by=name` |
| `sort_order` | string | Sort order: `asc` or `desc` (default: desc) | `?sort_order=asc` |
| `has_default` | boolean | Filter only default agents | `?has_default=true` |
| `has_mcp_tools` | boolean | Filter agents with MCP tools | `?has_mcp_tools=true` |
| `has_agentpress_tools` | boolean | Filter agents with AgentPress tools | `?has_agentpress_tools=true` |
| `tools` | string | Comma-separated tool names | `?tools=web_search,file_read` |
| `content_type` | string | Filter: `agents`, `templates`, or both | `?content_type=agents` |

**Response Example:**

```json
{
  "agents": [
    {
      "agent_id": "agent-uuid-123",
      "name": "Research Agent",
      "description": "AI agent for research tasks",
      "system_prompt": "You are a helpful research assistant...",
      "model_id": "anthropic/claude-3-5-sonnet",
      "tools": ["web_search", "file_read"],
      "mcp_tools": ["filesystem", "memory"],
      "is_default": true,
      "created_at": "2025-11-09T10:00:00Z",
      "updated_at": "2025-11-09T10:30:00Z"
    },
    {
      "agent_id": "agent-uuid-456",
      "name": "Code Agent",
      "description": "AI agent for coding tasks",
      "system_prompt": "You are an expert programmer...",
      "model_id": "anthropic/claude-3-5-sonnet",
      "tools": ["code_interpreter", "file_read", "file_write"],
      "mcp_tools": ["filesystem"],
      "is_default": false,
      "created_at": "2025-11-09T09:00:00Z",
      "updated_at": "2025-11-09T09:15:00Z"
    }
  ],
  "pagination": {
    "current_page": 1,
    "page_size": 20,
    "total_items": 2,
    "total_pages": 1,
    "has_next": false,
    "has_previous": false
  }
}
```

---

## 2. Get Specific Agent Details

Retrieve full configuration for a specific agent:

```powershell
curl.exe -X GET "https://kortix.syhc.dev/api/agents/agent-uuid-123" `
  -H "X-API-Key: pk_cLYtpCsc8raT3KyJzZRdbBSxPjJQluO0:sk_p6g2PzCygtl8PlwJVGeCartqgIymjhdQ"
```

**Response:** Full agent configuration with system prompt, tools, MCPs, etc.

---

## 3. Start Agent Run WITH Specified Agent

Pass the `agent_id` parameter to use a specific agent instead of the default:

```powershell
curl.exe -X POST "https://kortix.syhc.dev/api/agent/start" `
  -H "X-API-Key: pk_cLYtpCsc8raT3KyJzZRdbBSxPjJQluO0:sk_p6g2PzCygtl8PlwJVGeCartqgIymjhdQ" `
  -F "prompt=Research venture capital firms in biotech" `
  -F "agent_id=agent-uuid-456"
```

**Form Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | string | ✅ Yes | The task/prompt for the agent |
| `agent_id` | string | ❌ No | UUID of agent to use (default if omitted) |
| `thread_id` | string | ❌ No | Use existing thread (creates new if omitted) |
| `model_name` | string | ❌ No | Override agent's model (e.g., `gpt-4`) |
| `files` | file[] | ❌ No | Files to upload (max 10) |

**Response:**

```json
{
  "thread_id": "thread-uuid",
  "agent_run_id": "run-uuid",
  "status": "running"
}
```

---

## 4. Start Agent Run WITHOUT Specifying Agent

If `agent_id` is omitted, the system uses the default agent:

```powershell
curl.exe -X POST "https://kortix.syhc.dev/api/agent/start" `
  -H "X-API-Key: pk_cLYtpCsc8raT3KyJzZRdbBSxPjJQluO0:sk_p6g2PzCygtl8PlwJVGeCartqgIymjhdQ" `
  -F "prompt=Research venture capital firms in biotech"
```

**Default Agent Selection Logic:**

1. **For new threads:** Looks for agent with `metadata.is_suna_default = true`
2. **For existing threads:** Uses agent with `is_default = true`
3. **Fallback:** If no default found, returns 404 error

---

## 5. Use Case Examples

### Example 1: Use Default Agent

```powershell
# List available agents
curl.exe -X GET "https://kortix.syhc.dev/api/agents?has_default=true" `
  -H "X-API-Key: pk_cLYtpCsc8raT3KyJzZRdbBSxPjJQluO0:sk_p6g2PzCygtl8PlwJVGeCartqgIymjhdQ"

# Start run with default agent
curl.exe -X POST "https://kortix.syhc.dev/api/agent/start" `
  -H "X-API-Key: pk_cLYtpCsc8raT3KyJzZRdbBSxPjJQluO0:sk_p6g2PzCygtl8PlwJVGeCartqgIymjhdQ" `
  -F "prompt=Find research papers on AI agents"
```

### Example 2: Use Specific Agent

```powershell
# Get agent ID for "Code Agent"
curl.exe -X GET "https://kortix.syhc.dev/api/agents?search=Code%20Agent" `
  -H "X-API-Key: pk_cLYtpCsc8raT3KyJzZRdbBSxPjJQluO0:sk_p6g2PzCygtl8PlwJVGeCartqgIymjhdQ"

# Assume agent_id is "agent-uuid-456"
# Start run with Code Agent
curl.exe -X POST "https://kortix.syhc.dev/api/agent/start" `
  -H "X-API-Key: pk_cLYtpCsc8raT3KyJzZRdbBSxPjJQluO0:sk_p6g2PzCygtl8PlwJVGeCartqgIymjhdQ" `
  -F "prompt=Write a Python function to validate email addresses" `
  -F "agent_id=agent-uuid-456"
```

### Example 3: Use Existing Thread with Different Agent

```powershell
# Start new run on existing thread with different agent
curl.exe -X POST "https://kortix.syhc.dev/api/agent/start" `
  -H "X-API-Key: pk_cLYtpCsc8raT3KyJzZRdbBSxPjJQluO0:sk_p6g2PzCygtl8PlwJVGeCartqgIymjhdQ" `
  -F "thread_id=existing-thread-uuid" `
  -F "prompt=Now write unit tests for that function" `
  -F "agent_id=agent-uuid-456"
```

---

## Agent Configuration Details

Each agent can have:

| Field | Description |
|-------|-------------|
| `agent_id` | Unique UUID for the agent |
| `name` | Human-readable agent name |
| `description` | What the agent does |
| `system_prompt` | System instructions for the LLM |
| `model_id` | Default model (can be overridden with `model_name` param) |
| `tools` | List of available tools (web_search, code_interpreter, etc.) |
| `mcp_tools` | Model Context Protocol tools (filesystem, memory, etc.) |
| `is_default` | Whether this is the default agent |
| `created_at` | Agent creation timestamp |
| `updated_at` | Last modification timestamp |

---

## Error Handling

**Invalid Agent ID:**

```powershell
curl.exe -X POST "https://kortix.syhc.dev/api/agent/start" `
  -H "X-API-Key: pk_cLYtpCsc8raT3KyJzZRdbBSxPjJQluO0:sk_p6g2PzCygtl8PlwJVGeCartqgIymjhdQ" `
  -F "prompt=Test" `
  -F "agent_id=invalid-agent-id"
```

**Response:**

```json
{
  "detail": "Agent not found"
}
```

**No Default Agent:**

```powershell
curl.exe -X POST "https://kortix.syhc.dev/api/agent/start" `
  -H "X-API-Key: pk_cLYtpCsc8raT3KyJzZRdbBSxPjJQluO0:sk_p6g2PzCygtl8PlwJVGeCartqgIymjhdQ" `
  -F "prompt=Test"
```

**Response:**

```json
{
  "detail": "No default agent available. Please contact support."
}
```

---

## Summary

**To specify an agent:**

1. **List agents:** `GET /api/agents` with optional filters
2. **Get agent details:** `GET /api/agents/{agent_id}`
3. **Use in agent run:** `POST /api/agent/start` with `agent_id=...` form parameter
4. **Default behavior:** Omit `agent_id` to use account's default agent
