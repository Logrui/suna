# Suna Real-Time System: Complete Overview & Quick Start Guide

**Last Updated**: November 5, 2025  
**Status**: Complete documentation created

---

## TL;DR - How Real-Time Works in Suna

1. **External Service** (Vapi, webhook source) → Sends webhook to backend
2. **Backend** (FastAPI) → Receives webhook, writes to Supabase database
3. **Database** (PostgreSQL) → Triggers Realtime service via WAL
4. **Realtime Service** (Supabase) → Broadcasts JSON via WebSocket
5. **Browser Hook** (useVapiCallRealtime) → Receives message, invalidates React Query cache
6. **React Query** → Automatic refetch via HTTP GET
7. **UI Component** → Re-renders with new data ✅

---

## The 3 Key Files You Need to Know

### 1. Frontend Hook: `useVapiCallRealtime.ts`
```typescript
// What it does:
- Creates WebSocket subscription to vapi_calls table
- Listens for INSERT, UPDATE, DELETE events
- When event arrives → Invalidates React Query cache
- React Query auto-refetches data → UI updates

// Where it's used:
- ThreadComponent.tsx (line 107)
- MakeCallToolView.tsx (line 34)
- MonitorCallToolView.tsx (direct subscription)

// Key code:
const channel = supabase
  .channel(`vapi-call-${callId}`)
  .on('postgres_changes', {...}, (payload) => {
    queryClient.invalidateQueries({
      queryKey: ['vapi-call', payload.new.call_id]
    })
  })
  .subscribe()
```

### 2. Backend Webhook Handler: `vapi_webhooks.py`
```python
# What it does:
- Receives webhook from Vapi service
- Extracts transcript and call status
- WRITES TO DATABASE (this triggers realtime!)

# Key code:
await client.table("vapi_calls")\
  .update({
    "transcript": new_transcript,
    "status": "in-progress"
  })\
  .eq("call_id", call_id)\
  .execute()

# This single database write triggers:
# 1. PostgreSQL WAL event
# 2. Realtime service detects it
# 3. Broadcasts JSON to all subscribers
# 4. Browser hook receives it
# 5. UI updates! ✅
```

### 3. Client Factory: `client.ts`
```typescript
// Two different clients for two different purposes:

// Client 1: HTTP API (Auth, REST, Storage)
createClient() 
  ↓ Uses: window.location.origin
  ↓ Routes through: Next.js rewrites
  ↓ Proxied: ✅ YES
  ✓ For: Regular data fetches

// Client 2: WebSocket (Realtime only)
createRealtimeClient()
  ↓ Uses: NEXT_PUBLIC_REALTIME_URL
  ↓ Routes through: DIRECT to Kong
  ↓ Proxied: ❌ NO (can't proxy WebSocket!)
  ✓ For: Real-time subscriptions

// Why two?
// WebSocket protocol upgrade cannot traverse HTTP proxies.
// Must go directly to Kong which has the Realtime service.
```

---

## File Communication Map

```
User Action
    ↓
Frontend Component (ThreadComponent.tsx, MakeCallToolView.tsx)
    ↓
useVapiCallRealtime Hook (useVapiCallRealtime.ts)
    ├─ Creates: createRealtimeClient() (client.ts)
    ├─ Connects: ws://kong.kortix.syhc.dev/realtime/v1/websocket
    └─ Listens: supabase.channel().on('postgres_changes', ...)
         ↓
    [WAITING FOR REAL-TIME EVENT]
         ↓
External Service (Vapi, Slack, etc.)
    ↓
Webhook: POST /api/webhooks/vapi
    ↓
Next.js Rewrite (next.config.ts)
    /api/* → http://backend:8000/api/*
    ↓
FastAPI Backend (vapi_api.py)
    @router.post("/webhooks/vapi")
    ↓
VapiWebhookHandler (vapi_webhooks.py)
    _handle_transcript_updated()
    ↓
⭐ DATABASE WRITE ⭐
    client.table("vapi_calls").update({...}).execute()
    ↓
Supabase Client (supabase.py)
    HTTP POST to: http://supabase-kong:8000/rest/v1/vapi_calls
    ↓
Kong Gateway (Port 8000)
    Routes to: PostgREST (Port 3000)
    ↓
PostgreSQL (Port 5432)
    UPDATE vapi_calls SET transcript = ...
    ↓
PostgreSQL WAL (Write-Ahead Log)
    🔴 Event detected 🔴
    ↓
Realtime Service (Supabase Elixir)
    Detects: vapi_calls table changed
    Checks: Is it published? ✅
    Broadcasts: JSON to all WebSocket subscribers
    ↓
🌐 WEBSOCKET MESSAGE SENT 🌐
    ↓
Browser Receives (useVapiCallRealtime hook)
    ↓
Callback function (useVapiCallRealtime.ts:68-85)
    ↓
React Query Cache Invalidation
    queryClient.invalidateQueries({
      queryKey: ['vapi-call', call_id]
    })
    ↓
React Query Auto-Refetch
    Triggers: GET /api/vapi/calls/{id}
    ↓
Backend Processes (vapi_api.py:get_call_details)
    ↓
Fresh Data Returned
    ↓
React Component Re-renders
    ↓
✅ UI UPDATES WITH NEW DATA ✅
```

---

## Environment Variables Explained

### Frontend (.env.local)
```env
# Used by createClient() - HTTP/Auth/REST
NEXT_PUBLIC_SUPABASE_URL=http://kong.kortix.syhc.dev/
# ↑ Routes through Next.js rewrites
# ↓ Used by next.config.ts rewrites

# Used by createRealtimeClient() - WebSocket only
NEXT_PUBLIC_REALTIME_URL=http://kong.kortix.syhc.dev/
# ↑ DIRECT to Kong, bypasses Next.js
# ↓ WebSocket can't be proxied through Next.js

# For API calls to backend
NEXT_PUBLIC_BACKEND_URL=http://backend:8000/api
# ↑ Routes through: /api/* → backend:8000/api/*

# Anon key (public, safe to expose)
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### Backend (.env)
```env
# Direct connection to Supabase (internal Docker network)
SUPABASE_URL=http://supabase-kong:8000
# ↑ NOT localhost! Uses Docker internal hostname

# Service role key (backend-only, for admin operations)
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# For background jobs
REDIS_HOST=redis
REDIS_PORT=6379
```

---

## The Real-Time Flow: Step-by-Step with Files

```
STEP 1: Frontend Hook Mounts
────────────────────────────
File: frontend/src/components/thread/ThreadComponent.tsx
Code: useVapiCallRealtime(callData?.call_id)

Effect: Hook initializes on component mount
         ↓
         Creates WebSocket subscription


STEP 2: WebSocket Connection Established
────────────────────────────────────────
File: frontend/src/lib/supabase/client.ts
      (createRealtimeClient function)

Code: const client = createBrowserClient(
        process.env.NEXT_PUBLIC_REALTIME_URL,  // Direct to Kong!
        ANON_KEY
      )

Effect: WebSocket connection established to:
        ws://kong.kortix.syhc.dev/realtime/v1/websocket
        ✅ Status: "Connected"


STEP 3: Subscription Created
──────────────────────────
File: frontend/src/hooks/useVapiCallRealtime.ts

Code: const channel = supabase
        .channel(`vapi-call-${callId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'vapi_calls',
          filter: `call_id=eq.${callId}`
        }, callback)
        .subscribe()

Effect: Frontend is now listening for changes to:
        vapi_calls table WHERE call_id = {callId}


STEP 4: External Webhook Received
──────────────────────────────
File: backend/core/vapi_api.py

Code: @router.post("/webhooks/vapi")
      async def handle_vapi_webhook(request: Request):
        payload = await request.json()
        return await webhook_handler.handle_webhook(..., payload)

Effect: FastAPI receives webhook from Vapi


STEP 5: Webhook Dispatched to Handler
──────────────────────────────────
File: backend/core/vapi_webhooks.py

Code: handlers = {
        "transcript.updated": self._handle_transcript_updated,
        ...
      }
      handler = handlers.get(event_type)
      return await handler(payload)

Effect: Routes to appropriate handler based on event type


STEP 6: ⭐ DATABASE UPDATE (THE TRIGGER) ⭐
──────────────────────────────────────
File: backend/core/vapi_webhooks.py
      (in _handle_transcript_updated method)

Code: await client.table("vapi_calls")\
        .update({
          "transcript": transcript_data,
          "status": "in-progress"
        })\
        .eq("call_id", call_id)\
        .execute()

Effect: THIS IS IT!
        One line writes to database
        ↓
        PostgreSQL detects UPDATE
        ↓
        WAL event generated
        ↓
        Realtime service triggered


STEP 7: Realtime Broadcasts
────────────────────────
Supabase Realtime Service (Elixir):

Checks:
  1. Is vapi_calls table in supabase_realtime publication? ✅
  2. Are there WebSocket subscribers? ✅ (browser)
  3. Send JSON message to browser

Message Sent:
  {
    "event": "postgres_changes",
    "data": {
      "type": "UPDATE",
      "table": "vapi_calls",
      "new": { call_id, transcript, status, ... },
      "old": { ... }
    }
  }


STEP 8: Browser Hook Receives Event
────────────────────────────────
File: frontend/src/hooks/useVapiCallRealtime.ts

Code: .on('postgres_changes', {...}, (payload) => {
        console.log('[Vapi Realtime] Change received:', payload)
        // Process the message
        queryClient.invalidateQueries({
          queryKey: ['vapi-call', payload.new.call_id]
        })
      })

Effect: Hook callback fires
        ↓
        Cache is marked as "stale"
        ↓
        React Query initiates refetch


STEP 9: React Query Refetches Data
────────────────────────────────
File: Not explicitly called, handled by React Query

Code: (automatic refetch triggered)
      GET /api/vapi/calls/{call_id}

Effect: Browser makes HTTP request
        ↓
        Next.js routes to backend
        ↓
        Backend queries fresh data
        ↓
        Returns to browser


STEP 10: Component Re-Renders
──────────────────────────
File: frontend/src/components/thread/tool-views/vapi-call/...

Code: {callData?.transcript?.map((msg) => (
        <div>{msg.role}: {msg.message}</div>
      ))}

Effect: Component renders with new data
        ↓
        User sees updated transcript ✅
```

---

## Troubleshooting Quick Reference

### "WebSocket connection failed"
**Check:**
1. Is `NEXT_PUBLIC_REALTIME_URL` set? ✅
2. Is Kong accessible? `curl http://kong.kortix.syhc.dev:8888`
3. Browser DevTools → Network → Filter "WS"
   - Should see: `wss://kong.kortix.syhc.dev/realtime/v1/websocket`
   - Status should be: `101 Switching Protocols`

**Fix:** Check `createRealtimeClient()` console logs for errors

### "Real-time event received but UI doesn't update"
**Check:**
1. Is React Query cache key correct?
   - Hook invalidates: `['vapi-call', call_id]`
   - Component queries: `['vapi-call', call_id]` ← Must match!
2. Is component actually using the hook?
   - Should see in ThreadComponent: `useVapiCallRealtime(callId)`
3. Check browser console for logs:
   - `[Vapi Realtime] Change received:`
   - `[React Query] Invalidating cache`

**Fix:** Verify query keys match between hook and component

### "Data updates in DB but WebSocket never fires"
**Check:**
1. Is table in supabase_realtime publication?
   ```bash
   docker exec supabase-db-1 psql -U postgres -d postgres -c \
     "SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';"
   ```
   Should show: `vapi_calls`, `projects`, etc.

2. Check PostgreSQL directly:
   ```bash
   docker exec supabase-db-1 psql -U postgres -d postgres -c \
     "SELECT * FROM vapi_calls WHERE call_id='abc123';"
   ```

**Fix:** Run migration to add table to publication:
```sql
-- Add table to existing publication
ALTER PUBLICATION supabase_realtime ADD TABLE vapi_calls;
```

### "Backend can't write to database"
**Check:**
1. Is `SUPABASE_URL` correct in backend .env?
   - Should be: `http://supabase-kong:8000` (Docker internal)
   - NOT: `localhost:8888` or `kong.kortix.syhc.dev`
2. Check backend logs:
   ```bash
   docker compose logs backend | grep -i "supabase\|error"
   ```

**Fix:** Update backend .env with correct Docker hostname

---

## Architecture Diagram (Simplified)

```
┌─────────────────────────────────────────────────────┐
│                   BROWSER (Frontend)                │
│  ┌──────────────────────────────────────────────┐  │
│  │  Component: ThreadComponent                  │  │
│  └───────┬──────────────────────────────────────┘  │
│          │                                          │
│  ┌───────▼──────────────────────────────────────┐  │
│  │  Hook: useVapiCallRealtime                   │  │
│  │  ├─ WebSocket: ws://kong/.../websocket ──┐  │  │
│  │  ├─ Subscription: vapi_calls table        │  │  │
│  │  └─ Cache Invalidation: React Query       │  │  │
│  └──────────────────────────────────────────┬─┘  │
│                                              │      │
└──────────────────────────────────────────────┼─────┘
                                               │
        ┌──────────────────────────────────────┘
        │ WebSocket (Direct, NOT proxied)
        │
        ▼
┌──────────────────────────────────┐
│  Kong Gateway (port 8000)        │
│  ├─ /auth/v1/* → Auth            │
│  ├─ /rest/v1/* → PostgREST       │
│  └─ /realtime/v1/* → Realtime ◄──┤ (Listens to WebSocket)
└──────────┬───────────────────────┘
           │
     ┌─────┴─────────┬──────────────┐
     ▼               ▼              ▼
  Realtime    PostgREST         Auth
 Service      (port 3000)    (port 9999)
   (Elixir)
     │
     └──────────────┐
                    ▼
           ┌──────────────────┐
           │   PostgreSQL     │
           │   (port 5432)    │
           │ ┌──────────────┐ │
           │ │ vapi_calls   │ │◄─── (Listens to WAL)
           │ ├──────────────┤ │
           │ │ projects     │ │
           │ └──────────────┘ │
           └──────────────────┘


┌─────────────────────────────────────────────────────┐
│             BACKEND (FastAPI)                       │
│  ┌──────────────────────────────────────────────┐  │
│  │  Webhook Receiver: vapi_api.py               │  │
│  │  POST /webhooks/vapi                         │  │
│  └────────────┬─────────────────────────────────┘  │
│               │                                     │
│  ┌────────────▼─────────────────────────────────┐  │
│  │  Handler: vapi_webhooks.py                   │  │
│  │  _handle_transcript_updated()                │  │
│  └────────────┬─────────────────────────────────┘  │
│               │                                     │
│  ┌────────────▼─────────────────────────────────┐  │
│  │  ⭐ DATABASE WRITE ⭐                        │  │
│  │  client.table("vapi_calls").update(...)      │  │
│  └──────────────────────────────────────────────┘  │
└────────┬──────────────────────────────────────────┘
         │
         │ HTTP POST
         ├────────────────────────────────────────┐
         │ (inside Docker network: supabase)       │
         │ http://supabase-kong:8000/rest/v1/...  │
         │                                        │
         └────────────┬──────────────────────────┘
                      ▼
             ┌────────────────────┐
             │  Kong Gateway      │
             │ (Docker internal)  │
             └────────────────────┘
                      │
                      ▼ (HTTP POST to PostgREST)
             ┌────────────────────┐
             │  PostgreSQL        │
             │  UPDATE vapi_calls │
             └────────────────────┘
                      │
                      ▼ (WAL Event)
             ┌────────────────────┐
             │  Realtime Service  │
             │  Broadcasts JSON   │
             └────────────────────┘
                      │
                      │ WebSocket Message
                      ▼
                   Browser ◄── (Back to Step 1)
```

---

## Key Insights

1. **Two Separate Connections**
   - HTTP: Browser → Next.js → Backend (everything proxied)
   - WebSocket: Browser → Kong (direct, CANNOT be proxied)

2. **Trigger Point**
   - One database write in backend
   - Triggers entire real-time cascade
   - No polling, no manual refreshes needed

3. **React Query Integration**
   - Hook receives real-time event
   - Invalidates cache
   - React Query auto-refetches
   - Component re-renders

4. **Three Layers of Processing**
   - Infrastructure: Supabase Realtime + PostgreSQL WAL
   - Network: WebSocket broadcast via Kong
   - Application: React hook invalidation + cache management

5. **Critical Files to Monitor**
   - Backend: `vapi_webhooks.py` (where writes happen)
   - Frontend: `useVapiCallRealtime.ts` (where events received)
   - Config: `client.ts` (WebSocket connection)

---

## Next Steps

1. **Test Real-Time Connection:**
   ```bash
   # Browser DevTools → Console
   # Look for: [createRealtimeClient] Configuration: {...}
   # Look for: WebSocket status = "Connected"
   ```

2. **Test Webhook:**
   ```bash
   # Backend logs
   docker compose logs backend -f | grep -i "vapi\|transcript"
   ```

3. **Test Database Write:**
   ```bash
   # Check if data appears in DB
   docker exec supabase-db-1 psql -U postgres -d postgres -c \
     "SELECT * FROM vapi_calls ORDER BY created_at DESC LIMIT 1;"
   ```

4. **Test UI Update:**
   - Make a Vapi call
   - Watch browser console for `[Vapi Realtime]` logs
   - Verify UI updates automatically

---

## Additional Documentation

- **Network Flow Diagram**: `NETWORK_FLOW_DIAGRAM.md`
- **Visual Architecture**: `VISUAL_ARCHITECTURE_DIAGRAM.md`
- **Code Execution Flow**: `CODE_EXECUTION_FLOW.md`
- **Troubleshooting Guide**: `TROUBLESHOOTING.md`
- **Implementation Guide**: `IMPLEMENTATION_GUIDE.md`

