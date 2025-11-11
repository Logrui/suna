# Realtime Auth Sync - Visual Architecture

## Before (BROKEN)

```
┌─────────────────────────────────────────────────────────────────┐
│                         React App                                │
│                                                                   │
│  ┌─ AuthProvider ──────────────────────────────────────────────┐ │
│  │                                                              │ │
│  │  mainClient = createClient()                               │ │
│  │  ├─ URL: window.location.origin (proxied by Next.js)      │ │
│  │  ├─ Auth: Manages session, token refresh                  │ │
│  │  └─ Auth Events: onAuthStateChange() fires               │ │
│  │                                                              │ │
│  │  [React State] session, user, isLoading                   │ │
│  │                                                              │ │
│  └──────────────────────────────────────────────────────────────┘ │
│           │                              │                        │
│           │                              │                        │
│    ┌──────▼──────┐          ┌────────────▼────────┐             │
│    │ useProject  │          │ useVapiCallRealtime │             │
│    │ Realtime    │          │                     │             │
│    └──────┬──────┘          └────────────┬────────┘             │
│           │                              │                        │
│           │ createRealtimeClient()       │ createRealtimeClient()│
│           │                              │                        │
│    ┌──────▼──────────────┐      ┌────────▼─────────────┐        │
│    │ Realtime Client #1  │      │ Realtime Client #2   │        │
│    ├─ URL: kong direct   │      ├─ URL: kong direct    │        │
│    ├─ Auth: ❌ NONE      │      ├─ Auth: ❌ NONE       │        │
│    └─────────────────────┘      └──────────────────────┘        │
│           │                              │                        │
└───────────┼──────────────────────────────┼─────────────────────┘
            │                              │
            │ wss:// (no auth token)       │ wss:// (no auth token)
            │                              │
    ┌───────▼──────────────────────────────▼──────────┐
    │  Supabase Realtime Service (Kong)               │
    │                                                  │
    │  Subscription:                                  │
    │  SELECT * FROM projects WHERE project_id = ?   │
    │                                                  │
    │  RLS Check:                                    │
    │  ❌ FAILS: basejump.has_role_on_account()      │
    │  ❌ Can't verify: no auth context              │
    │  ❌ Error returned: "invalid column for filter"│
    │                                                  │
    └──────────────────────────────────────────────────┘
            │
            │ ❌ Subscription rejected
            │
            ▼
    🚫 "PostgreSQL error: invalid column for filter project_id"
```

**PROBLEMS:**
- ❌ 2+ realtime clients created (one per hook)
- ❌ Each is isolated from auth system
- ❌ No token sync from main client to realtime clients
- ❌ RLS policies reject subscriptions (see unauthenticated user)
- ❌ Multiple WebSocket connections (wasteful)

---

## After (FIXED)

```
┌─────────────────────────────────────────────────────────────────┐
│                         React App                                │
│                                                                   │
│  ┌─ AuthProvider ──────────────────────────────────────────────┐ │
│  │                                                              │ │
│  │  mainClient = createClient()                               │ │
│  │  ├─ URL: window.location.origin (proxied by Next.js)      │ │
│  │  ├─ Auth: Manages session, token refresh                  │ │
│  │  └─ Auth Events: onAuthStateChange() fires               │ │
│  │           │                                                 │ │
│  │           │ initializeRealtimeClient(mainClient)          │ │
│  │           │                                                 │ │
│  │           ▼                                                 │ │
│  │  SINGLETON Realtime Client Manager                        │ │
│  │  ├─ Creates realtime client ONCE                          │ │
│  │  ├─ Syncs token from mainClient → realtimeClient         │ │
│  │  ├─ Listens: onAuthStateChange() on mainClient          │ │
│  │  ├─ Auto-updates: TOKEN_REFRESHED, SIGNED_IN, etc       │ │
│  │  └─ Provides: getRealtimeClient() getter                 │ │
│  │                                                              │ │
│  │  [React State] session, user, isLoading                   │ │
│  │                                                              │ │
│  └──────────────────────────────────────────────────────────────┘ │
│           │                              │                        │
│           │                              │                        │
│    ┌──────▼──────┐          ┌────────────▼────────┐             │
│    │ useProject  │          │ useVapiCallRealtime │             │
│    │ Realtime    │          │                     │             │
│    └──────┬──────┘          └────────────┬────────┘             │
│           │                              │                        │
│           │ getRealtimeClient()          │ getRealtimeClient()   │
│           │  (same instance)             │  (same instance)      │
│           │                              │                        │
│    └──────┴──────────────────────────────┘                      │
│           │                                                       │
│           │ Returns SAME singleton instance                    │
│           │                                                       │
│    ┌──────▼────────────────────────────┐                       │
│    │ Realtime Client (SINGLETON)       │                       │
│    ├─ URL: kong direct                 │                       │
│    ├─ Auth: ✅ SYNCED from mainClient │                       │
│    ├─ Token: Auto-updates on refresh  │                       │
│    └──────┬─────────────────────────────┘                       │
│           │                                                       │
└───────────┼───────────────────────────────────────────────────┘
            │
            │ wss:// + Authorization header with valid token
            │
    ┌───────▼──────────────────────────────┐
    │  Supabase Realtime Service (Kong)    │
    │                                       │
    │  Subscription:                       │
    │  SELECT * FROM projects WHERE ...    │
    │                                       │
    │  RLS Check:                         │
    │  ✅ Auth context present             │
    │  ✅ basejump.has_role_on_account()  │
    │     can verify user has access      │
    │  ✅ Query allowed                    │
    │                                       │
    └───────┬──────────────────────────────┘
            │
            │ ✅ Subscription accepted
            │
            ▼
    🎉 Real-time updates flow to UI
```

**IMPROVEMENTS:**
- ✅ 1 realtime client (singleton, shared by all hooks)
- ✅ Auth synced automatically
- ✅ Token refreshes handled automatically
- ✅ RLS policies pass (auth context present)
- ✅ Single WebSocket connection
- ✅ Same architectural constraints preserved (two clients for routing, not auth)

---

## Auth Sync Flow (Detailed Timeline)

```
User Opens App
│
├─ AuthProvider mounts
│  ├─ Creates mainClient = createClient()
│  └─ Calls getInitialSession()
│       │
│       ├─ mainClient.auth.getSession() → { user, session }
│       │
│       └─ initializeRealtimeClient(mainClient)
│            │
│            ├─ Creates realtimeClient (singleton)
│            │
│            ├─ Calls realtimeClient.realtime.setAuth(session.access_token)
│            │  └─ ✅ Token synced from mainClient
│            │
│            └─ Sets up listener: mainClient.auth.onAuthStateChange((event, session) => {
│                 ├─ On TOKEN_REFRESHED:
│                 │  └─ realtimeClient.realtime.setAuth(new_token)
│                 │
│                 ├─ On SIGNED_IN:
│                 │  └─ realtimeClient.realtime.setAuth(new_token)
│                 │
│                 └─ On SIGNED_OUT:
│                    └─ realtimeClient.realtime.setAuth(null)
│
├─ Component mounts with realtime hook
│  ├─ useProjectRealtime() or useVapiCallRealtime()
│  │
│  ├─ Calls getRealtimeClient()
│  │  └─ Returns singleton instance (already auth-synced) ✅
│  │
│  └─ Creates postgres_changes subscription
│     │
│     ├─ Sends to Kong: WITH valid auth token
│     │
│     ├─ Kong forwards to Supabase Realtime Service
│     │
│     ├─ RLS evaluates query
│     │  ├─ Checks: basejump.has_role_on_account(account_id)
│     │  ├─ With auth context: ✅ CAN CHECK
│     │  └─ Result: ✅ ALLOWED (user has access)
│     │
│     └─ ✅ Subscription accepted, updates start flowing

User signs out
│
├─ mainClient.auth.signOut()
│
├─ onAuthStateChange() fires with event='SIGNED_OUT', session=null
│
├─ realtimeClient.realtime.setAuth(null) called
│
├─ All active subscriptions cancelled (auth removed)
│
└─ User redirected to login

User signs in (another account)
│
├─ mainClient.auth.signIn() succeeds
│
├─ onAuthStateChange() fires with event='SIGNED_IN', session={...}
│
├─ realtimeClient.realtime.setAuth(new_token) called
│  └─ ✅ Token synced for new user
│
└─ Subscriptions now use NEW user's auth context

... (repeat forever, auto-sync on every auth event)
```

---

## Code Changes Summary

### 3 Files Modified + 1 Created

```
frontend/src/
├─ lib/supabase/
│  ├─ client.ts                          [MODIFY - remove createRealtimeClient]
│  └─ realtime-client.ts                 [CREATE - new singleton manager]
│
├─ components/
│  └─ AuthProvider.tsx                   [MODIFY - call initializeRealtimeClient]
│
└─ hooks/
   ├─ useProjectRealtime.ts              [MODIFY - use getRealtimeClient]
   ├─ useVapiCallRealtime.ts             [MODIFY - use getRealtimeClient]
   └─ ... (MonitorCallToolView.tsx also needs update)
```

### Changes Per File

| File | Change | Why |
|------|--------|-----|
| `realtime-client.ts` | **CREATE** | New singleton manager with auth sync |
| `client.ts` | Remove `createRealtimeClient()` | Moving to new manager |
| `AuthProvider.tsx` | Import + call `initializeRealtimeClient()` | Start auth sync on app load |
| `useProjectRealtime.ts` | `createRealtimeClient()` → `getRealtimeClient()` | Use singleton instead |
| `useVapiCallRealtime.ts` | `createRealtimeClient()` → `getRealtimeClient()` | Use singleton instead |
| `MonitorCallToolView.tsx` | `createRealtimeClient()` → `getRealtimeClient()` | Use singleton instead |

**Total Lines Changed**: ~50 lines (mostly imports and function calls)  
**Lines Added**: ~150 lines (new realtime-client.ts)  
**Risk Level**: ⚠️ LOW (changes are isolated, clear rollback path)

---

## Why This Works

### 1. Two Clients Are STILL Required
```
Main client (REST):
  Browser → Next.js HTTP proxy → Backend → Supabase REST API ✅

Realtime client (WebSocket):
  Browser → Kong DIRECTLY (can't proxy WebSocket) ✅
```
**No consolidation possible** due to Next.js architectural limitation.

### 2. Auth Sync Solves the Problem
```
Before: Realtime client created with NO auth
  → RLS sees unauthenticated user
  → Query rejected

After: Realtime client created WITH auth synced from main client
  → RLS sees authenticated user
  → Query allowed
```

### 3. Singleton Pattern Ensures Consistency
```
Old: Each hook creates own realtime client
  → Multiple WebSocket connections
  → Auth could diverge
  → Wasteful

New: All hooks share singleton realtime client
  → One WebSocket connection
  → Auth always synced
  → Efficient
```

### 4. Automatic Token Refresh
```
Main client auto-refreshes token:
  session.expires_in = 3600 (1 hour)
  After ~55 minutes → TOKEN_REFRESHED event fires
  
Our listener catches it:
  onAuthStateChange('TOKEN_REFRESHED', { new_token })
  → setAuth(new_token) on realtime client
  → All subscriptions now use new token ✅
```

---

## Success Metrics

After implementation, you should see:

### Console Logs
```
✅ [RealtimeManager] Initializing with URL: https://kong...
✅ [RealtimeManager] ✅ Initial auth synced
✅ [RealtimeManager] User: user@email.com Token: eyJ...
✅ [useProjectRealtime] Setting up subscription for project-...
✅ [Vapi Realtime] Setting up subscription for vapi-call-...
```

### Network (DevTools)
```
✅ Only 1 WebSocket connection
✅ URL: wss://kong.kortix.syhc.dev/realtime/v1/websocket
✅ Status: 101 Switching Protocols (connected)
```

### Functionality
```
✅ Real-time updates appear in UI within 1-2 seconds
✅ No "invalid column" errors
✅ Works after token refresh
✅ Works after sign in/out
```

---

## Debugging Quick Reference

| Issue | Check | Solution |
|-------|-------|----------|
| "Realtime client not initialized" error | `typeof window`, AuthProvider mounted | Wrap component with AuthProvider |
| No real-time updates | DevTools Network WebSocket | Check [RealtimeManager] logs for auth sync |
| Multiple WebSocket connections | DevTools Network filter "wss://" | Should only see 1, not 3 |
| "invalid column" error still appears | Browser console | Check token is actually synced in logs |
| Auth not syncing | AuthProvider component | Check initializeRealtimeClient is called |
| Token not updating on refresh | Browser console | Look for TOKEN_REFRESHED event log |

