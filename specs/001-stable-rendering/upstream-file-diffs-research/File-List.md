# Core Files for Upstream Research

**Feature**: 001-stable-rendering | **Date**: 2025-11-14  
**Purpose**: List of frontend/backend files to research for recent upstream fixes

## File Categories

**20 total files** organized by category and priority

### 🔴 Critical Backend Files (Problem Areas 1, 2, 3, 5)

| Priority | File | Problem Areas | Description |
|----------|------|---------------|-------------|
| **P1** | `backend/core/agentpress/response_processor.py` | #1 Silent Exception Swallowing | Core LLM response streaming and tool execution |
| **P1** | `backend/run_agent_background.py` | #2 Error Propagation, #5 Redis Loss | Background worker streaming to Redis |
| **P2** | `backend/core/agent_runs.py` | #3 Race Condition, #5 Redis Loss | SSE streaming endpoint and Redis pub/sub |

### 🟡 Critical Frontend Files (Problem Areas 3, 4, 6, 7)

| Priority | File | Problem Areas | Description |
|----------|------|---------------|-------------|
| **P1** | `frontend/src/hooks/useAgentStream.ts` | #3 Race Condition, #4 Dependency Arrays, #6 Buffer Overflow, #7 startTransition | Primary streaming hook |
| **P2** | `frontend/src/components/thread/content/ThreadContent.tsx` | #3 Race Condition, #4 Dependency Arrays | Streaming text rendering |
| **P3** | `frontend/src/components/thread/content/ShowToolStream.tsx` | #4 Dependency Arrays | Tool call streaming display |

### 🔵 Supporting Backend Files

| Priority | File | Problem Areas | Description |
|----------|------|---------------|-------------|
| **P2** | `backend/core/run.py` | #1 Tool Exceptions, #2 Error Propagation | AgentRunner.run() main entry point |
| **P3** | `backend/core/agentpress/thread_manager.py` | #1 Tool Exceptions, #3 Race Condition | Thread execution and message management |
| **P3** | `backend/core/threads.py` | #3 Race Condition | Thread/message API endpoints |
| **P3** | `backend/core/agentpress/tool_registry.py` | #1 Tool Exceptions | Tool execution infrastructure |
| **P4** | `backend/core/agentpress/llm.py` | #2 Error Propagation | LiteLLM streaming API calls |
| **P4** | `backend/core/agentpress/xml_tool_parser.py` | #1 Tool Exceptions | Tool call parsing |
| **P4** | `backend/api/agent_runs.py` | #3 Race Condition | API endpoints for agent runs |

### 🔵 Supporting Frontend Files

| Priority | File | Problem Areas | Description |
|----------|------|---------------|-------------|
| **P2** | `frontend/src/lib/api.ts` | #3 Race Condition, #4 Dependency Arrays | EventSource setup and API layer |
| **P3** | `frontend/src/components/thread/ThreadComponent.tsx` | #4 Dependency Arrays | Thread component wrapper |
| **P4** | `frontend/src/components/thread/tool-views/wrapper/ToolViewRegistry.tsx` | #1 Tool Exceptions | Tool view error handling |
| **P4** | `frontend/src/utils/react-error-boundary.tsx` | All frontend issues | Error boundary component |
| **P4** | `frontend/src/hooks/usePlaybackController.tsx` | #3 Race Condition | Message replay system |
| **P5** | `frontend/src/components/thread/content/PlaybackControls.tsx` | #3 Race Condition | Replay controls component |

### 🟣 Configuration and Infrastructure

| Priority | File | Problem Areas | Description |
|----------|------|---------------|-------------|
| **P4** | `backend/core/redis_client.py` | #5 Redis Loss | Redis connection and operations |
| **P4** | `docker-compose.yml` | Infrastructure | Container orchestration | DO NOT RESEARCH - USER DIRECTIVE
| **P5** | `backend/requirements.txt` | Dependencies | Python dependencies | 
| **P5** | `frontend/package.json` | Dependencies | Node.js dependencies | DO NOT RESEARCH - USER DIRECTIVE

## Research Priority Groups

### **Group A: Immediate Research (Top 4)**
1. `backend/core/agentpress/response_processor.py` 
2. `backend/run_agent_background.py`
3. `frontend/src/hooks/useAgentStream.ts`
4. `backend/core/agent_runs.py`

### **Group B: Secondary Research (Next 4)**
5. `backend/core/run.py`
6. `frontend/src/lib/api.ts`
7. `frontend/src/components/thread/content/ThreadContent.tsx`
8. `backend/core/agentpress/thread_manager.py`

### **Group C: Supporting Research (If needed)**
9. `backend/core/threads.py`
10. `frontend/src/components/thread/content/ShowToolStream.tsx`
11. `backend/core/agentpress/tool_registry.py`
12. `frontend/src/components/thread/ThreadComponent.tsx`

## File Path References

**Backend Core**:
- `backend/core/agentpress/response_processor.py`
- `backend/run_agent_background.py`
- `backend/core/agent_runs.py`
- `backend/core/run.py`
- `backend/core/agentpress/thread_manager.py`
- `backend/core/threads.py`
- `backend/core/agentpress/tool_registry.py`
- `backend/core/agentpress/llm.py`
- `backend/core/agentpress/xml_tool_parser.py`
- `backend/api/agent_runs.py`
- `backend/core/redis_client.py`

**Frontend Core**:
- `frontend/src/hooks/useAgentStream.ts`
- `frontend/src/lib/api.ts`
- `frontend/src/components/thread/content/ThreadContent.tsx`
- `frontend/src/components/thread/content/ShowToolStream.tsx`
- `frontend/src/components/thread/ThreadComponent.tsx`
- `frontend/src/components/thread/tool-views/wrapper/ToolViewRegistry.tsx`
- `frontend/src/utils/react-error-boundary.tsx`
- `frontend/src/hooks/usePlaybackController.tsx`
- `frontend/src/components/thread/content/PlaybackControls.tsx`

## Research Commands by File

```bash
# For each file, find recent upstream changes (excluding origin/main and local branches)
git log --all --since="3 months ago" --oneline --remotes=upstream/* -- [FILE_PATH]

# Find upstream branches that touched specific files in last 3 months
git for-each-ref --format='%(refname:short) %(committerdate:iso)' refs/remotes/upstream | \
  awk -v date="$(date -d '3 months ago' -Idate)" '$2 >= date' | \
  cut -d' ' -f1 | \
  grep -v "upstream/main" | \
  while read branch; do
    if git show $branch:[FILE_PATH] >/dev/null 2>&1; then
      echo "Branch: $branch"
      git log --oneline -1 $branch -- [FILE_PATH]
    fi
  done

# Alternative: Find newest commit per upstream branch for specific file
git for-each-ref --format='%(refname:short)' refs/remotes/upstream | \
  grep -v "upstream/main" | \
  while read branch; do
    commit=$(git log --since="3 months ago" --oneline -1 $branch -- [FILE_PATH] | head -1)
    if [ -n "$commit" ]; then
      echo "Branch: $branch - $commit"
    fi
  done
```

## Selection Criteria

**High Priority Files**:
- Directly related to identified problem areas
- Core streaming/rendering functionality
- High likelihood of containing relevant fixes

**Medium Priority Files**:
- Supporting components for streaming
- Error handling infrastructure
- Tool execution related

**Low Priority Files**:
- Configuration and dependencies
- Infrastructure changes
- Less likely to contain streaming fixes

## Next Steps

1. **Human Review**: User selects up to 10 files from this list
2. **Template Creation**: Create analysis.md templates for selected files
3. **Branch Discovery**: Run git commands to find recent upstream changes
4. **Commit Analysis**: Review newest commits per branch for each file
5. **Fix Assessment**: Determine applicability to our problem areas
