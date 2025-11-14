# 🔴 ROOT CAUSE: 5-Second Streaming Timeout

## The Problem

After ~5 seconds of streaming, the frontend stops receiving messages even though the backend is still sending them for 20+ more seconds.

## Root Cause

**The issue is in the `onerror` handler logic in `frontend/src/lib/api.ts` (lines 1265-1300).**

### What Happens

1. **Backend sends completion message** → Frontend receives it → Does NOT close EventSource ✅
   - Your dev code (line 1220) correctly has: `// Don't call cleanup here - let the backend close the connection`

2. **Backend naturally closes the connection** after sending all messages → Triggers `EventSource.onerror` on the frontend

3. **`onerror` handler runs** (line 1265) → **This is where the problem occurs:**
   ```typescript
   eventSource.onerror = (event) => {
     // Check if the agent is still running
     getAgentStatus(agentRunId)
       .then((status) => {
         if (status.status !== 'running') {
           // ✅ This is correct - agent finished
           cleanupEventSource(agentRunId, 'agent not running');
           callbacks.onClose();
         } else {
           // ⚠️ THIS IS THE BUG - tries to reconnect even after completion
           // Reconnection with exponential backoff (1s, 1.5s, 2.25s, 3.38s, 5.07s...)
           const delay = Math.min(1000 * Math.pow(1.5, attempts), 30000);
           setupStream(); // Attempts to reconnect
         }
       })
   };
   ```

4. **Race Condition:** When the backend closes the connection normally after sending completion, `getAgentStatus` might still briefly return `running` status because:
   - The status query is asynchronous
   - There's a timing window where the backend hasn't fully marked it as non-running yet
   - The client tries to reconnect instead of cleanly closing

5. **Reconnection logic starts:** The first reconnection attempt happens after ~1 second. If that fails or times out, it retries with exponential backoff (1s, 1.5s, 2.25s, 3.38s, **5.07s**...).

## Why It Appears to Be 5 Seconds

- Initial messages stream for ~0-1s (first part of run)
- Stream silences for ~5s while reconnection logic tries and fails
- User stops seeing updates after ~5-6 seconds total

## The Critical Difference: origin/main vs. dev

### origin/main (Working):
- **Uses simple `try/catch` with NO reconnection logic**
- When connection closes normally, it just closes cleanly
- No attempting to reconnect after completion

### dev branch (Broken):
- **Added aggressive reconnection logic**
- When backend closes connection normally, treats it as an error
- Attempts to reconnect up to 5 times with exponential backoff
- This interferes with the natural stream completion flow

## The Fix

**Option A: Simple - Detect Normal Closure (Recommended)**
```typescript
eventSource.onerror = (event) => {
  // Only attempt reconnection if readyState is CONNECTING
  // If readyState is CLOSED, the connection closed normally (backend closed it)
  if (eventSource.readyState === EventSource.CLOSED) {
    console.log(`[STREAM] Connection closed normally for ${agentRunId}`);
    callbacks.onClose();
    return;
  }

  // Otherwise, attempt status check and reconnection
  getAgentStatus(agentRunId)
    .then((status) => {
      if (status.status !== 'running') {
        cleanupEventSource(agentRunId, 'agent not running');
        callbacks.onClose();
      } else {
        // Reconnect logic...
      }
    })
};
```

**Option B: Proper - Remove Reconnection Entirely**
- The backend SHOULD handle reconnection, not the frontend
- Frontend should just stream what the backend sends
- When connection closes, assume the backend finished properly

## Supporting Evidence

From `frontend/src/lib/api.ts` lines 1220-1233 (your current code):
```typescript
// ⚠️ CRITICAL FIX: Do NOT close the EventSource here!
// The solution: Let the backend close the SSE connection naturally after sending all messages.
// The backend's stream generator will return after yielding the completion message (see
// backend/core/agent_runs.py lines 1034-1036), which closes the connection. This will
// trigger onerror/onclose on the client side AFTER all messages have been processed.
```

**This comment is correct, but your `onerror` handler contradicts it** by attempting reconnection!

## Origin/Main Success

The original `frontend/src/lib/api/agents.ts` (in origin/main) does NOT have this aggressive reconnection logic, which is why streaming works there.

## Timeline

1. 0-1s: Messages stream normally
2. 1s: Backend finishes and closes connection
3. 1s: Frontend's `onerror` fires
4. 1s: `getAgentStatus` check runs, may still see "running" temporarily
5. 1-6s: Reconnection attempts with exponential backoff block new messages
6. 5-6s: After ~5-6s total, user stops seeing updates
7. 20s: Backend actually finishes, but frontend stopped listening around 5-6s

## Quick Test

Check your browser console during streaming:
```
[STREAM] Connection closed normally for xyz-agent-run-id
[STREAM] Agent is still running for xyz, reconnecting (attempt 1/5) in 1000ms...
[STREAM] Error checking status, reconnecting (attempt 2/5) in 1500ms...
[STREAM] Error checking status, reconnecting (attempt 3/5) in 2250ms...
[STREAM] Error checking status, reconnecting (attempt 4/5) in 3375ms...
[STREAM] Max reconnection attempts exceeded for xyz
```

If you see "reconnecting" messages around the 5-second mark, this confirms the issue.
