# Agent Chat Premature Termination - Root Cause & Fix

## Problem Summary
Agent chat sessions were terminating prematurely when tool calls (like `execute_command` for building/installing packages) were still executing in the Daytona sandbox. Users would see the chat interface stop updating, even though the agent was still working in the background.

## Root Cause Analysis

### What the Logs Revealed
```
[STREAM] EventSource opened for 48754cfc-5111-4cf7-84d9-ff98fa825b26
[useAgentStream] Unhandled message type: llm_response_start
[useAgentStream] Finalizing stream with status: completed, runId: 48754cfc-5111-4cf7-84d9-ff98fa825b26
[STREAM] Cleaning up EventSource for 48754cfc-5111-4cf7-84d9-ff98fa825b26: manual cleanup
```

The stream was being finalized **immediately after opening**, despite the agent potentially still executing tool calls.

### The Technical Issue

The bug was in `frontend/src/lib/api.ts` (lines 1229-1244):

```typescript
// OLD CODE - BUGGY
if (rawData.includes('"type": "status"') && rawData.includes('"status": "completed"')) {
  callbacks.onMessage(rawData);
  
  // ❌ BUG: Immediately closing EventSource
  cleanupEventSource(agentRunId, 'agent run completed');
  callbacks.onClose();
  
  return;
}
```

**What was happening:**

1. Backend completes agent run and sends all messages to Redis list
2. Backend sends messages through SSE: `[Message 1, Message 2, ..., Tool Result, Completion Status]`
3. EventSource buffers these messages for async processing
4. Frontend's `onmessage` handler starts processing Message 1
5. While processing, the "completed" status message is processed
6. **EventSource is immediately closed via `cleanupEventSource()`**
7. **Remaining buffered messages (including tool results) are discarded!**

### Why This Happened

EventSource (Server-Sent Events) processes messages **asynchronously**. When multiple messages arrive rapidly:
- They're buffered by the browser
- The `onmessage` handler processes them one at a time
- If you call `eventSource.close()` while messages are still buffered, those messages are lost

## The Fix

Changed the code to **not manually close the EventSource** when receiving a "completed" message. Instead, let the backend close the connection naturally:

```typescript
// NEW CODE - FIXED
if (rawData.includes('"type": "status"') && rawData.includes('"status": "completed"')) {
  if (rawData.includes('Agent run completed successfully')) {
    nonRunningAgentRuns.add(agentRunId);
  }

  callbacks.onMessage(rawData);

  // ✅ FIX: Don't close the EventSource here!
  // Let the backend close the connection after sending all messages.
  // This ensures all buffered messages are processed.
  
  return; // Just return, don't cleanup
}
```

### How It Works Now

1. Backend completes and sends all messages including "completed" status
2. Backend's stream generator returns (see `backend/core/agent_runs.py` lines 1034-1036)
3. **Backend closes the SSE connection**
4. EventSource processes all buffered messages first
5. After all messages are processed, `onerror` handler is triggered
6. Error handler checks status, sees "completed", and cleans up properly

## Additional Fix: WebSocket Security Error

After deploying the agent chat fix, a **secondary issue** was discovered related to the recent HTTPS upgrade:

### Problem
```
SecurityError: Failed to construct 'WebSocket': An insecure WebSocket connection 
may not be initiated from a page loaded over HTTPS.
```

### Root Cause
When the frontend is served over HTTPS (via Cloudflare), WebSocket connections must use the secure `wss://` protocol instead of `ws://`. The Supabase client was not correctly using secure WebSockets because it was falling back to `NEXT_PUBLIC_SUPABASE_URL` (which is HTTP) instead of using the explicitly configured `NEXT_PUBLIC_REALTIME_URL` (which is HTTPS).

**Note:** Cloudflare automatically handles HTTPS upgrades for regular HTTP requests, so `NEXT_PUBLIC_SUPABASE_URL` can remain as HTTP. However, WebSocket connections require explicit `wss://` protocol configuration via `NEXT_PUBLIC_REALTIME_URL`.

### Configuration
In `docker-compose.yaml`:

```yaml
# Correct configuration
- NEXT_PUBLIC_SUPABASE_URL=http://kong.kortix.syhc.dev/      # HTTP is fine - Cloudflare upgrades
- NEXT_PUBLIC_REALTIME_URL=https://kong.kortix.syhc.dev/     # HTTPS required for wss:// WebSocket
```

The `createRealtimeClient()` function in `frontend/src/lib/supabase/client.ts` prioritizes `NEXT_PUBLIC_REALTIME_URL`, ensuring WebSocket connections use `wss://` when the page is served over HTTPS.

## Testing

To verify the fix:
1. Start an agent run that uses long-running tool calls (e.g., `execute_command` with package installation)
2. Observe that all tool results are displayed in the chat
3. Verify the chat completes successfully without premature termination
4. Check browser logs for proper message sequencing
5. Verify no WebSocket security errors in console

## Related Files

### Agent Chat Fix
- **`frontend/src/lib/api.ts`** - Fixed EventSource cleanup timing (line ~1239)
- **`frontend/src/hooks/useAgentStream.ts`** - Stream management hook (no changes needed)
- **`backend/core/agent_runs.py`** - Backend streaming implementation (no changes needed)
- **`backend/run_agent_background.py`** - Agent execution and message queueing (no changes needed)

### WebSocket Security Fix & Debugging
- **`docker-compose.yaml`** - Verified NEXT_PUBLIC_REALTIME_URL uses HTTPS for secure WebSocket (line 98, 108)
- **`frontend/src/lib/supabase/client.ts`** - Realtime client prioritizes NEXT_PUBLIC_REALTIME_URL + comprehensive debugging (lines 70-185)

## Impact

- ✅ Prevents premature stream termination
- ✅ Ensures all tool call results are received by the frontend
- ✅ Maintains proper cleanup through natural connection closure
- ✅ No performance impact (actually removes unnecessary early cleanup)
- ✅ Fixes WebSocket security errors when running over HTTPS
- ✅ Enables Supabase Realtime to work properly with HTTPS frontend

## Deployment

Both fixes require frontend rebuild:
```bash
docker compose up -d --build frontend
```

## Future Considerations

While these fixes resolve the immediate issues, consider:
1. Adding sequence numbers to messages for verification
2. Implementing message acknowledgment protocol
3. Adding metrics to track message delivery success rate
4. Consider WebSocket as an alternative to SSE for more robust bidirectional communication
5. Add automated tests to detect premature stream termination
6. Monitor WebSocket connection stability in production

## Additional Enhancement: WebSocket Debugging

To better diagnose WebSocket connection issues, comprehensive debugging was added to `frontend/src/lib/supabase/client.ts`:

### What Was Added

1. **Configuration Logging**: Logs WebSocket URL construction, expected protocol (ws:// vs wss://), and page protocol
2. **Connection State Monitoring**: Tracks WebSocket connection state changes via internal API
3. **Channel Subscription Hooks**: Intercepts channel creation and subscription to log lifecycle events
4. **Protocol Detection**: Compares expected vs actual WebSocket protocol based on page security

### Example Debug Output

```javascript
[createRealtimeClient] Configuration: {
  NEXT_PUBLIC_REALTIME_URL: "https://kong.kortix.syhc.dev/",
  NEXT_PUBLIC_SUPABASE_URL: "http://kong.kortix.syhc.dev/",
  realtimeUrl: "https://kong.kortix.syhc.dev/",
  windowOrigin: "https://kortix.syhc.dev",
  note: "WebSocket will attempt to upgrade at: https://kong.kortix.syhc.dev//realtime/v1/websocket"
}

[createRealtimeClient] WebSocket configuration: {
  realtimeUrl: "https://kong.kortix.syhc.dev/",
  constructedWsUrl: "wss://kong.kortix.syhc.dev//realtime/v1/websocket",
  expectedProtocol: "wss://",
  expectedFullUrl: "wss://kong.kortix.syhc.dev//realtime/v1/websocket",
  pageProtocol: "https:",
  shouldBeSecure: true
}

[createRealtimeClient] 📢 Creating channel: chat-updates
[createRealtimeClient] 🔔 Subscribing to channel: chat-updates
[createRealtimeClient] WebSocket state before subscribe: connected
[createRealtimeClient] WebSocket state after subscribe: connected
```

### Benefits

- **Quick Protocol Verification**: See at a glance if ws:// vs wss:// is correct
- **Connection State Visibility**: Know immediately if WebSocket is connected/disconnected
- **Channel Lifecycle Tracking**: Understand subscription flow and timing
- **Environment Variable Validation**: Confirm configuration is correctly set

This debugging infrastructure will help diagnose any future WebSocket issues quickly and accurately.

## Timeline

- **November 8, 2025** - Agent chat premature termination identified and fixed
- **November 8, 2025** - WebSocket security error identified and fixed after HTTPS migration
- **November 8, 2025** - WebSocket debugging infrastructure added to aid diagnostics
- **Status**: ✅ All issues resolved and deployed with enhanced observability
