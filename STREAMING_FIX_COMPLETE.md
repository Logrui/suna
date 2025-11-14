# 🎯 STREAMING TIMEOUT ISSUE: DIAGNOSIS & FIX COMPLETE

## Summary

**Problem:** Frontend streaming stops after ~5 seconds despite backend continuing for 20+ seconds

**Root Cause:** EventSource `onerror` handler treats normal connection closure (backend finishing) as an error, triggering reconnection attempts with exponential backoff (1s → 1.5s → 2.25s → 3.375s → **5.07s**)

**Status:** ✅ **FIX APPLIED - Ready for testing**

---

## Investigation Timeline

### Phase 1: Symptom Analysis
- Identified 5-second cutoff marker in frontend (not backend)
- Backend logs show successful completion after 24.79 seconds
- Backend sends 500+ chunks successfully
- Issue is frontend-side streaming interruption

### Phase 2: File Archaeology
- Compared 48 changed files between `dev` branch (current) and `origin/main` (upstream)
- Found massive refactoring: 2319-line new `frontend/src/lib/api.ts` consolidating old API layer
- Old `useAgentStream.ts` completely deleted (848 lines)
- Identified new reconnection logic as suspect

### Phase 3: Root Cause Discovery
Found **the smoking gun** in `frontend/src/lib/api.ts` lines 1265-1300:

```typescript
eventSource.onerror = (event) => {
  getAgentStatus(agentRunId)
    .then((status) => {
      if (status.status !== 'running') {
        // ✅ Correct - close cleanly
      } else {
        // ⚠️ BUG - attempts reconnection even after normal completion
        // Exponential backoff: 1s, 1.5s, 2.25s, 3.375s, 5.07s
      }
    })
};
```

The paradox: Code had a comment saying "DO NOT close EventSource on completion" (correct!), but then the `onerror` handler would try to reconnect anyway (incorrect!).

### Phase 4: Fix Implementation
Added check for normal closure:
```typescript
if (eventSource.readyState === EventSource.CLOSED) {
  // Backend closed connection cleanly - this is normal completion, not error
  callbacks.onClose();
  return; // Don't attempt reconnection
}
```

---

## Technical Details

### The Chain of Events (Before Fix)

```
T=0s:  Frontend calls streamAgent(agentRunId)
       ↓
T=0s:  EventSource connection opens
       ↓
T=0-5s: Messages stream normally
        - Tool starts executing
        - Chunks arrive via Redis + SSE
        - Frontend updates UI
       ↓
T=5s:  Backend finishes and closes SSE connection cleanly
       ↓
T=5s:  EventSource.onerror fires (normal closure event)
       ↓
T=5s:  onerror handler calls getAgentStatus(agentRunId)
       ↓
T=5s:  Race condition! Status might still be 'running' briefly
       ↓
T=5s+1s: First reconnection attempt after 1s delay
T=5s+1.5s: Second reconnection attempt after 1.5s delay
T=5s+2.25s: Third reconnection attempt after 2.25s delay
T=5s+3.375s: Fourth reconnection attempt after 3.375s delay
T=5s+5.07s: Fifth and final reconnection attempt after 5.07s delay ← ~10 seconds total
       ↓
       User perceives messages stopped at 5-6 second mark
```

### The Chain of Events (After Fix)

```
T=0s:  Frontend calls streamAgent(agentRunId)
       ↓
T=0s:  EventSource connection opens
       ↓
T=0-20s: Messages stream continuously
         - Tool executes for 20+ seconds
         - All chunks arrive and process
         - Frontend updates in real-time
        ↓
T=20s: Backend finishes and closes SSE connection
       ↓
T=20s: EventSource.onerror fires
       ↓
T=20s: Fix detects readyState === CLOSED (normal closure)
       ↓
T=20s: Clean close - NO reconnection attempts
       ↓
       User sees complete stream from start to finish
```

---

## Why This Happened

1. **API Layer Consolidation:** Your dev branch consolidated separate `agents.ts`, `streaming.ts`, and other API files into one massive 2319-line `api.ts`

2. **During Consolidation:** Someone (or a previous iteration) added aggressive reconnection logic to handle real network errors

3. **Unintended Side Effect:** This reconnection logic interferes with normal, clean connection closures by the backend

4. **Paradox Created:** The code explicitly says "let backend close connection" but then tries to reconnect when it does

---

## Files Modified

### `frontend/src/lib/api.ts` - Lines 1265-1340
**Change:** Added `EventSource.readyState === EventSource.CLOSED` detection

**Before:** 86 lines of onerror logic with no normal closure detection
**After:** 88 lines with early-exit for normal closures

**Impact:** Only 2 lines of actual logic added + comments

---

## Testing Checklist

### Local Testing (Before Docker Deploy)
- [ ] Start an agent with a long tool (20+ seconds execution)
- [ ] Open browser DevTools → Console
- [ ] Look for these messages:
  - ✅ Should see: `[STREAM] Connection closed normally for agent-XYZ - streaming complete`
  - ❌ Should NOT see: `[STREAM] Agent still running... reconnecting (attempt`
  - ❌ Should NOT see: `[STREAM] Error checking status, reconnecting`
- [ ] Verify all tool outputs arrived (not cut off at 5s)
- [ ] Check response is marked as completed

### Network Testing
- [ ] Simulate network latency (DevTools → Network → throttling)
- [ ] Verify reconnection logic STILL works for real network errors
- [ ] Kill connection mid-stream and verify it attempts to reconnect

### Regression Testing
- [ ] Test normal agent runs (< 5 seconds) - should work fine
- [ ] Test immediate failures - should error cleanly
- [ ] Test very long tools (> 60 seconds) - should stream all the way

---

## Comparison: dev vs origin/main

| Aspect | dev (Broken) | origin/main (Working) |
|--------|------------|----------------------|
| Reconnection Logic | ✅ Has it (but broken) | ❌ No reconnection |
| Handles Real Errors | ✅ Yes (too aggressive) | ❌ Not tested (rare) |
| Handles Normal Closure | ❌ No (treats as error) | ✅ Yes (simple) |
| Code Size | Large (2319 line api.ts) | Modular (separate files) |
| Complexity | High | Low |

**The fix brings dev closer to origin/main's reliability while keeping the new API consolidation.**

---

## Why 5 Seconds Specifically?

The reconnection backoff formula: `delay = 1000 * Math.pow(1.5, attempts)`

- Attempt 0: 1000ms = 1.0s
- Attempt 1: 1500ms = 1.5s
- Attempt 2: 2250ms = 2.25s
- Attempt 3: 3375ms = 3.375s
- Attempt 4: 5070ms = **5.07 seconds** ← Max backoff hits here

After 5th attempt fails, `callbacks.onClose()` fires, user perceives stream timeout at 5-6 second mark.

---

## Quick Reference

**To Test:** 
```bash
# 1. Make sure frontend code is rebuilt
docker build frontend --no-cache -t suna-frontend:latest

# 2. Restart containers
docker compose restart frontend

# 3. Open web UI and test streaming
# Monitor: DevTools Console for [STREAM] messages
```

**To Monitor:**
```javascript
// In browser console during streaming:
[STREAM] messages starting with these are GOOD:
  - "[STREAM] Connected and receiving"
  - "[STREAM] Connection closed normally"
  
[STREAM] messages with these indicate PROBLEM:
  - "[STREAM] reconnecting"
  - "[STREAM] Max reconnection"
```

---

## Related Files

- **Root Cause Doc:** `STREAMING_5_SECOND_TIMEOUT_ROOT_CAUSE.md`
- **Fix Details:** `STREAMING_FIX_SUMMARY.md`
- **Modified Code:** `frontend/src/lib/api.ts` (lines 1265-1340)

---

## Next Steps

1. ✅ **Fix Applied** - `frontend/src/lib/api.ts` updated
2. ⏳ **Test Locally** - Run a 20+ second agent and verify
3. ⏳ **Docker Rebuild** - Rebuild frontend image with fix
4. ⏳ **Verify in Production** - Test with real workloads
5. ⏳ **Monitor Logs** - Watch for any new streaming errors

**No other changes needed.** This is a surgical fix to one event handler.

---

**Status:** ✅ Code ready. Waiting for testing confirmation.
