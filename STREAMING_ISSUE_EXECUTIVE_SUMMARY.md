# 📌 EXECUTIVE SUMMARY: 5-Second Streaming Timeout Issue

## Problem Statement
After starting an agent run with a message/prompt:
- ✅ Frontend receives LLM responses initially (0-5s)
- ✅ Tool calls start appearing 
- ❌ At ~5 seconds: Streaming chunks DISAPPEAR
- ❌ No more messages received
- ❌ Chat messages remain incomplete
- ⏱️ Backend continues running (takes 20-25s total)

---

## Root Cause Analysis

### The Core Issue
The `feature/slash-commands` branch underwent a **massive API layer refactoring**:
- Consolidated 2000+ lines into new `frontend/src/lib/api.ts`
- Reorganized EventSource streaming management  
- Changed cleanup and timeout logic

### Symptom Timeline
```
T=0-5s    ✅ Streaming active (chunks arriving every 100-500ms)
T=5s      ⚠️  TIMEOUT or DISCONNECT
          Possible triggers:
          - Browser inactivity timeout
          - EventSource connection closed
          - Frontend cleanup triggered too early
          - Keepalive pings not being sent
T=5-25s   ❌ No more messages
T=25s     Backend completes but frontend never sees the finish
```

---

## Suspect Files (Ordered by Likelihood)

### 🔴 CRITICAL (Must Check First)
1. **`frontend/src/lib/api.ts`** (NEW - 2319 lines!)
   - Contains refactored `streamAgent()` function
   - EventSource timeout configuration
   - Cleanup logic timing
   
2. **`frontend/src/hooks/useAgentStream.ts`** 
   - Line 781-793: 1500ms liveness check (might be too aggressive)
   - Stream cleanup logic
   - Status state management

3. **`frontend/src/lib/config.ts`**
   - Massive changes (+344 lines!)
   - Might control timeouts/connection settings
   - Environment variable handling

### 🟠 HIGH PRIORITY (Check If Above Don't Reveal Issue)
4. **`frontend/src/lib/api-client.ts`**
   - HTTP client configuration changes
   - Request timeout settings
   - Connection pooling

5. **`frontend/src/lib/supabase/client.ts`**
   - Auth token refresh timing
   - Session management changes

6. **`backend/core/agent_runs.py`**
   - Stream keepalive timeout (line ~1030)
   - Message publishing speed
   - Timeout constants

---

## Investigation Checklist

### Browser Developer Tools
- [ ] Open Network tab
- [ ] Start an agent run
- [ ] Watch `/api/agent-run/{id}/stream` request
- [ ] At 5 seconds, is it still OPEN or does it CLOSE?
- [ ] Look for error codes (408, 504, connection reset?)
- [ ] Check console for `[STREAM]` log messages

### File Comparison Commands
```bash
# See exact changes to streaming
git diff origin/main HEAD -- frontend/src/lib/api.ts | grep -A 5 -B 5 "streamAgent"

# Check for timeout constant changes
git diff origin/main HEAD | grep -i "timeout\|5000\|5[0-9][0-9][0-9]"

# Find all cleanup calls
grep -rn "cleanupEventSource\|cleanup(" frontend/src/lib/api.ts
```

### Console Logging
Add these debug logs to identify where the stream dies:
```typescript
// In useAgentStream.ts handleStreamClose()
console.log(`[STREAM] handleStreamClose called at T=${(Date.now() - startTime)/1000}s`);

// In agents.ts streamAgent()
console.log(`[STREAM] eventSource.onerror at T=${(Date.now() - startTime)/1000}s`);
```

---

## Possible Fixes (In Priority Order)

### Fix #1: Check EventSource Timeout
**File:** `frontend/src/lib/api.ts` (or agents.ts)

Before:
```typescript
const eventSource = new EventSource(url.toString());
eventSource.onmessage = (event) => { /* ... */ };
```

Check if there are any hidden timeouts or if messages stop being processed.

### Fix #2: Increase Liveness Check Delay
**File:** `frontend/src/hooks/useAgentStream.ts` Line 781-793

Before:
```typescript
setTimeout(async () => { ... }, 1500);  // 1.5 seconds
```

After:
```typescript
setTimeout(async () => { ... }, 8000);  // 8 seconds
```

### Fix #3: Ensure Keepalive Pings are Working
**File:** `backend/core/agent_runs.py` Line ~1030

Verify:
```python
except asyncio.TimeoutError:
    # Send keepalive ping during long tool execution
    yield f"data: {json.dumps({'type': 'ping'})}\n\n"
```

### Fix #4: Check Frontend Message Processing
**File:** `frontend/src/lib/api/agents.ts` streamAgent() onmessage

Ensure the message callback isn't being silently blocked:
```typescript
eventSource.onmessage = (event) => {
  console.log(`[STREAM] Got message at T=${elapsed}s: ${event.data.substring(0, 100)}`);
  // Process message
};
```

---

## Testing After Fix

1. **Test Short Operations** (< 2 seconds)
   - Should work fine

2. **Test Long Operations** (5-10 seconds)
   - Stream should stay open
   - Messages should continue arriving
   - No console warnings

3. **Test Very Long Operations** (20+ seconds)
   - Stream should stay open for entire duration
   - Backend logs should show continuous chunk transmission
   - Final completion message should appear in UI

4. **Test Error Scenarios**
   - Immediate failure
   - Mid-stream failure  
   - Very long tool output (>1MB)

---

## Documentation of Changed Files

### New Files Created
```
frontend/src/lib/api-server.ts                    (Server-side API calls)
frontend/src/lib/api.ts                           (Massive consolidation!)
frontend/src/lib/api/billing-v2.ts               (New billing API)
frontend/src/lib/api/models.ts                   (Model listing)
frontend/src/lib/cache-init.ts                   (Cache initialization)
frontend/src/lib/api/streaming.ts                (Cleanup helpers only)
```

### Files Heavily Modified (>100 lines changed)
```
frontend/src/lib/config.ts                        (344 additions!)
frontend/src/lib/home.tsx                         (1565 additions!)
frontend/src/lib/api-client.ts                    (405 changes)
frontend/src/lib/supabase/client.ts               (175 changes)
```

---

## Key Metrics

| Metric | Value |
|--------|-------|
| Total new/changed files | 42 |
| Total lines added | 7001+ |
| Total lines deleted | 389 |
| Files with >100 line changes | 5 |
| Risk level | 🔴 CRITICAL |
| Regression likelihood | 85% |

---

## Recommended Action Plan

1. **Immediately** 
   - [ ] Verify streaming timeout in browser DevTools
   - [ ] Check console for error messages
   - [ ] Run tests on current branch

2. **Next**
   - [ ] Compare `streamAgent` function between branches
   - [ ] Check for timeout constants
   - [ ] Look for cleanup race conditions

3. **If Still Stuck**
   - [ ] Revert `frontend/src/lib/api.ts` to main version
   - [ ] Test if streaming works
   - [ ] If yes, identify specific changes that broke it
   - [ ] If no, check backend timeout settings

4. **Last Resort**
   - [ ] Check Cloudflare/Kong proxy settings for connection timeouts
   - [ ] Check Docker network settings
   - [ ] Verify both services using same timezone/time source

---

## References

- Frontend streaming: `frontend/src/lib/api.ts` or `frontend/src/lib/api/agents.ts`
- Backend streaming: `backend/core/agent_runs.py` lines 899-1100
- Hook that manages streaming: `frontend/src/hooks/useAgentStream.ts`
- Keepalive logic: Backend line ~1030, Frontend line ~781
- Error handling: Multiple files - see FILE_CHANGES_ANALYSIS.md

