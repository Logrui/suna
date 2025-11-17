# Phase 1 Backend Endpoint Tests

## Setup
Ensure the following are running:
- Backend: `cd backend && python api.py` (or via Docker)
- LM Studio: Running on `localhost:1234`
- Ollama: Running on `localhost:11434` (optional for testing)

---

## Test 1: Warmup Model (LM Studio)

**Description:** Trigger loading a model into GPU

```bash
curl -X POST http://localhost:8000/api/models/warmup \
  -H "Content-Type: application/json" \
  -d '{
    "model_id": "hermes-2-pro-mistral-7b",
    "provider": "lmstudio"
  }'
```

**Expected Response (< 100ms):**
```json
{
  "status": "warming_up",
  "model_id": "hermes-2-pro-mistral-7b",
  "estimated_time": 15
}
```

**What happens:**
- ✅ Response returns immediately (< 100ms)
- ✅ Backend spawns async task to load model
- ✅ WebSocket event "model_loading" broadcast
- ⏳ 5-30 seconds pass (model loads in GPU)
- ✅ WebSocket event "model_loaded" broadcast

---

## Test 2: Unload Model

**Description:** Unload a model from GPU

```bash
curl -X POST http://localhost:8000/api/models/unload \
  -H "Content-Type: application/json" \
  -d '{
    "model_id": "hermes-2-pro-mistral-7b",
    "provider": "lmstudio"
  }'
```

**Expected Response (< 100ms):**
```json
{
  "status": "unloading",
  "model_id": "hermes-2-pro-mistral-7b"
}
```

**What happens:**
- ✅ Response returns immediately
- ✅ Backend spawns async task to unload
- ✅ Model is unloaded from GPU (VRAM freed)
- ✅ WebSocket event "model_unloading" broadcast

---

## Test 3: Unload Provider (Cross-Provider)

**Description:** Unload ALL models from a provider

```bash
curl -X POST http://localhost:8000/api/models/unload_provider \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "lmstudio"
  }'
```

**Expected Response (< 100ms):**
```json
{
  "status": "unloading_provider",
  "provider": "lmstudio",
  "models_unloaded": [
    "hermes-2-pro-mistral-7b",
    "mistral-7b-instruct"
  ],
  "count": 2
}
```

**Use case:** When user switches from LM Studio to Ollama

---

## Test 4: Get Model Status

**Description:** Check if a model is loaded

```bash
curl -X GET "http://localhost:8000/api/models/hermes-2-pro-mistral-7b/status"
```

**Expected Response:**
```json
{
  "model_id": "hermes-2-pro-mistral-7b",
  "provider": "unknown",
  "status": "loaded",  // or "loading", "unloaded", "error"
  "load_time_ms": 5000,
  "context_window": 32768,
  "quantization": "Q4_K_S",
  "timestamp": "2025-11-10T12:34:56.123456"
}
```

---

## Test 5: Provider Offline Error

**Description:** Error handling when provider is offline

**Setup:** Stop LM Studio before running test

```bash
curl -X POST http://localhost:8000/api/models/warmup \
  -H "Content-Type: application/json" \
  -d '{
    "model_id": "hermes-2-pro-mistral-7b",
    "provider": "lmstudio"
  }'
```

**Expected Response:**
```json
{
  "status": "warming_up",
  "model_id": "hermes-2-pro-mistral-7b",
  "estimated_time": 15
}
```

**What happens (background):**
- ✅ Response returns immediately (still 200 OK)
- ✅ Async task attempts to connect
- ✅ Cannot reach LM Studio (offline)
- ✅ WebSocket event "model_load_failed" broadcast with error message

---

## Test 6: Complete Workflow (Happy Path)

**Step 1:** Load Model A
```bash
curl -X POST http://localhost:8000/api/models/warmup \
  -H "Content-Type: application/json" \
  -d '{
    "model_id": "hermes-2-pro-mistral-7b",
    "provider": "lmstudio"
  }'
```

Wait 20-30 seconds for loading...

**Step 2:** Select different model (auto-unload Model A, load Model B)
```bash
curl -X POST http://localhost:8000/api/models/unload \
  -H "Content-Type: application/json" \
  -d '{
    "model_id": "hermes-2-pro-mistral-7b",
    "provider": "lmstudio"
  }'

curl -X POST http://localhost:8000/api/models/warmup \
  -H "Content-Type: application/json" \
  -d '{
    "model_id": "mistral-7b-instruct",
    "provider": "lmstudio"
  }'
```

Wait 20-30 seconds for loading...

**Step 3:** Check status
```bash
curl -X GET "http://localhost:8000/api/models/mistral-7b-instruct/status"
```

**Expected:** status = "loaded"

---

## WebSocket Events Reference

### Connection
```javascript
const ws = new WebSocket('ws://localhost:8000/ws')

// Subscribe to model events
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'model_events'
}))
```

### Events Received

**Event 1: model_loading**
```json
{
  "type": "model_loading",
  "model_id": "hermes-2-pro-mistral-7b",
  "provider": "lmstudio",
  "estimated_time": 15,
  "timestamp": "2025-11-10T12:34:56.100Z"
}
```

**Event 2: model_loaded**
```json
{
  "type": "model_loaded",
  "model_id": "hermes-2-pro-mistral-7b",
  "provider": "lmstudio",
  "load_time_ms": 5000,
  "timestamp": "2025-11-10T12:34:56.100Z"
}
```

**Event 3: model_load_failed**
```json
{
  "type": "model_load_failed",
  "model_id": "hermes-2-pro-mistral-7b",
  "provider": "lmstudio",
  "error": "Cannot connect to lmstudio (port 1234)",
  "error_code": "CONNECT_ERROR",
  "timestamp": "2025-11-10T12:34:56.100Z"
}
```

**Event 4: model_unloading**
```json
{
  "type": "model_unloading",
  "model_id": "hermes-2-pro-mistral-7b",
  "provider": "lmstudio",
  "timestamp": "2025-11-10T12:34:56.100Z"
}
```

---

## Verification Checklist

### POST /api/models/warmup
- [ ] Returns 200 OK within 100ms
- [ ] Response has status="warming_up"
- [ ] Response has estimated_time
- [ ] Background task spawns (doesn't block)
- [ ] WebSocket events broadcast
- [ ] Works with "lmstudio" provider
- [ ] Works with "ollama" provider
- [ ] Error handling for invalid provider (400)
- [ ] Error handling for offline provider (503)

### POST /api/models/unload
- [ ] Returns 200 OK within 100ms
- [ ] Response has status="unloading"
- [ ] Background task spawns (doesn't block)
- [ ] Model actually unloads from GPU
- [ ] VRAM is freed

### POST /api/models/unload_provider
- [ ] Returns 200 OK within 100ms
- [ ] Response lists all models being unloaded
- [ ] All models from provider are unloaded
- [ ] Cross-provider switching works

### GET /api/models/{model_id}/status
- [ ] Returns 200 OK within 200ms
- [ ] Has current status
- [ ] Works for loaded models
- [ ] Works for unloaded models
- [ ] Works for loading models

---

## Success Criteria

✅ **Functional:**
- All endpoints return immediately (< 100ms)
- Background tasks run asynchronously
- WebSocket events broadcast to clients
- Provider switching works cleanly
- Error handling works gracefully

✅ **Non-Functional:**
- No blocking behavior
- No request timeouts
- Graceful error messages
- Works with multiple concurrent requests
- No memory leaks

---

## Troubleshooting

### "Cannot connect to lmstudio"
- Check LM Studio is running: `http://localhost:1234`
- Check firewall isn't blocking port 1234
- Try restarting LM Studio

### WebSocket events not appearing
- Check WebSocket connection is established
- Check you've subscribed to "model_events" channel
- Check browser console for errors

### Backend crashes on startup
- Check Python syntax: `python -m py_compile core/models_api.py`
- Check imports are correct
- Check all dependencies installed
