# 🚨 CRITICAL: 5-Second Streaming Timeout Issue - Root Cause Analysis

## Issue Summary
Streaming stops after ~5 seconds for long-running tool calls. The backend completes the run but the frontend no longer receives updates.

---

## 🔴 SUSPECTED ROOT CAUSE #1: Backend Stream Connection Timeout

### Location: `backend/core/agent_runs.py` (Lines 1020-1040)

The streaming endpoint has a **30-second keepalive timeout**:

```python
queue_item = await asyncio.wait_for(
    message_queue.get(),
    timeout=30.0  # <-- Keepalive timeout
)

if queue_item["type"] == "new_response":
    # Process response
elif queue_item["type"] == "error":
    # Handle error
```

**Problem:** If a tool call takes >5 seconds, there might be no new messages for 5+ seconds. During this gap:
- The frontend might not receive the keepalive ping (status: 'ping')
- The browser's HTTP client might close the connection
- OR the frontend's EventSource might timeout before receiving a response

---

## 🟠 SUSPECTED ROOT CAUSE #2: Frontend EventSource Not Handling Long Tool Calls

### Location: `frontend/src/lib/api/threads.ts` or `frontend/src/lib/api/streaming.ts`

**Missing:** Look for the actual `streamAgent` function implementation in:
- `frontend/src/lib/api/streaming.ts` (newly added in this branch)
- `frontend/src/lib/api/agents.ts` (likely where `streamAgent` is actually defined)

**Typical Issues:**
1. EventSource connection timeout not configured
2. No heartbeat/keepalive message handling
3. Connection closes on inactivity

---

## 🟡 SUSPECTED ROOT CAUSE #3: Frontend Cleanup Race Condition

### Location: `frontend/src/hooks/useAgentStream.ts` (Lines 781-793)

```typescript
setTimeout(async () => {
  if (!isMountedRef.current) return;
  if (currentRunIdRef.current !== runId) return;
  if (statusRef.current === 'streaming') return;  // <-- THIS CHECK!
  try {
    const latest = await getAgentStatus(runId);
    // If status check fails or takes time, stream might not be re-established
  }
}, 1500);  // 1.5 seconds - Too short for tool execution!
```

**Problem:** After 1.5 seconds, if `statusRef.current !== 'streaming'`, the code tries to check the status. If this fails and the stream never transitioned to 'streaming' state properly, it might prematurely finalize.

---

## 📋 FILES TO INVESTIGATE IMMEDIATELY

### CRITICAL (Must Check):
1. **`frontend/src/lib/api/agents.ts`** - The `streamAgent()` function
   - Does it have timeout handling?
   - Does it send keepalive pings?
   - How does it handle EventSource?

2. **`backend/core/agent_runs.py`** - Stream generator timeout
   - Lines 1000-1050: Keepalive logic
   - Is 30-second timeout too long/short?
   - Are keepalive pings actually being sent?

3. **`backend/run_agent_background.py`** - Message publishing
   - Are messages published to Redis queue fast enough?
   - Could publishing delay cause the stream to timeout?

### HIGH PRIORITY:
4. **`frontend/src/hooks/useAgentStream.ts`**
   - The 1.5-second status check (line 781)
   - The `handleStreamClose` logic
   - Stream reconnection logic

5. **`frontend/src/components/thread/content/StreamingText.tsx`**
   - Does it handle stream completion properly?
   - Any client-side timeouts?

---

## 🔍 DIAGNOSIS STEPS

### Step 1: Check Browser DevTools
When streaming fails:
1. Open Network tab → Check the `/api/agent-run/{id}/stream` request
2. **Is the connection CLOSED or PENDING?**
3. How long until it closes? (Check timing)

### Step 2: Check Backend Logs
Look for:
- `"Stream complete. Total chunks: XXX"` 
- Any "timeout" messages
- When the stream ends vs when the agent completes

### Step 3: Monitor Chrome Network Timeline
```
[0s] Request starts
[1-5s] Streaming active (chunks arriving)
[5s] ❌ Stream closes or becomes silent
[25s] Agent actually completes
```

---

## 💡 LIKELY FIX STRATEGIES

### Strategy A: Increase Keepalive Frequency
**Backend `backend/core/agent_runs.py` (line ~1030):**
```python
except asyncio.TimeoutError:
    # No new messages for 30 seconds - send keepalive ping
    # CHANGE: Send more frequent pings during tool execution
    elapsed = time.time() - stream_start_time
    logger.debug(f"[KEEPALIVE] Sending heartbeat ping...")
    yield f"data: {json.dumps({'type': 'ping'})}\n\n"
    continue
```

**Fix:** Reduce timeout from 30s to 5s, send pings every 5s when tool is running

### Strategy B: Improve Frontend EventSource Handling
**Frontend `frontend/src/lib/api/agents.ts`:**
```typescript
export function streamAgent(runId: string, callbacks) {
  const eventSource = new EventSource(
    `/api/agent-run/${runId}/stream?token=${token}`,
    {
      // Add timeout configuration if available
      // Note: EventSource doesn't support readyState timeout, 
      // but we can implement manual timeout
    }
  );

  // Add liveness check timer
  let lastMessageTime = Date.now();
  const livenessTimer = setInterval(() => {
    if (Date.now() - lastMessageTime > 8000) {  // 8s timeout
      console.warn('No message for 8s, stream may be dead');
      // Try to reconnect or alert
    }
  }, 1000);

  eventSource.onmessage = (event) => {
    lastMessageTime = Date.now();  // Reset timer on each message
    callbacks.onMessage(event.data);
  };
  
  // ...cleanup code...
}
```

### Strategy C: Check Frontend Cleanup Timing
**Frontend `frontend/src/hooks/useAgentStream.ts` (line 781):**
```typescript
// INCREASE timeout for tool execution scenarios
setTimeout(async () => {
  if (!isMountedRef.current) return;
  if (currentRunIdRef.current !== runId) return;
  if (statusRef.current === 'streaming') return;  // Already got a message
  
  // For tool calls, wait longer before checking status
  // Tools can take 10-30+ seconds
  try {
    const latest = await getAgentStatus(runId);
    if (latest.status === 'running') {
      // Agent still running, keep the stream open
      updateStatus('streaming');  // Manually set to streaming
    }
  } catch {
    // ignore
  }
}, 5000);  // INCREASED from 1500ms to 5000ms (5 seconds)
```

---

## 📊 TIMELINE HYPOTHESIS

```
T=0s     → User submits message
T=0.5s   → Frontend gets agentRunId and calls startStreaming()
T=0.5s   → Frontend connects to /api/agent-run/{id}/stream (EventSource)
T=1s     → Backend sends first streaming chunks (LLM thinking, tool selection)
T=1.5s   → Frontend goes to 'streaming' state
T=3s     → Tool starts executing on backend (long-running)
T=5s     ⚠️  TIMEOUT OCCURS HERE
           - No messages for 5+ seconds (tool is still running)
           - Frontend EventSource has NO activity
           - Browser/proxy might close connection as "idle"
           - OR frontend timeout triggers and closes stream
T=25s    → Backend completes agent run & publishes final message
           → But stream is already closed on frontend!
```

---

## ✅ VERIFICATION CHECKLIST

- [ ] Find `streamAgent()` function in frontend
- [ ] Check if EventSource has readyState monitoring
- [ ] Check backend keepalive ping frequency
- [ ] Verify Redis pubsub publishing speed under load
- [ ] Check for proxy/load balancer timeouts (Kong, Cloudflare)
- [ ] Look for explicit `close()` calls when tool starts
- [ ] Check if streaming cleanup happens prematurely
- [ ] Monitor elapsed time between messages in stream

---

## 🎯 NEXT IMMEDIATE ACTIONS

1. **Pull main branch** changes to streaming files
2. **Compare differences** between main and feature/slash-commands
3. **Look for timeout configs** added/removed in:
   - Frontend API client
   - Backend stream endpoint
   - React Query timeout settings
4. **Check Cloudflare/Kong configs** for connection timeouts
5. **Add extensive logging** to track message arrival times

