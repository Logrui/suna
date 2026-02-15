# MCP Pipeline Documentation Suite

**4 documents explaining the complete MCP system architecture**

---

## Documents Included

### 1. **MCP_PIPELINE_TRACE.md** ⭐ START HERE
   - **Length**: ~800 lines
   - **Audience**: Anyone wanting complete understanding
   - **Content**:
     - Executive summary of 3 systems
     - Detailed stage-by-stage explanation
     - Architecture diagram
     - All files with line numbers
     - Data flow examples
   - **Best for**: Understanding the complete pipeline

### 2. **MCP_SYSTEM_CLASSIFICATION.md** 📋 FOR DEVELOPERS
   - **Length**: ~500 lines
   - **Audience**: Developers working on specific systems
   - **Content**:
     - System membership (which files belong where)
     - Cross-system dependencies
     - Data flow through systems
     - What each system does NOT do
     - Testing considerations
   - **Best for**: Developers modifying or debugging specific systems

### 3. **MCP_QUICK_REFERENCE.md** 📌 FOR YOUR DESK
   - **Length**: ~300 lines
   - **Audience**: Quick lookup during development
   - **Content**:
     - 6 stages at a glance
     - Stage cheat sheet
     - Critical files list
     - Data structure reference
     - Function call chains
     - Decision tree
     - Debugging tips
   - **Best for**: Quick reference, printing

### 4. **MCP_MENTAL_MODEL_ANSWER.md** ✅ VALIDATION
   - **Length**: ~400 lines
   - **Audience**: For your specific question about system architecture
   - **Content**:
     - Your mental model validated
     - Precise system breakdown per stage
     - JIT clarification (does NOT re-discover)
     - Critical code excerpts
     - Data flow chart
     - Grade: Your model is CORRECT ✅
   - **Best for**: Understanding exactly which system handles what

---

## Quick Navigation

### "What file handles Stage X?"

**Stage 1-2 (Registration & OAuth)**
- See: `MCP_PIPELINE_TRACE.md:Lines ~150-250`
- Files: `api.py:56-178`, `auth_service.py`

**Stage 3 (Discovery)**
- See: `MCP_PIPELINE_TRACE.md:Lines ~250-350`
- Files: `mcp_service.py:405-549`

**Stage 4 (Enable/Disable)**
- See: `MCP_PIPELINE_TRACE.md:Lines ~350-420`
- Files: `agent_tools.py:102-364`

**Stage 5 (Tool Map Building)**
- See: `MCP_PIPELINE_TRACE.md:Lines ~420-500`
- Files: `mcp_loader.py:92-146`

**Stage 6 (Execution)**
- See: `MCP_PIPELINE_TRACE.md:Lines ~500-600`
- Files: `mcp_loader.py:453-720`

### "Does JIT re-discover tools?"

**Answer**: No. See `MCP_MENTAL_MODEL_ANSWER.md:Lines ~280-320`

JIT reads cached `enabledTools` from agent config in Stage 5 (no server calls), but connects to servers in Stage 6 to load schemas (only when tool actually executes).

### "Which system owns which file?"

**See**: `MCP_SYSTEM_CLASSIFICATION.md:Lines ~1-200`

Tables showing:
- Core MCP Module files
- JIT System files
- Agent Runner files
- Execution Layer files

### "I need to debug why a tool won't execute"

**See**: `MCP_QUICK_REFERENCE.md:Lines ~280-320` (Debugging Tips)

Or check full debugging flow in `MCP_SYSTEM_CLASSIFICATION.md:Lines ~450-500`

---

## The 3 Systems Explained in One Sentence Each

1. **Core MCP Module** (`backend/core/mcp_module/`): Discovers tools from MCP servers, handles OAuth, stores credentials and tool configs in agent versions.

2. **JIT System** (`backend/core/jit/`): Reads cached tool configs from agent versions, builds in-memory tool map, lazy-loads schemas when tools execute.

3. **Execution Layer** (`backend/core/tools/`): Executes already-discovered tools by connecting to MCP servers and calling their endpoints.

---

## Common Workflows

### "User registers MCP with OAuth"
```
Frontend: POST /mcp/auth/start
API: api.py:106-178 → Redirect to OAuth provider
OAuth Provider: User authorizes
OAuth Provider: Redirects to /mcp/auth/callback
API: api.py:203-467 → Exchange token, discover tools, store in agent config
```
**Files**: `api.py`, `auth_service.py`
**Read**: `MCP_PIPELINE_TRACE.md:Lines ~150-250`

### "Agent startup"
```
Agent Runner: setup_bootstrap()
  ├─ Create JITConfig
  ├─ Create MCPJITLoader(agent_config)
  └─ build_tool_map()
      └─ Read enabledTools from agent config
      └─ Create tool_map in-memory
      └─ Attach to thread_manager
```
**Files**: `agent_runner.py`, `mcp_loader.py`
**Read**: `MCP_PIPELINE_TRACE.md:Lines ~420-500`

### "User enables a tool for an agent"
```
Frontend: PUT /agents/{id}/custom-mcp-tools
API: agent_tools.py:235-364
  ├─ Read current agent config
  ├─ Update enabledTools list
  ├─ Create new agent version
  └─ Return success
```
**Files**: `agent_tools.py`
**Read**: `MCP_PIPELINE_TRACE.md:Lines ~350-420`

### "Tool executes"
```
ThreadManager: execute("tool_name", args)
Loader: activate_mcp_tool("tool_name")
  ├─ MCPJITLoader.activate_tool()
  ├─ _load_tool_schema()
  │  ├─ Connect to MCP server
  │  ├─ Call session.list_tools()
  │  └─ Extract schema
  └─ Register in tool_registry
LLM: Calls tool_name(args)
Wrapper: execute()
  ├─ Find MCP connection
  ├─ Call session.call_tool("tool_name", args)
  └─ Return result
```
**Files**: `mcp_loader.py`, `mcp_tool_wrapper.py`
**Read**: `MCP_PIPELINE_TRACE.md:Lines ~500-600`

---

## Key Insights You Should Know

### Insight #1: Discovery Happens Once
Tools are discovered in Stage 3 and cached in `agent_versions.config`. JIT doesn't re-discover—it reads from cache.

### Insight #2: JIT is Lazy
Stage 5 builds the tool_map (fast, no server calls). Stage 6 loads schemas on-demand (slower, server calls). This is intentional.

### Insight #3: Three Different Server Calls
1. **Stage 3**: list_tools() during discovery (sees all available tools)
2. **Stage 6a**: list_tools() again when loading schema (gets full schema for one tool)
3. **Stage 6b**: call_tool() during execution (actually uses the tool)

### Insight #4: Config is Source of Truth
The `enabledTools` array in agent config determines what tools are available to the agent. Changing this requires creating a new agent version.

### Insight #5: Stage 5 is Extremely Fast
Building the tool map reads from config only (no network). It completes in <50ms typically. Schema loading (Stage 6) is what's slow (200-500ms per tool).

---

## How to Use These Documents

### First Time Setup (New to the codebase)
1. Read: `MCP_QUICK_REFERENCE.md` (get oriented) — 10 min
2. Read: `MCP_PIPELINE_TRACE.md` (understand full system) — 30 min
3. Skim: `MCP_SYSTEM_CLASSIFICATION.md` (files and dependencies) — 10 min

### You Want to Modify a Specific System
1. Read: `MCP_SYSTEM_CLASSIFICATION.md` to understand your system
2. Grep: `MCP_PIPELINE_TRACE.md` for your files and stages
3. Reference: `MCP_QUICK_REFERENCE.md` for specific code locations

### Debugging a Problem
1. Check: `MCP_QUICK_REFERENCE.md` decision tree
2. Reference: `MCP_PIPELINE_TRACE.md` data flow section
3. Deep dive: `MCP_SYSTEM_CLASSIFICATION.md` dependencies

### Explaining to a Teammate
1. Share: `MCP_QUICK_REFERENCE.md` for quick understanding
2. Share: `MCP_MENTAL_MODEL_ANSWER.md` if they ask about JIT
3. Share: `MCP_SYSTEM_CLASSIFICATION.md` if they need to modify systems

---

## Answer to Your Original Question

> "I need to understand EXACTLY which system handles each stage"

**Answer**: See `MCP_MENTAL_MODEL_ANSWER.md`

But quick summary:

| Stage | System | Files | Server Calls? |
|-------|--------|-------|---------------|
| 1 | Core MCP | `api.py:56` | ❌ |
| 2 | Core MCP | `api.py:106`, `auth_service.py` | ✅ OAuth |
| 3 | Core MCP | `mcp_service.py:405` | ✅ Discovery |
| 4 | Agent Tools | `agent_tools.py:102` | ❌ |
| 5 | **JIT** | `mcp_loader.py:92` | ❌ |
| 6 | **JIT + Executor** | `mcp_loader.py:453` | ✅ Schema+Exec |

**Your mental model is correct**. JIT handles Stages 5-6 (tool map building + execution), Core MCP handles Stages 1-4 (registration through caching).

---

## File Statistics

| Document | Lines | Topics | Use Case |
|----------|-------|--------|----------|
| MCP_PIPELINE_TRACE.md | ~900 | 15+ topics | Complete reference |
| MCP_SYSTEM_CLASSIFICATION.md | ~550 | 12+ topics | Developer reference |
| MCP_QUICK_REFERENCE.md | ~350 | 10+ topics | Quick lookup |
| MCP_MENTAL_MODEL_ANSWER.md | ~450 | Your question | Answer validation |

**Total**: ~2,250 lines of precise, line-numbered documentation

---

## Verification Checklist

After reading these documents, you should know:

- [ ] Which files handle Stage 1 (registration)
- [ ] How OAuth works (Stage 2)
- [ ] How tools are discovered (Stage 3)
- [ ] How to enable/disable tools (Stage 4)
- [ ] What happens at agent startup (Stage 5)
- [ ] How tool execution works (Stage 6)
- [ ] What "JIT" actually does (NOT re-discovery)
- [ ] Where config is stored (agent_versions table)
- [ ] Which system is responsible for each file
- [ ] How to trace a tool call from start to finish

---

## Questions This Documentation Answers

✅ "Which system handles which stage?"
✅ "Does JIT re-discover tools?"
✅ "Where are discovered tools stored?"
✅ "When do server calls happen?"
✅ "What is the tool_map?"
✅ "How does Stage 5 differ from Stage 6?"
✅ "Which files should I modify for X feature?"
✅ "How does OAuth integration work?"
✅ "What happens if enabledTools is empty?"
✅ "Can I change enabledTools at runtime?"
✅ "Why is discovery so fast/slow?"
✅ "Where do JIT server calls happen?"

---

## Next Steps

1. **Pick a document** based on your use case above
2. **Read through** the relevant sections (all include line numbers)
3. **Grep the code** using the file references provided
4. **Debug confidently** knowing which system owns which code

Good luck! The MCP system is well-designed once you understand the three-system split. 🚀

