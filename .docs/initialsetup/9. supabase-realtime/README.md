# Supabase Realtime in Suna App

**Last Updated**: November 3, 2025
**Status**: Documented - Configuration Issues Present
**Priority**: Medium (Not Critical for Core Functionality)

---

## Overview

Supabase Realtime enables **WebSocket-based real-time subscriptions** to database changes. In Suna, realtime is used to push live updates to the frontend when specific data changes in the database, creating a responsive, real-time user experience.

The `/realtime/v1/websocket` endpoint is the **WebSocket gateway** that clients connect to for receiving live updates.

---

## What Is Realtime Used For in Suna?

### 1. **Vapi Phone Call Monitoring** 🎧

**Hook**: `useVapiCallRealtime()` (`frontend/src/hooks/useVapiCallRealtime.ts`)

**Purpose**: Live updates for phone calls made through the Vapi integration

**Subscribes To**: `vapi_calls` table in PostgreSQL

**What It Monitors**:
- Call status changes (`in-progress` → `completed`, `ended`, `failed`, etc.)
- Real-time transcript updates as call is happening
- Duration and cost information
- Any INSERT, UPDATE, or DELETE events on the call

**Affected UI Components**:
- `MakeCallToolView.tsx` - Initiates calls
- `MonitorCallToolView.tsx` - Shows live call status and transcript updates

**Example Event**:
```typescript
// When a Vapi call is updated via webhook from Vapi service
{
  eventType: 'UPDATE',
  new: {
    call_id: 'abc123',
    status: 'in-progress',
    transcript: [{ role: 'user', message: 'Hello' }],
    started_at: '2025-11-03T10:00:00Z'
  }
}
```

### 2. **Project Sandbox Updates** 📦

**Hook**: `useProjectRealtime()` (`frontend/src/hooks/useProjectRealtime.ts`)

**Purpose**: Live sync of sandbox environment state for projects

**Subscribes To**: `projects` table in PostgreSQL

**What It Monitors**:
- Sandbox data changes (files, environment state, execution results)
- When sandbox is updated by worker processes

**Affected UI Components**:
- Project editor/viewer components
- Sandbox file system explorer

**Example Event**:
```typescript
// When a sandbox is updated
{
  eventType: 'UPDATE',
  new: {
    project_id: 'proj-123',
    sandbox: {
      files: [{ path: '/app.js', content: '...' }],
      output: 'execution output'
    }
  }
}
```

---

## How Realtime Works

### Database-to-Frontend Flow

```
1. Vapi Webhook Service
   ↓ (HTTP POST to backend)
2. Backend updates vapi_calls table in Supabase
   ↓ (Supabase detects change)
3. Realtime Publication triggers
   ↓ (Supabase broadcasts to all subscribers)
4. Browser receives WebSocket message
   ↓ (via ws://localhost:8888/realtime/v1/websocket)
5. useVapiCallRealtime hook invalidates React Query cache
   ↓ (UI re-fetches data and updates)
6. Component re-renders with new data
```

### Database Setup

Realtime requires explicit **publication configuration**:

**Migration 1**: `backend/supabase/migrations/20251010173052_vapi_real_time.sql`
```sql
-- Enable Realtime for vapi_calls table
ALTER PUBLICATION supabase_realtime ADD TABLE vapi_calls;

-- Add Row-Level Security (RLS) policies
ALTER TABLE vapi_calls ENABLE ROW LEVEL SECURITY;

-- Users can see calls from their own threads
CREATE POLICY "Users can view their own calls"
ON vapi_calls FOR SELECT
USING (
  thread_id IN (
    SELECT thread_id FROM threads WHERE account_id = auth.uid()
  )
);
```

**Migration 2**: `backend/supabase/migrations/20250814145041_project_realtime_updates.sql`
```sql
-- Enable realtime for projects table
ALTER PUBLICATION supabase_realtime ADD TABLE projects;
```

---

## Architecture: Graceful Degradation

**Important**: Realtime is NOT critical for core functionality. The app includes **graceful degradation**:

### With Realtime (Optimal)
- ✅ Live updates via WebSocket
- ✅ Instant notifications
- ✅ Low latency (milliseconds)
- ✅ Reduced backend polling

### Without Realtime (Still Functional)
- ✅ React Query polling still works
- ✅ Manual refresh updates data
- ✅ Call monitoring still works (just with delay)
- ✅ Everything else works normally
- ⚠️ Slight delay in seeing updates (polling interval)

### How It Works

The frontend uses **React Query invalidation** as the primary mechanism:

```typescript
// useVapiCallRealtime hook
const channel = supabase
  .channel(`vapi-call-${callId}`)
  .on('postgres_changes', { ... }, (payload) => {
    // When realtime update arrives, invalidate cache
    queryClient.invalidateQueries({
      queryKey: ['vapi-call', newData.call_id],
    });
    // React Query automatically refetches the data
  })
  .subscribe();
```

**If realtime fails**: React Query's default polling interval kicks in (configurable).

---

## Current Status: 🟢 FULLY OPERATIONAL

### ✅ Fixed Issues (November 3-4, 2025)

**Authentication Login Flow** - **FIXED** ✅
- **Issue**: Login failed with auth proxy routing errors
- **Root Cause**: Auth proxy at `frontend/src/app/api/proxy/auth/[...slug]/route.ts` was routing to frontend instead of Kong backend
- **Solution Implemented**:
  - Fixed line 37 in auth proxy route handler
  - Changed routing logic to properly direct auth requests to `kong.${host}` subdomain
  - Now correctly routes to Kong in both localhost and Cloudflare tunnel modes

**WebSocket Connection Failures** - **FIXED** ✅
- **Previous Problem**: Browser tried to connect to `ws://localhost:3000` instead of Kong
- **Root Cause**: Supabase client using wrong URL for browser requests
- **Solution Implemented**:
  1. Updated backend CORS to include Cloudflare tunnel domains
  2. Fixed auth proxy to route to Kong subdomain (not back to frontend)
  3. Changed Cloudflare SSL/TLS setting from "Full" to "Flexible"
  4. Disabled Cloudflare "Automatic HTTPS Rewrites"

**SSL/TLS Certificate Errors** - **FIXED** ✅
- **Previous Problem**: Browser auto-upgraded HTTP to HTTPS, Kong's self-signed cert failed validation
- **Root Cause**: Kong uses self-signed HTTPS cert on port 8445, browser wouldn't trust it
- **Solution**: Configure Cloudflare "Flexible" mode to allow HTTP from origin

**Impact**:
- ✅ User authentication now works correctly
- ✅ WebSocket realtime connections work
- ✅ Authentication flows through Cloudflare tunnel successfully
- ✅ Both localhost and https://kortix.syhc.dev access patterns work
- ✅ All realtime features (Vapi calls, project sandboxes) fully operational

---

## Quick Start

### For Local Development (localhost:3000)
```env
NEXT_PUBLIC_SUPABASE_URL=http://localhost:8888
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key
```

### For Cloudflare Tunnel (https://kortix.syhc.dev)
```env
NEXT_PUBLIC_SUPABASE_URL=http://kong.kortix.syhc.dev
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key
```

Then complete the Cloudflare configuration (see IMPLEMENTATION_GUIDE.md):
1. Set SSL/TLS to "Flexible"
2. Disable "Automatic HTTPS Rewrites"
3. Verify Kong tunnel routing: `kong.kortix.syhc.dev → http://localhost:8888`

See **IMPLEMENTATION_GUIDE.md** for complete setup instructions.

---

## Available Realtime Features

### 1. Postgres Changes Subscriptions

Listen to table changes in real-time:

```typescript
const supabase = createClient();

supabase
  .channel('my-channel')
  .on(
    'postgres_changes',
    {
      event: '*',                    // INSERT, UPDATE, DELETE
      schema: 'public',
      table: 'vapi_calls',
      filter: `call_id=eq.${callId}`  // Optional: filter by column
    },
    (payload) => {
      console.log('Change received!', payload.new);
    }
  )
  .subscribe();
```

### 2. Broadcast Messages

Send arbitrary messages through realtime (not table-based):

```typescript
// Send a message
supabase.channel('my-channel').send('broadcast', {
  event: 'custom_event',
  payload: { message: 'Hello!' }
});

// Receive messages
supabase
  .channel('my-channel')
  .on('broadcast', { event: 'custom_event' }, (payload) => {
    console.log(payload);
  })
  .subscribe();
```

### 3. Presence Tracking

Track which users are online/viewing what:

```typescript
// Not currently used in Suna, but available
supabase
  .channel('my-channel')
  .on('presence', { event: 'sync' }, (payload) => {
    console.log('Online users:', payload.key);
  })
  .subscribe();
```

---

## How to Verify Realtime Is Working

### 1. Check WebSocket Connection

**In Chrome DevTools → Network Tab**:
1. Filter by `WS` (WebSocket)
2. Look for `realtime/v1/websocket` connection
3. Status should show `101 Switching Protocols` (not red X)

**Expected URL**:
```
ws://localhost:8888/realtime/v1/websocket?apikey=...&vsn=1.0.0
```

**NOT**:
```
ws://localhost:3000/realtime/v1/websocket  ❌ WRONG
```

### 2. Test in Browser Console

```javascript
const supabase = createClient();

// Try to subscribe to a table
const subscription = await supabase
  .from('vapi_calls')
  .on('*', (payload) => {
    console.log('✅ Realtime update:', payload);
  })
  .subscribe();

// Should see console log if WebSocket is connected
```

### 3. Check Supabase Realtime Service

```bash
# Check if Realtime service is running in Supabase
docker ps | grep realtime

# View Realtime logs
docker compose -f suna-supabase/docker/docker-compose.yml logs realtime -f
```

### 4. Verify Table Publications

In Supabase Studio Dashboard:
1. Go to **Database** → **Publications**
2. Find `supabase_realtime` publication
3. Verify `vapi_calls` and `projects` tables are included

---

## Troubleshooting

**See TROUBLESHOOTING.md for:**
- WebSocket connection debugging
- Realtime update failures
- Certificate and SSL/TLS issues
- Cloudflare tunnel issues
- Docker networking problems
- Diagnostic commands and tools

**Quick Check**: In Chrome DevTools → Network → Filter `WS`:
- ✅ Should see `ws://` or `wss://` connection to realtime endpoint
- ❌ If missing or red X, check TROUBLESHOOTING.md

---

## Related Code Files

| File | Purpose |
|------|---------|
| `frontend/src/hooks/useVapiCallRealtime.ts` | Vapi call monitoring |
| `frontend/src/hooks/useProjectRealtime.ts` | Project sandbox monitoring |
| `frontend/src/components/thread/tool-views/vapi-call/MonitorCallToolView.tsx` | UI that uses realtime |
| `backend/supabase/migrations/20251010173052_vapi_real_time.sql` | Enable realtime for vapi_calls |
| `backend/supabase/migrations/20250814145041_project_realtime_updates.sql` | Enable realtime for projects |
| `backend/core/vapi_webhooks.py` | Webhook handler that updates vapi_calls table |

---

## Performance Considerations

### Network Usage

- **Realtime enabled**: Lower bandwidth (only changes streamed)
- **Realtime disabled**: Higher polling (entire record fetched periodically)

### Latency

- **Realtime**: ~50-200ms for updates to appear
- **React Query polling**: ~5-30 seconds (depends on interval)

### Database Load

- **Realtime**: More continuous connections, but less polling
- **Realtime disabled**: Periodic full table scans via React Query

---

## Future Enhancements

### Possible Realtime Uses

1. **Multi-user Awareness**
   - See which agents are being edited by other users
   - Show cursor positions/selections

2. **Live Thread Updates**
   - Stream message arrivals in real-time
   - Multi-user conversation awareness

3. **Broadcast Notifications**
   - Alert all connected users of important events
   - Trigger actions across browsers

4. **Presence Tracking**
   - Show "User is typing..."
   - Show "User is viewing this thread"

---

## Related Documentation

- **Supabase Realtime Docs**: https://supabase.com/docs/guides/realtime
- **Supabase Realtime Postgres Changes**: https://supabase.com/docs/guides/realtime/postgres-changes
- **Supabase JavaScript Client**: https://supabase.com/docs/reference/javascript
- **WebSocket Protocol**: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket

---

## Summary

| Feature | Status | Impact |
|---------|--------|--------|
| User Authentication | ✅ Working | Can login via localhost and Cloudflare tunnel |
| Realtime Subscriptions | ✅ WebSocket connected | Real-time updates working |
| Vapi Call Monitoring | ✅ Live updates | Instant updates (~50-200ms) |
| Project Sandbox Updates | ✅ Live updates | Instant updates (~50-200ms) |
| Core App Features | ✅ All working | Fully operational |

**Verdict**: All realtime features are now fully operational with proper authentication. WebSocket connections established successfully, and real-time updates working across all features.
