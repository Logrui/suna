# Complete Real-Time Architecture Summary for User

## What I Just Created For You

I've created **4 comprehensive documentation files** that provide a complete understanding of how Supabase Real-Time works in Suna, from high-level concepts to line-by-line code execution.

---

## The Documents

### 1. **QUICK_START_GUIDE.md** (Start Here!)
A quick-reference guide with:
- TL;DR in 30 seconds
- The 3 most important files explained
- File communication map showing what talks to what
- Step-by-step data flow with file names
- Environment variables explained
- Troubleshooting quick reference

**Best for**: Getting up to speed quickly (10 minutes to understand it)

---

### 2. **NETWORK_FLOW_DIAGRAM.md** (Most Comprehensive)
Complete detailed breakdown including:
- Example 1: Vapi call real-time (full walkthrough)
- Example 2: Project sandbox real-time (full walkthrough)
- File-by-file communication layer:
  - Frontend components → hooks → clients
  - Backend API → webhooks → database
  - Supabase infrastructure
- Environment variables explained
- Summary table of all files
- Common failures & root causes

**Best for**: Deep understanding, reference material (30 minutes)

---

### 3. **VISUAL_ARCHITECTURE_DIAGRAM.md** (For Visual Learners)
Beautiful ASCII diagrams showing:
- HTTP/REST flow (proxied through Next.js)
- WebSocket Realtime flow (DIRECT, not proxied)
- Complete event flow (backend → browser)
- Why WebSocket can't be proxied (with visual explanation)
- Directory structure with purposes
- Simplified architecture diagram

**Best for**: Visual learners, presentations (15 minutes)

---

### 4. **CODE_EXECUTION_FLOW.md** (Line-by-Line Code)
Actual code walkthrough with:
- Step 1-10: Vapi webhook to UI update
- Each step includes actual code snippets
- HTTP request/response examples
- SQL queries shown
- WebSocket message format
- Execution timeline table
- Key code locations quick reference

**Best for**: Developers implementing or debugging (20 minutes)

---

## How They Fit Together

```
Want quick understanding?
  ↓
Start: QUICK_START_GUIDE.md (10 min)
  ↓
Want more detail?
  ↓
Read: NETWORK_FLOW_DIAGRAM.md (30 min)
  ↓
Want to see code?
  ↓
Study: CODE_EXECUTION_FLOW.md (20 min)
  ↓
Want visuals?
  ↓
Reference: VISUAL_ARCHITECTURE_DIAGRAM.md (15 min)
```

---

## The 3 Critical Files You Need to Know

### 1. Frontend Hook: `useVapiCallRealtime.ts`
```typescript
// Creates WebSocket subscription
const channel = supabase
  .channel(`vapi-call-${callId}`)
  .on('postgres_changes', {...}, (payload) => {
    // When event arrives → invalidate cache
    queryClient.invalidateQueries({...})
  })
  .subscribe()
```
**What it does**: Listens for database changes via WebSocket, tells React Query to refetch

### 2. Backend Handler: `vapi_webhooks.py`
```python
# Receives webhook, writes to database
await client.table("vapi_calls")\
  .update({
    "transcript": new_transcript,
    "status": "in-progress"
  })\
  .eq("call_id", call_id)\
  .execute()
```
**What it does**: ONE line that triggers the entire real-time cascade!

### 3. Client Factory: `client.ts`
```typescript
// Two different clients for two different purposes

createClient()               // HTTP (proxied through Next.js)
createRealtimeClient()       // WebSocket (DIRECT to Kong, NOT proxied)
```
**What it does**: Creates the right client for each job (HTTP vs WebSocket)

---

## The Complete Data Flow (One Diagram)

```
Vapi Webhook
    ↓
Backend receives (vapi_api.py)
    ↓
Handler processes (vapi_webhooks.py)
    ↓
⭐ Database writes (CRITICAL!)
    ↓
PostgreSQL triggers Realtime
    ↓
Realtime broadcasts JSON via WebSocket
    ↓
Browser hook receives (useVapiCallRealtime.ts)
    ↓
React Query cache invalidated
    ↓
Auto-refetch via HTTP GET
    ↓
Fresh data returned
    ↓
Component re-renders
    ↓
✅ UI updates in real-time!
```

---

## Key Insights

### 1. Why Two Supabase Clients?
```
createClient()
├─ Uses: window.location.origin (localhost:3000 or kortix.syhc.dev)
├─ Proxies through: Next.js rewrites
└─ For: HTTP API (Auth, REST, Storage)

createRealtimeClient()
├─ Uses: NEXT_PUBLIC_REALTIME_URL (kong.kortix.syhc.dev)
├─ Proxies through: NOTHING (direct connection!)
└─ For: WebSocket (can't proxy WebSocket through Next.js!)
```

### 2. The Trigger Point
One database write triggers everything:
```python
await client.table("vapi_calls").update({...}).execute()
         ↓
    PostgreSQL UPDATE
         ↓
    WAL Event generated
         ↓
    Realtime service detects
         ↓
    Broadcasts to 1000s of subscribers
```

### 3. No Polling Required
- Browser doesn't ask "Is there new data?"
- Database tells browser "Data changed!" (via WebSocket)
- Instant updates, zero latency

---

## Where Each File Is Located

```
In your `.docs/.initialsetup/9. supabase-realtime/` folder:

QUICK_START_GUIDE.md          ← ⭐ START HERE
NETWORK_FLOW_DIAGRAM.md       ← Most detailed
VISUAL_ARCHITECTURE_DIAGRAM.md ← For visuals
CODE_EXECUTION_FLOW.md        ← Line-by-line code
DOCUMENTATION_INDEX.md        ← Index of all docs
```

---

## What These Docs Answer

✅ How does real-time work?
✅ What file talks to what?
✅ Where does data move?
✅ How do APIs communicate?
✅ What's the WebSocket role?
✅ Why can't Next.js proxy WebSocket?
✅ What environment variables matter?
✅ Where is the trigger point?
✅ How does React integrate?
✅ What breaks real-time?
✅ How do I debug it?
✅ How do I implement new features?

---

## Quick Example: Tracing a Vapi Call Update

**Question**: "How does my UI see a Vapi call transcript update in real-time?"

**Answer** (with file names):

1. **Vapi sends webhook**
   → External service → Backend

2. **Backend receives**
   → `backend/core/vapi_api.py` → handle_vapi_webhook()

3. **Backend processes**
   → `backend/core/vapi_webhooks.py` → _handle_transcript_updated()

4. **Database writes**
   → `backend/core/services/supabase.py` → client.table("vapi_calls").update()

5. **Supabase triggers realtime**
   → PostgreSQL WAL → Realtime service

6. **Browser receives via WebSocket**
   → `frontend/src/lib/supabase/client.ts` → createRealtimeClient()

7. **Hook processes event**
   → `frontend/src/hooks/useVapiCallRealtime.ts` → callback receives JSON

8. **React Query refetches**
   → queryClient.invalidateQueries()

9. **UI updates**
   → Component re-renders with new transcript ✅

---

## The Issue You're Facing (Based on Previous Context)

The documentation you reviewed previously attempted to fix:

**Problem**: WebSocket connections to Supabase Realtime weren't working

**Solution Implemented**: 
- Created separate `createRealtimeClient()` function
- Made it connect DIRECTLY to Kong (not through Next.js)
- Set `NEXT_PUBLIC_REALTIME_URL` environment variable
- Updated all hooks to use the new client

**Status**: ✅ Already implemented in your codebase

**Why It Still Might Not Work**:
1. Kong might not be accessible at `kong.kortix.syhc.dev`
2. WebSocket connection might be failing (check browser DevTools → Network → WS)
3. Table might not be in `supabase_realtime` publication
4. Environment variable might not be set correctly

**To Debug**: Follow troubleshooting steps in the new docs!

---

## Next Steps

1. **Read**: `QUICK_START_GUIDE.md` (10 minutes)
2. **Understand**: The 3 key files and what they do
3. **Check**: Browser console for WebSocket errors
4. **Verify**: Kong is accessible and Realtime working
5. **Use**: The troubleshooting guide if issues persist

---

## Navigation Quick Links

- **Quick Overview**: Start with `QUICK_START_GUIDE.md`
- **Complete Reference**: Read `NETWORK_FLOW_DIAGRAM.md`
- **Visual Learner**: Use `VISUAL_ARCHITECTURE_DIAGRAM.md`
- **Code Details**: Study `CODE_EXECUTION_FLOW.md`
- **Debugging**: Reference `TROUBLESHOOTING.md` (already exists)
- **Setup**: Follow `IMPLEMENTATION_GUIDE.md` (already exists)

---

## Final Note

The real-time system in Suna is actually quite elegant:

1. **Backend** writes one line of code → database
2. **Database** triggers Realtime automatically
3. **Frontend hook** receives event automatically
4. **React Query** refetches automatically
5. **UI** updates automatically ✅

No polling, no manual refreshing, no websocket management code needed. It just works!

The issue in your setup is almost certainly in the **infrastructure/network layer** (Kong accessibility, environment variables) rather than the code itself.

Use the new documentation to diagnose which layer is broken! 🚀

