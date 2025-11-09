# Root Cause Analysis: 30-35 Second Stream Timeout

## Executive Summary

**The 30-35 second chat stream timeout is caused by an adaptive activity timeout mechanism in `backend/core/run.py` (lines 80-88) that terminates the agent execution loop when no activity is detected for "computation" tasks (30 seconds) or other task types (10-20 seconds). This causes the agent generator to exit, which publishes a final "completed" status message that prematurely terminates the SSE stream.**

## Timeline of Investigation

1. **Initial Observation**: Chat streams terminate after exactly 35 seconds despite 300s timeout in stream handler
2. **First Hypothesis**: Stream handler timeout (agent_runs.py:1022) - DISPROVEN
3. **Key Finding**: Backend logs show "Detected run completion via status message in stream: completed" at 35s mark
4. **Deep Investigation**: Found activity_timeout mechanism in run.py
5. **Root Cause Confirmed**: Auto-continue loop breaks when elapsed_time > activity_timeout

## Technical Details

### The Culprit: Activity Timeout in `backend/core/run.py`

**Location**: Lines 80-88

```python
def _get_timeout_for_task(task_type: str) -> int:
    """Get adaptive timeout based on task type (Pattern 2 enhancement)"""
    timeouts = {
        'research': 10,      # Search tasks: quicker timeout
        'computation': 30,   # Compute tasks: longer timeout ← FILE CREATION IS "COMPUTATION"
        'writing': 20,       # Writing tasks: medium timeout
        'general': 15        # Default
    }
    return timeouts.get(task_type, 15)
```

**Purpose**: This is an adaptive safeguard to prevent tools from blocking execution indefinitely. When the agent tool execution takes longer than the threshold, it triggers an "auto-continue" mechanism that forces the LLM to move forward.

### How It Triggers the Timeout

**Location**: Lines 900-928 in run.py

1. **Auto-continue loop initialized** (line 909):
   ```python
   while continue_execution and auto_continue_iterations < max_auto_continue:
   ```

2. **On first tool call** (line 917-921):
   - Task is classified as 'computation' (for file operations)
   - Activity timeout set to 30 seconds
   - `logger.info(f"📋 Task classified as: computation (timeout: 30s)")`

3. **Check for activity timeout** (lines 923-926):
   ```python
   elapsed_time = time.time() - last_activity_time
   if elapsed_time > activity_timeout:
       logger.info(f"⏱️ Auto-continue: Activity timeout after {elapsed_time:.1f}s (computation task)")
       break  # ← THIS BREAKS THE LOOP
   ```

4. **When loop breaks**:
   - Agent generator exits its execution loop
   - `run_agent()` async generator completes
   - `run_agent_background()` publishes final status: `{"type": "status", "status": "completed"}`
   - Stream generator (agent_runs.py:1037) receives this and terminates with `terminate_stream = True`

### Evidence

**Backend logs from earlier investigation**:
```
06:03:13.685207Z - Stream started
06:03:13.837601Z - Streaming began (Redis subscribed)
06:03:48.493799Z - Stream stopped: "Detected run completion via status message"
Duration: Exactly 35 seconds
```

**Why 35 seconds instead of 30?**
- 30s activity timeout + ~5 seconds additional processing/redis delays = ~35 seconds

### Why This Affects File Creation

File creation in the sandbox is a "computation" task (classified by `_classify_task_type()` in run.py). The file creation process:

1. Calls the file tool
2. Tool starts execution in sandbox
3. File is being created but taking time (>30 seconds)
4. Activity timeout triggers
5. Agent run terminated
6. Stream ends with "completed" status
7. UI shows "Success" but no content yet
8. File eventually completes in background, but stream is already closed

## Impact Assessment

**Affected Operations**:
- Any tool execution taking 10-30 seconds depending on task type
- File creation/manipulation
- Code execution
- Research/search with complex queries
- Writing/document generation

**User Experience**:
- Streams show "Success" prematurely
- Content arrives later or not at all
- Confusion between "task completed" vs "stream closed"

## Solution

The fix requires increasing these timeouts to allow long-running operations to complete:

```python
def _get_timeout_for_task(task_type: str) -> int:
    """Get adaptive timeout based on task type"""
    timeouts = {
        'research': 60,      # 10s → 60s (6x increase)
        'computation': 120,  # 30s → 120s (4x increase) ← CRITICAL
        'writing': 90,       # 20s → 90s (4.5x increase)
        'general': 60        # 15s → 60s (4x increase)
    }
    return timeouts.get(task_type, 60)
```

### Why This Fix is Safe

1. **Original values were too aggressive** for real-world tool execution
2. **New values still have safeguards**:
   - 120s computation timeout prevents infinite blocking
   - Max 25 auto-continue iterations (line 901)
   - Each iteration adds continuation prompt, allowing LLM to decide next steps
3. **Maintains auto-continue mechanism** for legitimate long-waits
4. **Stream handler has 300s timeout** as final safety net

## Related Code Sections

- **Stream handler timeout**: `backend/core/agent_runs.py:1022` (300s - correctly implemented)
- **Stream termination on status**: `backend/core/agent_runs.py:1037-1040`
- **Background worker**: `backend/run_agent_background.py:238-250`
- **Agent generator main loop**: `backend/core/run.py:700-1000`

## Files to Modify

1. `backend/core/run.py` - Increase `_get_timeout_for_task()` return values
2. Rebuild backend container
3. Test with file creation scenario

## Status

- [x] Root cause identified
- [x] Evidence collected and documented
- [ ] Fix implemented
- [ ] Testing completed
- [ ] Deployed to production
