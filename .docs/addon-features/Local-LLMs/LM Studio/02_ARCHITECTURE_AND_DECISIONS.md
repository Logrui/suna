# Architecture & Design Decisions

**Purpose:** Technical reference and decision justification  
**Audience:** Architects, senior developers, tech leads  
**Read time:** 30 minutes

---

## System Architecture

### Complete Stack

```
┌──────────────────────────────────────────────────────────────┐
│                    Browser (User)                            │
│  - HTTP requests to frontend                                 │
│  - WebSocket connection to backend                           │
└────────────────────┬─────────────────────────────────────────┘
                     │ HTTPS + WSS://
                     ↓
┌──────────────────────────────────────────────────────────────┐
│               Frontend (Next.js on port 3000)                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ AgentModelSelector                                     │  │
│  │ - REST API: Calls warmup/unload endpoints            │  │
│  │                                                        │  │
│  │ useModelLoading Hook                                  │  │
│  │ - WebSocket: Listens to model_* events              │  │
│  │ - Toast: Shows notifications                         │  │
│  │                                                        │  │
│  │ ChatInput                                             │  │
│  │ - Non-blocking sends (always enabled)                │  │
│  └────────────────────────────────────────────────────────┘  │
└────────────────────┬─────────────────────────────────────────┘
                     │ REST (/api/...)
                     │ WebSocket (ws://...)
                     ↓
┌──────────────────────────────────────────────────────────────┐
│              Backend (FastAPI on port 8000)                  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ REST Endpoints                                         │  │
│  │ POST /api/models/warmup  → asyncio.create_task()    │  │
│  │ POST /api/models/unload  → asyncio.create_task()    │  │
│  │ GET  /api/models/{id}/status → Check status         │  │
│  │                                                        │  │
│  │ Returns IMMEDIATELY (non-blocking to frontend)       │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Async Background Tasks                               │  │
│  │ _trigger_model_load()  → 5-30 seconds                │  │
│  │ _unload_model()        → 1-2 seconds                 │  │
│  │ _broadcast_websocket_event() → Sends to all clients  │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ WebSocket Event Broadcaster                           │  │
│  │ Sends: model_loading, model_loaded,                  │  │
│  │        model_load_failed, model_unloading            │  │
│  └────────────────────────────────────────────────────────┘  │
└────────────────────┬─────────────────────────────────────────┘
                     │ HTTP (OpenAI-compatible: /v1/...)
                     │ HTTP (REST API: /api/v0/...)
                     ↓
┌──────────────────────────────────────────────────────────────┐
│        Local LLM Providers (Docker on same host)             │
│                                                              │
│  ┌──────────────────────┐    ┌─────────────────────────┐    │
│  │  LM Studio           │    │  Ollama                 │    │
│  │  (port 1234)         │    │  (port 11434)           │    │
│  │                      │    │                         │    │
│  │  /api/v0/ → REST API │    │  /api/ → REST API       │    │
│  │  - List models       │    │  - List models          │    │
│  │  - Model metadata    │    │  - Model metadata       │    │
│  │  - Unload models     │    │  (basic info only)      │    │
│  │                      │    │                         │    │
│  │  /v1/ → OpenAI       │    │  /v1/ → OpenAI          │    │
│  │  - Chat completions  │    │  - Chat completions     │    │
│  │  - Auto-loads model  │    │  - Auto-loads model     │    │
│  │    on first request   │    │    on first request     │    │
│  │                      │    │                         │    │
│  │  GPU: Loads model    │    │  GPU: Loads model       │    │
│  │  on inference        │    │  on inference           │    │
│  └──────────────────────┘    └─────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

---

## Request Flow Diagrams

### Happy Path: Select Model → Load → Send

```
Timeline (seconds)  What Happens                 Frontend UI
─────────────────  ────────────────────────────  ────────────────────
T=0                User clicks model dropdown
                   ↓ Sees: "Hermes-2-Pro"

T=0                User selects Hermes-2-Pro
                   ↓ AgentModelSelector calls:
                   ├─ POST /api/models/unload (previous)
                   └─ POST /api/models/warmup (new)

T=0.05             ✅ Both endpoints return immediately
                   ↓ Frontend gets response
                   Spinner appears, toast: "⏳ Loading..."

T=0.1              Backend spawns async tasks:
                   ├─ _trigger_model_load()
                   └─ Broadcasts "model_loading" event

T=0.15             useModelLoading hook receives event
                   ↓ Updates state.isLoading = true
                   Spinner shown, toast refreshed

T=1-30             Backend task runs (depends on model size):
                   ├─ Makes request to /v1/chat/completions
                   ├─ LM Studio loads model into GPU
                   ├─ Response received
                   └─ Broadcasts "model_loaded" event

T=1.5-30.5         useModelLoading hook receives event
                   ↓ Updates state.isLoading = false
                   Spinner disappears
                   Toast: "✅ Ready! (5000ms)"

T=2-31             User can send messages
                   ✅ Send button always enabled
                   ✅ Model is ready to inference
```

### Error Scenario: Provider Offline

```
Timeline  What Happens                 Frontend UI
────────  ────────────────────────────  ────────────────────
T=0       User clicks model dropdown

T=0       User selects model
          ↓ POST /api/models/warmup

T=0.05    ✅ Endpoint returns immediately

T=0.1     Backend spawns async task:
          _trigger_model_load()
          Toast: "⏳ Loading..."

T=5       Backend task tries to connect:
          httpx.AsyncClient().post() → ConnectError
          ❌ Cannot reach LM Studio (offline)

T=5.1     Error caught:
          Broadcasts "model_load_failed" event
          ├─ error: "Provider offline"
          └─ error_code: "CONNECT_ERROR"

T=5.2     useModelLoading hook receives event
          ↓ Updates state.error = "Provider offline"
          Toast: "❌ Failed to load model"
          Spinner disappears
          
T=6       User sees helpful error message
          ✅ Can select different provider or retry
```

### Non-blocking Scenario: Send During Loading

```
Timeline  What Happens                 User Experience
────────  ────────────────────────────  ────────────────────
T=0       User selects "Hermes-2-Pro"
          Toast: "⏳ Loading... (est 15s)"

T=0.5     User immediately types message
          ✅ Text input is active

T=1       User clicks Send
          ✅ Button is ENABLED
          Frontend calls: POST /api/threads/{id}/messages

T=1.1     Message sent! Response received
          ✅ No waiting for model load
          ✅ Toast: "Message sent"

T=5       Model finally finishes loading
          Toast: "✅ Hermes-2-Pro ready!"

T=6       User sends next message
          ✅ Model is fully loaded
          ✅ Faster response

Key: User never blocked, always can send
```

### Concurrent Scenario: Rapid Model Selection

```
Timeline  Action                           Backend State
────────  ──────────────────────────────   ────────────────
T=0       Select Model A
          POST /api/models/warmup(A)       Task: Loading A

T=0.2     See: "Loading A..." (toast)

T=2       Quickly select Model B
          POST /api/models/unload(A)       Task: Unload A
          POST /api/models/warmup(B)       Task: Loading B

T=2.1     Toast: "Loading B..."
          Previous "Loading A" toast dismissed

T=3       Background: Model A unloads
          Still loading B

T=8       Model B ready
          Toast: "✅ B ready!"
          Previous unfinished load of A ignored

Result: ✅ Graceful handling of rapid changes
         ✅ No VRAM conflicts
         ✅ Clean state management
```

---

## API Specifications

### Endpoint 1: POST /api/models/warmup

**Purpose:** Trigger background model loading  
**Returns:** Immediately (non-blocking)  
**Background:** Loads model into GPU asynchronously

**Request:**
```json
{
  "model_id": "hermes-2-pro",
  "provider": "lmstudio"
}
```

**Response (200 OK - immediate):**
```json
{
  "status": "warming_up",
  "model_id": "hermes-2-pro",
  "estimated_time": 15,
  "request_id": "req_12345"
}
```

**Background Task:** Broadcasts WebSocket events
- `model_loading` → Loading started
- `model_loaded` → Loading succeeded
- `model_load_failed` → Loading failed

**Error Cases:**
```json
// 400 Bad Request
{
  "error": "Invalid model_id",
  "details": "Model not found in registry"
}

// 503 Service Unavailable
{
  "error": "Provider unavailable",
  "details": "Cannot connect to LM Studio on port 1234"
}
```

---

### Endpoint 2: POST /api/models/unload

**Purpose:** Unload model to free VRAM  
**Returns:** Immediately (non-blocking)  
**Background:** Unloads model from GPU asynchronously

**Request:**
```json
{
  "model_id": "hermes-2-pro",
  "provider": "lmstudio"
}
```

**Response (200 OK - immediate):**
```json
{
  "status": "unloading",
  "model_id": "hermes-2-pro",
  "request_id": "req_12346"
}
```

**Background Task:**
- Calls provider-specific unload API
- Broadcasts `model_unloading` event (optional)
- Frees VRAM for next model

**Error Cases:**
```json
// 404 Not Found
{
  "error": "Model not loaded",
  "details": "hermes-2-pro is not currently loaded"
}

// 503 Service Unavailable
{
  "error": "Provider error",
  "details": "LM Studio unload failed"
}
```

---

### Endpoint 3: GET /api/models/{model_id}/status

**Purpose:** Check if model is loaded and ready  
**Returns:** Current status  
**Response Time:** <200ms

**Response (200 OK):**
```json
{
  "model_id": "hermes-2-pro",
  "provider": "lmstudio",
  "status": "loaded",
  "loaded_at": "2025-11-10T12:34:56Z",
  "load_time_ms": 5000,
  "context_window": 128000,
  "parameters": 7000000000,
  "quantization": "Q4_K_M",
  "memory_used_mb": 4096
}
```

**Possible Status Values:**
- `loaded` - Model is in GPU memory and ready
- `loading` - Currently loading into GPU
- `unloaded` - Not in GPU memory
- `error` - Last load attempt failed

**Error Cases:**
```json
// 404 Not Found
{
  "error": "Model not found",
  "details": "hermes-2-pro is not registered"
}

// 503 Service Unavailable
{
  "error": "Provider unavailable"
}
```

---

## WebSocket Event Specifications

### Connection

**URL:** `ws://localhost:8000/ws` (or `wss://` for HTTPS)

**Subscribe to Channel:**
```json
{
  "type": "subscribe",
  "channel": "model_events"
}
```

**Subscription Confirmation:**
```json
{
  "type": "subscribed",
  "channel": "model_events",
  "timestamp": "2025-11-10T12:34:56Z"
}
```

---

### Event 1: model_loading

**When:** Warmup task starts  
**Payload:**
```json
{
  "type": "model_loading",
  "model_id": "hermes-2-pro",
  "provider": "lmstudio",
  "estimated_time": 15,
  "timestamp": "2025-11-10T12:34:56.100Z"
}
```

**Frontend Action:**
```typescript
case 'model_loading':
  setState(prev => ({
    ...prev,
    isLoading: true,
    currentModel: data.model_id,
    status: 'loading'
  }))
  toast.show({
    title: `⏳ Loading ${data.model_id}...`,
    description: `Est. ${data.estimated_time}s`
  })
```

---

### Event 2: model_loaded

**When:** Model successfully loaded and ready  
**Payload:**
```json
{
  "type": "model_loaded",
  "model_id": "hermes-2-pro",
  "provider": "lmstudio",
  "load_time_ms": 5000,
  "timestamp": "2025-11-10T12:34:56.100Z"
}
```

**Frontend Action:**
```typescript
case 'model_loaded':
  setState(prev => ({
    ...prev,
    isLoading: false,
    status: 'loaded',
    loadTimeMs: data.load_time_ms
  }))
  toast.show({
    title: `✅ ${data.model_id} ready!`,
    description: `Loaded in ${data.load_time_ms}ms`
  })
```

---

### Event 3: model_load_failed

**When:** Model loading failed  
**Payload:**
```json
{
  "type": "model_load_failed",
  "model_id": "hermes-2-pro",
  "provider": "lmstudio",
  "error": "Connection timeout after 30s",
  "error_code": "TIMEOUT",
  "timestamp": "2025-11-10T12:34:56.100Z"
}
```

**Error Codes:**
- `CONNECT_ERROR` - Provider offline
- `TIMEOUT` - Load took too long
- `NOT_FOUND` - Model doesn't exist
- `OUT_OF_MEMORY` - Not enough VRAM
- `UNKNOWN` - Other error

**Frontend Action:**
```typescript
case 'model_load_failed':
  setState(prev => ({
    ...prev,
    isLoading: false,
    status: 'error',
    error: data.error
  }))
  toast.show({
    title: `❌ Failed to load ${data.model_id}`,
    description: data.error,
    variant: 'destructive'
  })
```

---

### Event 4: model_unloading

**When:** Model unload starts (optional event)  
**Payload:**
```json
{
  "type": "model_unloading",
  "model_id": "hermes-2-pro",
  "provider": "lmstudio",
  "reason": "user_selected_new_model",
  "timestamp": "2025-11-10T12:34:56.100Z"
}
```

**Reason Values:**
- `user_selected_new_model` - User selected different model
- `memory_pressure` - System needs VRAM
- `timeout` - Model idle timeout
- `manual` - Explicit unload request

**Frontend Action:** Optional (usually silent)
```typescript
case 'model_unloading':
  setState(prev => ({
    ...prev,
    status: 'unloading'
  }))
  // Optional: Show subtle notification
```

---

## State Management

### useModelLoading Hook State

```typescript
interface ModelLoadingState {
  // Current loading state
  isLoading: boolean           // true if any model loading
  status: 'idle' | 'loading' | 'loaded' | 'error' | 'unloading'
  
  // Model info
  currentModel: string | null  // Model being loaded/loaded
  previousModel: string | null // Last model before unload
  
  // Timing
  loadTimeMs: number | null    // How long last load took
  
  // Error info
  error: string | null         // Error message if status='error'
}
```

### State Transitions

```
Initial: { isLoading: false, status: 'idle', currentModel: null }

User selects model:
  → { isLoading: true, status: 'loading', currentModel: 'hermes-2-pro' }

Model loads:
  → { isLoading: false, status: 'loaded', currentModel: 'hermes-2-pro', loadTimeMs: 5000 }

Loading fails:
  → { isLoading: false, status: 'error', error: 'Connection timeout' }

User selects new model:
  → { isLoading: true, status: 'unloading', previousModel: 'hermes-2-pro' }
  → { isLoading: true, status: 'loading', currentModel: 'mistral-7b' }
  → { isLoading: false, status: 'loaded', currentModel: 'mistral-7b', loadTimeMs: 3000 }
```

---

## Error Handling Strategy

### Backend Error Handling

**Principle:** Fail gracefully, broadcast errors to frontend

```python
async def _trigger_model_load(model_id: str, provider: str):
    try:
        # ... load logic ...
        broadcast("model_loaded", {...})
    
    except httpx.ConnectError:
        broadcast("model_load_failed", {
            "error": "Provider offline",
            "error_code": "CONNECT_ERROR"
        })
    
    except asyncio.TimeoutError:
        broadcast("model_load_failed", {
            "error": "Loading timed out (30s)",
            "error_code": "TIMEOUT"
        })
    
    except KeyError:
        broadcast("model_load_failed", {
            "error": f"Model {model_id} not found",
            "error_code": "NOT_FOUND"
        })
    
    except Exception as e:
        logger.error(f"Load error: {e}")
        broadcast("model_load_failed", {
            "error": "Unknown error",
            "error_code": "UNKNOWN"
        })
```

### Frontend Error Handling

**Principle:** Show helpful messages, allow retry

```typescript
if (state.error) {
  return (
    <div className="bg-red-50 p-3 rounded">
      <p className="text-red-800 font-semibold">Failed to load model</p>
      <p className="text-red-600 text-sm">{state.error}</p>
      <button onClick={() => retryLoad()}>Retry</button>
    </div>
  )
}

// Recovery options by error:
// CONNECT_ERROR → Show: "Check if LM Studio is running"
// TIMEOUT → Show: "Model is very large, try smaller model"
// NOT_FOUND → Show: "Model not available, refresh list"
// OUT_OF_MEMORY → Show: "Not enough VRAM, unload other models"
```

---

## Performance Considerations

### Response Times Target

| Operation | Target | Notes |
|-----------|--------|-------|
| Warmup endpoint | <100ms | Just returns immediately |
| Unload endpoint | <100ms | Just returns immediately |
| Status endpoint | <200ms | Query from cache |
| WebSocket event | <1s | Propagates to all clients |
| Model load | 5-30s | Depends on model size and GPU |
| Model unload | 1-2s | Fast operation |

### Optimization Strategies

**1. Caching Model Metadata**
```python
# Cache at startup
model_cache = {
    "hermes-2-pro": {
        "context_window": 128000,
        "quantization": "Q4_K_M",
        "size_mb": 4096
    }
}

# Serve from cache (no provider calls)
@router.get("/api/models/{model_id}/status")
def get_model_status(model_id: str):
    return model_cache[model_id]  # O(1) lookup
```

**2. Broadcast via Supabase Realtime**
```python
# Instead of direct WebSocket, use Supabase
# Scales better, handles multiple connections
supabase.realtime.broadcast(
    channel="model_events",
    event="model_loaded",
    message={"model_id": "hermes-2-pro"}
)
```

**3. Debounce Rapid Selections**
```typescript
// Frontend: Don't spam calls if user selects rapidly
const handleModelChange = debounce(
  (model) => fetch('/api/models/warmup', ...),
  500  // Wait 500ms after last selection
)
```

**4. Model Preloading Strategy**
```python
# Optional: Pre-load frequently used models on startup
async def startup():
    for popular_model in ["hermes-2-pro", "mistral-7b"]:
        asyncio.create_task(_trigger_model_load(popular_model))
```

---

## Why Hybrid REST + OpenAI-Compatible?

### The Problem

The OpenAI-compatible API (`/v1/*`) is great for inference but **lacks discovery information**:

| Information | REST API | OpenAI-Compatible |
|-------------|----------|-------------------|
| Model name | ✅ | ✅ |
| Context window | ✅ | ❌ |
| Quantization | ✅ | ❌ |
| Model type (chat/embedding) | ✅ | ❌ |
| Parameter count | ✅ | ❌ |
| Architecture | ✅ | ❌ |

**Why it matters:**
- **Context window:** Token counting (can't fit prompt without it)
- **Quantization:** VRAM calculation (Q4 vs Q8 is 2x difference)
- **Model type:** Can't distinguish embeddings from chat models
- **Parameters:** Helps users understand model size

### The Solution: Hybrid Approach

**Strategy:**
1. **Startup:** Call REST API ONCE to get all model metadata
2. **Runtime:** Use OpenAI-compatible for every inference
3. **LiteLLM Router:** Abstracts provider differences

**Implementation:**
```python
# Startup: REST for discovery
models = await fetch(f"{LM_STUDIO}/api/v0/models")
model_cache = {m['id']: m for m in models}  # Cache metadata

# Runtime: OpenAI-compatible for inference
response = await fetch(
    f"{LM_STUDIO}/v1/chat/completions",
    json={...}
)  # Uses cached metadata to make decisions
```

### Benefits

✅ **Complete information** for UI (model selector, filters)  
✅ **Fast inference** (no discovery calls during chat)  
✅ **Standard protocol** (any OpenAI-compatible server)  
✅ **Cost effective** (discovery once, inference many times)  
✅ **Fallback capable** (if REST fails, can still inference)

---

## Testing Strategy

### Unit Tests

**Backend:**
```python
def test_warmup_returns_immediately():
    response = client.post("/api/models/warmup", ...)
    assert response.status_code == 200
    assert response.json()["status"] == "warming_up"
    # Verify no blocking occurred
    assert (time.time() - start) < 0.1

def test_unload_returns_immediately():
    response = client.post("/api/models/unload", ...)
    assert response.status_code == 200
    assert response.json()["status"] == "unloading"
```

### Integration Tests

**Backend:**
```python
async def test_end_to_end_model_load():
    # 1. Call warmup
    response = client.post("/api/models/warmup", ...)
    
    # 2. Wait for WebSocket event
    event = await websocket_listener.wait_for("model_loaded", timeout=60)
    
    # 3. Verify model is ready
    status = client.get("/api/models/{id}/status").json()
    assert status["status"] == "loaded"
```

**Frontend:**
```typescript
async function testModelLoadingFlow() {
  // 1. Select model
  userEvent.click(modelSelector)
  userEvent.click('Hermes-2-Pro')
  
  // 2. Verify loading toast
  await screen.findByText(/Loading Hermes-2-Pro/)
  
  // 3. Wait for loaded event (mock WebSocket)
  mockWebSocket.emit('model_loaded', {...})
  
  // 4. Verify ready state
  await screen.findByText(/Ready/)
}
```

### Manual Testing Scenarios

1. **Happy path** - Select → Load → Send
2. **Error handling** - Provider offline, timeout
3. **Non-blocking** - Send during loading
4. **Rapid selection** - Switch models quickly
5. **Concurrent** - Multiple users loading different models
6. **Docker networking** - Backend reaches providers

---

## Deployment Considerations

### Docker Networking

Services must be on correct networks:

```yaml
services:
  backend:
    networks:
      - default  # Internal communication
      - supabase # Access to Supabase services
    environment:
      LM_STUDIO_URL: http://localhost:1234  # Or host.docker.internal
      OLLAMA_URL: http://localhost:11434
```

**Important:** Use `host.docker.internal` for localhost access from containers

### Environment Variables

```env
# Required for LM Studio
LM_STUDIO_BASE_URL=http://host.docker.internal:1234

# Required for Ollama
OLLAMA_BASE_URL=http://host.docker.internal:11434

# WebSocket
WEBSOCKET_ENABLED=true

# Logging
LOG_LEVEL=INFO
```

### Monitoring & Logging

**Key metrics to track:**
- Model load time (should be 5-30s)
- WebSocket event propagation delay
- Error rate by error code
- Number of concurrent model loads

**Log patterns to watch:**
```
WARN: Model load taking longer than 30s
ERROR: Provider offline when attempting warmup
ERROR: WebSocket connection lost
DEBUG: Broadcast model_loaded event to N clients
```

---

## Security Considerations

### Model Loading

✅ **Validate model_id** before accepting request
```python
if model_id not in ALLOWED_MODELS:
    raise ValueError(f"Model {model_id} not allowed")
```

✅ **Rate limit** warmup/unload endpoints
```python
@limiter.limit("10/minute")
@router.post("/api/models/warmup")
def warmup_model(...):
```

✅ **Timeout** model loading to prevent DoS
```python
response = await httpx.AsyncClient().post(
    url,
    timeout=30.0  # Kill if takes >30s
)
```

### WebSocket

✅ **Authenticate** WebSocket connections
✅ **Validate** event data before broadcasting
✅ **Rate limit** event broadcasts

---

**Architecture ready for implementation!**
