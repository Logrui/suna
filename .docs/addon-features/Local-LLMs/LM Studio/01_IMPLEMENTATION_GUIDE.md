# LM Studio v2.0 Implementation Guide

**Status:** ✅ Complete & Ready for Development  
**Scope:** Model warm-up, toast notifications, non-blocking sends, auto-unload  
**Timeline:** 5-8 hours development  
**Created:** November 10, 2025

## Quick Start

**Read in this order:**
1. This file (30 min) - Implementation guide with all code
2. ARCHITECTURE_AND_DECISIONS.md (30 min) - Technical reference
3. QUICK_REFERENCE.md (5 min) - Lookup during coding

---

## Architecture Overview

### System Design

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ AgentModelSelector → useModelLoading Hook           │   │
│  │ (Selects model)      (Listens to WebSocket)         │   │
│  │                      (Shows toasts)                 │   │
│  │ ChatInput (Non-blocking sends)                      │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────┘
                     │ REST + WebSocket
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                  Backend (FastAPI)                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 3 Endpoints:                                         │   │
│  │ • POST /api/models/warmup → Returns immediately     │   │
│  │ • POST /api/models/unload → Returns immediately     │   │
│  │ • GET /api/models/{id}/status → Check model status  │   │
│  │                                                      │   │
│  │ Async Tasks (non-blocking):                          │   │
│  │ • _trigger_model_load() → 5-30s background task    │   │
│  │ • _unload_model() → Fast unload operation           │   │
│  │ • _broadcast_websocket_event() → Real-time updates  │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP + WebSocket
                     ↓
┌─────────────────────────────────────────────────────────────┐
│            Local LLM Providers (Docker)                     │
│                                                             │
│  LM Studio (port 1234)         Ollama (port 11434)         │
│  ┌──────────────────────┐      ┌────────────────────┐      │
│  │ REST: /api/v0/*      │      │ REST: /api/*       │      │
│  │ OpenAI: /v1/*        │      │ OpenAI: /v1/*      │      │
│  │                      │      │                    │      │
│  │ Discovery: Model     │      │ Discovery: Basic   │      │
│  │ metadata, context,   │      │ model info         │      │
│  │ quantization         │      │                    │      │
│  └──────────────────────┘      └────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### User Experience Flow

```
Scenario A: Switch within same provider
─────────────────────────────────────
1. Model A (LM Studio) loaded
   ↓
2. User selects Model B (LM Studio)
   ↓
3. AgentModelSelector:
   - POST /api/models/unload(Model A, lmstudio)
   - POST /api/models/warmup(Model B, lmstudio)
   ↓
4. Model A unloads, Model B loads
5. Done (same provider, no cross-provider cleanup needed)


Scenario B: Switch between different providers
──────────────────────────────────────────────
1. Model A (LM Studio) loaded
   ↓
2. User selects Model C (Ollama)
   ↓
3. AgentModelSelector:
   - POST /api/models/unload_provider(lmstudio) ← NEW: Unload ALL LM Studio models
   - POST /api/models/warmup(Model C, ollama)
   ↓
4. All LM Studio models unload (VRAM freed completely)
5. Model C (Ollama) loads
6. Done (clean provider switch, no conflicts)


Scenario C: Switch provider back
────────────────────────────────
1. Model C (Ollama) loaded
   ↓
2. User selects Model B (LM Studio)
   ↓
3. AgentModelSelector:
   - POST /api/models/unload_provider(ollama) ← NEW: Unload ALL Ollama models
   - POST /api/models/warmup(Model B, lmstudio)
   ↓
4. All Ollama models unload (VRAM freed completely)
5. Model B (LM Studio) loads
6. Done (clean switch back to original provider)
```

---

## v2.0 Features

### New Requirements (Your Specifications)

✅ **Model Warm-up on Selection**
- User selects model → Automatically load into GPU
- 5-30 second loading time (model size dependent)
- Real-time feedback via toast notifications

✅ **Non-blocking Message Sends**
- Send button ALWAYS enabled (never disabled)
- Users can send while model is loading
- Optional warning toast during loading

✅ **Auto-unload Previous Model (Same Provider)**
- When selecting new model from same provider, previous model unloaded
- Frees VRAM for new model
- Seamless switching within provider

✅ **Cross-Provider Unloading**
- **NEW:** When selecting Ollama model → Unload all LM Studio models
- **NEW:** When selecting LM Studio model → Unload all Ollama models
- Only one provider active at a time
- Prevents VRAM conflicts between providers

✅ **Dual Provider Support**
- Ollama (port 11434) and LM Studio (port 1234) simultaneously
- Switch between them instantly (with cross-provider unload)
- Share model metadata and status

✅ **Real-time Status Updates**
- WebSocket events for loading status
- Toast notifications for user feedback
- Loading indicators in UI

---

## Implementation Details

### Backend Endpoints

#### 1. POST /api/models/warmup

**Purpose:** Trigger model loading in background

**Request:**
```json
{
  "model_id": "hermes-2-pro",
  "provider": "lmstudio"  // or "ollama"
}
```

**Response (immediate):**
```json
{
  "status": "warming_up",
  "model_id": "hermes-2-pro",
  "estimated_time": 15  // seconds
}
```

**Backend Code:**
```python
@router.post("/api/models/warmup")
async def warmup_model(request: WarmupRequest):
    """
    Trigger background model loading.
    Returns immediately, actual loading happens async.
    """
    model_id = request.model_id
    provider = request.provider
    
    # Spawn async task (don't wait for it)
    asyncio.create_task(
        _trigger_model_load(model_id, provider)
    )
    
    # Return immediately to frontend
    return {
        "status": "warming_up",
        "model_id": model_id,
        "estimated_time": 15
    }


async def _trigger_model_load(model_id: str, provider: str):
    """
    Background task: Load model into GPU.
    Broadcasts WebSocket events on progress.
    """
    try:
        # Broadcast: Loading started
        await _broadcast_websocket_event("model_loading", {
            "model_id": model_id,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        # Load model via dummy request
        if provider == "lmstudio":
            base_url = "http://localhost:1234"
        else:  # ollama
            base_url = "http://localhost:11434"
        
        # Make dummy inference request to trigger load
        # Model auto-loads into GPU on first request
        response = await httpx.AsyncClient().post(
            f"{base_url}/v1/chat/completions",
            json={
                "model": model_id,
                "messages": [
                    {"role": "user", "content": "test"}
                ],
                "max_tokens": 1
            },
            timeout=120.0  # Model loading can take time
        )
        
        # Broadcast: Loading succeeded
        await _broadcast_websocket_event("model_loaded", {
            "model_id": model_id,
            "load_time_ms": 5000,  # Calculate actual time
            "timestamp": datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        # Broadcast: Loading failed
        await _broadcast_websocket_event("model_load_failed", {
            "model_id": model_id,
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        })
```

#### 2. POST /api/models/unload

**Purpose:** Unload model from GPU to free VRAM

**Request:**
```json
{
  "model_id": "hermes-2-pro",
  "provider": "lmstudio"
}
```

**Response (immediate):**
```json
{
  "status": "unloading",
  "model_id": "hermes-2-pro"
}
```

**Backend Code:**
```python
@router.post("/api/models/unload")
async def unload_model(request: UnloadRequest):
    """
    Trigger background model unloading.
    Returns immediately, actual unload happens async.
    """
    model_id = request.model_id
    provider = request.provider
    
    # Spawn async task (don't wait for it)
    asyncio.create_task(
        _unload_model(model_id, provider)
    )
    
    # Return immediately
    return {
        "status": "unloading",
        "model_id": model_id
    }


async def _unload_model(model_id: str, provider: str):
    """
    Background task: Unload model from GPU.
    Broadcasts WebSocket event when complete.
    """
    try:
        # Broadcast: Unloading started
        await _broadcast_websocket_event("model_unloading", {
            "model_id": model_id,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        # Call provider-specific unload endpoint
        if provider == "lmstudio":
            # LM Studio: Call /api/v0/models/unload
            await httpx.AsyncClient().post(
                "http://localhost:1234/api/v0/models/unload",
                json={"model": model_id},
                timeout=10.0
            )
        else:  # ollama
            # Ollama: No direct unload API, relies on timeout
            # Could implement graceful shutdown
            pass
        
        # Model is now unloaded and VRAM freed
        
    except Exception as e:
        # Log error but continue (unload best-effort)
        logger.error(f"Unload error for {model_id}: {e}")
```

#### 3. GET /api/models/{model_id}/status

**Purpose:** Check if model is loaded and ready

**Response:**
```json
{
  "model_id": "hermes-2-pro",
  "provider": "lmstudio",
  "status": "loaded",  // "loaded", "loading", "unloaded", "error"
  "load_time_ms": 5000,
  "context_window": 128000,
  "timestamp": "2025-11-10T12:34:56Z"
}
```

**Backend Code:**
```python
@router.get("/api/models/{model_id}/status")
async def get_model_status(model_id: str):
    """
    Check if model is loaded and ready.
    """
    # Get model info from cache or provider
    model_info = await _get_model_info(model_id)
    
    return {
        "model_id": model_id,
        "provider": model_info.provider,
        "status": model_info.status,  # "loaded", "loading", etc.
        "load_time_ms": model_info.load_time_ms,
        "context_window": model_info.context_window,
        "timestamp": datetime.utcnow().isoformat()
    }
```

#### 4. POST /api/models/unload_provider (NEW - Cross-Provider Unload)

**Purpose:** Unload ALL models from a specific provider (for provider switching)

**Request:**
```json
{
  "provider": "lmstudio"  // or "ollama"
}
```

**Response (immediate):**
```json
{
  "status": "unloading_provider",
  "provider": "lmstudio",
  "models_unloaded": ["hermes-2-pro", "mistral-7b"],
  "count": 2
}
```

**Use case:** When user switches from LM Studio to Ollama (or vice versa), unload entire provider to free all VRAM

**Backend Code:**
```python
@router.post("/api/models/unload_provider")
async def unload_provider(request: UnloadProviderRequest):
    """
    Unload ALL models from a specific provider.
    Used when switching between providers (LM Studio ↔ Ollama).
    Returns immediately, actual unload happens async.
    """
    provider = request.provider
    
    # Get list of loaded models for this provider
    loaded_models = await _get_loaded_models_for_provider(provider)
    
    # Spawn async tasks for each model
    for model_id in loaded_models:
        asyncio.create_task(
            _unload_model(model_id, provider)
        )
    
    # Return immediately
    return {
        "status": "unloading_provider",
        "provider": provider,
        "models_unloaded": loaded_models,
        "count": len(loaded_models)
    }


async def _get_loaded_models_for_provider(provider: str) -> list:
    """
    Get list of all models currently loaded in a provider.
    """
    if provider == "lmstudio":
        # LM Studio: Call /api/v0/models to get loaded models
        response = await httpx.AsyncClient().get(
            "http://localhost:1234/api/v0/models",
            timeout=5.0
        )
        models = response.json().get("data", [])
        return [m["id"] for m in models if m.get("loaded")]
    
    else:  # ollama
        # Ollama: Call /api/tags to get loaded models
        response = await httpx.AsyncClient().get(
            "http://localhost:11434/api/tags",
            timeout=5.0
        )
        models = response.json().get("models", [])
        return [m["name"] for m in models if m.get("loaded")]
```

---

### Frontend Hook: useModelLoading

**File:** `frontend/src/hooks/useModelLoading.ts`

**Purpose:** Listen to WebSocket events and manage loading state

**Code:**
```typescript
import { useEffect, useState, useCallback } from 'react'
import { toast } from '@/components/ui/use-toast'

export interface ModelLoadingState {
  isLoading: boolean
  currentModel: string | null
  previousModel: string | null
  error: string | null
  loadTimeMs: number | null
  status: 'idle' | 'loading' | 'loaded' | 'error' | 'unloading'
}

export function useModelLoading() {
  const [state, setState] = useState<ModelLoadingState>({
    isLoading: false,
    currentModel: null,
    previousModel: null,
    error: null,
    loadTimeMs: null,
    status: 'idle'
  })

  useEffect(() => {
    // Connect to WebSocket
    // Using Supabase Realtime or direct WebSocket
    const wsUrl = typeof window !== 'undefined' 
      ? `${window.location.origin.replace('http', 'ws')}/ws`
      : 'ws://localhost:8000/ws'
    
    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      console.log('WebSocket connected')
      // Subscribe to model events
      ws.send(JSON.stringify({ type: 'subscribe', channel: 'model_events' }))
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      
      switch (data.type) {
        case 'model_loading':
          setState(prev => ({
            ...prev,
            isLoading: true,
            currentModel: data.model_id,
            status: 'loading',
            error: null
          }))
          toast({
            title: `⏳ Loading ${data.model_id}...`,
            description: `Estimated time: ${data.estimated_time || 15}s`,
            duration: 3000
          })
          break

        case 'model_loaded':
          setState(prev => ({
            ...prev,
            isLoading: false,
            status: 'loaded',
            loadTimeMs: data.load_time_ms,
            error: null
          }))
          toast({
            title: `✅ ${data.model_id} ready!`,
            description: `Loaded in ${data.load_time_ms}ms`,
            duration: 2000,
            variant: 'success'
          })
          break

        case 'model_load_failed':
          setState(prev => ({
            ...prev,
            isLoading: false,
            status: 'error',
            error: data.error
          }))
          toast({
            title: `❌ Failed to load ${data.model_id}`,
            description: data.error,
            duration: 4000,
            variant: 'destructive'
          })
          break

        case 'model_unloading':
          setState(prev => ({
            ...prev,
            previousModel: prev.currentModel,
            status: 'unloading'
          }))
          break
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      setState(prev => ({
        ...prev,
        error: 'WebSocket connection error'
      }))
    }

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close()
      }
    }
  }, [])

  return state
}
```

---

### Frontend Component Updates

#### AgentModelSelector Component

**File:** `frontend/src/components/agents/config/model-selector.tsx`

**Changes (Now with Cross-Provider Unloading):**
```typescript
import { useModelLoading } from '@/hooks/useModelLoading'
import { Loader2, CheckCircle2 } from 'lucide-react'

export function AgentModelSelector() {
  const { isLoading, currentModel, status } = useModelLoading()
  const [selectedModel, setSelectedModel] = useState<string | null>(null)
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null)

  const handleModelChange = async (newModelId: string, newProvider: string) => {
    const previousModel = selectedModel
    const previousProvider = selectedProvider

    // 1. Handle cross-provider unloading
    // If switching to different provider, unload entire previous provider
    if (previousProvider && previousProvider !== newProvider) {
      await fetch('/api/models/unload_provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: previousProvider
        })
      })
      // Toast for cross-provider switch
      toast({
        title: `Unloading ${previousProvider}...`,
        description: `Switching to ${newProvider}`,
        duration: 2000
      })
    } 
    // 2. Handle same-provider switching (just unload previous model)
    else if (previousProvider === newProvider && previousModel) {
      await fetch('/api/models/unload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model_id: previousModel,
          provider: newProvider
        })
      })
    }

    // 3. Warmup new model
    setSelectedModel(newModelId)
    setSelectedProvider(newProvider)
    await fetch('/api/models/warmup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model_id: newModelId,
        provider: newProvider
      })
    })
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={selectedModel || ''}
        onChange={(e) => {
          const model = e.target.value
          // Get provider from model metadata
          const provider = getProviderForModel(model)
          handleModelChange(model, provider)
        }}
        disabled={isLoading}
        className="px-3 py-2 border rounded"
      >
        <option value="">Select model...</option>
        {/* Group models by provider in dropdown */}
        <optgroup label="LM Studio">
          {lmStudioModels.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </optgroup>
        <optgroup label="Ollama">
          {ollamaModels.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </optgroup>
      </select>

      {/* Show current provider */}
      {selectedProvider && (
        <span className="text-xs text-gray-500">
          ({selectedProvider})
        </span>
      )}

      {/* Loading indicator */}
      {isLoading && currentModel === selectedModel && (
        <div className="flex items-center gap-2 text-yellow-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      )}

      {/* Ready indicator */}
      {status === 'loaded' && currentModel === selectedModel && (
        <div className="flex items-center gap-2 text-green-600">
          <CheckCircle2 className="w-4 h-4" />
          <span className="text-sm">Ready</span>
        </div>
      )}
    </div>
  )
}
```

#### ChatInput Component

**File:** `frontend/src/components/thread/chat-input/chat-input.tsx`

**Changes (Non-blocking sends):**
```typescript
import { useModelLoading } from '@/hooks/useModelLoading'

export function ChatInput() {
  const { isLoading: isModelLoading } = useModelLoading()
  const [message, setMessage] = useState('')

  const handleSend = async () => {
    if (!message.trim()) return

    // 1. Show optional warning if model is loading
    if (isModelLoading) {
      toast({
        title: 'ℹ️ Model still loading',
        description: 'Your message will use the previously loaded model',
        duration: 2000
      })
    }

    // 2. Send message immediately (non-blocking)
    // Don't wait for model to finish loading
    try {
      const response = await fetch('/api/threads/{threadId}/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: message,
          role: 'user'
        })
      })

      if (response.ok) {
        setMessage('')
        // Message sent successfully
      }
    } catch (error) {
      toast({
        title: 'Error sending message',
        description: error.message,
        variant: 'destructive'
      })
    }
  }

  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyPress={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            handleSend()
          }
        }}
        placeholder="Type your message..."
        className="flex-1 px-3 py-2 border rounded"
      />

      {/* Send button is ALWAYS enabled */}
      <button
        onClick={handleSend}
        disabled={!message.trim()}  // Only disabled if no text
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        Send
      </button>

      {/* Optional: Show warning during loading */}
      {isModelLoading && (
        <span className="text-xs text-yellow-600 self-center">
          Model loading...
        </span>
      )}
    </div>
  )
}
```

---

## Implementation Phases

### Phase 1: Backend Endpoints (2-3 hours)

**What to build:**
- [ ] Create `backend/routes/models.py` or add to existing `api.py`
- [ ] Implement POST `/api/models/warmup` endpoint
- [ ] Implement POST `/api/models/unload` endpoint
- [ ] Implement GET `/api/models/{id}/status` endpoint
- [ ] Implement 3 async helper functions
- [ ] Add error handling and logging
- [ ] Test endpoints with curl or Postman

**Files to modify:**
```
backend/
  ├── api.py (register new router)
  ├── routes/models.py (NEW - 3 endpoints)
  └── core/utils/config.py (import provider info)
```

**Validation:**
```bash
# Test warmup
curl -X POST http://localhost:8000/api/models/warmup \
  -H "Content-Type: application/json" \
  -d '{"model_id": "hermes-2-pro", "provider": "lmstudio"}'

# Test unload
curl -X POST http://localhost:8000/api/models/unload \
  -H "Content-Type: application/json" \
  -d '{"model_id": "hermes-2-pro", "provider": "lmstudio"}'
```

### Phase 2: WebSocket Integration (1 hour)

**What to build:**
- [ ] Set up WebSocket connection (use Supabase Realtime or direct WS)
- [ ] Implement event broadcasting in backend
- [ ] Test events reaching frontend
- [ ] Verify event payloads

**Files to modify:**
```
backend/
  ├── core/websocket/ (NEW - event broadcaster)
  └── routes/models.py (add event broadcasts)
```

### Phase 3: Frontend Hook & Components (1-2 hours)

**What to build:**
- [ ] Create `useModelLoading` hook (WebSocket listener)
- [ ] Update `AgentModelSelector` (warm-up/unload logic)
- [ ] Update `ChatInput` (non-blocking sends)
- [ ] Add toast notifications
- [ ] Add loading indicators

**Files to create:**
```
frontend/src/
  ├── hooks/useModelLoading.ts (NEW)
  └── components/
     ├── agents/config/model-selector.tsx (UPDATE)
     └── thread/chat-input/chat-input.tsx (UPDATE)
```

### Phase 4: Integration Testing (1 hour)

**What to test:**
- [ ] Select model → warmup → get loaded toast
- [ ] Send message during loading → message sends
- [ ] Select new model → unload + warmup → no interference
- [ ] Error scenarios (provider offline, timeout)
- [ ] Concurrent operations (switch models rapidly)
- [ ] Docker networking (all services communicate)

**Test scenarios:**
```
✅ Happy path: Select → Load → Send
✅ Non-blocking: Send during loading
✅ Auto-unload: Switch models
✅ Error: Provider offline
✅ Error: Timeout
✅ Concurrent: Rapid selection
```

---

## WebSocket Events

### Event Format

All events use this format:

```json
{
  "type": "model_loading|model_loaded|model_load_failed|model_unloading",
  "model_id": "hermes-2-pro",
  "provider": "lmstudio",
  "timestamp": "2025-11-10T12:34:56Z",
  "extra": {}
}
```

### Event Types

#### 1. model_loading
```json
{
  "type": "model_loading",
  "model_id": "hermes-2-pro",
  "estimated_time": 15
}
```
**Frontend action:** Show loading toast, spinner

#### 2. model_loaded
```json
{
  "type": "model_loaded",
  "model_id": "hermes-2-pro",
  "load_time_ms": 5000,
  "status": "ready"
}
```
**Frontend action:** Show success toast, remove spinner

#### 3. model_load_failed
```json
{
  "type": "model_load_failed",
  "model_id": "hermes-2-pro",
  "error": "Connection timeout",
  "provider": "lmstudio"
}
```
**Frontend action:** Show error toast, reset state

#### 4. model_unloading
```json
{
  "type": "model_unloading",
  "model_id": "hermes-2-pro",
  "reason": "user_selected_new_model"
}
```
**Frontend action:** Update state, optional quiet notification

---

## Configuration

### Backend (.env)

Add these if not present:

```env
# LM Studio
LM_STUDIO_BASE_URL=http://localhost:1234

# Ollama
OLLAMA_BASE_URL=http://localhost:11434

# WebSocket
WEBSOCKET_ENABLED=true
WEBSOCKET_URL=ws://localhost:8000/ws
```

### Frontend (.env.local)

```env
# Already in place
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000/api
```

---

## Error Handling

### Backend Error Handling

```python
# Scenario 1: Provider offline
try:
    response = await httpx.AsyncClient().post(url, timeout=5)
except httpx.ConnectError:
    # Provider is down - broadcast error event
    await _broadcast_websocket_event("model_load_failed", {
        "error": "Provider offline"
    })

# Scenario 2: Model not found
if response.status_code == 404:
    await _broadcast_websocket_event("model_load_failed", {
        "error": f"Model {model_id} not found"
    })

# Scenario 3: Timeout
except asyncio.TimeoutError:
    await _broadcast_websocket_event("model_load_failed", {
        "error": "Model loading timed out"
    })
```

### Frontend Error Handling

```typescript
// Hook catches WebSocket errors
ws.onerror = (error) => {
  setState(prev => ({
    ...prev,
    error: 'Connection error - check console'
  }))
}

// Component gracefully degrades
if (state.error) {
  return <ErrorMessage error={state.error} />
}
```

---

## Testing Checklist

### Manual Testing

- [ ] **Happy Path**
  - [ ] Select model
  - [ ] See loading toast
  - [ ] Model loads (5-30s)
  - [ ] See ready toast
  - [ ] Send message works

- [ ] **Non-blocking Sends**
  - [ ] Select model
  - [ ] Immediately send message while loading
  - [ ] Message sends successfully
  - [ ] No blocking or errors

- [ ] **Auto-unload**
  - [ ] Load first model
  - [ ] Select second model
  - [ ] First model unloads
  - [ ] Second model loads
  - [ ] No VRAM conflicts

- [ ] **Error Scenarios**
  - [ ] Provider offline
  - [ ] Model not found
  - [ ] Timeout (very large model)
  - [ ] Network disconnection

- [ ] **Docker Networking**
  - [ ] Backend can reach LM Studio (1234)
  - [ ] Backend can reach Ollama (11434)
  - [ ] Frontend can reach backend
  - [ ] WebSocket connection works

### Performance Targets

- Model load time: 5-30 seconds (depends on model)
- Warmup endpoint response: <100ms
- Unload endpoint response: <100ms
- Status check response: <200ms
- WebSocket event propagation: <1 second

---

## Success Criteria

### Backend ✅
- [ ] 3 endpoints implemented and working
- [ ] Async tasks execute without blocking
- [ ] WebSocket events broadcast on all events
- [ ] Error handling catches all scenarios
- [ ] Logging captures all operations
- [ ] Tests pass (happy path + errors)

### Frontend ✅
- [ ] useModelLoading hook functional
- [ ] WebSocket connection established
- [ ] Toast notifications display
- [ ] Model selector shows loading/ready state
- [ ] Chat input sends during loading
- [ ] No console errors

### Integration ✅
- [ ] End-to-end flow works (select → load → send)
- [ ] Both providers work (Ollama + LM Studio)
- [ ] Error messages are helpful
- [ ] Performance is acceptable
- [ ] Docker containers communicate

---

## Key Decision: Why This Architecture?

### Why REST API + OpenAI-Compatible?

The OpenAI-compatible endpoint (used for inference) **lacks critical information** needed for discovery:
- ❌ No `context_window` (needed for token counting)
- ❌ No `quantization` info (needed for VRAM calculation)
- ❌ No `model_type` (can't distinguish embeddings from chat)

**Solution: Hybrid approach**
- REST API (`/api/v0/*`) used ONCE at startup for model discovery
- OpenAI-compatible (`/v1/*`) used for every inference request
- LiteLLM router handles provider switching seamlessly

See ARCHITECTURE_AND_DECISIONS.md for full analysis.

---

## Ready to Code?

✅ **All specifications complete**  
✅ **Code examples provided**  
✅ **Error handling documented**  
✅ **Testing scenarios defined**  

**Next steps:**
1. Read ARCHITECTURE_AND_DECISIONS.md for technical deep-dive
2. Check QUICK_REFERENCE.md for command reminders
3. Start Phase 1: Backend endpoints
4. Reference code examples in this file as you implement

**Questions?** Check the error sections or reach out to team leads.

**Estimated Timeline:** 5-8 hours total (2-3h backend, 1-2h frontend, 1h testing)

---

**Created:** November 10, 2025  
**Status:** Ready for Development  
**Consolidation:** 6 documents merged into 1 comprehensive guide
