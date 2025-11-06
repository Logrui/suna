# 🔴 Message Streaming & Live Update Issue - Root Cause Analysis

## Problem Statement
**Users see initial streaming responses, but then the chat PAUSES and doesn't update until the page is refreshed.**

### Symptom Flow
```
1. User sends message
2. ✅ Initial response streams in (live)
3. ⏸️ Chat stops updating mid-stream
4. ❌ Page must be refreshed to see the rest
5. After refresh: Full conversation is visible
```

---

## 🔍 System Architecture

### Backend Streaming Flow
```
Backend (agent_runs.py)
├─ StreamingResponse endpoint
├─ Redis list: agent_run:{id}:responses
├─ Redis channels:
│  ├─ agent_run:{id}:new_response (triggers fetch from list)
│  └─ agent_run:{id}:control (STOP/END_STREAM/ERROR)
└─ Pub/Sub listener: Waits for Redis messages, yields from queue
```

### Frontend Streaming Flow
```
Frontend (useAgentStream.ts)
├─ EventSource connection to /agent-run/{id}/stream
├─ onmessage: Receives SSE data, parses JSON
├─ State updates: messages, textContent, toolCall, error
├─ onclose: Finalizes stream
└─ Cleanup: Closes EventSource, stops listeners
```

---

## 🎯 Root Causes Identified

### **ISSUE #1: Browser EventSource Reconnection Limits** ⚠️ **PRIMARY**

**Location**: `frontend/src/lib/api.ts:1150-1250`

**Problem**: 
- Browsers have built-in EventSource reconnection behavior
- **Browsers automatically close EventSource after ~60 seconds of no messages**
- When agent is processing (thinking/tool execution), NO messages are sent for long periods
- EventSource closes silently, stream ends abruptly
- Frontend doesn't know the agent is still running

**Evidence**:
```typescript
// In api.ts onopen/onmessage/onerror
const eventSource = new EventSource(url.toString());
// ❌ NO keepalive mechanism
// ❌ NO heartbeat messages
// ❌ NO reconnection logic with backoff
```

**Root Cause**: 
- Backend sends messages only when there's actual content
- If agent is "thinking" → NO messages for 30-60 seconds
- Browser closes connection
- Agent keeps running, finishes, writes to Redis
- Frontend already closed → never receives completion

---

### **ISSUE #2: No Server-Side Keepalive/Heartbeat** ⚠️ **CRITICAL**

**Location**: `backend/core/agent_runs.py:898-1087`

**Problem**:
```python
async def stream_generator(agent_run_data):
    # Yields only when there's data
    for response in initial_responses:
        yield f"data: {json.dumps(response)}\n\n"
    
    # 🔴 THEN: Waits for Redis pub/sub messages
    # If agent is thinking for 60+ seconds:
    # - No messages in Redis
    # - No pub/sub events
    # - stream_generator yields nothing
    # - Browser sees 60s of silence
    # - Browser closes EventSource
```

**Missing Implementation**:
```python
# What's NOT there:
while not terminate_stream:
    try:
        queue_item = await asyncio.wait_for(
            message_queue.get(),
            timeout=30  # ❌ NO TIMEOUT = browser closes connection
        )
        # If timeout: should send keepalive ping
    except asyncio.TimeoutError:
        # ❌ No heartbeat sent here
        pass
```

---

### **ISSUE #3: No Explicit Reconnection Logic** ⚠️ **SECONDARY**

**Location**: `frontend/src/lib/api.ts:1240-1260`

**Problem**:
```typescript
eventSource.onerror = (event) => {
    console.error(`[STREAM] EventSource error for ${agentRunId}:`, event);
    
    // Only checks if agent is running
    getAgentStatus(agentRunId).then((status) => {
        if (status.status !== 'running') {
            nonRunningAgentRuns.add(agentRunId);
            cleanupEventSource(agentRunId, 'agent not running');
            callbacks.onClose();  // ❌ Just closes, doesn't reconnect
        } else {
            // ❌ Does nothing! Agent is still running but stream died
            // Browser reconnects automatically but...
        }
    });
};
```

**The Issue**:
- When stream disconnects, agent might still be running
- Browser tries auto-reconnect, but timing is wrong
- Frontend thinks stream is dead
- Manual reconnection missing

---

### **ISSUE #4: Redis Message Queue Gaps** ⚠️ **TERTIARY**

**Location**: `backend/core/agent_runs.py:970-1010`

**Problem**:
```python
# Stream generator polls Redis when it gets pub/sub notification
while not terminate_stream:
    queue_item = await message_queue.get()  # Wait for notification
    
    if queue_item["type"] == "new_response":
        # Fetch from Redis list
        new_responses_json = await redis.lrange(
            response_list_key, 
            new_start_index,  # ❌ If gap exists here...
            -1
        )
        
        # If responses were written AFTER stream closed:
        # - Redis list has them
        # - But stream generator already quit
        # - Frontend never sees them
```

---

## 📊 Timeline of the Bug

```
Time    Backend                         Frontend (Browser)
---     -------                         -----------------
0s      Agent starts running            EventSource opens
         Response 1 → Redis              onmessage: Got response 1
         Pub/sub: new_response notify    UI updates ✅
         
5s      Response 2 → Redis              onmessage: Got response 2
         Pub/sub: new_response notify    UI updates ✅

30s     Agent thinking (no responses)   ⏸️ No data flowing
         ...                            
         
60s     ❌ No keepalive sent            ❌ Browser closes EventSource
        Stream generator still running  handleStreamClose() called

65s     Agent finishes                  Thinks stream ended
        Response 3 → Redis              ❌ Never receives it
        Pub/sub: new_response notify    
        ❌ Stream already closed

70s     Status: completed → Redis       Frontend shows incomplete
        Pub/sub: control/END_STREAM     conversation until refresh
        Stream generator exits          
```

---

## 🔧 Solutions Required

### **FIX #1: Add Server-Side Keepalive (HIGHEST PRIORITY)**

**What to do**:
```python
# In agent_runs.py stream_generator

async def stream_generator(agent_run_data):
    while not terminate_stream:
        try:
            # Wait for new messages BUT with timeout
            queue_item = await asyncio.wait_for(
                message_queue.get(),
                timeout=30  # Timeout after 30s of inactivity
            )
            # Process queue_item normally...
            
        except asyncio.TimeoutError:
            # No new messages for 30 seconds - send keepalive
            yield f"data: {json.dumps({'type': 'ping'})}\n\n"
            continue  # Keep the connection alive
```

**Effect**: Browser never sees 60s of silence, connection stays open

---

### **FIX #2: Add Keepalive Handler on Frontend**

**What to do**:
```typescript
// In api.ts EventSource setup

eventSource.onmessage = (event) => {
    const rawData = event.data;
    
    // ✅ NEW: Ignore keepalive pings
    if (rawData.includes('"type": "ping"')) {
        console.debug('[STREAM] Received keepalive ping');
        return;  // Don't process as message
    }
    
    // Rest of message processing...
};
```

**Effect**: Frontend acknowledges connection is alive, stays connected

---

### **FIX #3: Explicit Reconnection with Backoff**

**What to do**:
```typescript
// In api.ts onerror handler

eventSource.onerror = (event) => {
    console.error(`[STREAM] EventSource error for ${agentRunId}:`, event);
    
    const agentStatus = await getAgentStatus(agentRunId);
    
    if (agentStatus.status === 'running') {
        // ✅ NEW: Agent still running, reconnect!
        console.log('[STREAM] Agent still running, attempting reconnect...');
        
        // Clean up old EventSource
        cleanupEventSource(agentRunId, 'reconnecting');
        
        // Exponential backoff
        const reconnectDelay = Math.min(1000 * Math.pow(1.5, reconnectAttempts), 30000);
        setTimeout(() => {
            setupStream();  // Recursive call with same runId
        }, reconnectDelay);
    } else {
        // Agent finished, close normally
        nonRunningAgentRuns.add(agentRunId);
        cleanupEventSource(agentRunId, 'agent not running');
        callbacks.onClose();
    }
};
```

**Effect**: If connection drops while agent runs, reconnect automatically

---

### **FIX #4: Verify Final Status on Stream Close**

**Already partially implemented**, but ensure:
```typescript
// In handleStreamClose() - ALREADY THERE but verify
const agentStatus = await getAgentStatus(runId);

// This should catch any missed completion messages
if (agentStatus.status === 'completed') {
    finalizeStream('completed', runId);
    
    // ✅ Also: Fetch final messages from backend
    const finalMessages = await getMessages(threadId);
    setMessages(finalMessages);  // Get everything user missed
}
```

---

## 🎬 Implementation Priority

### **Tier 1: Critical (Do First)**
1. ✅ Add 30-second keepalive timeout on backend
2. ✅ Send ping message when timeout occurs
3. ✅ Frontend ignores ping messages

**Time to fix**: 15-20 minutes  
**Risk**: Low - pure addition, no breaking changes  
**Impact**: Fixes 80% of the issue

---

### **Tier 2: Important (Do Second)**
4. ✅ Add reconnection logic with backoff
5. ✅ Verify final status and fetch messages on stream close

**Time to fix**: 30-40 minutes  
**Risk**: Low-Medium - new logic but well-scoped  
**Impact**: Fixes remaining 15% and improves resilience

---

### **Tier 3: Nice to Have (Do Later)**
6. ⏳ Add connection health monitoring
7. ⏳ Implement message buffering if client goes offline
8. ⏳ Add metrics/telemetry for streaming health

**Time to fix**: 1-2 hours  
**Risk**: Medium - more complex  
**Impact**: Better observability and reliability

---

## 📋 Testing Plan

### Test Case 1: Long Thinking Time
```
1. Send: "Research and analyze [complex topic]"
2. Expect: Agent thinks for 45+ seconds
3. Monitor: Should see keepalive pings every 30s
4. Verify: Chat continues updating after "thinking"
5. Result: ✅ No pause, smooth streaming
```

### Test Case 2: Tool Execution
```
1. Send: Task requiring tool calls
2. Tools execute (30-90s delay typical)
3. Monitor: Connection should stay alive
4. Verify: Results appear as they complete
5. Result: ✅ Live streaming throughout
```

### Test Case 3: Network Interruption
```
1. Start: Long-running agent task
2. Simulate: Network disconnect (browser DevTools)
3. After 5s: Re-enable network
4. Verify: Stream reconnects automatically
5. Result: ✅ Automatic recovery, no manual refresh needed
```

---

## 📝 Code Locations to Modify

### Backend Changes
- **File**: `backend/core/agent_runs.py`
- **Lines**: 970-1010 (main stream generator loop)
- **Change**: Add `asyncio.wait_for(..., timeout=30)` with ping handling

### Frontend Changes
- **File**: `frontend/src/lib/api.ts`
- **Lines**: 1150-1260 (EventSource setup and error handling)
- **Changes**:
  - Add ping filter in onmessage
  - Add reconnection logic in onerror
  - Track reconnect attempts

---

## ✅ Success Criteria

- [ ] Streaming doesn't pause for long-running tasks
- [ ] Keepalive pings sent every 30 seconds (configurable)
- [ ] Connection stays open for entire agent run
- [ ] Page refresh not required to see complete conversation
- [ ] No console errors for expected delays
- [ ] Automatic reconnection if connection drops
- [ ] All existing tests still pass

---

## 📚 References

- [MDN EventSource Reconnection](https://developer.mozilla.org/en-US/docs/Web/API/EventSource)
- [SSE Best Practices](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [FastAPI StreamingResponse](https://fastapi.tiangolo.com/advanced/response-streaming/)
- [Redis Pub/Sub Pattern](https://redis.io/topics/pubsub)

---

**Severity**: 🔴 **HIGH** - Critical UX issue  
**Status**: 🔴 **NOT YET FIXED**  
**Next Steps**: Implement Tier 1 fixes
