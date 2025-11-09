# Suna Real-Time: Code-Level Execution Flow

## Complete Code Walkthrough: Vapi Call Real-Time Update

This document traces the EXACT code execution path for a real-time Vapi call update.

---

## 1. VAPI WEBHOOK ARRIVES AT BACKEND

### External Vapi Service sends webhook:
```
POST https://kortix.syhc.dev/api/webhooks/vapi
Content-Type: application/json

{
  "message": {
    "type": "transcript.updated",
    "call": {
      "id": "abc123def456",
      "customer": { "number": "+1234567890" },
      "status": "in-progress",
      "createdAt": "2025-11-05T10:00:00Z"
    },
    "artifact": {
      "messages": [
        {
          "role": "user",
          "message": "Hello, how can I help?",
          "time": "2025-11-05T10:00:05Z"
        },
        {
          "role": "assistant",
          "message": "Hi there! I'm happy to assist.",
          "time": "2025-11-05T10:00:07Z"
        }
      ]
    }
  }
}
```

### Next.js routes it:
**File**: `frontend/next.config.ts` (lines 14-15)
```typescript
{
  source: '/api/:path*',
  destination: `http://backend:8000/api/:path*`,  // Docker internal
}
```

### FastAPI receives it:

**File**: `backend/core/vapi_api.py` (lines 18-31)
```python
@router.post("/webhooks/vapi", summary="Vapi Webhook Handler")
async def handle_vapi_webhook(request: Request):
    try:
        payload = await request.json()
        
        # Extract event type from payload
        event_type = (
            payload.get("message", {}).get("type")  # "transcript.updated"
            if "message" in payload
            else payload.get("type") or payload.get("event")
        )
        
        if not event_type:
            return {"status": "ok", "message": "Event type not recognized"}
        
        # Call webhook handler
        return await webhook_handler.handle_webhook(event_type, payload)
    
    except Exception as e:
        logger.error(f"Error processing Vapi webhook: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
```

---

## 2. WEBHOOK HANDLER PROCESSES EVENT

**File**: `backend/core/vapi_webhooks.py` (lines 80-102)

```python
async def handle_webhook(self, event_type: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    try:
        handlers = {
            "conversation-update": self._handle_conversation_update,
            "status-update": self._handle_status_update,
            "end-of-call-report": self._handle_end_of_call_report,
            "call.started": self._handle_call_started,
            "call.ended": self._handle_call_ended,
            "transcript.updated": self._handle_transcript_updated,  # ← OUR EVENT
            "assistant-request": self._handle_assistant_request,
            "speech-update": lambda p: {"status": "ok"}
        }
        
        handler = handlers.get(event_type)  # Gets _handle_transcript_updated
        if handler:
            return await handler(payload)  # Call the handler
        else:
            return {"status": "unhandled"}
    
    except Exception as e:
        logger.error(f"Error handling webhook event {event_type}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

---

## 3. HANDLER UPDATES DATABASE

**File**: `backend/core/vapi_webhooks.py` (lines 113-160)

```python
async def _handle_transcript_updated(self, payload: Dict[str, Any]) -> Dict[str, Any]:
    call_id = self._extract_call_id(payload)  # "abc123def456"
    call = self._extract_call_data(payload)    # Call data
    
    if not call_id:
        return {"status": "error", "message": "Missing call ID"}
    
    client = await self.db.client  # Get Supabase client
    
    message_data = payload.get("message", {})
    artifact = message_data.get("artifact", {})
    messages = artifact.get("messages", [])
    
    # Process transcript
    transcript_data = self._process_messages(messages)  # Convert to transcript format
    # Result: [
    #   {"role": "user", "message": "Hello, how can I help?", "timestamp": "..."},
    #   {"role": "assistant", "message": "Hi there! I'm happy to assist.", "timestamp": "..."}
    # ]
    
    status = "in-progress" if transcript_data else call.get("status", "in-progress")
    
    update_data = {
        "transcript": transcript_data,
        "status": status,
        "updated_at": "now()"  # PostgreSQL function
    }
    
    try:
        # Check if call exists
        result = await client.table("vapi_calls")\
            .select("*")\
            .eq("call_id", call_id)\
            .execute()
        
        if result.data:
            # 🔴 HERE'S THE CRITICAL UPDATE 🔴
            await client.table("vapi_calls")\
                .update(update_data)\
                .eq("call_id", call_id)\
                .execute()
            # This sends to: http://supabase-kong:8000/rest/v1/vapi_calls
        else:
            # Call doesn't exist yet, insert it
            new_call = {
                "call_id": call_id,
                "phone_number": call.get("customer", {}).get("number"),
                "direction": "outbound" if call.get("type") == "outboundPhoneCall" else "inbound",
                "status": status,
                "transcript": transcript_data,
                "started_at": call.get("createdAt")
            }
            await client.table("vapi_calls").insert(new_call).execute()
    
    except Exception as e:
        logger.error(f"Database operation failed for call {call_id}: {e}")
        return {"status": "error", "message": str(e)}
    
    return {"status": "success"}
```

---

## 4. SUPABASE CLIENT SENDS TO DATABASE

**File**: `backend/core/services/supabase.py` (lines 27-91)

```python
class DBConnection:
    """Thread-safe singleton database connection manager using Supabase."""
    
    _instance: Optional['DBConnection'] = None
    _lock = threading.Lock()

    @property
    async def client(self) -> AsyncClient:
        """
        Returns the Supabase async client.
        Lazily initializes on first access.
        """
        if not self._initialized:
            await self.initialize()
        return self._client
    
    async def initialize(self):
        """Initialize the database connection."""
        if self._initialized:
            return
        
        try:
            supabase_url = config.SUPABASE_URL  # http://supabase-kong:8000 (Docker internal)
            supabase_key = (
                config.SUPABASE_SERVICE_ROLE_KEY or 
                config.SUPABASE_ANON_KEY
            )
            
            if not supabase_url or not supabase_key:
                raise RuntimeError("Missing Supabase configuration")
            
            # Create async Supabase client
            self._client = await create_async_client(
                supabase_url,
                supabase_key
            )
            
            self._initialized = True
            logger.debug(f"Supabase client initialized: {supabase_url}")
        
        except Exception as e:
            logger.error(f"Failed to initialize Supabase client: {e}")
            raise
```

### The actual HTTP request sent by Supabase client:

```http
POST http://supabase-kong:8000/rest/v1/vapi_calls?id=eq.abc123def456 HTTP/1.1
Host: supabase-kong:8000
Authorization: Bearer eyJ...SERVICE_ROLE_KEY...
Content-Type: application/json

{
  "transcript": [
    {"role": "user", "message": "Hello, how can I help?", "timestamp": "..."},
    {"role": "assistant", "message": "Hi there! I'm happy to assist.", "timestamp": "..."}
  ],
  "status": "in-progress",
  "updated_at": "now()"
}
```

---

## 5. SUPABASE RECEIVES & UPDATES DATABASE

### Kong routes to PostgREST (Port 3000):

```http
POST /rest/v1/vapi_calls HTTP/1.1
Authorization: Bearer eyJ...
```

### PostgREST converts to SQL:

```sql
UPDATE public.vapi_calls
SET 
  transcript = '[
    {"role": "user", "message": "Hello, how can I help?", "timestamp": "..."},
    {"role": "assistant", "message": "Hi there! I'm happy to assist.", "timestamp": "..."}
  ]'::jsonb,
  status = 'in-progress',
  updated_at = NOW()
WHERE call_id = 'abc123def456';
```

### PostgreSQL executes:

```
UPDATE 1 row
```

---

## 6. POSTGRESQL TRIGGERS REALTIME

### PostgreSQL WAL (Write-Ahead Log) event is generated:

```
EventType: UPDATE
TableName: vapi_calls
ChangedRow: {
  call_id: "abc123def456",
  status: "in-progress",
  transcript: [{ role: "user", ... }, { role: "assistant", ... }],
  updated_at: "2025-11-05T10:00:08Z"
}
```

### Realtime service (Elixir) detects via WAL polling:

**Supabase Realtime checks:**
```
1. Is vapi_calls in supabase_realtime publication? ✅ YES
2. Is there an active WebSocket subscription for vapi_calls? 
   Yes: browser has subscribed to vapi-call-abc123def456 channel ✅
3. Convert change to JSON and broadcast
```

---

## 7. REALTIME BROADCASTS TO BROWSER VIA WEBSOCKET

### WebSocket message sent to browser:

```json
{
  "ref": "1",
  "topic": "realtime:public:vapi_calls:call_id=eq.abc123def456",
  "event": "postgres_changes",
  "payload": {
    "data": {
      "type": "UPDATE",
      "schema": "public",
      "table": "vapi_calls",
      "commit_timestamp": "2025-11-05T10:00:08.123456Z",
      "new": {
        "call_id": "abc123def456",
        "phone_number": "+1234567890",
        "status": "in-progress",
        "transcript": [
          {"role": "user", "message": "Hello, how can I help?"},
          {"role": "assistant", "message": "Hi there! I'm happy to assist."}
        ],
        "updated_at": "2025-11-05T10:00:08Z"
      },
      "old": {
        "call_id": "abc123def456",
        "status": "in-progress",
        "transcript": [
          {"role": "user", "message": "Hello, how can I help?"}
        ],
        "updated_at": "2025-11-05T10:00:05Z"
      }
    }
  }
}
```

---

## 8. BROWSER RECEIVES & PROCESSES

### Browser DevTools shows WebSocket connection:

```
Name: wss://kong.kortix.syhc.dev/realtime/v1/websocket
Status: 101 Switching Protocols (Connection upgraded)
Type: websocket
```

### Supabase Realtime JS client receives message:

**File**: `frontend/src/hooks/useVapiCallRealtime.ts` (lines 22-90)

```typescript
'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createRealtimeClient } from '@/lib/supabase/client';

export function useVapiCallRealtime(callId?: string, threadId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!callId && !threadId) return;

    // ⭐ CREATE REALTIME CLIENT - DIRECT TO KONG, NOT PROXIED
    const supabase = createRealtimeClient();
    
    const channelName = callId 
      ? `vapi-call-${callId}`           // "vapi-call-abc123def456"
      : `vapi-calls-thread-${threadId}`;

    console.log(`[Vapi Realtime] Setting up subscription for ${channelName}`);
    
    // ⭐ CREATE CHANNEL & SET UP LISTENER
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',                  // Event type
        {
          event: '*',                        // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',                  // Schema name
          table: 'vapi_calls',               // Table name
          filter: callId 
            ? `call_id=eq.${callId}`         // Only for this call
            : threadId 
            ? `thread_id=eq.${threadId}`     // Or this thread
            : undefined
        },
        (payload) => {                       // ⭐ CALLBACK WHEN EVENT RECEIVED
          console.log('[Vapi Realtime] Call update received:', {
            eventType: payload.eventType,    // "UPDATE"
            callId: (payload.new as VapiCall)?.call_id,
            status: (payload.new as VapiCall)?.status,
            transcriptLength: Array.isArray((payload.new as VapiCall)?.transcript) 
              ? (payload.new as VapiCall).transcript.length 
              : 'not array'
          });
          
          const newData = payload.new as VapiCall;
          const oldData = payload.old as VapiCall;

          // Check what changed
          if (payload.eventType === 'UPDATE' && newData) {
            if (newData.status !== oldData?.status) {
              console.log(
                `[Vapi Realtime] Status changed: ${oldData?.status} → ${newData.status}`
              );
            }

            if (newData.transcript) {
              const oldTranscriptLength = 
                Array.isArray(oldData?.transcript) 
                  ? oldData.transcript.length 
                  : 0;
              const newTranscriptLength = 
                Array.isArray(newData.transcript) 
                  ? newData.transcript.length 
                  : 0;
              
              if (newTranscriptLength !== oldTranscriptLength) {
                console.log(
                  `[Vapi Realtime] Transcript updated: ${oldTranscriptLength} → ${newTranscriptLength} messages`
                );
              }
            }
          }

          // ⭐⭐⭐ THE MAGIC: INVALIDATE REACT QUERY CACHE ⭐⭐⭐
          if (newData) {
            console.log('[Vapi Realtime] Invalidating and refetching queries for call:', newData.call_id);
            
            // Invalidate exact query
            queryClient.invalidateQueries({
              queryKey: ['vapi-call', newData.call_id],
              exact: true
            });
            
            // Invalidate monitor query
            queryClient.invalidateQueries({
              queryKey: ['vapi-call-monitor', newData.call_id],
              exact: true
            });

            // Invalidate thread-level queries
            if (newData.thread_id) {
              queryClient.invalidateQueries({
                queryKey: ['vapi-calls', newData.thread_id],
                exact: true
              });
            }
            
            // Refetch after short delay
            setTimeout(() => {
              queryClient.refetchQueries({
                queryKey: ['vapi-call', newData.call_id],
                exact: true,
                type: 'active'
              });
            }, 100);
          }
        }
      )
      .subscribe((status) => {
        console.log(`[Vapi Realtime] Subscription status: ${status}`);
      });

    // Cleanup: Unsubscribe when component unmounts
    return () => {
      console.log(`[Vapi Realtime] Unsubscribing from ${channelName}`);
      supabase.removeChannel(channel);
    };
  }, [callId, threadId, queryClient]);
}
```

---

## 9. REACT QUERY CACHE INVALIDATION TRIGGERS REFETCH

### Browser makes HTTP GET request for fresh data:

```http
GET /api/vapi/calls/abc123def456 HTTP/1.1
Host: localhost:3000
Cookie: ...
```

### Next.js rewrites to backend:

**File**: `frontend/next.config.ts`
```typescript
{
  source: '/api/:path*',
  destination: `http://backend:8000/api/:path*`
}
```

### Backend endpoint processes it:

**File**: `backend/core/vapi_api.py` (lines 36-50)
```python
@router.get("/vapi/calls/{call_id}", summary="Get Call Details")
async def get_call_details(call_id: str):
    try:
        from core.services.supabase import DBConnection
        db = DBConnection()
        client = await db.client
        
        # Query Supabase for current data
        result = await client.table("vapi_calls")\
            .select("*")\
            .eq("call_id", call_id)\
            .single()\
            .execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Call not found")
        
        # Return the current state
        return result.data
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving call details: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
```

### Response sent back to browser:

```json
{
  "call_id": "abc123def456",
  "phone_number": "+1234567890",
  "status": "in-progress",
  "transcript": [
    {"role": "user", "message": "Hello, how can I help?"},
    {"role": "assistant", "message": "Hi there! I'm happy to assist."}
  ],
  "started_at": "2025-11-05T10:00:00Z",
  "updated_at": "2025-11-05T10:00:08Z"
}
```

---

## 10. REACT COMPONENT RE-RENDERS

### useQuery hook receives new data:

**File**: Somewhere using `useVapiCall(callId)` hook

```typescript
// This hook was defined somewhere:
const { data: callData } = useQuery({
  queryKey: ['vapi-call', callId],
  queryFn: async () => {
    const response = await fetch(`/api/vapi/calls/${callId}`);
    return response.json();
  },
});

// When cache was invalidated:
// 1. Query status changed to "stale"
// 2. Automatic refetch triggered
// 3. Fresh data fetched from backend
// 4. callData updated
// 5. Component re-renders with new data
```

### Component renders with new transcript:

```tsx
{callData?.transcript?.map((msg, idx) => (
  <div key={idx} className={msg.role}>
    <strong>{msg.role}:</strong> {msg.message}
  </div>
))}

// Output:
// user: Hello, how can I help?
// assistant: Hi there! I'm happy to assist.
```

---

## COMPLETE EXECUTION TIMELINE

| Time | Component | Action | Code Location | Result |
|------|-----------|--------|----------------|--------|
| t=0 | Vapi | Sends webhook | External API | HTTP POST to backend |
| t=1 | Frontend → Backend | Routes request | next.config.ts | Request reaches FastAPI |
| t=2 | FastAPI | Receives webhook | vapi_api.py | Extracts event type |
| t=3 | Handler | Routes to handler | vapi_webhooks.py | Calls _handle_transcript_updated |
| t=4 | Handler | Extracts data | vapi_webhooks.py | Gets call_id, transcript |
| t=5 | Handler | Prepares update | vapi_webhooks.py | Builds update_data dict |
| t=6 | Supabase Client | Gets connection | supabase.py | Returns singleton client |
| t=7 | Supabase Client | Sends UPDATE | supabase.py | HTTP POST to supabase-kong:8000 |
| t=8 | Kong | Routes request | Kong Gateway | Sends to PostgREST |
| t=9 | PostgREST | Converts to SQL | Supabase | UPDATE vapi_calls SET ... |
| t=10 | PostgreSQL | Executes SQL | PostgreSQL | Row updated, WAL event logged |
| t=11 | Realtime Service | Detects change | Supabase Realtime | Polls PostgreSQL WAL |
| t=12 | Realtime Service | Broadcasts JSON | Supabase Realtime | Sends to all WebSocket clients |
| t=13 | Browser WebSocket | Receives message | Network | JSON payload arrives |
| t=14 | Supabase JS | Fires callback | supabase/realtime-js | Invokes postgres_changes listener |
| t=15 | Hook Callback | Processes event | useVapiCallRealtime.ts | Logs received message |
| t=16 | React Query | Invalidates cache | queryClient | Marks query as stale |
| t=17 | React Query | Triggers refetch | queryClient | Automatic refetch starts |
| t=18 | Browser | Makes HTTP GET | fetch() | Requests fresh data |
| t=19 | Frontend → Backend | Routes request | next.config.ts | Request reaches FastAPI |
| t=20 | FastAPI | Queries database | vapi_api.py | SELECT from vapi_calls |
| t=21 | Supabase | Returns data | PostgREST | Fresh row data |
| t=22 | Browser | Receives response | fetch() | Updated data in hand |
| t=23 | React Query | Updates cache | useQuery hook | Cache now has fresh data |
| t=24 | Component | Re-renders | Component | Renders with new transcript |
| t=25 | UI | Updates | Browser display | **User sees updated call! ✅** |

---

## Key Code Locations Quick Reference

| Feature | File | Lines | Purpose |
|---------|------|-------|---------|
| Receive webhook | `backend/core/vapi_api.py` | 18-31 | GET webhook from external service |
| Route to handler | `backend/core/vapi_api.py` | 18-31 | Extract event type and dispatch |
| Process webhook | `backend/core/vapi_webhooks.py` | 80-160 | Handle specific event types |
| **Write to DB** | `backend/core/vapi_webhooks.py` | 131 | **CRITICAL: Triggers realtime** |
| Get DB client | `backend/core/services/supabase.py` | 27-91 | Returns async Supabase client |
| Create RT client | `frontend/src/lib/supabase/client.ts` | 63-100 | Creates WebSocket client |
| Subscribe hook | `frontend/src/hooks/useVapiCallRealtime.ts` | 1-110 | Sets up realtime subscription |
| Invalidate cache | `frontend/src/hooks/useVapiCallRealtime.ts` | 68-85 | Triggers React Query refetch |
| HTTP rewrites | `frontend/next.config.ts` | 1-60 | Proxies HTTP requests to backend |
| Component mount | `frontend/src/components/thread/ThreadComponent.tsx` | 107 | Uses realtime hook |

