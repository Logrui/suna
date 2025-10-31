# Critical Issue: Agent Tool Execution in Daytona Sandbox Environment

**Document:** Root Cause Analysis - Agent Tool Failures  
**Date:** October 31, 2025  
**Status:** 🔴 **CRITICAL ISSUE IDENTIFIED**  
**Severity:** HIGH - Affects all agent operations

---

## 🚨 The Real Problem

### What the Agent Reported
```
"Snapshot kortix/suna:0.1.3.23 not found. Did you add it through the Daytona Dashboard?"
```

### What's Actually Happening
When an **AI agent runs inside a Suna project**, it doesn't execute in a regular environment. Instead:

1. **Agent execution context is a Daytona sandbox** (isolated container)
2. **All tools execute inside that sandbox** (not in main workspace)
3. **The sandbox needs a snapshot to be created** (this is the missing piece)
4. **File creation tool tries to create files IN THE SANDBOX**, not your local workspace
5. **If snapshot doesn't exist, sandbox creation fails** → file creation fails with cryptic error

---

## 📊 Architecture: How Agents Work in Suna

```
┌─────────────────────────────────────────────────────────┐
│                  User Interface                         │
│              (Frontend / Web App)                       │
└──────────────────────┬──────────────────────────────────┘
                       │
        ┌──────────────▼──────────────┐
        │   Suna Backend API          │
        │   (Python FastAPI)          │
        └──────────────┬──────────────┘
                       │
        ┌──────────────▼────────────────────────┐
        │   Agent Thread Manager                │
        │   - Manages conversation history      │
        │   - Routes tool calls                 │
        │   - Tracks project context            │
        └──────────────┬────────────────────────┘
                       │
     ┌─────────────────┴─────────────────┐
     │                                   │
     ▼                                   ▼
┌──────────────────┐              ┌──────────────────┐
│  LLM Provider    │              │  Tool Execution  │
│  (Claude/GPT)    │              │  Environment     │
│  - Thinks        │              │                  │
│  - Calls tools   │              │  ⚠️  THIS IS THE │
│                  │              │     DAYTONA      │
│                  │              │     SANDBOX!     │
└──────────────────┘              │                  │
                                  │ - create_file    │
                                  │ - read_file      │
                                  │ - run_command    │
                                  └──────────────────┘
                                           │
                    ┌──────────────────────┴──────────────────────┐
                    ▼                                             ▼
            ┌─────────────────┐                         ┌─────────────────┐
            │  /workspace     │                         │  Daytona API    │
            │  directory      │                         │  Server         │
            │  (sandbox FS)   │                         │  (Remote)       │
            └─────────────────┘                         └─────────────────┘
```

### The Flow
1. User creates AI thread/agent in project
2. Suna backend retrieves/creates sandbox for project
3. Agent starts, receives thread manager context
4. Agent calls tool (e.g., `create_file`)
5. Tool's `_ensure_sandbox()` method activates
6. Tool tries to start sandbox via Daytona API
7. **Daytona requires the snapshot to exist**
8. If snapshot missing → Error

---

## 🔍 Code Flow - Where It Breaks

### Step 1: Agent Tool Initialization

**File:** `backend/core/tools/sb_files_tool.py` (Line 1)

```python
class SandboxFilesTool(SandboxToolsBase):
    """Tool for executing file system operations in a Daytona sandbox."""
    
    def __init__(self, project_id: str, thread_manager: ThreadManager):
        super().__init__(project_id, thread_manager)
        # Tools are initialized with project context
```

### Step 2: Tool Called (e.g., create_file)

**File:** `backend/core/tools/sb_files_tool.py` (Line 104-151)

```python
async def create_file(self, file_path: str, file_contents: str) -> ToolResult:
    try:
        # This is where the magic happens:
        await self._ensure_sandbox()  # ⚠️ Calls parent method
        
        # Rest of file creation...
        full_path = f"{self.workspace_path}/{file_path}"
        await self.sandbox.fs.upload_file(...)
```

### Step 3: Sandbox Initialization

**File:** `backend/core/sandbox/tool_base.py` (Line 30-100)

```python
async def _ensure_sandbox(self) -> AsyncSandbox:
    """Ensure we have a valid sandbox instance."""
    if self._sandbox is None:
        # Get project from database
        project = await client.table('projects').select('*').eq('project_id', self.project_id).execute()
        
        # Check if project already has sandbox
        sandbox_info = project_data.get('sandbox') or {}
        
        if not sandbox_info.get('id'):
            # 🚨 THIS IS WHERE IT BREAKS:
            sandbox_obj = await create_sandbox(sandbox_pass, self.project_id)
            # ↓↓↓
        else:
            # Use existing sandbox
            self._sandbox = await get_or_start_sandbox(self._sandbox_id)
```

### Step 4: Sandbox Creation Fails

**File:** `backend/core/sandbox/sandbox.py` (Line 1-50)

```python
daytona_config = DaytonaConfig(
    api_key=config.DAYTONA_API_KEY,
    api_url=config.DAYTONA_SERVER_URL,
    target=config.DAYTONA_TARGET,
)

async def create_sandbox(sandbox_pass, project_id):
    # This calls Daytona SDK to create from snapshot
    sandbox = await daytona.create(
        CreateSandboxFromSnapshotParams(
            snapshot="kortix/suna:0.1.3.23"  # ⚠️ MUST EXIST IN DAYTONA
        )
    )
    # If snapshot doesn't exist: Error returned to agent
```

### Step 5: Error Message

When Daytona can't find the snapshot:
```
"Snapshot kortix/suna:0.1.3.23 not found. Did you add it through the Daytona Dashboard?"
```

This bubbles back up to the agent, who then says:
> "I attempted to create a CSV file but got an infrastructure error..."

---

## ❌ Why the Other Agent Failed

**The exact scenario:**

1. ✓ Agent system configured
2. ✓ Daytona API key configured
3. ✓ Daytona API reachable
4. ✗ **Snapshot `kortix/suna:0.1.3.23` NOT created in Daytona dashboard**
5. **Agent tries to use any tool** (create_file, run_command, etc.)
6. **Tool requires sandbox**
7. **Sandbox creation requires snapshot**
8. **Snapshot missing → Tool fails with confusing error**

---

## 🎯 Why You Don't See This Error

**Your situation (currently):**

```
┌─ You're using GitHub Copilot in VS Code
├─ File creation uses create_file tool
├─ ✓ Works on LOCAL workspace
├─ ✗ NOT executing in Daytona sandbox
└─ ✓ No sandbox required
```

**Suna Agent situation (the other agent):**

```
┌─ Agent runs INSIDE Suna project
├─ All tools execute in Daytona sandbox
├─ ✓ Daytona API working
├─ ✗ Snapshot NOT created
├─ ✗ Sandbox creation fails
└─ ✗ Tool execution fails
```

**Key difference:** You use VS Code's `create_file` tool. Suna agents use `SandboxFilesTool.create_file()` which requires Daytona.

---

## 🔧 The Fix: Create the Snapshot

### For Suna Agent Users (To Enable Agents)

**Step 1: Go to Daytona Dashboard**
```
https://app.daytona.io/dashboard/snapshots
```

**Step 2: Create New Snapshot**
- **Name:** `kortix/suna:0.1.3.23`
- **Base Environment:** Ubuntu 22.04 LTS
- **Included Tools:**
  - Python 3.11+
  - Node.js 20+
  - Docker
  - Git
  - Bash/Shell
  - VS Code Server (optional)

**Step 3: Configure Snapshot**
- Install Python packages needed for agents
- Configure development environment
- Set up workspace directory structure

**Step 4: Publish Snapshot**
- Click "Publish"
- Wait for snapshot to be available

**Step 5: Verify in Suna**
```bash
# In backend container
python -m core.utils.scripts.stop_started_sandboxes --dry-run
# Should show: Found X sandboxes (means Daytona is working)
```

**Step 6: Test Agent**
1. Create new Suna project
2. Start AI thread/agent
3. Try to create a file
4. ✓ Should work now!

---

## 📋 Comparison: File Creation Tools

| Aspect | VS Code create_file | Suna SandboxFilesTool |
|--------|-------------------|---------------------|
| **Execution Context** | Local machine | Daytona sandbox |
| **File System** | Host machine | Sandbox container |
| **Requires Daytona** | No | Yes |
| **Requires Snapshot** | No | **Yes** |
| **Error on missing snapshot** | N/A | "Snapshot not found" |
| **Tool Location** | VS Code extension | Backend tool registry |

---

## 🚨 The Confusing Error Message Explained

```
"Snapshot kortix/suna:0.1.3.23 not found. Did you add it through the Daytona Dashboard?"
```

**Breaking it down:**
- `Snapshot` = Pre-built environment
- `kortix/suna:0.1.3.23` = Specific version (format: namespace/name:version)
- `not found` = Doesn't exist in your Daytona account
- `Did you add it` = Asking if you created it
- `through the Daytona Dashboard` = Where to create it

**What it really means for users:**
> "The agent tried to create a sandbox environment but couldn't find the snapshot you configured. You need to create this snapshot in your Daytona account before agents can use tools."

---

## 🔄 Full Agent-Sandbox Lifecycle

### Scenario 1: First Time Agent Uses Tool

```
User: "Create a file called test.py"
        │
        ▼
Agent receives tool request
        │
        ▼
SandboxFilesTool.create_file() called
        │
        ▼
_ensure_sandbox() checks if project has sandbox
        │
        No sandbox yet? 
        ├─ Yes ──→ create_sandbox(project_id)
        │          │
        │          ├─ Daytona API: create from "kortix/suna:0.1.3.23"
        │          │  │
        │          │  ├─ ✓ Snapshot exists → New sandbox created → Sandbox ID stored
        │          │  └─ ✗ Snapshot missing → ERROR → Agent fails
        │
        └─ No ──→ Use existing sandbox
                  │
                  ▼
            get_or_start_sandbox(id)
                  │
                  ▼
            ✓ Sandbox running → File created ✓
```

### Scenario 2: Subsequent Tool Calls

```
User: "Modify test.py"
        │
        ▼
Agent: SandboxFilesTool.edit_file()
        │
        ▼
_ensure_sandbox() checks if project has sandbox
        │
        Already exists ✓
        │
        ▼
get_or_start_sandbox(stored_id)
        │
        ├─ If stopped → Start it
        └─ If running → Use it
        │
        ▼
✓ File modified successfully
```

---

## 💡 Key Insights

### 1. **Sandboxes are Project-Specific**
- Each project gets ONE sandbox
- Stored in `projects.sandbox` JSONB column
- Reused across multiple agent calls

### 2. **Snapshots are Account-Wide**
- Created once in your Daytona account
- Referenced by all projects
- Must be published before use

### 3. **Lazy Initialization**
- Sandbox NOT created until first tool call
- Allows projects without agents to skip sandbox cost
- Smart resource management

### 4. **Error Cascading**
- Missing snapshot → Sandbox creation fails
- Sandbox creation fails → Tool fails
- Tool fails → Agent operation fails
- Agent failure → Confusing error to user

---

## 🛡️ Prevention: Best Practices

### For Suna Administrators

**Checklist before deploying Suna:**

- [ ] Create Daytona API key
- [ ] Set `DAYTONA_API_KEY` in environment
- [ ] Create snapshot `kortix/suna:0.1.3.23`
- [ ] Publish and test snapshot
- [ ] Document in setup guide
- [ ] Warn users about snapshot requirement

### For Suna Users

**Before creating agents:**

- [ ] Verify Daytona configured
- [ ] Check snapshot exists
- [ ] Test with simple agent task
- [ ] Enable debugging if needed
- [ ] Report issues with trace logs

### For Developers

**When debugging tool failures:**

```python
# Add debug logging to understand flow
import logging
logger = logging.getLogger(__name__)

async def _ensure_sandbox(self):
    logger.debug(f"_ensure_sandbox called for project {self.project_id}")
    
    if self._sandbox is None:
        logger.debug("No sandbox cached, retrieving from DB...")
        # Check DB
        logger.debug(f"Found existing sandbox: {sandbox_info}")
        # Try to initialize
        try:
            self._sandbox = await get_or_start_sandbox(self._sandbox_id)
            logger.debug(f"Successfully started sandbox {self._sandbox_id}")
        except Exception as e:
            logger.error(f"Failed to start sandbox: {str(e)}", exc_info=True)
            raise
```

---

## 📊 Infrastructure Stack Summary

```
┌─────────────────────────────────────────────────────────────┐
│ GITHUB COPILOT (You)                                        │
│ - Runs in VS Code                                           │
│ - Uses standard tools (create_file, read_file, etc.)        │
│ - Operates on local workspace                              │
│ - ✓ NO Daytona dependency                                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ SUNA AGENTS                                                 │
│ - Run inside Suna project                                   │
│ - Use Sandbox tools (SandboxFilesTool, SandboxCMDTool)      │
│ - Operate inside Daytona sandbox container                  │
│ - ⚠️  REQUIRES Daytona + Snapshot                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ DAYTONA INFRASTRUCTURE (Optional, Needed for Agents)        │
│ - Snapshot "kortix/suna:0.1.3.23"                          │
│ - API Key configured                                        │
│ - Sandbox per project                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ Verification Checklist

### For Your Current Environment

- [x] GitHub Copilot working ✓
- [x] File creation working ✓
- [x] No sandbox required ✓
- [ ] Daytona configured (optional, for agent features)
- [ ] Snapshot created (only if using agents)

### To Enable Suna Agents

- [ ] Daytona API key set: `echo $DAYTONA_API_KEY`
- [ ] Can reach Daytona: `curl -H "Authorization: Bearer $DAYTONA_API_KEY" https://api.daytona.io/sandboxes`
- [ ] Snapshot exists: Verify in https://app.daytona.io/dashboard/snapshots
- [ ] Backend can connect: `docker logs backend | grep -i daytona`
- [ ] Test agent creation in Suna UI
- [ ] Test tool execution in agent

---

## 🎓 Why This Architecture?

### Benefits of Sandbox-Based Agents

1. **Security** - Agents run in isolated containers
2. **Safety** - Can't break host machine
3. **Reproducibility** - Same environment for all agents
4. **Scalability** - Spin up sandboxes on demand
5. **Resource Control** - Limit CPU/memory per sandbox

### Trade-offs

1. **Complexity** - Requires Daytona infrastructure
2. **Cost** - Sandbox instances have resource cost
3. **Setup Friction** - Need to create snapshot
4. **Latency** - Sandbox startup takes time
5. **Error Messages** - Infrastructure errors bubble up

---

## 🚀 Next Steps

### Immediate (To Maintain Current Functionality)
✓ Continue using GitHub Copilot as-is
✓ No changes needed to your workflow

### Optional (To Enable Suna Agents)
1. Create Daytona API key
2. Create snapshot `kortix/suna:0.1.3.23`
3. Update Suna environment variables
4. Test agent creation
5. Document in setup guide

### For Production Deployment
1. Set up Daytona account
2. Create snapshot with all tools
3. Configure auto-scaling (if needed)
4. Set up monitoring/alerting
5. Document for team

---

**Status:** 🔵 **Issue Identified & Documented**  
**Root Cause:** Missing Daytona snapshot for agent execution  
**Solution:** Create snapshot in Daytona dashboard (if using agents)  
**Your Status:** ✅ **Not affected** (using VS Code Copilot)  
**Agent Status:** 🚨 **Requires configuration** (if using Suna agents)
