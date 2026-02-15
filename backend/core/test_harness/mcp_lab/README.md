# MCP Lab Harness - Master Guide

The MCP Lab Harness is a **production-grade testing environment** designed to verify Suna/Kortix worker infrastructure and MCP server integrations in a clean, isolated CLI setting. It mirrors real-world agent execution paths while mocking infrastructure dependencies like Supabase and real LLM inference.

---

## 📂 Directory Structure

```
backend/core/test_harness/mcp_lab/
├── runner.py                # Main CLI for onboarding and discovery
├── agent_harness.py         # Isolated E2E agent run simulator
├── mocks.py                 # Mock services (DB, Credentials, Versioning)
├── gen_desktop_commander_url.py # Helper for OAuth URL generation
├── layouts/                 # Configuration and state (see below)
│   ├── local_lab.json       # MCP Server configurations
│   ├── secrets.json         # Encrypted/Plaintext tokens (gitignored)
│   └── pending_auth.json    # Temporary PKCE state
└── scripts/                 # Scripted agent turn definitions (JSON)
    ├── test_valyu.json      # Scenario: API Key auth
    └── test_desktop_commander.json # Scenario: OAuth/Bearer auth
```

---

## 🛠️ Configuration & Layouts

The harness relies on JSON files in the `layouts/` directory to manage state.

### 1. `layouts/local_lab.json`
Defines which MCP servers are "connected" to the harness.
```json
{
  "account_id": "harness_user",
  "custom_mcp": [
    {
      "name": "desktop_commander",
      "url": "https://mcp.desktopcommander.app/mcp",
      "type": "http",
      "config": {}
    },
    {
      "name": "valyu_ai",
      "url": "https://mcp.valyu.ai/mcp?valyuApiKey=...",
      "type": "http",
      "config": {}
    }
  ]
}
```

### 2. `layouts/secrets.json`
Stores authentication tokens. In production, these are encrypted in Supabase; here they are stored in plain text for testing.
```json
{
  "credentials": {
    "desktop_commander": {
      "access_token": "...",
      "refresh_token": "...",
      "expires_in": 3600
    }
  }
}
```

### 3. `layouts/pending_auth.json`
Temporary storage for the `code_verifier` used during the PKCE OAuth handshake. Created by `auth` or generation scripts.

---

## 🚀 Command Reference (`runner.py`)

Run these commands using `uv run` inside the `suna-backend-1` container or with `PYTHONPATH` set to the backend directory.

### `add` - Onboard a Server
Probes a URL for SSE/HTTP support and detects OAuth requirements.
```bash
python runner.py add https://mcp.valyu.ai/mcp?valyuApiKey=...
```

### `auth` - OAuth Handshake
Initiates a CLI-based OAuth flow.
```bash
python runner.py auth --server desktop_commander
```
1. Generates PKCE challenge.
2. Provides an Authorization URL.
3. Prompts user to paste the `code` from the redirect URL.
4. Exchanges code for token and saves to `secrets.json`.

### `discover` - Unified Discovery
Mirrors the `discover_mcp_tools` agent tool. Builds a JIT tool map and fetches full schemas.
```bash
python runner.py discover
```

---

## 🤖 Agent Execution (`agent_harness.py`)

The `agent_harness.py` script allows you to run **scripted agent sessions**. This verifies that the worker can successfully use tools and return data to the LLM context.

### Running a Script
```bash
python agent_harness.py run --script scripts/test_valyu.json
```

### Script Format
Scripts define a sequence of turns (messages or tool calls).
```json
{
  "name": "Test Script",
  "turns": [
    { "id": 1, "type": "message", "content": "Hello" },
    { "id": 2, "type": "tool_call", "tool_name": "valyu_search", "args": { "query": "..." } }
  ]
}
```

---

## 🏗️ Architecture: Native Flow Alignment

The harness is explicitly designed to prevent "test drift" by using **real production code paths**:

| Component | Production Path | Harness Path |
|-----------|----------------|--------------|
| **Discovery** | `expand_msg_tool._discover_tools()` | **Same** |
| **Execution** | `MCPToolExecutor.execute_tool()` | **Same** |
| **JIT Loading** | `MCPJITLoader.rebuild_tool_map()` | **Same** |
| **Prompting** | `PromptManager._append_jit_mcp_info()` | **Same** |

**What is Mocked?**
- **Database**: Bypasses Supabase, reads from `local_lab.json`.
- **Worker Environment**: Patches out heavy LLM initialization and cloud services.
- **Inference**: Uses "Scripted Turns" instead of real LLM calls to isolate infrastructure logic.

---

## 🔧 Troubleshooting

### "Missing 'url' in HTTP MCP config"
Ensure the server is defined in `local_lab.json` AND that `secrets.json` contains a matching entry if authentication is required. The harness uses the server name or URL slug to link these files.

### "TypeError: object AsyncMock can't be used in 'await' expression"
This occurs when a mocked service method is not decorated with `AsyncMock`. The `agent_harness.py` environment patcher handles this for core services.

### OAuth Session Errors
Desktop Commander and other providers often restrict `redirect_uri` and `client_id`. If the automated flow fails, use `gen_desktop_commander_url.py` to manually tweak parameters or inject a known-good token into `secrets.json`.

---

## 📝 Change Log & Session Summary (Feb 2026)

- ✅ **Isolated Agent Runner**: Established `agent_harness.py` for E2E verification without a DB.
- ✅ **OAuth Standard**: Verified Bearer Token propagation in HTTP/SSE headers.
- ✅ **Unified Brain**: Proven ability to merge 40+ tools from multiple servers (Valyu + Desktop Commander).
- ✅ **Bug Fix**: Caught and fixed missing `time` import in `mcp_tool_executor.py`.
- ✅ **Discovery Fix**: Fixed schema loading for custom MCPs where `url` was nested in config.
