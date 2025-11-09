# Verification & Testing Checklist - All Fixes

## Status Summary

✅ **WebSocket HTTPS (wss://)** - Deployed  
✅ **Singleton Realtime Auth Sync** - Deployed  
✅ **LLM Response Message Handler** - Deployed  
✅ **Activity Timeout Extension** - Deployed (120s computation timeout)  

**Backend Status**: Running with all fixes  
**Frontend Status**: Latest build with all fixes  
**Deployment Time**: 2025-11-09 06:13:56 UTC  

---

## Critical Test: Activity Timeout Fix (Fix #4)

This is the most important fix to validate. The 120-second computation timeout should allow file creation operations to complete.

### Test Scenario: File Creation (Reproduces Original Issue)

**Setup**:
1. Open Suna at: https://kortix.syhc.dev
2. Start a new chat
3. Request: "Create a file called test.txt in my home directory with the content 'Hello World'"

**Expected Behavior (Post-Fix)**:
- ✅ Spinner continues for 30-60+ seconds (NO timeout at 35s)
- ✅ File successfully created in sandbox environment
- ✅ Stream completes with full response (not "Success" with no content)
- ✅ Response visible immediately after completion (not delayed)
- ✅ Total duration: 40-70 seconds (depending on sandbox performance)

**Expected Behavior (If Bug Still Present)**:
- ❌ Spinner shows for ~12 seconds
- ❌ Changes to "Success" without content
- ❌ File may or may not be created
- ❌ Stream terminates at exactly 35 seconds

---

## Secondary Tests: Other Fixes

### Test 1: WebSocket Security (Fix #1)

**In Browser DevTools (F12) → Network Tab**:
1. Refresh page
2. Look for WebSocket connection
3. Filter by "ws" in the network panel

**Expected Results**:
- ✅ Connection shows as `wss://kortix.syhc.dev/realtime/v1` (HTTPS protocol)
- ✅ Status shows "101 Web Socket Protocol Handshake" (green)
- ✅ Only ONE WebSocket connection (not multiple)
- ✅ No mixed-content security warnings in console

**Browser Console Check**:
```javascript
// Should show secure connection
localStorage.getItem('supabase.auth.token') // Has token
```

---

### Test 2: Realtime Auth Sync (Fix #2)

**In Browser DevTools Console**:

```javascript
// Look for [RealtimeManager] debug logs
// Should see similar output on page load:
// [RealtimeManager] Initialized realtime client
// [RealtimeManager] Listening for auth state changes
// [RealtimeManager] Synchronized auth token on event: INITIAL_SESSION
```

**Expected Results**:
- ✅ Multiple [RealtimeManager] logs appear
- ✅ No "subject must not be null" errors in console
- ✅ Realtime subscriptions succeed (data appears in UI)
- ✅ On token refresh: "Synchronized auth token on event: TOKEN_REFRESHED"

**How to Trigger Token Refresh**:
- Wait 1 hour, then refresh page, or
- Manually trigger in console: `await supabaseClient.auth.refreshSession()`

---

### Test 3: Message Handler (Fix #3)

**In Browser DevTools Console**:

```javascript
// Should see debug logs like:
// [useAgentStream] Received message type: llm_response_start
// [useAgentStream] Received message type: llm_response
// [useAgentStream] Received message type: tool_use
// [useAgentStream] Received message type: tool_result
// [useAgentStream] Received message type: status
```

**Expected Results**:
- ✅ No "Unhandled message type" warnings
- ✅ Debug logs show all message types being processed
- ✅ Chat responses appear normally (no missing content)

---

## Activity Timeout Verification (Deep Dive)

### Backend Log Analysis

**What to Look For** (after running file creation test):

```bash
# In backend logs, you should see:
# 1. Task classification
"📋 Task classified as: computation (timeout: 120s)"

# 2. Auto-continue iterations (if tool takes very long)
"🔄 Auto-continue iteration 1/25"

# 3. Tool execution start
"Tool call: file_ops"

# 4. Tool execution completion
"Tool result received: file_ops"

# 5. NO activity timeout (with new fix)
# Should NOT see: "⏱️ Auto-continue: Activity timeout after XXs"

# 6. Normal completion
"Agent run completed normally"
"Detected run completion via status message: completed"
```

**Command to Check**:
```bash
cd d:\Homelab\suna
docker compose logs backend --since 5m 2>&1 | Select-String "classified|timeout|activity|file"
```

**If timeout fix working**: You'll see "timeout: 120s"  
**If timeout fix failing**: You'll see "timeout: 30s" or no timeout message

---

## Files to Verify

### 1. Check run.py Has New Timeouts

```bash
cd d:\Homelab\suna\backend
grep -A5 "_get_timeout_for_task" core/run.py
```

**Expected Output**:
```
def _get_timeout_for_task(task_type: str) -> int:
    """Get adaptive timeout based on task type"""
    timeouts = {
        'research': 60,      # 6x increase
        'computation': 120,  # 4x increase ← KEY
        'writing': 90,       # 4.5x increase
        'general': 60        # 4x increase
```

### 2. Verify Frontend Singleton

```bash
cd d:\Homelab\suna\frontend
grep -n "getRealtimeClient\|RealtimeManager" src/components/AuthProvider.tsx
grep -n "getRealtimeClient" src/hooks/useProjectRealtime.ts
```

**Expected**: Multiple results showing singleton pattern usage

### 3. Check llm_response_start Handler

```bash
cd d:\Homelab\suna\frontend
grep -n "llm_response_start" src/hooks/useAgentStream.ts
```

**Expected**: Results showing handler added

### 4. Verify wss:// Configuration

```bash
cd d:\Homelab\suna
grep -n "NEXT_PUBLIC_REALTIME_URL" docker-compose.yaml
grep -n "NEXT_PUBLIC_REALTIME_URL" frontend/Dockerfile
```

**Expected**: Shows wss:// URLs

---

## Testing Checklist

### Before Testing
- [ ] Backend running (`docker compose ps` shows backend healthy)
- [ ] Frontend built with latest changes
- [ ] No pending git changes that affect these fixes
- [ ] Browser DevTools available (F12)

### Core Test: File Creation (20 minutes)
- [ ] Open https://kortix.syhc.dev
- [ ] Start new chat
- [ ] Request file creation (30-60 second task)
- [ ] Spinner continues past 35 seconds (NO premature timeout)
- [ ] File successfully created
- [ ] Response complete and visible

### WebSocket Test (5 minutes)
- [ ] DevTools Network tab shows wss:// connection
- [ ] Single WebSocket connection (not multiple)
- [ ] HTTP 101 status
- [ ] No mixed-content warnings

### Realtime Test (5 minutes)
- [ ] Console shows [RealtimeManager] logs
- [ ] No RLS errors
- [ ] Realtime data updates appearing in UI

### Message Handler Test (5 minutes)
- [ ] Send chat message
- [ ] Console shows debug logs for all message types
- [ ] No "Unhandled message type" warnings
- [ ] Response appears correctly

### Long-Running Task Test (30 minutes - optional, validates timeout)
- [ ] Request complex file operation (>60 seconds)
- [ ] Verify stream completes successfully
- [ ] Confirm no timeout at original 35-second mark
- [ ] Verify response includes all content

---

## Success Criteria

✅ **All tests pass** = Ready for production

### Minimum (Pass Grade)
- File creation test: Stream continues >35s
- No security warnings (wss://)
- No RLS errors (Realtime working)
- No console errors

### Ideal (Excellent Grade)
- File creation test: Completes successfully
- WebSocket: Single connection, wss://, 101 status
- Realtime: All [RealtimeManager] logs present
- Message handler: All types processed, no warnings
- Activity timeout: Logs show 120s timeout value

---

## Troubleshooting Guide

### Issue: Still seeing 35-second timeout

**Debug Steps**:
1. Verify backend is running the new code:
   ```bash
   docker compose logs backend | grep "_get_timeout_for_task"
   ```
2. If not found, rebuild with --no-cache:
   ```bash
   docker compose build backend --no-cache
   ```
3. Check that run.py was edited correctly (grep for "120")

### Issue: WebSocket still showing ws:// (not wss://)

**Debug Steps**:
1. Clear browser cache (Cmd+Shift+Delete on Windows/Chrome)
2. Verify docker-compose.yaml has NEXT_PUBLIC_REALTIME_URL
3. Rebuild frontend: `docker compose build frontend --no-cache`
4. Restart frontend: `docker compose up -d frontend`

### Issue: RLS errors still appearing

**Debug Steps**:
1. Check console for [RealtimeManager] logs
2. Verify realtime-client.ts exists and has syncAuthToRealtime function
3. Check AuthProvider.tsx calls getRealtimeClient on mount
4. Refresh browser and check for "Synchronized auth token" log

### Issue: Stream still stopping early despite fixes

**Debug Steps**:
1. Check backend logs for activity timeout message
2. Verify task was classified correctly (should be "computation")
3. Check tool execution didn't fail silently
4. Try with simpler operation first (create small file) to isolate issue

---

## Deployment Checklist

Before merging to main/dev:
- [ ] All verification tests pass
- [ ] No new errors in backend/frontend logs
- [ ] Backend performance acceptable (CPU/memory)
- [ ] Frontend performance acceptable (page load time)
- [ ] 24+ hours of stability testing complete
- [ ] Rollback plan reviewed and understood

---

## Rollback Instructions (If Needed)

### Quick Rollback (5 minutes)

**For Activity Timeout** (Fix #4):
```bash
# Edit backend/core/run.py, change:
# 'computation': 120 → 'computation': 30
# Then rebuild and restart backend
docker compose build backend --no-cache
docker compose up -d backend
```

**For Realtime Auth** (Fix #2):
```bash
# Edit frontend hooks to not use singleton:
# useProjectRealtime.ts: create instance instead of getRealtimeClient()
# Then rebuild frontend
docker compose build frontend --no-cache
docker compose up -d frontend
```

**For WebSocket HTTPS** (Fix #1):
```bash
# Remove NEXT_PUBLIC_REALTIME_URL from docker-compose.yaml
# Rebuild frontend
docker compose build frontend --no-cache
docker compose up -d frontend
```

---

**Testing Ready**: ✅ All systems deployed and running  
**Next Step**: Execute file creation test to validate activity timeout fix  
**Estimated Duration**: 1-2 hours for full verification suite  
