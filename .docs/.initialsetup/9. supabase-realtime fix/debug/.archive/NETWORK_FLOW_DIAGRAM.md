# Suna Real-Time Architecture: Network Flow Diagram

**Last Updated**: November 5, 2025  
**Status**: Complete overview of all data flows

---

## Overview: Real-Time Data Flow in Suna

The Suna app has **THREE TYPES OF DATA FLOWS**:

1. **REST API (HTTP)** - Regular data queries & mutations (PROXIED through Next.js)
2. **WebSocket (Realtime)** - Live subscriptions to database changes (DIRECT to Kong, NOT proxied)
3. **Backend Processing** - Webhooks trigger database updates (direct Supabase connection)

---

## EXAMPLE 1: Vapi Phone Call Realtime Flow

### Step-by-Step Data Journey

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              VAPI PHONE CALL REALTIME FLOW                         │
└─────────────────────────────────────────────────────────────────────────────────────┘

1️⃣  VAPI SERVICE → BACKEND (External Webhook)
    ├─ Vapi sends webhook to: https://kortix.syhc.dev/api/webhooks/vapi
    ├─ Cloudflare Tunnel: https://kortix.syhc.dev → http://localhost:3000
    ├─ Next.js Rewrite: /api/webhooks/vapi → http://backend:8000/api/webhooks/vapi
    └─ Backend receives at: backend/core/vapi_api.py (@router.post("/webhooks/vapi"))

2️⃣  BACKEND → SUPABASE (Write to Database)
    ├─ File: backend/core/vapi_webhooks.py (VapiWebhookHandler)
    ├─ Method: _handle_transcript_updated() or _handle_status_update()
    ├─ Action: 
    │   ├─ client.table("vapi_calls").update({
    │   │     "transcript": [...],
    │   │     "status": "in-progress",
    │   │     "updated_at": "now()"
    │   │   }).eq("call_id", call_id).execute()
    ├─ Connection: backend/core/services/supabase.py → DBConnection()
    ├─ Target: SUPABASE_URL=http://supabase-kong:8000 (Docker internal)
    └─ Via Supabase client library (Python async)

3️⃣  SUPABASE DATABASE → SUPABASE REALTIME SERVICE (PostgreSQL Trigger)
    ├─ PostgreSQL detects UPDATE on vapi_calls table
    ├─ Realtime subscription exists (configured in: db schema)
    ├─ Supabase Realtime service (Elixir) detects change
    └─ Broadcasts JSON message to all WebSocket subscribers

4️⃣  SUPABASE REALTIME → BROWSER (WebSocket Message)
    ├─ Connection: wss://kong.kortix.syhc.dev/realtime/v1/websocket
    ├─ Browser receives JSON payload:
    │   {
    │     "event": "postgres_changes",
    │     "data": {
    │       "type": "UPDATE",
    │       "schema": "public",
    │       "table": "vapi_calls",
    │       "commit_timestamp": "...",
    │       "new": {
    │         "call_id": "abc123",
    │         "status": "in-progress",
    │         "transcript": [{ role: "user", message: "..." }],
    │         "updated_at": "..."
    │       },
    │       "old": { ... }
    │     }
    │   }
    └─ Received by: Supabase Realtime JS client

5️⃣  BROWSER HOOK → REACT QUERY INVALIDATION (Frontend State Update)
    ├─ File: frontend/src/hooks/useVapiCallRealtime.ts
    ├─ Hook: useVapiCallRealtime(callId, threadId)
    │   └─ Runs on component mount (ThreadComponent, MakeCallToolView, MonitorCallToolView)
    ├─ Subscription created:
    │   realtimeClient
    │     .channel(`vapi-call-${callId}`)
    │     .on('postgres_changes', {
    │       event: '*',
    │       schema: 'public',
    │       table: 'vapi_calls',
    │       filter: `call_id=eq.${callId}`
    │     }, (payload) => {
    │       console.log('[Vapi Realtime] Change received:', payload)
    │       queryClient.invalidateQueries({
    │         queryKey: ['vapi-call', newData.call_id]
    │       })
    │     })
    │     .subscribe()
    ├─ Realtime event received → Console logs printed
    ├─ React Query cache invalidated → Triggers refetch
    └─ Component re-renders with new data

6️⃣  REACT QUERY REFETCH → REST API CALL (Get Updated Data)
    ├─ Query key invalidation triggers automatic refetch
    ├─ React Query hook: useVapiCall(callId) → frontend/src/hooks/react-query/vapi-calls/queries.ts
    ├─ Browser makes HTTP GET: /api/vapi/calls/{call_id}
    ├─ Next.js Rewrite: /api/* → http://backend:8000/api/*
    ├─ Backend endpoint: backend/core/vapi_api.py (@router.get("/vapi/calls/{call_id}"))
    ├─ Backend queries database:
    │   client.table("vapi_calls")
    │     .select("*")
    │     .eq("call_id", call_id)
    │     .single()
    │     .execute()
    ├─ Response returned to browser
    └─ React component re-renders with fresh data ✅

RESULT: UI updates automatically as call progresses! 🎉
```

---

## EXAMPLE 2: Project Sandbox Realtime Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           PROJECT SANDBOX REALTIME FLOW                            │
└─────────────────────────────────────────────────────────────────────────────────────┘

1️⃣  BACKEND WORKER → SUPABASE (Write Sandbox Update)
    ├─ Worker (Dramatiq) processes agent task
    ├─ File: backend/core/utils/project_helpers.py
    ├─ Function: update_project_sandbox(project_id, sandbox_data)
    ├─ Action:
    │   client.table('projects').update({
    │     "sandbox": {
    │       "files": [...],
    │       "output": "execution output",
    │       "status": "completed"
    │     },
    │     "updated_at": "now()"
    │   }).eq("project_id", project_id).execute()
    ├─ Connection: DBConnection() → Supabase service role key
    └─ Target: http://supabase-kong:8000

2️⃣  SUPABASE DATABASE → REALTIME SERVICE (Trigger)
    ├─ PostgreSQL detects UPDATE on projects table
    ├─ Realtime triggers for subscribers
    └─ Broadcasts to all connected WebSocket clients

3️⃣  BROWSER RECEIVES REALTIME EVENT
    ├─ File: frontend/src/hooks/useProjectRealtime.ts
    ├─ Hook: useProjectRealtime(projectId)
    │   └─ Runs on ThreadComponent mount
    ├─ Subscription:
    │   realtimeClient
    │     .channel(`project-${projectId}`)
    │     .on('postgres_changes', {
    │       event: '*',
    │       schema: 'public',
    │       table: 'projects',
    │       filter: `project_id=eq.${projectId}`
    │     }, (payload) => {
    │       if (payload.new.sandbox !== payload.old.sandbox) {
    │         queryClient.invalidateQueries({
    │           queryKey: threadKeys.project(projectId)
    │         })
    │       }
    │     })
    │     .subscribe()
    ├─ Event detected → Cache invalidation
    ├─ React Query refetches project data
    └─ Sandbox view updates ✅

RESULT: Project editor shows sandbox updates in real-time!
```

---

## DETAILED NETWORK MAP: File-by-File Communication

### Frontend Communication Layer

```typescript
// ┌─────────────────────────────────────────────────────┐
// │  NEXT.JS FRONTEND (localhost:3000 or https://...)   │
// └─────────────────────────────────────────────────────┘

// 1. COMPONENT LEVEL
frontend/src/components/thread/ThreadComponent.tsx
  ├─ Imports: useVapiCallRealtime, useProjectRealtime
  ├─ Line 50: import { useProjectRealtime } from '@/hooks/useProjectRealtime'
  ├─ Line 107: useVapiCallRealtime(initialData?.call_id)
  ├─ Line 153: useProjectRealtime(projectId)
  └─ When these components mount → hooks initialize subscriptions

frontend/src/components/thread/tool-views/vapi-call/MakeCallToolView.tsx
  ├─ Imports: useVapiCallRealtime
  ├─ Line 9: import { useVapiCallRealtime } from '@/hooks/useVapiCallRealtime'
  ├─ Line 34: useVapiCallRealtime(callData?.call_id)
  └─ Listens to real-time call updates during active calls

frontend/src/components/thread/tool-views/vapi-call/MonitorCallToolView.tsx
  ├─ Imports: createRealtimeClient (for subscription)
  ├─ Line 10: import { createRealtimeClient } from '@/lib/supabase/client'
  ├─ Line 115: const realtimeClient = createRealtimeClient()
  ├─ Line 120-135: Sets up subscription to vapi_calls
  └─ Direct realtime subscription in component


// 2. HOOK LAYER (React Hooks)
frontend/src/hooks/useVapiCallRealtime.ts
  ├─ Input: callId (string), threadId (string)
  ├─ Creates realtime subscription:
  │   const supabase = createRealtimeClient()
  │   const channel = supabase
  │     .channel(`vapi-call-${callId}`)
  │     .on('postgres_changes', {...}, (payload) => {
  │       queryClient.invalidateQueries({
  │         queryKey: ['vapi-call', newData.call_id]
  │       })
  │     })
  │     .subscribe()
  ├─ Listens for: INSERT, UPDATE, DELETE on vapi_calls table
  ├─ Triggers: React Query cache invalidation
  ├─ Cleanup: channel unsubscribe on unmount
  └─ ✅ NO HTTP CALLS - pure WebSocket subscription

frontend/src/hooks/useProjectRealtime.ts
  ├─ Input: projectId (string)
  ├─ Creates realtime subscription:
  │   const supabase = createRealtimeClient()
  │   const channel = supabase
  │     .channel(`project-${projectId}`)
  │     .on('postgres_changes', {...}, (payload) => {
  │       queryClient.invalidateQueries({
  │         queryKey: threadKeys.project(projectId)
  │       })
  │     })
  │     .subscribe()
  ├─ Listens for: Changes to projects table
  ├─ Triggers: React Query cache invalidation
  └─ ✅ NO HTTP CALLS - pure WebSocket subscription


// 3. SUPABASE CLIENT LAYER (Connection Management)
frontend/src/lib/supabase/client.ts
  ├─ createClient() [for HTTP/Auth/REST]
  │   ├─ Uses: window.location.origin (e.g., localhost:3000 or kortix.syhc.dev)
  │   ├─ Proxies through: Next.js rewrites
  │   ├─ URL becomes: /auth/v1/*, /rest/v1/*, /storage/v1/*
  │   └─ Handled by: next.config.ts rewrites → supabaseUrl/auth/v1/*
  │
  └─ createRealtimeClient() [for WebSocket/Realtime] 🔴 KEY FUNCTION
      ├─ Uses: NEXT_PUBLIC_REALTIME_URL or NEXT_PUBLIC_SUPABASE_URL
      ├─ Direct to: http://kong.kortix.syhc.dev (NO proxying)
      ├─ WebSocket URL: wss://kong.kortix.syhc.dev/realtime/v1/websocket
      ├─ Configuration:
      │   {
      │     auth: {
      │       persistSession: false,    // Don't manage auth state
      │       autoRefreshToken: false,  // Use main client for tokens
      │     },
      │     realtime: {
      │       params: {
      │         eventsPerSecond: 1000,
      │       },
      │     },
      │   }
      ├─ Logging: Detailed console.log for debugging
      └─ Return: Supabase client for .channel() subscriptions


// 4. NEXT.JS PROXY LAYER (HTTP Traffic)
frontend/next.config.ts
  ├─ Rewrites for Supabase API:
  │   {
  │     source: '/auth/v1/:path*',
  │     destination: `${supabaseUrl}/auth/v1/:path*`,
  │   },
  │   {
  │     source: '/rest/v1/:path*',
  │     destination: `${supabaseUrl}/rest/v1/:path*`,
  │   },
  │   {
  │     source: '/storage/v1/:path*',
  │     destination: `${supabaseUrl}/storage/v1/*`,
  │   },
  │   {
  │     source: '/realtime/v1/:path*',
  │     destination: `${supabaseUrl}/realtime/v1/:path*`,
  │   }
  │
  ├─ Rewrites for Backend API:
  │   {
  │     source: '/api/:path*',
  │     destination: `http://backend:8000/api/:path*`,
  │   }
  │
  └─ NOTE: /realtime/v1 rewrite is for HTTP polling ONLY
           WebSocket upgrades CANNOT be proxied through Next.js!


// 5. AUTH PROXY (Special Handling)
frontend/src/app/api/proxy/auth/[...slug]/route.ts
  ├─ Handles: POST /auth/v1/* (Login, Signup, etc.)
  ├─ Detects environment:
  │   if (localhost) → route to http://localhost:8888
  │   else → route to http://kong.${host} (e.g., kong.kortix.syhc.dev)
  │
  ├─ Purpose: Ensures auth requests go to correct backend
  ├─ Returns: Auth response with Set-Cookie headers
  └─ Critical for: OAuth callbacks, session management
```

### Backend Communication Layer

```python
# ┌─────────────────────────────────────────────────────┐
# │    FASTAPI BACKEND (http://localhost:8000 or ...)   │
# └─────────────────────────────────────────────────────┘

# 1. WEBHOOK RECEIVER (External Events)
backend/core/vapi_api.py
  ├─ Endpoint: POST /webhooks/vapi
  ├─ Receives: External webhook from Vapi service
  │   Example: https://kortix.syhc.dev/api/webhooks/vapi
  │   Flow: Vapi → Cloudflare Tunnel → Next.js → Backend
  │
  ├─ Handler: handle_vapi_webhook(request)
  ├─ Extracts: event_type (conversation-update, status-update, etc.)
  ├─ Calls: VapiWebhookHandler.handle_webhook(event_type, payload)
  └─ Returns: {"status": "success"} or error response


# 2. WEBHOOK HANDLER (Database Writer)
backend/core/vapi_webhooks.py
  ├─ Class: VapiWebhookHandler
  ├─ Methods:
  │   ├─ _handle_conversation_update(payload)
  │   │   └─ Updates: vapi_calls table with transcript data
  │   │       client.table("vapi_calls").update({
  │   │         "transcript": transcript_data,
  │   │         "status": "in-progress",
  │   │         "updated_at": "now()"
  │   │       }).eq("call_id", call_id).execute()
  │   │
  │   ├─ _handle_status_update(payload)
  │   │   └─ Updates: call status (completed, ended, failed, etc.)
  │   │
  │   └─ _handle_end_of_call_report(payload)
  │       └─ Final update: cost, duration, quality metrics
  │
  ├─ Connection: Uses DBConnection() singleton
  ├─ Target: Supabase (http://supabase-kong:8000)
  └─ 🔴 THIS IS WHERE REALTIME STARTS: Writing to DB triggers Supabase Realtime


# 3. DATABASE CONNECTION (Async Supabase Client)
backend/core/services/supabase.py
  ├─ Class: DBConnection (Thread-safe Singleton)
  ├─ Methods:
  │   ├─ initialize()
  │       ├─ Creates async Supabase client
  │       ├─ Uses: SUPABASE_URL (http://supabase-kong:8000)
  │       ├─ Auth: SUPABASE_SERVICE_ROLE_KEY (or ANON_KEY)
  │       └─ Returns: AsyncClient
  │   │
  │   └─ @property client
  │       └─ Ensures client is initialized
  │
  ├─ Connection Details:
  │   SUPABASE_URL = http://supabase-kong:8000 (Docker internal network)
  │   SUPABASE_SERVICE_ROLE_KEY = your-key
  │
  ├─ Usage in code:
  │   db = DBConnection()
  │   client = await db.client
  │   result = await client.table("vapi_calls").update(...).execute()
  │
  └─ 🔴 CRITICAL: Must connect to SUPABASE_URL, not NEXT_PUBLIC_SUPABASE_URL!
                   Backend uses internal Docker network (supabase-kong:8000)
                   Frontend uses Kong tunnel (kong.kortix.syhc.dev)


# 4. OTHER BACKENDS DATA WRITERS
backend/core/threads.py
  ├─ Updates projects table:
  │   client.table('projects').update({
  │     "sandbox": {...},
  │     "updated_at": "now()"
  │   }).eq("project_id", project_id).execute()
  │
  └─ 🔴 TRIGGERS: useProjectRealtime() hook on frontend

backend/core/triggers/execution_service.py
  └─ Updates projects with execution results

backend/core/utils/project_helpers.py
  └─ Helper: update_project_sandbox(project_id, sandbox_data)
```

### Supabase Infrastructure Layer

```
┌─────────────────────────────────────────────────────────────┐
│              SUPABASE INFRASTRUCTURE (Docker)               │
└─────────────────────────────────────────────────────────────┘

Kong Gateway (HTTP + WebSocket Entry Point)
  ├─ Port (Local): 8888 → Kong internal 8000
  ├─ Port (Docker): supabase-kong:8000 (internal network)
  ├─ Tunnel Route: kong.kortix.syhc.dev → http://localhost:8888
  │
  ├─ Routes traffic to:
  │   ├─ /auth/v1/* → Auth service (port 9999)
  │   ├─ /rest/v1/* → PostgREST (port 3000)
  │   └─ /realtime/v1/* → Realtime service (port 4000)
  │
  └─ ✅ SUPPORTS WebSocket upgrades for /realtime/v1/websocket


PostgreSQL Database
  ├─ Port: 5432
  ├─ Tables:
  │   ├─ vapi_calls (Realtime enabled)
  │   ├─ projects (Realtime enabled)
  │   └─ ... (others)
  │
  ├─ Realtime Setup:
  │   ├─ Publication: supabase_realtime
  │   ├─ Tables in publication: vapi_calls, projects, etc.
  │   └─ Trigger: Detects INSERT/UPDATE/DELETE


Realtime Service (Elixir)
  ├─ Port: 4000
  ├─ Listens to: PostgreSQL WAL (Write-Ahead Log)
  ├─ Flow:
  │   1. PostgreSQL UPDATE on vapi_calls
  │   2. Realtime service detects change via WAL
  │   3. Converts to JSON event
  │   4. Broadcasts to all connected WebSocket clients
  │
  ├─ WebSocket Endpoint:
  │   URL: ws://localhost:8888/realtime/v1/websocket
  │   URL: wss://kong.kortix.syhc.dev/realtime/v1/websocket (via tunnel)
  │
  ├─ Connection Headers:
  │   - Authorization: Bearer {JWT_TOKEN}
  │   - Channels: vapi-call-{call_id}, project-{project_id}, etc.
  │
  └─ Message Format: JSON
      {
        "event": "postgres_changes",
        "data": {
          "type": "UPDATE",
          "schema": "public",
          "table": "vapi_calls",
          "commit_timestamp": "...",
          "new": { /* updated row data */ },
          "old": { /* previous row data */ }
        }
      }


Auth Service
  ├─ Port: 9999 (internal)
  ├─ Exposed via Kong: /auth/v1/*
  └─ Handles: JWT tokens, sessions, OAuth


PostgREST (REST API)
  ├─ Port: 3000 (internal)
  ├─ Exposed via Kong: /rest/v1/*
  └─ Provides: SQL→REST interface for read/write operations
```

---

## COMPLETE REQUEST JOURNEY EXAMPLE: Vapi Call Real-Time Update

### Step 1: Backend Receives Webhook
```
Source: Vapi Service
Destination: https://kortix.syhc.dev/api/webhooks/vapi
Path: 
  Vapi → 
  Cloudflare Tunnel → 
  Frontend (localhost:3000) → 
  Next.js Rewrite (/api/* → backend:8000/api/*) → 
  Backend API (FastAPI)
File: backend/core/vapi_api.py → handle_vapi_webhook()
```

### Step 2: Backend Writes to Database
```
Source: VapiWebhookHandler
Action: UPDATE vapi_calls table
File: backend/core/vapi_webhooks.py → _handle_transcript_updated()
Code:
  client = await self.db.client  # DBConnection singleton
  await client.table("vapi_calls").update({
    "transcript": new_transcript,
    "status": "in-progress"
  }).eq("call_id", call_id).execute()
Target: http://supabase-kong:8000 (Docker internal)
```

### Step 3: Supabase Realtime Detects Change
```
Source: PostgreSQL WAL (Write-Ahead Log)
Detection: Realtime service monitors for changes on published tables
Table: vapi_calls (must be in supabase_realtime publication)
Event: UPDATE detected
Action: Convert to JSON and broadcast
```

### Step 4: Browser Receives WebSocket Message
```
Connection: WebSocket to wss://kong.kortix.syhc.dev/realtime/v1/websocket
Message Type: postgres_changes
Payload: { type: "UPDATE", new: { call_id, transcript, status }, old: {...} }
Receiver: Supabase Realtime JS Client (created by createRealtimeClient())
```

### Step 5: React Hook Processes Event
```
File: frontend/src/hooks/useVapiCallRealtime.ts
Trigger: 'postgres_changes' event received
Code:
  const channel = supabase
    .channel(`vapi-call-${callId}`)
    .on('postgres_changes', {...}, (payload) => {
      console.log('[Vapi Realtime] Change received:', payload)
      queryClient.invalidateQueries({
        queryKey: ['vapi-call', payload.new.call_id]
      })
    })
    .subscribe()
```

### Step 6: React Query Refetches
```
Cache Key: ['vapi-call', call_id]
Status: INVALIDATED
Trigger: Automatic refetch
Request: GET /api/vapi/calls/{call_id}
Path: Browser → Next.js → Backend API
File: backend/core/vapi_api.py → get_call_details()
Response: Fresh data with updated transcript
```

### Step 7: Component Re-renders
```
Data: New call data in React Query cache
UI Update: Call transcript, status, duration all update
Result: User sees live call updates in real-time ✅
```

---

## Environment Variables: How They Control Data Flow

### Frontend Environment Variables
```env
# HTTP/Auth/REST API (uses next.config.ts rewrites)
NEXT_PUBLIC_SUPABASE_URL=http://kong.kortix.syhc.dev/
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# WebSocket/Realtime (DIRECT, not proxied)
NEXT_PUBLIC_REALTIME_URL=http://kong.kortix.syhc.dev/

# Backend API
NEXT_PUBLIC_BACKEND_URL=http://backend:8000/api

# Environment mode
NEXT_PUBLIC_ENV_MODE=local
```

**How they're used:**
- `createClient()` uses `NEXT_PUBLIC_SUPABASE_URL` for HTTP → proxied through Next.js
- `createRealtimeClient()` uses `NEXT_PUBLIC_REALTIME_URL` for WebSocket → DIRECT to Kong
- Separate URLs allow different routing strategies (HTTP vs WebSocket)

### Backend Environment Variables
```env
# Direct Supabase connection (internal Docker network)
SUPABASE_URL=http://supabase-kong:8000
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Redis for Dramatiq worker
REDIS_HOST=redis
REDIS_PORT=6379

# LLM / External APIs
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
```

**How they're used:**
- Backend uses `SUPABASE_URL` to connect to Supabase (internal Docker hostname)
- When backend writes to database, it triggers Supabase Realtime
- Frontend subscribes via separate `NEXT_PUBLIC_REALTIME_URL`

---

## The Critical Problem: WebSocket Cannot Be Proxied

### ❌ What DOESN'T Work
```
Browser → Next.js Rewrite → Kong → Supabase Realtime
```
**Why**: HTTP protocol upgrade to WebSocket cannot traverse a Next.js rewrite proxy

### ✅ What WORKS
```
Browser → DIRECT connection to Kong → Supabase Realtime WebSocket
```
**Solution**: Use separate URL (`NEXT_PUBLIC_REALTIME_URL`) that points directly to Kong, not through Next.js

### The Fix in Code
```typescript
// WRONG (doesn't work for WebSocket):
const client = createBrowserClient(
  window.location.origin,  // Tries to go through Next.js
  ANON_KEY
)
// Browser attempts: localhost:3000/realtime/v1/websocket
// ❌ Next.js has no WebSocket handler for this path
// ❌ Connection fails

// CORRECT (works for WebSocket):
const client = createBrowserClient(
  process.env.NEXT_PUBLIC_REALTIME_URL,  // Direct to Kong
  ANON_KEY
)
// Browser attempts: kong.kortix.syhc.dev/realtime/v1/websocket
// ✅ Kong has realtime service on port 4000
// ✅ WebSocket upgrade succeeds
```

---

## Summary Table: Which File Does What

| Component | File | Purpose | Protocol | Route |
|-----------|------|---------|----------|-------|
| **Component** | `ThreadComponent.tsx` | Mounts hooks | - | - |
| **Hook** | `useVapiCallRealtime.ts` | Subscribes to real-time updates | WebSocket | Direct |
| **Hook** | `useProjectRealtime.ts` | Subscribes to project updates | WebSocket | Direct |
| **Client Factory** | `client.ts` | Creates Supabase clients | Both | Mixed |
| **Rewrite Config** | `next.config.ts` | Defines HTTP proxies | HTTP | Proxied |
| **Auth Proxy** | `proxy/auth/.../route.ts` | Special auth handling | HTTP | Proxied |
| **Backend API** | `vapi_api.py` | Receives webhooks | HTTP | From external |
| **Webhook Handler** | `vapi_webhooks.py` | Writes to database | Internal | Direct to DB |
| **DB Connection** | `supabase.py` | Manages Supabase client | Internal | Internal |
| **Realtime Service** | Supabase (Elixir) | Broadcasts DB changes | WebSocket | Direct |
| **PostgreSQL** | DB (Docker) | Stores data | Internal | Internal |

---

## Debugging: How to Trace Data Flow

### Check if Hook is Running
```bash
# Browser DevTools → Console
# Look for logs:
[Vapi Realtime] Setting up subscription for vapi-call-abc123
[Vapi Realtime] Subscribed to vapi_calls changes
```

### Check if WebSocket Connected
```bash
# Browser DevTools → Network tab
# Filter: WS
# Should see connection to wss://kong.kortix.syhc.dev/realtime/v1/websocket
# Status should be "101 Switching Protocols"
```

### Check if Message Received
```bash
# Browser DevTools → Console
# When data changes, should see:
[Vapi Realtime] Change received: { type: 'UPDATE', ... }
[React Query] Invalidating cache for vapi-call-abc123
```

### Check Backend Writing to DB
```bash
# Docker logs
docker compose logs backend -f | grep "vapi_calls"

# Look for:
# - "Updating vapi_calls for call_id: abc123"
# - No errors from Supabase client
```

### Check if Realtime Publication Exists
```bash
# Docker exec into Supabase DB
docker exec supabase-db-1 psql -U postgres -d postgres -c \
  "SELECT tablename FROM pg_tables WHERE tablename IN ('vapi_calls', 'projects');"

# Check publications
docker exec supabase-db-1 psql -U postgres -d postgres -c \
  "SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';"
```

---

## Common Failures & Root Causes

| Symptom | Root Cause | File to Check | Solution |
|---------|-----------|---------------|----------|
| WebSocket connection fails | Kong not accessible | `createRealtimeClient()` | Check `NEXT_PUBLIC_REALTIME_URL` |
| Data updates but UI doesn't | Hook not subscribed | `useVapiCallRealtime.ts` | Check component is using hook |
| React Query doesn't refetch | Cache key mismatch | `useVapiCallRealtime.ts` | Verify `queryKey` matches fetch query |
| Realtime event never received | Table not published | Supabase setup | Run migration: `20251010173052_vapi_real_time.sql` |
| Backend can't write to DB | SUPABASE_URL wrong | `backend/.env` | Use internal Docker hostname |
| Auth fails on tunnel | Kong routing wrong | `proxy/auth/.../route.ts` | Route to `kong.${host}` not `${host}` |

