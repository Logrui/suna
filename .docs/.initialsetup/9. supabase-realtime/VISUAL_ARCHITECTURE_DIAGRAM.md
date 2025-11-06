# Suna Real-Time: Visual Architecture Diagram

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                      │
│                     ⚡ SUNA REAL-TIME DATA FLOW ARCHITECTURE ⚡                      │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘


╔════════════════════════════════════════════════════════════════════════════════════════╗
║                          1️⃣  HTTP/REST FLOW (Proxied)                                 ║
╚════════════════════════════════════════════════════════════════════════════════════════╝

Browser (localhost:3000 or https://kortix.syhc.dev)
    │
    ├─► HTTP GET /api/vapi/calls/{id}
    │       │
    │       └──> [Next.js Rewrite]
    │           /api/* → http://backend:8000/api/*
    │           │
    │           └──> FastAPI Backend (http://localhost:8000)
    │               backend/core/vapi_api.py
    │               │
    │               └──> Query Supabase
    │                   client.table("vapi_calls").select("*")
    │                   │
    │                   └──> [Docker Network: supabase]
    │                       http://supabase-kong:8000/rest/v1/...
    │                       │
    │                       └──> Kong Gateway
    │                           │
    │                           └──> PostgREST (port 3000)
    │                               │
    │                               └──> PostgreSQL (port 5432)
    │                                   │
    │                                   └──> SELECT * FROM vapi_calls WHERE call_id=?
    │
    └─ Response: JSON data ◄─────────────────────────────────────────────────────────


╔════════════════════════════════════════════════════════════════════════════════════════╗
║                    2️⃣  WEBSOCKET REALTIME FLOW (DIRECT - Not Proxied!)                ║
╚════════════════════════════════════════════════════════════════════════════════════════╝

Browser
    │
    ├─► WebSocket Connection (upgraded from HTTP)
    │   URL: wss://kong.kortix.syhc.dev/realtime/v1/websocket
    │       │
    │       └──> ❌ NOT through Next.js (can't proxy WebSocket!)
    │
    │   URL: ws://localhost:8888/realtime/v1/websocket
    │       │
    │       └──> [Cloudflare Tunnel or Direct]
    │           │
    │           └──> Kong Gateway (port 8000)
    │               │
    │               └──> Realtime Service (port 4000)
    │                   │
    │                   └──► Listens to PostgreSQL WAL
    │
    └─ WebSocket Connection Established ✅


╔════════════════════════════════════════════════════════════════════════════════════════╗
║                    3️⃣  REAL-TIME EVENT FLOW (Backend → Browser)                       ║
╚════════════════════════════════════════════════════════════════════════════════════════╝

External Service (Vapi)
    │
    ├─► Webhook POST https://kortix.syhc.dev/api/webhooks/vapi
    │       │
    │       └──> [Cloudflare Tunnel]
    │           Frontend (localhost:3000)
    │           │
    │           └──> [Next.js Rewrite]
    │               /api/* → http://backend:8000/api/*
    │               │
    │               └──> FastAPI Backend
    │                   backend/core/vapi_api.py :: handle_vapi_webhook()
    │                   backend/core/vapi_webhooks.py :: VapiWebhookHandler
    │                   │
    │                   └──> ⭐ DATABASE WRITE ⭐
    │                       │
    │                       └──> await client.table("vapi_calls").update({
    │                           "transcript": [...],
    │                           "status": "in-progress"
    │                       }).eq("call_id", call_id).execute()
    │                           │
    │                           └──> [Docker Network: supabase]
    │                               http://supabase-kong:8000
    │                               │
    │                               └──> Kong Gateway
    │                                   │
    │                                   └──> PostgREST (port 3000)
    │                                       │
    │                                       └──> PostgreSQL (port 5432)
    │                                           │
    │                                           ├─ UPDATE vapi_calls SET ...
    │                                           │
    │                                           └─ 📤 PostgreSQL WAL Event
    │
    │                                               │
    │                                               └──> Realtime Service (Elixir)
    │                                                   │
    │                                                   └──> BROADCASTS JSON MESSAGE
    │                                                       to all WebSocket subscribers
    │
    │                                                       {
    │                                                         "event": "postgres_changes",
    │                                                         "data": {
    │                                                           "type": "UPDATE",
    │                                                           "new": {
    │                                                             "call_id": "abc123",
    │                                                             "status": "in-progress",
    │                                                             "transcript": [...]
    │                                                           },
    │                                                           "old": {...}
    │                                                         }
    │                                                       }
    │
    │                                                       │
    │                                                       └──► 📡 Via WebSocket
    │                                                           (through Kong tunnel)
    │                                                           │
    │                                                           └─► 🖥️ Browser
    │                                                               │
    │                                                               └──► ✅ Received!


╔════════════════════════════════════════════════════════════════════════════════════════╗
║                    4️⃣  BROWSER-SIDE PROCESSING (React)                                ║
╚════════════════════════════════════════════════════════════════════════════════════════╝

Browser receives WebSocket message
    │
    ├─► Supabase Realtime JS Client
    │   (created by: createRealtimeClient())
    │   │
    │   └──> Supabase Channel Subscription
    │       channel = client.channel(`vapi-call-${callId}`)
    │       │
    │       └──> .on('postgres_changes', {...}, (payload) => {
    │           console.log('[Vapi Realtime] Change received:', payload)
    │           │
    │           └──► 🎯 CACHE INVALIDATION 🎯
    │               queryClient.invalidateQueries({
    │                 queryKey: ['vapi-call', newData.call_id]
    │               })
    │               │
    │               └──► React Query detects invalidation
    │                   │
    │                   └──► Automatic Refetch Triggered
    │                       GET /api/vapi/calls/{id}
    │                       │
    │                       └──► Same as Step 1️⃣ (HTTP Flow)
    │                           │
    │                           └──► Response: Fresh Data
    │                               │
    │                               └──► React Component Re-renders ✅
    │
    └─► UI Updates in Real-Time! 🎉


╔════════════════════════════════════════════════════════════════════════════════════════╗
║                         COMPLETE REQUEST SEQUENCE                                      ║
╚════════════════════════════════════════════════════════════════════════════════════════╝

Time    Source              Action                          Target             File
────    ──────              ──────                          ──────             ────
t=0     Vapi Service        Webhook: call.transcript        Backend            vapi_api.py
                            updated event

t=1     FastAPI Backend     Receives POST                   vapi_webhooks.py   → handle_vapi_webhook()
                            /webhooks/vapi

t=2     VapiWebhookHandler  Extracts call_id &              
                            transcript from payload

t=3     DBConnection        Opens Supabase                  supabase.py
                            connection

t=4     Backend             UPDATE vapi_calls               Supabase
                            SET transcript=...             PostgreSQL

t=5     PostgreSQL          Detects UPDATE                  Realtime Service
                            (via WAL)

t=6     Realtime Service    Checks if vapi_calls            
                            in supabase_realtime
                            publication

t=7     Realtime Service    Converts UPDATE to JSON         Browser
                            Broadcasts via WebSocket

t=8     Browser             Receives WebSocket              useVapiCallRealtime.ts
        (Thread Component)  postgres_changes event

t=9     React Hook          Logs event received             console.log()
                            Invalidates cache

t=10    React Query         Detects cache                   
                            invalidation

t=11    React Query         Auto-triggers refetch           GET /api/vapi/calls/{id}
                            (with 100ms delay)

t=12    Browser             HTTP GET request                Backend
                            to fetch fresh data

t=13    Backend             SELECT * FROM vapi_calls       Supabase
                            WHERE call_id={id}

t=14    Backend             Returns updated data            Browser

t=15    React               Updates component state         Component re-renders
        (useQuery hook)     with new data

t=16    Component           Renders UI with                 🖥️ User sees
        (ThreadComponent)   updated transcript              new data! ✅


╔════════════════════════════════════════════════════════════════════════════════════════╗
║                      DIRECTORY STRUCTURE & FILE PURPOSES                               ║
╚════════════════════════════════════════════════════════════════════════════════════════╝

Frontend
├── src/
│   ├── components/
│   │   └── thread/
│   │       ├── ThreadComponent.tsx          ← 🎯 Mounts hooks here
│   │       │                                   (imports useVapiCallRealtime)
│   │       │                                   (imports useProjectRealtime)
│   │       │
│   │       └── tool-views/vapi-call/
│   │           ├── MakeCallToolView.tsx     ← 🎯 Mounts useVapiCallRealtime
│   │           │
│   │           └── MonitorCallToolView.tsx  ← 🎯 Direct subscription setup
│   │                                           (uses createRealtimeClient)
│   │
│   ├── hooks/
│   │   ├── useVapiCallRealtime.ts           ← ⚡ REAL-TIME HOOK #1
│   │   │                                       • Creates channel subscription
│   │   │                                       • Listens to vapi_calls table
│   │   │                                       • Invalidates React Query cache
│   │   │
│   │   └── useProjectRealtime.ts            ← ⚡ REAL-TIME HOOK #2
│   │                                           • Creates channel subscription
│   │                                           • Listens to projects table
│   │                                           • Invalidates React Query cache
│   │
│   ├── lib/
│   │   └── supabase/
│   │       └── client.ts                    ← 🔧 CRITICAL CLIENT FACTORY
│   │                                           • createClient() → HTTP proxied
│   │                                           • createRealtimeClient() → Direct WS
│   │
│   ├── app/
│   │   ├── next.config.ts                   ← ⚙️ HTTP REWRITES CONFIG
│   │   │                                       /auth/v1/* → supabase URL
│   │   │                                       /rest/v1/* → supabase URL
│   │   │                                       /realtime/v1/* → supabase URL (HTTP only)
│   │   │
│   │   └── api/
│   │       └── proxy/
│   │           └── auth/[...slug]/
│   │               └── route.ts              ← 🔌 AUTH PROXY
│   │                                           Handles OAuth callbacks
│   │
│   └── .env.local                           ← 📝 CONFIG
│       NEXT_PUBLIC_SUPABASE_URL=http://kong.kortix.syhc.dev/
│       NEXT_PUBLIC_REALTIME_URL=http://kong.kortix.syhc.dev/
│       NEXT_PUBLIC_BACKEND_URL=http://backend:8000/api


Backend (FastAPI + Python)
├── core/
│   ├── vapi_api.py                          ← 📨 WEBHOOK RECEIVER
│   │                                           @router.post("/webhooks/vapi")
│   │                                           Receives external Vapi events
│   │
│   ├── vapi_webhooks.py                     ← 🔥 WEBHOOK PROCESSOR
│   │                                           VapiWebhookHandler class
│   │                                           _handle_transcript_updated()
│   │                                           _handle_status_update()
│   │                                           ⭐ WRITES TO DATABASE HERE ⭐
│   │
│   ├── services/
│   │   └── supabase.py                      ← 🔌 DB CONNECTION
│   │                                           DBConnection singleton
│   │                                           Async Supabase client
│   │
│   ├── threads.py                           ← 📝 DATA WRITER #2
│   │   Updates projects table
│   │
│   └── utils/
│       └── project_helpers.py               ← 🛠️ HELPER
│           update_project_sandbox()
│           Writes sandbox data to DB


Supabase (Docker)
├── Kong Gateway (Port 8000)                 ← 🚪 API GATEWAY
│   Routes to services below
│
├── Realtime Service (Port 4000)             ← ⚡ THE MAGIC
│   • Listens to PostgreSQL WAL
│   • Detects table changes
│   • Broadcasts JSON messages via WebSocket
│   • Critical: Tables must be in supabase_realtime publication
│
├── PostgREST (Port 3000)                    ← 📊 REST API
│   Converts PostgreSQL queries to REST endpoints
│
├── Auth Service (Port 9999)                 ← 🔐 AUTHENTICATION
│   JWT tokens, sessions, OAuth
│
└── PostgreSQL (Port 5432)                   ← 💾 DATABASE
    • vapi_calls table (Realtime enabled)
    • projects table (Realtime enabled)
    • ... other tables


╔════════════════════════════════════════════════════════════════════════════════════════╗
║                      WHY WEBSOCKET CAN'T BE PROXIED                                    ║
╚════════════════════════════════════════════════════════════════════════════════════════╝

Problem:
────────
Browser attempts: ws://localhost:3000/realtime/v1/websocket

Flow that FAILS:
  Browser → Next.js Server (HTTP request for WebSocket upgrade)
    └─ Next.js receives: GET /realtime/v1/websocket with Upgrade: websocket header
    └─ Next.js rewrites: destination: http://kong.kortix.syhc.dev/realtime/v1/websocket
    ❌ FAILS because: Next.js is an HTTP proxy, not a WebSocket proxy
    └─ Connection drops


Solution:
─────────
Browser attempts: ws://kong.kortix.syhc.dev/realtime/v1/websocket

Flow that WORKS:
  Browser → Kong (DIRECT WebSocket)
    └─ Kong receives: WebSocket upgrade request
    ✅ SUCCEEDS because: Kong has actual Realtime service (Elixir)
    └─ Connection stays open, receives messages


Code:
─────
// ❌ WRONG:
const url = window.location.origin  // http://localhost:3000
const client = createBrowserClient(url, ANON_KEY)
// Tries to use: http://localhost:3000/realtime/v1/websocket
// Next.js receives request but can't proxy WebSocket → FAILS

// ✅ CORRECT:
const url = process.env.NEXT_PUBLIC_REALTIME_URL  // http://kong.kortix.syhc.dev
const client = createRealtimeClient()
// Uses: http://kong.kortix.syhc.dev/realtime/v1/websocket
// Direct to Kong → WORKS


╔════════════════════════════════════════════════════════════════════════════════════════╗
║                           KEY TAKEAWAYS                                                ║
╚════════════════════════════════════════════════════════════════════════════════════════╝

1. HTTP REQUESTS (REST API)
   • Browser → Next.js → Backend → Supabase
   • Proxied through Next.js rewrites
   • Files: client.ts (createClient), next.config.ts

2. WEBSOCKET CONNECTIONS (Realtime)
   • Browser → Kong (DIRECT, bypassing Next.js)
   • Can NOT be proxied
   • Files: client.ts (createRealtimeClient)

3. REAL-TIME EVENT FLOW
   • Backend writes to database via Supabase client
   • PostgreSQL triggers Realtime service
   • Realtime broadcasts JSON via WebSocket
   • Browser hook receives message
   • React Query cache invalidated
   • Component refetches data
   • UI updates ✅

4. CRITICAL FILES
   • Frontend: useVapiCallRealtime.ts, useProjectRealtime.ts
   • Backend: vapi_webhooks.py, supabase.py
   • Infrastructure: next.config.ts, docker-compose.yaml

5. ENVIRONMENT VARIABLES
   • NEXT_PUBLIC_SUPABASE_URL → HTTP API (proxied)
   • NEXT_PUBLIC_REALTIME_URL → WebSocket (direct)
   • SUPABASE_URL (backend) → Internal Docker network

6. WHEN REALTIME FAILS
   • Check if NEXT_PUBLIC_REALTIME_URL is set
   • Verify Kong is accessible at that URL
   • Check if table is in supabase_realtime publication
   • Look for WebSocket connection in browser DevTools (WS tab)
   • Verify backend is writing to database (check logs)

