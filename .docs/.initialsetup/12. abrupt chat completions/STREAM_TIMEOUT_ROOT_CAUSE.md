# Stream Timeout Issue - Root Cause Analysis

**Issue:** Chat streams stop after ~30-35 seconds regardless of whether the agent has finished processing.

**User Experience:** User requests file creation, stream shows "Creating File..." loader, after 10-12 seconds the loader changes to "Success" but the file content hasn't arrived yet, then when user asks "Why?" the system ignores their question and delivers the delayed file content.

---

## 🔍 Evidence from Backend Logs

### Timeline of Stream Processing
**Agent Run ID:** `cff7be62-a912-4f9d-82b8-4b5e8ba9f894`

| Time | Event | Context |
|------|-------|---------|
| 06:03:13.685207Z | **Stream starts** | GET /api/agent-run/.../stream |
| 06:03:13.837601Z | **Streaming begins** | Subscribed to Redis channels, waiting for messages |
| 06:03:48.493799Z | **Stream STOPS** | "Detected run completion via status message in stream: completed" |
| 06:03:48.494110Z | **Cleanup** | asyncio.wait cancelled, listener task cancelled |

**Duration: 35 seconds total (13:13 to 13:48)**

### Backend Log Entry (Critical)
```
2025-11-09T06:03:48.493799Z [debug] Detected run completion via status message in stream: completed
agent_run_id=cff7be62-a912-4f9d-82b8-4b5e8ba9f894 
filename=agent_runs.py func_name=stream_generator lineno=1036
```

---

## 🎯 Root Cause Identified

### The Problem: Premature Stream Termination

**File:** `backend/core/agent_runs.py`  
**Line:** 1018 (stream timeout mechanism)

```python
while not terminate_stream:
    try:
        # Add 30-second timeout to send keepalive pings for long-running tasks
        queue_item = await asyncio.wait_for(
            message_queue.get(),
            timeout=30.0  # <-- 30-SECOND TIMEOUT
        )
        
        if queue_item["type"] == "new_response":
            # ... process responses ...
            if response.get('type') == 'status' and response.get('status') in ['completed', 'failed', 'stopped']:
                logger.debug(f"Detected run completion via status message in stream: {response.get('status')}")
                terminate_stream = True  # <-- STOPS STREAM
                break
                
    except asyncio.TimeoutError:
        # No new messages for 30 seconds - send keepalive ping
        logger.debug(f"[KEEPALIVE] Sending heartbeat ping for {agent_run_id}")
        yield f"data: {json.dumps({'type': 'ping'})}\n\n"
        continue
```

### What SHOULD Happen (Intended Design)

1. **Agent runs (long task)**
2. **After 30 seconds with no messages:**
   - Timeout triggers
   - Code sends "ping" keepalive message
   - Stream continues waiting
3. **When agent completes:**
   - Status message "completed" sent to queue
   - Stream receives it and terminates gracefully
4. **Result:** Long-running tasks stream their output over time with periodic pings

### What IS Happening (Bug)

1. **Agent is running (takes 35+ seconds)**
2. **After 30 seconds with no messages from agent:**
   - Timeout should trigger
   - Keepalive ping should be sent
   - ❌ **But frontend is receiving "completed" message instead!**
3. **Stream terminates at 35 seconds**
4. **Agent continues running in background but frontend has disconnected**

---

## 📊 Analysis: Two Possible Root Causes

### Hypothesis 1: Status Message Sent Too Early
The `completed` status message is being published to Redis **before** the agent actually finishes processing.

**Evidence:**
- Stream terminates at 06:03:48 (35 seconds)
- But user's screenshot shows the task was still "Creating File" after that
- The agent should still be searching for venture capital firms

**If True:** The backend is prematurely marking the run as complete

### Hypothesis 2: Worker Process Crash or Disconnection
The worker process that's running the agent crashes or becomes unresponsive after ~30 seconds, triggering an automatic completion status.

**Evidence:**
- Exact 30-second timeout behavior
- No error messages visible in logs
- Stream cleans up gracefully (not a crash)

**If True:** There's a timeout in the worker/executor layer

### Hypothesis 3: Keepalive Not Working
The `asyncio.TimeoutError` handler is not working correctly, so instead of sending a ping, the stream just ends.

**Evidence:**
- Comment in code: "send keepalive pings"
- No ping messages visible in stream
- Stream ends exactly at timeout boundary

**If True:** The exception handling is broken or the ping isn't reaching frontend

---

## 🔧 What Needs to Be Fixed

### Option A: Increase Timeout (Band-Aid)
Change the 30-second timeout to 120 or 300 seconds.
- **Pros:** Quick fix
- **Cons:** Delays error detection, doesn't solve real issue

### Option B: Implement Proper Keepalive
Verify keepalive ping logic is working:
1. Confirm timeout triggers and catches `asyncio.TimeoutError`
2. Verify ping message is actually yielded to stream
3. Check frontend processes ping messages correctly

### Option C: Fix Worker Timeout
If worker is timing out:
1. Increase worker task timeout
2. Implement retry logic
3. Add more detailed error logging

### Option D: Investigate Status Message Publishing
Check what's triggering the "completed" status:
1. Is there a separate timeout in the worker?
2. Is the agent run marked complete prematurely?
3. Is there race condition in status publishing?

---

## 🔍 Immediate Investigation Steps

1. **Check Worker Logs**
   ```bash
   docker compose logs worker --since 5m | grep -i timeout
   docker compose logs worker --since 5m | grep -i "cff7be62"
   ```

2. **Check Redis for Completed Status**
   Which component published the "completed" status at 06:03:48?

3. **Verify Keepalive Pings**
   Look for "KEEPALIVE" or "ping" messages in logs during 30-35 second window

4. **Add Debug Logging**
   - Log when timeout triggers
   - Log when ping is sent
   - Log when completed status is received

---

## 📋 User Impact

**Frequency:** Every agent run >30 seconds  
**Severity:** High - Makes long-running tasks impossible  
**Workaround:** None - frontend cannot reconnect

**Example Broken Flows:**
- Research tasks (30+ seconds) ❌
- File creation (35+ seconds) ❌
- Large data processing ❌
- Multi-step agent workflows ❌

---

## 🚀 Recommended Fix Priority

1. **URGENT:** Increase timeout to 300 seconds (temporary)
   - Allows most tasks to complete
   - Buy time for proper fix

2. **HIGH:** Verify and fix keepalive ping mechanism
   - Ensure timeout exception is caught
   - Ensure ping reaches frontend
   - Ensure frontend doesn't break on ping

3. **HIGH:** Investigate why "completed" status sent at 35 seconds
   - Is there a separate worker timeout?
   - Is status publishing working correctly?

4. **MEDIUM:** Add comprehensive logging
   - Trace timeout behavior
   - Log all status transitions
   - Help with future debugging

---

## 📝 Files to Modify

1. **`backend/core/agent_runs.py`**
   - Line 1018: Check timeout value
   - Lines 1045-1051: Verify TimeoutError handling
   - Add more detailed logging

2. **`frontend/src/hooks/useAgentStream.ts`**
   - Add handler for "ping" messages
   - Add logging for stream state changes
   - Detect and warn on premature termination

3. **`backend/run_agent_background.py`**
   - Check for timeouts in worker execution
   - Verify status publishing timing

---

**Status:** 🔴 BLOCKING - Prevents any task >30 seconds from completing  
**Next Action:** Increase timeout to 300s + add logging to identify root cause
