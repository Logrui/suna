# Realtime Auth Sync Implementation Plan

**Date**: November 8, 2025  
**Status**: Ready for Implementation  
**Priority**: HIGH (blocks realtime features)

---

## Executive Summary

The PostgreSQL realtime subscription failures ("invalid column for filter project_id") are caused by **authentication context mismatch** between two Supabase clients:

- **Main Client** (`createClient()`): REST API, manages auth, has session
- **Realtime Client** (`createRealtimeClient()`): WebSocket, does NOT manage auth, isolated

Each hook creates its own realtime client instance, and none receive the auth token from the main client. Result: RLS policies fail because queries appear unauthenticated.

**Solution**: Create a singleton realtime client that auto-syncs auth from main client.

---

## Root Cause Analysis

### Current Architecture (BROKEN)

```
AuthProvider (React Context)
  ├─ Creates: mainClient = createClient()
  │  ├─ Uses: window.location.origin (proxied through Next.js)
  │  ├─ Manages: auth session state
  │  └─ onAuthStateChange(): Updates session in React state
  │
  └─ Provides: { supabase, session, user } to all components

useProjectRealtime Hook
  ├─ Creates: realtimeClient = createRealtimeClient()
  │  ├─ Uses: process.env.NEXT_PUBLIC_REALTIME_URL (direct to Kong, bypasses Next.js)
  │  ├─ Config: persistSession: false, autoRefreshToken: false
  │  ├─ Comment: "use main client for that"
  │  └─ ❌ NO CONNECTION to AuthProvider's session
  │
  └─ Subscribes: postgres_changes on 'projects' table
     └─ ❌ FAILS: RLS sees unauthenticated user

useVapiCallRealtime Hook
  ├─ Creates: realtimeClient = createRealtimeClient() ← Different instance!
  │  └─ ❌ ALSO NO CONNECTION to auth
  │
  └─ Subscribes: postgres_changes on 'vapi_calls' table
     └─ ❌ ALSO FAILS: RLS sees unauthenticated user

MonitorCallToolView Component
  ├─ Creates: realtimeClient = createRealtimeClient() ← Yet another instance!
  │  └─ ❌ ALSO NO CONNECTION to auth
  │
  └─ Subscribes: postgres_changes on 'vapi_calls' table
     └─ ❌ ALSO FAILS: RLS sees unauthenticated user
```

### Why RLS Fails

RLS SELECT policy on `projects` table:
```sql
is_public OR 
basejump.has_role_on_account(account_id) OR 
auth.jwt()->>'email' ~~ '%@kortix.ai' OR 
admin
```

RLS SELECT policy on `vapi_calls` table:
```sql
thread_id IN (SELECT id FROM user's threads)
```

**Both policies require authentication context from JWT in the session.**

When realtime client (with no auth) tries to subscribe, `auth.jwt()` is null, `basejump.has_role_on_account()` can't check memberships, and subscription is rejected by RLS.

---

## Solution Architecture

### New Realtime Client Manager

**File**: `frontend/src/lib/supabase/realtime-client.ts`

```typescript
/**
 * Realtime Client Manager
 * 
 * Maintains a SINGLETON realtime client instance that:
 * 1. Connects directly to Kong (bypasses Next.js HTTP proxy)
 * 2. Auto-syncs auth token from main Supabase client
 * 3. Handles token refresh automatically
 * 4. Used by all realtime subscription hooks
 */

let realtimeClientInstance: SupabaseClient | null = null;
let mainClientReference: SupabaseClient | null = null;
let authUnsubscribe: (() => void) | null = null;

/**
 * Initialize realtime client with auth syncing
 * Called once from AuthProvider after main client is ready
 */
export async function initializeRealtimeClient(mainClient: SupabaseClient): Promise<SupabaseClient> {
  if (realtimeClientInstance) {
    console.log('[RealtimeManager] Realtime client already initialized');
    return realtimeClientInstance;
  }

  mainClientReference = mainClient;
  
  // Create realtime client pointing directly to Kong
  const realtimeUrl = 
    process.env.NEXT_PUBLIC_REALTIME_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    'http://localhost:8888';

  console.log('[RealtimeManager] Initializing with URL:', realtimeUrl);

  realtimeClientInstance = createSupabaseClient(
    realtimeUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      realtime: {
        params: {
          eventsPerSecond: 1000,
        },
      },
    }
  );

  // PHASE 1: Sync initial auth
  try {
    const { data: { session }, error } = await mainClient.auth.getSession();
    if (error) {
      console.warn('[RealtimeManager] Failed to get initial session:', error);
    } else if (session?.access_token) {
      await realtimeClientInstance.realtime.setAuth(session.access_token);
      console.log('[RealtimeManager] ✅ Initial auth synced');
      console.log('[RealtimeManager] User:', session.user?.email, 'Token:', session.access_token.substring(0, 20) + '...');
    } else {
      console.log('[RealtimeManager] No initial session (user not logged in yet)');
    }
  } catch (err) {
    console.error('[RealtimeManager] Failed to sync initial auth:', err);
  }

  // PHASE 2: Listen to all auth changes and sync token
  authUnsubscribe = mainClient.auth.onAuthStateChange(async (event, session) => {
    console.log('[RealtimeManager] Auth state changed:', event);

    if (session?.access_token) {
      try {
        await realtimeClientInstance.realtime.setAuth(session.access_token);
        console.log('[RealtimeManager] ✅ Auth synced on', event);
        console.log('[RealtimeManager] User:', session.user?.email, 'Token:', session.access_token.substring(0, 20) + '...');
      } catch (err) {
        console.error('[RealtimeManager] Failed to sync auth:', err);
      }
    } else {
      console.log('[RealtimeManager] Auth cleared on', event, '(user signed out or session expired)');
    }
  }).data.subscription;

  console.log('[RealtimeManager] Initialization complete. Auth syncing active.');
  return realtimeClientInstance;
}

/**
 * Get the singleton realtime client instance
 * Ensures all hooks use the same authenticated connection
 */
export function getRealtimeClient(): SupabaseClient {
  if (!realtimeClientInstance) {
    throw new Error(
      '[RealtimeManager] Realtime client not initialized. ' +
      'This usually means AuthProvider has not mounted yet. ' +
      'Ensure your components are wrapped with AuthProvider.'
    );
  }
  return realtimeClientInstance;
}

/**
 * Cleanup (for testing/unmount)
 */
export function cleanupRealtimeClient() {
  if (authUnsubscribe) {
    authUnsubscribe();
  }
  realtimeClientInstance = null;
  mainClientReference = null;
}
```

---

## Implementation Steps

### Phase 1: Create Realtime Client Manager (File: realtime-client.ts)

✅ Create `frontend/src/lib/supabase/realtime-client.ts` with above code

**Files Modified**: 1 (new file)  
**Testing**: Unit test the singleton pattern, verify no multiple instances

---

### Phase 2: Update AuthProvider

**File**: `frontend/src/components/AuthProvider.tsx`

```typescript
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import { initializeRealtimeClient } from '@/lib/supabase/realtime-client';  // ← ADD THIS
import { User, Session } from '@supabase/supabase-js';
import { SupabaseClient } from '@supabase/supabase-js';
import { clearUserLocalStorage } from '@/lib/utils/clear-local-storage';

type AuthContextType = {
  supabase: SupabaseClient;
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const supabase = createClient();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const getInitialSession = async () => {
      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        // ✨ NEW: Initialize realtime client with auth syncing
        try {
          await initializeRealtimeClient(supabase);
          console.log('[AuthProvider] Realtime client initialized with auth syncing');
        } catch (err) {
          console.error('[AuthProvider] Failed to initialize realtime client:', err);
        }

      } catch (error) {
        console.error('[AuthProvider] Failed to get initial session:', error);
      } finally {
        setIsLoading(false);
      }
    };

    getInitialSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (isLoading) setIsLoading(false);
        switch (event) {
          case 'SIGNED_IN':
            break;
          case 'SIGNED_OUT':
            clearUserLocalStorage();
            break;
          case 'TOKEN_REFRESHED':
            break;
          case 'MFA_CHALLENGE_VERIFIED':
            break;
          default:
        }
      },
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [supabase]);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      clearUserLocalStorage();
    } catch (error) {
      console.error('❌ Error signing out:', error);
    }
  };

  const value = {
    supabase,
    session,
    user,
    isLoading,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
```

**Key Changes**:
- Import `initializeRealtimeClient`
- Call it after getting initial session
- Add error handling with logging

**Files Modified**: 1  
**Testing**: Verify no errors in console, confirm realtime client init logs appear

---

### Phase 3: Update Realtime Hooks (3 Files)

#### File 1: `frontend/src/hooks/useProjectRealtime.ts`

```typescript
'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getRealtimeClient } from '@/lib/supabase/realtime-client';  // ← CHANGE: was createRealtimeClient
import { threadKeys } from '@/hooks/react-query/threads/keys';
import { Project } from '../app/(dashboard)/projects/[projectId]/thread/_types';

export function useProjectRealtime(projectId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!projectId) return;

    const supabase = getRealtimeClient();  // ← CHANGE: was createRealtimeClient()

    const channel = supabase
      .channel(`project-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          const newData = payload.new as Project;
          const oldData = payload.old as Project;
          if (newData?.sandbox && (!oldData?.sandbox || 
              JSON.stringify(newData.sandbox) !== JSON.stringify(oldData.sandbox))) {
            queryClient.invalidateQueries({
              queryKey: threadKeys.project(projectId)
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, queryClient]);
}
```

**Key Changes**:
- Change import: `getRealtimeClient` (not `createRealtimeClient`)
- Change call: `getRealtimeClient()` (not `createRealtimeClient()`)
- That's it! Everything else stays the same

---

#### File 2: `frontend/src/hooks/useVapiCallRealtime.ts`

```typescript
'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getRealtimeClient } from '@/lib/supabase/realtime-client';  // ← CHANGE

interface VapiCall {
  id: string;
  call_id: string;
  thread_id?: string;
  status: string;
  phone_number: string;
  duration_seconds?: number;
  transcript?: any;
  started_at?: string;
  ended_at?: string;
}

export function useVapiCallRealtime(callId?: string, threadId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!callId && !threadId) return;

    const supabase = getRealtimeClient();  // ← CHANGE

    // ... rest of code unchanged ...
  }, [callId, threadId, queryClient]);
}
```

---

#### File 3: `frontend/src/components/thread/tool-views/vapi-call/MonitorCallToolView.tsx`

Find the import line:
```typescript
import { createRealtimeClient } from '@/lib/supabase/client';  // ← OLD
```

Change to:
```typescript
import { getRealtimeClient } from '@/lib/supabase/realtime-client';  // ← NEW
```

Find the usage line:
```typescript
const supabase = createRealtimeClient();  // ← OLD
```

Change to:
```typescript
const supabase = getRealtimeClient();  // ← NEW
```

**Files Modified**: 3  
**Testing**: 
- No console errors
- Verify all hooks use same realtime client (check console logs, should see only one "Initializing with URL" message)

---

### Phase 4: Clean Up Old Code

**File**: `frontend/src/lib/supabase/client.ts`

Remove or deprecate `createRealtimeClient()` function.

Add comment:
```typescript
/**
 * @deprecated Use getRealtimeClient() from '@/lib/supabase/realtime-client.ts instead
 * 
 * Realtime client is now managed as a singleton and automatically syncs auth
 * from the main Supabase client.
 */
```

---

## Testing Strategy

### Test 1: Console Logs Verification (Quick)

**Procedure**:
1. Start app with realtime feature enabled
2. Open browser DevTools Console
3. Look for logs in this order:

```
[AuthProvider] Realtime client initialized with auth syncing
[RealtimeManager] Initializing with URL: https://kong.kortix.syhc.dev/
[RealtimeManager] ✅ Initial auth synced
[RealtimeManager] User: your@email.com Token: eyJ...
[useProjectRealtime] Setting up subscription for project-...
[Vapi Realtime] Setting up subscription for vapi-call-...
```

**Expected Result**: All logs appear, no errors

---

### Test 2: Single WebSocket Connection (DevTools)

**Procedure**:
1. Open DevTools → Network tab
2. Filter for WebSocket (wss://)
3. Trigger a realtime feature
4. Look at WebSocket requests

**Expected Result**: 
- ✅ Only ONE WebSocket connection to `/realtime/v1/websocket`
- ✅ NOT multiple connections (old behavior would create 1 per hook)
- ✅ Connection shows "101 Switching Protocols" (successful upgrade)

---

### Test 3: Realtime Update Flow (End-to-End)

**Procedure**:
1. Open browser to Suna app
2. Navigate to a page with realtime features (e.g., project editor or Vapi call monitor)
3. In another terminal, manually update the database:
   ```bash
   docker compose exec -T db psql -U postgres -d postgres -c "UPDATE projects SET sandbox = jsonb_set(sandbox, '{test}', '\"updated\"') WHERE project_id = '<your-project-id>';"
   ```
4. Watch UI - should update in real-time

**Expected Result**:
- ✅ UI updates immediately
- ✅ Console shows `[useProjectRealtime] Invalidating and refetching queries`
- ✅ No "invalid column" errors

---

### Test 4: Auth Token Refresh

**Procedure**:
1. Open DevTools Console
2. Trigger token refresh (wait ~1 hour or manually refresh)
3. Look for console logs

**Expected Result**:
```
[RealtimeManager] Auth state changed: TOKEN_REFRESHED
[RealtimeManager] ✅ Auth synced on TOKEN_REFRESHED
[RealtimeManager] User: your@email.com Token: eyJ...
```

---

### Test 5: Sign Out / Sign In

**Procedure**:
1. Open DevTools Console
2. Click Sign Out
3. Check console

**Expected Result**:
```
[RealtimeManager] Auth state changed: SIGNED_OUT
[RealtimeManager] Auth cleared on SIGNED_OUT
```

Sign in again:
```
[RealtimeManager] Auth state changed: SIGNED_IN
[RealtimeManager] ✅ Auth synced on SIGNED_IN
[RealtimeManager] User: your@email.com Token: eyJ...
```

---

### Test 6: Multiple Users

**Procedure**:
1. User A logs in → verify subscriptions work
2. Manually update database for User A's project
3. Verify User A's UI updates
4. User A logs out
5. User B logs in
6. Manually update database for User B's project (different ID)
7. Verify User B's UI updates
8. Verify User B does NOT see User A's data (RLS working)

**Expected Result**:
- ✅ Each user only sees their own data
- ✅ Auth syncs correctly on sign in/out
- ✅ No "invalid column" errors for either user

---

## Success Criteria

### Must-Have (Blocking)

- [ ] No "invalid column for filter project_id" errors in console
- [ ] Realtime subscriptions are accepted by database (no RLS rejection)
- [ ] Real-time updates appear in UI within 1-2 seconds
- [ ] Single WebSocket connection (not multiple)
- [ ] Auth syncs on page load
- [ ] Auth syncs on TOKEN_REFRESHED event
- [ ] Auth syncs on sign in/out

### Should-Have (Quality)

- [ ] Comprehensive logging with [RealtimeManager] prefix
- [ ] No "Multiple GoTrueClient instances detected" warning
- [ ] Graceful error handling if AuthProvider not mounted
- [ ] Token visible in console logs (redacted after first 20 chars)
- [ ] Tests pass for all scenarios

### Nice-to-Have (Future)

- [ ] Analytics on subscription success rate
- [ ] Automatic retry on auth sync failure
- [ ] Performance monitoring (WebSocket latency)

---

## Rollback Plan

If issues occur:

1. **Revert realtime-client.ts changes**:
   ```bash
   git checkout frontend/src/lib/supabase/realtime-client.ts
   ```

2. **Revert all hook changes back to `createRealtimeClient()`**

3. **Revert AuthProvider changes**

4. **Rebuild frontend**:
   ```bash
   docker compose build frontend --no-cache
   docker compose up -d frontend
   ```

---

## Documentation Updates Needed

After implementation:

1. Update `.docs/.initialsetup/9. supabase-realtime fix/README.md` with new architecture
2. Create implementation summary in this folder
3. Update code comments in client.ts about deprecation
4. Add troubleshooting guide for future auth issues

---

## Timeline

- **Phase 1**: 10 min (create realtime-client.ts)
- **Phase 2**: 5 min (update AuthProvider)
- **Phase 3**: 5 min (update 3 hooks)
- **Phase 4**: 2 min (cleanup)
- **Testing**: 20-30 min
- **Total**: ~1 hour

---

## Notes

- **Architecture remains**: Two separate clients (REST and WebSocket) are STILL needed due to Next.js proxy limitations
- **Only change**: Auth syncing between them, not consolidation
- **Performance**: Single WebSocket connection for all realtime subscriptions (better than before)
- **Debugging**: Comprehensive [RealtimeManager] logging helps with future issues

