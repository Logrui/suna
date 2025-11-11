# 🔧 Streaming Issue - Copy-Paste Code Fixes

## FIX #1: Backend Keepalive Timeout

### File: `backend/core/agent_runs.py`

**Location**: Around line 1020 in the `stream_generator` function

**Find this code**:
```python
        # 4. Main loop to process messages from the queue
        while not terminate_stream:
            try:
                queue_item = await message_queue.get()
```

**Replace with**:
```python
        # 4. Main loop to process messages from the queue
        while not terminate_stream:
            try:
                # Add 30-second timeout to send keepalive pings for long-running tasks
                queue_item = await asyncio.wait_for(
                    message_queue.get(),
                    timeout=30.0
                )
```

---

**Then find this**:
```python
                except asyncio.CancelledError:
                     logger.debug(f"Stream generator main loop cancelled for {agent_run_id}")
                     terminate_stream = True
                     break
                except Exception as loop_err:
                    logger.error(f"Error in stream generator main loop for {agent_run_id}: {loop_err}", exc_info=True)
                    terminate_stream = True
                    yield f"data: {json.dumps({'type': 'status', 'status': 'error', 'message': f'Stream failed: {loop_err}'})}\n\n"
                    break
```

**Add BEFORE these exceptions**:
```python
                except asyncio.TimeoutError:
                    # No new messages for 30 seconds - send keepalive ping
                    # This prevents browsers from closing the connection during long agent processing
                    logger.debug(f"[KEEPALIVE] Sending heartbeat ping for {agent_run_id} (streaming for ~{time.time() - stream_start_time:.0f}s)")
                    yield f"data: {json.dumps({'type': 'ping'})}\n\n"
                    continue
```

**Add at the start of stream_generator** (after initial variables):
```python
    async def stream_generator(agent_run_data):
        logger.debug(f"Streaming responses for {agent_run_id} using Redis list {response_list_key} and channel {response_channel}")
        last_processed_index = -1
        listener_task = None
        terminate_stream = False
        initial_yield_complete = False
        stream_start_time = time.time()  # ✅ ADD THIS LINE
```

---

## FIX #2: Frontend Reconnection Logic

### File: `frontend/src/lib/api.ts`

**Location**: In the `streamAgent` function, around line 1140

**Add this at the top of streamAgent function** (after the existing variable declarations):
```typescript
  // Track reconnection attempts per agent run
  const reconnectAttemptsMap: Record<string, number> = {};

  // Get or initialize reconnect attempts for this run
  const getReconnectAttempts = (runId: string) => reconnectAttemptsMap[runId] || 0;
  const incrementReconnectAttempts = (runId: string) => {
    reconnectAttemptsMap[runId] = (getReconnectAttempts(runId)) + 1;
  };
  const resetReconnectAttempts = (runId: string) => {
    reconnectAttemptsMap[runId] = 0;
  };
```

---

**Find `eventSource.onopen`** (around line 1150):
```typescript
      eventSource.onopen = () => {
        console.log(`[STREAM] EventSource opened for ${agentRunId}`);
      };
```

**Replace with**:
```typescript
      eventSource.onopen = () => {
        console.log(`[STREAM] EventSource opened for ${agentRunId}`);
        resetReconnectAttempts(agentRunId);  // ✅ Reset retry count on success
      };
```

---

**Find `eventSource.onerror`** (around line 1240):
```typescript
      eventSource.onerror = (event) => {
        console.error(`[STREAM] EventSource error for ${agentRunId}:`, event);
        
        // Check if the agent is still running
        getAgentStatus(agentRunId)
          .then((status) => {
            if (status.status !== 'running') {
              nonRunningAgentRuns.add(agentRunId);
              cleanupEventSource(agentRunId, 'agent not running');
              callbacks.onClose();
            } else {
              // Let the browser handle reconnection for non-fatal errors
            }
          })
          .catch((err) => {
            // ... error handling
          });
      };
```

**Replace the entire `eventSource.onerror` handler with**:
```typescript
      eventSource.onerror = (event) => {
        console.error(`[STREAM] EventSource error for ${agentRunId}:`, event);
        
        // Check if the agent is still running
        getAgentStatus(agentRunId)
          .then((status) => {
            if (status.status !== 'running') {
              // Agent finished, close normally
              nonRunningAgentRuns.add(agentRunId);
              cleanupEventSource(agentRunId, 'agent not running');
              callbacks.onClose();
            } else {
              // ✅ NEW: Agent is still running, attempt reconnection with backoff
              const attempts = getReconnectAttempts(agentRunId);
              const maxAttempts = 5;

              if (attempts < maxAttempts) {
                // Calculate exponential backoff delay
                const delay = Math.min(
                  1000 * Math.pow(1.5, attempts),
                  30000 // Cap at 30 seconds
                );

                incrementReconnectAttempts(agentRunId);

                console.log(
                  `[STREAM] Agent still running for ${agentRunId}, reconnecting (attempt ${attempts + 1}/${maxAttempts}) in ${delay}ms...`
                );

                // Clean up the broken EventSource
                cleanupEventSource(agentRunId, 'reconnecting');

                // Wait and then recreate the stream
                setTimeout(() => {
                  setupStream();
                }, delay);
              } else {
                // Exceeded max reconnection attempts
                console.error(
                  `[STREAM] Max reconnection attempts (${maxAttempts}) exceeded for ${agentRunId}`
                );
                nonRunningAgentRuns.add(agentRunId);
                cleanupEventSource(agentRunId, 'max reconnect attempts exceeded');
                callbacks.onError('Stream disconnected - max reconnection attempts exceeded');
                callbacks.onClose();
              }
            }
          })
          .catch((err) => {
            const errorMessage = err instanceof Error ? err.message : String(err);
            console.error(
              `[STREAM] Error checking agent status for ${agentRunId}:`,
              err
            );

            // Also attempt reconnection on status check errors
            const attempts = getReconnectAttempts(agentRunId);
            const maxAttempts = 5;

            if (attempts < maxAttempts) {
              const delay = Math.min(
                1000 * Math.pow(1.5, attempts),
                30000
              );

              incrementReconnectAttempts(agentRunId);

              console.log(
                `[STREAM] Error checking status, reconnecting (attempt ${attempts + 1}/${maxAttempts}) in ${delay}ms...`
              );

              cleanupEventSource(agentRunId, 'reconnecting after status check error');

              setTimeout(() => {
                setupStream();
              }, delay);
            } else {
              console.error(
                `[STREAM] Max reconnection attempts exceeded for ${agentRunId} after error checking status`
              );
              nonRunningAgentRuns.add(agentRunId);
              cleanupEventSource(agentRunId, 'max reconnect attempts exceeded');
              callbacks.onError(
                errorMessage || 'Stream disconnected - failed to check agent status'
              );
              callbacks.onClose();
            }
          });
      };
```

---

## Verification Checklist

### ✅ Backend Change Complete
- [ ] Found line ~1020 with `await message_queue.get()`
- [ ] Added `asyncio.wait_for(..., timeout=30.0)` wrapper
- [ ] Added `asyncio.TimeoutError` exception handler with ping yield
- [ ] Added `stream_start_time = time.time()` at function start
- [ ] File saved

### ✅ Frontend Change Complete
- [ ] Found `streamAgent` function around line 1081
- [ ] Added reconnect tracking variables
- [ ] Updated `eventSource.onopen` to reset reconnect count
- [ ] Replaced entire `eventSource.onerror` handler
- [ ] File saved

### ✅ Test Build
```bash
docker compose down
docker compose up -d --build
docker logs suna-backend-1 | grep -i "keepalive\|error"
```

---

## What Each Part Does

### Backend Timeout (30 seconds)
- Waits for new messages from Redis queue
- If nothing arrives in 30 seconds, sends a `{"type": "ping"}` message
- Keeps the connection "warm" so browser won't close it
- Repeats every 30 seconds until agent finishes

### Frontend Ping Filter
- Already implemented! Does nothing when it sees `{"type": "ping"}`
- No code change needed here

### Frontend Reconnection
- When connection drops, checks if agent is still running
- If running: Waits and reconnects (1.5s → 2.25s → 3.4s, up to 30s)
- If finished: Closes normally
- Max 5 reconnection attempts to prevent infinite loops

---

## Testing After Fix

### Test 1: Long Thinking
```bash
# Watch backend logs
docker logs suna-backend-1 -f | grep KEEPALIVE

# Send: "Analyze [complex topic]" and wait 60+ seconds
# Should see: "[KEEPALIVE] Sending heartbeat ping..." every 30s
# Should NOT see: "EventSource closed" or "Stream generator cancelled"
```

### Test 2: Manual Disconnect
```bash
# Browser DevTools → Network → Filter to "xhr" or "fetch"
# Find the /agent-run/.../stream request
# Right-click → Abort Request
# Should see in console: "[STREAM] Agent still running, reconnecting..."
# Stream should reconnect automatically in 1-2 seconds
```

### Test 3: Long Tool Execution
```bash
# Send task that requires 45+ seconds of tool execution
# Monitor DevTools Network tab
# Should see continuous message flow
# No long pauses or freezes
```

---

## Rollback (If Something Breaks)

```bash
# Revert backend
git checkout backend/core/agent_runs.py

# Revert frontend
git checkout frontend/src/lib/api.ts

# Rebuild
docker compose down
docker compose up -d --build
```

---

## Common Issues

### "No messages arriving after keepalive added"
- **Check**: Is `asyncio.TimeoutError` indented correctly?
- **Check**: Is `yield` present in the exception handler?
- **Fix**: Ensure it's at the same indentation as other exceptions

### "Reconnection attempts never stop"
- **Check**: Is `resetReconnectAttempts()` called in `eventSource.onopen`?
- **Check**: Is `getReconnectAttempts()` used before incrementing?
- **Fix**: Ensure tracking map is properly initialized

### "Pings showing up in the chat"
- **Check**: Is ping filter still present in `eventSource.onmessage`?
- **Expected**: `if (rawData.includes('"type": "ping"')) return;`
- **Fix**: Verify this line exists in the message handler

---

## Performance Notes

- **Ping Size**: ~20 bytes every 30 seconds = negligible bandwidth
- **Memory**: No additional memory usage
- **CPU**: Minimal - just async timeout check
- **Reconnection Delay**: User imperceptible (happens in background)

---

**Ready to implement?** Start with FIX #1 (backend), then FIX #2 (frontend). Test after each.

