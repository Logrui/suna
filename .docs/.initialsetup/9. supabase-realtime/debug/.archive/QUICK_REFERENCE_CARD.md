# Suna Real-Time: Quick Reference Card

**Print this or bookmark it!**

---

## 30-Second Summary

Real-time in Suna works like this:

```
Backend writes to DB → PostgreSQL triggers Realtime 
→ WebSocket broadcasts JSON to browser 
→ React hook receives event 
→ Cache invalidates → Auto-refetch 
→ UI updates ✅
```

---

## The 3 Key Files

```
┌─────────────────────────────────────────────────────┐
│ File 1: useVapiCallRealtime.ts                      │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Creates WebSocket subscription                  │ │
│ │ Listens: vapi_calls table for changes          │ │
│ │ On event: invalidates React Query cache        │ │
│ │ Result: Auto-refetch & UI update               │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ File 2: vapi_webhooks.py                            │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Receives webhook from Vapi                     │ │
│ │ Writes to: vapi_calls table                    │ │
│ │ This triggers: PostgreSQL WAL                  │ │
│ │ Which triggers: Realtime broadcast             │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ File 3: client.ts                                   │
│ ┌─────────────────────────────────────────────────┐ │
│ │ createClient()           (HTTP, proxied)        │ │
│ │ createRealtimeClient()   (WebSocket, direct)    │ │
│ │                                                 │ │
│ │ Why different?                                  │ │
│ │ WebSocket can't be proxied through Next.js!    │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

---

## Environment Variables

```
Frontend (.env.local):
├─ NEXT_PUBLIC_SUPABASE_URL=http://kong.kortix.syhc.dev/
│  └─ For HTTP (Auth, REST) - proxied through Next.js
│
└─ NEXT_PUBLIC_REALTIME_URL=http://kong.kortix.syhc.dev/
   └─ For WebSocket - DIRECT to Kong (not proxied!)

Backend (.env):
└─ SUPABASE_URL=http://supabase-kong:8000
   └─ Internal Docker network (not localhost!)
```

---

## Data Flow (with times)

```
t=0   Vapi Webhook sent
      ↓
t=1   Backend receives (vapi_api.py)
      ↓
t=2   Handler processes (vapi_webhooks.py)
      ↓
t=3   Database writes (Supabase)
      ↓
t=4   PostgreSQL triggers Realtime
      ↓
t=5   Realtime broadcasts to browser
      ↓
t=6   Hook receives (useVapiCallRealtime.ts)
      ↓
t=7   Cache invalidated (React Query)
      ↓
t=8   Auto-refetch started
      ↓
t=9   Backend returns fresh data
      ↓
t=10  Component re-renders
      ↓
✅    UI UPDATED! (usually ~500-1000ms total)
```

---

## WebSocket vs HTTP (The Key Difference)

```
HTTP Requests (proxied):
Browser → Next.js → Backend → Supabase
├─ Works for: Auth, REST API, Storage
├─ Proxy: ✅ YES (Next.js rewrites)
└─ Example: GET /api/vapi/calls/{id}

WebSocket (NOT proxied):
Browser → Kong (DIRECT) ← Supabase Realtime
├─ Works for: Real-time subscriptions
├─ Proxy: ❌ NO (Next.js can't proxy WebSocket)
└─ Example: ws://kong.kortix.syhc.dev/realtime/v1/websocket
```

---

## How to Verify It's Working

```
✅ Browser DevTools → Network → Filter "WS"
   └─ Should see: wss://kong.../realtime/v1/websocket
   └─ Status: 101 Switching Protocols

✅ Browser Console
   └─ Should see: [Vapi Realtime] Setting up subscription
   └─ Should see: [Vapi Realtime] Change received

✅ Database (after webhook)
   └─ Should see: Updated row in vapi_calls table

✅ UI
   └─ Should update automatically within 1 second
```

---

## Quick Troubleshooting

```
Problem: WebSocket won't connect
├─ Check: NEXT_PUBLIC_REALTIME_URL is set
├─ Check: Kong accessible at that URL
└─ Fix: Verify environment variables & Kong running

Problem: Real-time event received but UI doesn't update
├─ Check: React Query cache key matches
├─ Check: Component actually using hook
└─ Fix: Verify query keys in hook & component match

Problem: Backend can't write to database
├─ Check: SUPABASE_URL is INTERNAL Docker hostname
├─ Check: Not using localhost, use supabase-kong:8000
└─ Fix: Update backend .env

Problem: Data updates but WebSocket never fires
├─ Check: Table is in supabase_realtime publication
├─ Check: PostgreSQL migration was applied
└─ Fix: Run migration or alter publication
```

---

## Code Pattern: Create a New Real-Time Hook

```typescript
// Copy this pattern to make a new realtime hook:

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createRealtimeClient } from '@/lib/supabase/client'

export function useMyTableRealtime(recordId?: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!recordId) return

    const supabase = createRealtimeClient()

    const channel = supabase
      .channel(`my-table-${recordId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'my_table',  // ← YOUR TABLE NAME
          filter: `record_id=eq.${recordId}`
        },
        (payload) => {
          // Invalidate cache to trigger refetch
          queryClient.invalidateQueries({
            queryKey: ['my-table', recordId]  // ← YOUR QUERY KEY
          })
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [recordId, queryClient])
}
```

---

## File Locations Quick Reference

```
Frontend
├─ src/hooks/useVapiCallRealtime.ts          ← Real-time hook
├─ src/lib/supabase/client.ts                ← Client factory
├─ src/components/thread/ThreadComponent.tsx ← Uses hook
├─ next.config.ts                             ← HTTP rewrites
└─ .env.local                                 ← Env vars

Backend
├─ core/vapi_webhooks.py                     ← Webhook handler
├─ core/services/supabase.py                 ← DB connection
└─ .env                                       ← Env vars

Supabase
├─ Kong Gateway (port 8000)                  ← API gateway
├─ Realtime Service (port 4000)              ← WebSocket handler
└─ PostgreSQL (port 5432)                    ← Database
```

---

## The Realtime Publication Setup

```sql
-- Tables that support real-time must be published:

-- Check if published:
SELECT * FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';

-- Should return: vapi_calls, projects, etc.

-- If missing, add table:
ALTER PUBLICATION supabase_realtime ADD TABLE vapi_calls;
```

---

## One-Line Explanation

> "Backend writes to database once, JavaScript receives the change via WebSocket instantly, React Query refetches data automatically, UI updates in milliseconds. No polling, no manual refreshing, pure real-time magic."

---

## Documentation Links

```
Start here:
  → QUICK_START_GUIDE.md

Comprehensive reference:
  → NETWORK_FLOW_DIAGRAM.md

Visual learner?
  → VISUAL_ARCHITECTURE_DIAGRAM.md

Code details:
  → CODE_EXECUTION_FLOW.md

Troubleshooting:
  → TROUBLESHOOTING.md

Setup:
  → IMPLEMENTATION_GUIDE.md
```

---

## Remember These 5 Things

1. **Two Clients**: HTTP (proxied) vs WebSocket (direct)
2. **One Trigger**: Database write = realtime cascade
3. **Direct Connection**: WebSocket CANNOT be proxied through Next.js
4. **Hook Pattern**: Listen → Invalidate → Auto-refetch
5. **No Polling**: Database tells browser, not the other way around

---

## Quick Test (5 minutes)

1. Open: Browser DevTools → Network tab
2. Filter: "WS"
3. Look for: `wss://kong.../realtime/v1/websocket`
4. Make a change in app (e.g., Vapi call)
5. Check: WebSocket receives message
6. Verify: `[Vapi Realtime]` logs in console
7. Confirm: UI updates automatically

If all green → Real-time working! ✅

---

## Common Mistakes

❌ Using `createClient()` for realtime subscriptions
   → Use `createRealtimeClient()` instead!

❌ Setting NEXT_PUBLIC_REALTIME_URL to localhost:3000
   → Use Kong URL (kong.kortix.syhc.dev)

❌ Setting backend SUPABASE_URL to localhost
   → Use Docker internal hostname (supabase-kong:8000)

❌ Forgetting to add table to supabase_realtime publication
   → Run migration or alter publication

❌ Wrong React Query cache key
   → Must match between hook and component

---

## Performance Tips

- Realtime broadcasts to ALL subscribers
- Each WebSocket uses minimal bandwidth (~1KB per update)
- Browsers auto-reconnect if connection drops
- Configure multiple connections if needed
- Use event filtering to reduce noise

---

## When to Use Real-Time

✅ Live call transcripts (Vapi)
✅ Sandbox updates (Projects)
✅ Chat messages
✅ Collaborative editing
✅ Live notifications
✅ Any table that changes frequently

❌ Infrequent background jobs
❌ Large batch operations
❌ One-time setup data

---

## Pro Tips

1. **Always filter** by relevant ID to reduce messages
2. **Test WebSocket** in browser DevTools first
3. **Check logs** for `[Vapi Realtime]` when debugging
4. **Verify table publication** if events never arrive
5. **Monitor Kong** if WebSocket connects but no messages
6. **Use cache keys** consistently everywhere
7. **Test locally** before deploying to production

---

**Created**: November 5, 2025  
**Status**: Production Ready  
**Questions?** Check the full documentation in 9. supabase-realtime/ folder!

