# MCP Lab Harness - Documentation Index

## 📚 Documentation Files

### 🚀 [README.md](./README.md)
**Complete usage guide and reference**
- Setup instructions
- All three authentication scenarios (OAuth, none, query-param)
- Command reference with examples
- Troubleshooting guide
- Architecture notes
- Example workflows

### ❓ [QUESTIONS_ANSWERED.md](./QUESTIONS_ANSWERED.md)
**Detailed answers to your original questions**
- Q1: Unauthenticated servers (e.g., Context7) - what was broken and how it's fixed
- Q2: Why we switched from custom implementation to native MCPRegistry/MCPToolExecutor flow
- Before/after code comparisons
- Benefits of native flow alignment

### 📝 [SESSION_SUMMARY.md](./SESSION_SUMMARY.md)
**Complete list of changes made in this session**
- 9 fixes and enhancements
- Testing checklist for all scenarios
- Files modified
- Next steps
- Architectural decisions

---

## 🎯 Quick Start

### First Time Setup
```bash
cd d:\Homelab\suna\backend

# Add an unauthenticated server (easiest scenario)
python core/test_harness/mcp_lab/runner.py add https://mcp.context7.com/mcp

# Discover tools
python core/test_harness/mcp_lab/runner.py discover

# Test tool execution
python core/test_harness/mcp_lab/runner.py run --prompt "What can you do?"
```

### Three Main Commands

#### 1. `add` - Onboard a New MCP Server
```bash
# Unauthenticated (Context7)
python runner.py add https://mcp.context7.com/mcp

# OAuth (Desktop Commander)
python runner.py add https://mcp.desktopcommander.app/mcp \
  --client-id kortix-harness-cli \
  --redirect-uri http://localhost:8080/callback

# Query-param auth (Valyu)
python runner.py add "https://mcp.valyu.ai/mcp?valyuApiKey=sk_test_..."
```

#### 2. `discover` - List All Tools (Native Flow)
```bash
python runner.py discover
```

Uses the exact same code path as the production `discover_mcp_tools` agent tool.

#### 3. `run` - Simulate Agent Turn (Discovery + Execution)
```bash
# Specify tool
python runner.py run --prompt "List contexts" --tool list_contexts --args '{}'

# Auto-select tool
python runner.py run --prompt "What can you do?"
```

Uses the exact same code path as the production `execute_mcp_tool` agent tool.

---

## 🔧 What's Been Fixed

### Production Bug Fixed
**File**: `core/tools/utils/mcp_tool_executor.py`  
**Issue**: Missing `import time` would crash SSE tool execution  
**Status**: ✅ Fixed (added import on line 5)

### Harness Bugs Fixed
1. ✅ Unauthenticated servers (Scenario B) now work - fixed undefined variables
2. ✅ `cmd_discover` now uses native `MCPRegistry.get_discovery_info()` flow
3. ✅ `cmd_run` now uses native `MCPToolExecutor.execute_tool()` flow
4. ✅ URL correction logic improved
5. ✅ Auto-tool selection added
6. ✅ Server name derivation improved
7. ✅ Transport fallback (405 handling) improved
8. ✅ Comprehensive documentation added

---

## 📂 File Structure

```
backend/core/test_harness/mcp_lab/
├── runner.py                    # Main CLI (575 lines, completely rewritten)
├── mocks.py                     # Mock services (DB, Auth, Credentials)
├── layouts/
│   ├── local_lab.json          # MCP server configs (auto-created)
│   └── secrets.json            # OAuth tokens (auto-created, gitignored)
├── README.md                    # Complete usage guide
├── QUESTIONS_ANSWERED.md        # Answers to your questions
├── SESSION_SUMMARY.md           # All changes made this session
└── INDEX.md                     # This file
```

---

## 🎓 Key Concepts

### Native Flow Alignment

The harness was completely redesigned to use **production code paths**:

| Component | Production Path | Harness Path |
|-----------|----------------|--------------|
| **Discovery** | `expand_msg_tool._discover_tools()` → `MCPRegistry.get_discovery_info()` | **Same** |
| **Execution** | `expand_msg_tool._call_tool()` → `MCPToolExecutor.execute_tool()` | **Same** |
| **JIT Loading** | `AgentRunner._initialize_mcp_jit_loader()` → `MCPJITLoader` | **Same** |
| **Prompt** | `PromptManager._append_jit_mcp_info()` | **Same** |

**Benefits**:
- Zero drift between test and production
- Bugs found in harness = bugs in production
- No duplicate maintenance

### What's Mocked vs. What's Real

**Mocked** (infrastructure only):
- Database → returns configs from `local_lab.json`
- Credentials → returns tokens from `secrets.json`
- Version Service → returns agent config from `local_lab.json`

**Real** (production code):
- MCP transport clients (SSE, HTTP, stdio)
- SSRF validation
- OAuth discovery, PKCE, token exchange
- Tool schema loading
- Error handling

---

## 🧪 Testing Scenarios

### ✅ Scenario A: OAuth Server
**Example**: Desktop Commander  
**Status**: Ready (OAuth flow implemented, needs real credentials to test)

### ✅ Scenario B: Unauthenticated Server  
**Example**: Context7  
**Status**: **READY TO TEST NOW**

```bash
python runner.py add https://mcp.context7.com/mcp
python runner.py discover
python runner.py run --prompt "List contexts"
```

### ✅ Scenario C: Query-Param Auth
**Example**: Valyu  
**Status**: Ready (needs API key to test)

```bash
python runner.py add "https://mcp.valyu.ai/mcp?valyuApiKey=sk_test_..."
```

---

## 🚦 Next Steps

1. **Test with Context7** (easiest, no auth required):
   ```bash
   python runner.py add https://mcp.context7.com/mcp
   python runner.py discover
   python runner.py run --prompt "test"
   ```

2. **Test OAuth Flow** (if you have Desktop Commander credentials):
   ```bash
   python runner.py add https://mcp.desktopcommander.app/mcp \
     --client-id YOUR_CLIENT_ID \
     --redirect-uri http://localhost:8080/callback
   ```

3. **Test Query-Param Auth** (if you have Valyu API key):
   ```bash
   python runner.py add "https://mcp.valyu.ai/mcp?valyuApiKey=YOUR_KEY"
   ```

4. **Add More Servers**:
   - Discover other MCP servers
   - Test multi-server discovery
   - Validate tool name collision handling

5. **Create Pytest Suite**:
   - Import harness functions
   - Mock environment
   - Assert expected behavior

---

## 📖 Related Documentation

- **MCP Spec**: [Model Context Protocol](https://github.com/modelcontextprotocol/specification)
- **OAuth 2.0**: [RFC 6749](https://datatracker.ietf.org/doc/html/rfc6749)
- **PKCE**: [RFC 7636](https://datatracker.ietf.org/doc/html/rfc7636)

---

## 🤝 Contributing

If you find bugs or want to add features:

1. Test your changes with all three scenarios
2. Update documentation (README.md)
3. Add to SESSION_SUMMARY.md
4. Commit with descriptive message

---

## 💡 Pro Tips

### Debugging

Enable verbose logging:
```bash
export LOG_LEVEL=DEBUG
python runner.py discover
```

### Langfuse Tracing

Set up Langfuse:
```bash
export LANGFUSE_PUBLIC_KEY=pk_...
export LANGFUSE_SECRET_KEY=sk_...
export LANGFUSE_HOST=https://cloud.langfuse.com  # or self-hosted
```

Then run with tracing:
```bash
python runner.py run --prompt "test" --tool list_contexts
```

Check Langfuse UI for:
- System prompt generation
- Tool execution spans
- Input/output captured

### Multi-Server Testing

Add multiple servers:
```bash
python runner.py add https://mcp.context7.com/mcp
python runner.py add "https://mcp.valyu.ai/mcp?valyuApiKey=sk_test_..."
python runner.py discover
# Should show tools from both servers
```

---

**Last Updated**: 2026-02-13  
**Status**: ✅ Ready for testing  
**Next Milestone**: Test with real servers and add pytest suite
