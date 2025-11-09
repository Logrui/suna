# Infinite Loop Prevention - Quick Testing Guide

**Reference:** LOW Priority Issues Fixed on 2025-11-09

## Quick Test Procedures

### Test 1: ThreadContent getAgentInfo Callback (2-5 minutes)

**What to Check:** No excessive callback recreations

**Steps:**
1. Add temporary console.log in ThreadContent.tsx:
```typescript
const getAgentInfo = useCallback(() => {
  console.count('[DEBUG] getAgentInfo called'); // ADD THIS
  // ... rest of function
}, [threadMetadata, displayMessages, agentName, agentAvatar, agentMetadata, agentData]);
```

2. Open thread with multiple messages
3. Check console:
   - Should see `[DEBUG] getAgentInfo called: 1` (initial)
   - When new message arrives → count increases by 1
   - NOT increasing rapidly (not infinite loop)

4. Expected behavior:
   - Count increases with new messages
   - Rate is ~1-2 per message addition
   - No console errors

**Pass Criteria:** ✅ Consistent with user actions, no excessive calls

---

### Test 2: useToolCalls Reference Guard (2-5 minutes)

**What to Check:** Messages processed only once per change

**Steps:**
1. Add console.log in useToolCalls.ts:
```typescript
useEffect(() => {
  const messagesHaveChanged = lastProcessedMessagesRef.current !== messages;
  console.log('[DEBUG] messagesHaveChanged:', messagesHaveChanged, 'length:', messages.length);

  if (!messagesHaveChanged) {
    console.log('[DEBUG] Skipping message processing (same reference)');
    return;
  }
  // ... rest of effect
}, [messages, agentStatus, isMobile, compact]);
```

2. Open thread and send message
3. Check console pattern:
   ```
   [DEBUG] messagesHaveChanged: true length: 1
   [DEBUG] messagesHaveChanged: false length: 1
   [DEBUG] messagesHaveChanged: true length: 2
   [DEBUG] messagesHaveChanged: false length: 2
   ```

4. Expected: One `messagesHaveChanged: true` followed by `false` per message

**Pass Criteria:** ✅ Each message causes exactly one processing pass

---

### Test 3: Realtime-Client Singleton (3-10 minutes)

**What to Check:** Single WebSocket connection, no re-initializations

**Steps:**

#### 3A: Check Initialization Logs
1. Open DevTools Console
2. Hard refresh page
3. Look for initialization logs:
   ```
   [RealtimeManager] Initializing realtime client manager
   [RealtimeManager] Client created, URL: ...
   [RealtimeManager] ✅ Initial auth synced to realtime client
   [RealtimeManager] Initialization complete. Auth syncing is active.
   ```
4. **Should see these exactly ONCE, not repeated**

**Pass Criteria:** ✅ Initialization logs appear once per page load

#### 3B: Check Multiple Hooks
1. Open thread page (mounts useProjectRealtime)
2. Check logs - should NOT see initialization repeated
3. Try navigating away and back
4. Check logs - should NOT see new initialization

**Pass Criteria:** ✅ No duplicate initialization logs

#### 3C: Check WebSocket Connection
1. Open DevTools Network tab
2. Filter for "WS" (WebSocket)
3. Hard refresh page
4. Should see ONE WebSocket connection to realtime
5. Connection should stay open (not disconnect/reconnect)

**Pass Criteria:** ✅ Single persistent WebSocket connection

#### 3D: Check Auth Sync on Login
1. If logged in, log out
2. Watch console for:
   ```
   [RealtimeManager] Auth state changed: SIGNED_OUT
   [RealtimeManager] Auth cleared on SIGNED_OUT
   ```
3. Log back in
4. Watch console for:
   ```
   [RealtimeManager] Auth state changed: SIGNED_IN
   [RealtimeManager] ✅ Auth synced on event: SIGNED_IN
   [RealtimeManager] User: your@email.com
   ```
5. Should see exactly ONE sync log per login

**Pass Criteria:** ✅ Auth events trigger exactly one sync

---

## Automated Test Ideas (For Future)

### Unit Test Template

```typescript
// useToolCalls.test.ts
describe('useToolCalls - Reference Guard', () => {
  it('should skip processing when messages reference unchanged', () => {
    const messages = [{ type: 'user', content: 'Hello' }];
    const { rerender } = renderHook(
      (props) => useToolCalls(props.messages, jest.fn()),
      { initialProps: { messages } }
    );

    // Same reference, should skip
    rerender({ messages });

    // Should NOT call message processing logic
    expect(processMessagesCount).toBe(1); // Only initial call
  });

  it('should process when messages reference changes', () => {
    let messages = [{ type: 'user', content: 'Hello' }];
    const { rerender } = renderHook(
      (props) => useToolCalls(props.messages, jest.fn()),
      { initialProps: { messages } }
    );

    // New reference
    messages = [...messages, { type: 'assistant', content: 'Hi' }];
    rerender({ messages });

    // Should call processing logic
    expect(processMessagesCount).toBe(2); // Initial + new message
  });
});
```

### Integration Test Template

```typescript
// realtime-client.test.ts
describe('Realtime Client Singleton', () => {
  it('should return same instance on multiple calls', async () => {
    const mainClient = createTestClient();

    const client1 = await initializeRealtimeClient(mainClient);
    const client2 = getRealtimeClient();

    expect(client1).toBe(client2); // Same reference
  });

  it('should prevent re-initialization', async () => {
    const mainClient = createTestClient();
    const spy = jest.spyOn(mainClient.auth, 'getSession');

    await initializeRealtimeClient(mainClient);
    await initializeRealtimeClient(mainClient); // Second call

    // getSession should be called only once
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('should sync auth on state changes', async () => {
    const mainClient = createTestClient();
    const setSpy = jest.spyOn(realtimeClient.realtime, 'setAuth');

    await initializeRealtimeClient(mainClient);

    // Trigger auth change
    mainClient.auth.trigger('SIGNED_IN', testSession);

    await waitFor(() => {
      expect(setSpy).toHaveBeenCalledWith(testSession.access_token);
    });
  });
});
```

---

## Troubleshooting

### Issue: Console shows multiple initialization logs

**Possible causes:**
1. Page was hard-refreshed multiple times
2. AuthProvider is mounted multiple times (check app.tsx)
3. Hot module replacement caused re-mount

**What to do:**
- Check if logs are from different page loads
- Look at timestamps to confirm
- If same page load: investigate AuthProvider mounting

### Issue: useToolCalls processing runs constantly

**Possible causes:**
1. Parent component creating new messages array every render
2. Memoization not working in parent

**What to do:**
```typescript
// In parent component, check:
const messages = useMemo(() => [...], [...]); // Should use useMemo

// OR if passing directly:
// const messages = thread.messages; // Better than creating new array
```

### Issue: Multiple WebSocket connections

**Possible causes:**
1. Multiple realtime clients created
2. Module being imported multiple times

**What to do:**
1. Check imports: `from '@/lib/supabase/realtime-client'` (consistent path)
2. Verify AuthProvider initialization: should call `initializeRealtimeClient` once
3. Check React DevTools: Profiler → Components → ensure single AuthProvider

---

## Debug Commands (Browser Console)

```javascript
// Check current initialization state
import { getRealtimeClientAuthState } from '@/lib/supabase/realtime-client';
getRealtimeClientAuthState()

// Should output:
// {
//   initialized: true,
//   hasMainClientRef: true,
//   hasAuthListener: true,
//   wsUrl: "http://localhost:8000"
// }

// Count listener calls (if you added logging)
// Check console filter for "[RealtimeManager]" logs
// Count occurrences of each log type
```

---

## Expected Behavior Summary

### ThreadContent
- ✅ getAgentInfo called once per message change
- ✅ No infinite loops in console
- ✅ Agent avatar/name updates correctly

### useToolCalls
- ✅ Messages processed once per content change
- ✅ Reference guard skips redundant processing
- ✅ Tool calls appear exactly once in panel

### Realtime-Client
- ✅ Single WebSocket connection per session
- ✅ One initialization per app load
- ✅ Auth syncs exactly once per login/logout
- ✅ Multiple subscriptions work simultaneously

---

**All Tests Passing?** ✅
**Ready to Deploy:** Yes

For detailed explanation of why these patterns are safe, see: `VERIFICATION_AND_DOCUMENTATION_FIX.md`
