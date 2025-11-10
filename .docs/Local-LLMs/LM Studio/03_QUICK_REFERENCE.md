# Quick Reference & Checklists

**Purpose:** Fast lookup during development  
**Audience:** Developers actively coding  
**Use:** Bookmark this page, search Ctrl+F for what you need

---

## Role-Based Reading Paths

### 👔 Project Lead (60 minutes)
```
Read:
1. 01_IMPLEMENTATION_GUIDE.md → "Overview" + "Implementation Phases" (15 min)
2. 02_ARCHITECTURE_AND_DECISIONS.md → "System Architecture" + "Why Hybrid REST?" (20 min)
3. Below: Testing Scenarios (15 min)
4. Below: Success Criteria (10 min)

Questions answered:
✅ What's being built?
✅ How long will it take?
✅ What could go wrong?
✅ How do we verify it works?
```

### 💻 Backend Developer (2.5 hours)
```
Read (1.5 hours):
1. 01_IMPLEMENTATION_GUIDE.md → Full read including code (45 min)
2. 02_ARCHITECTURE_AND_DECISIONS.md → "Backend Error Handling" section (20 min)
3. Below: Backend Checklist (10 min)
4. Below: Endpoint Reference (15 min)

Code (1 hour):
1. Implement 3 endpoints
2. Test with curl commands below
3. Verify WebSocket broadcasting
```

### 🎨 Frontend Developer (1.5 hours)
```
Read (45 minutes):
1. 01_IMPLEMENTATION_GUIDE.md → "Frontend Hook" + "Component Updates" (30 min)
2. 02_ARCHITECTURE_AND_DECISIONS.md → "WebSocket Event Specifications" (15 min)

Code (45 minutes):
1. Create useModelLoading hook (25 min)
2. Update model selector (10 min)
3. Update chat input (10 min)
```

### 🧪 QA/Testing (1 hour)
```
Read (30 minutes):
1. 02_ARCHITECTURE_AND_DECISIONS.md → "Testing Strategy" (15 min)
2. Below: Testing Scenarios (15 min)

Test (30 minutes):
1. Run manual test scenarios
2. Check error cases
3. Verify success criteria
```

---

## File Locations

### Backend Files to Create/Modify

| File | Action | Lines | What |
|------|--------|-------|------|
| `backend/api.py` | Register router | 5 | Import and include new router |
| `backend/routes/models.py` | **CREATE** | 150 | 3 endpoints + 3 async tasks |
| `backend/core/websocket/` | **CREATE** | 50 | Event broadcaster |

### Frontend Files to Create/Modify

| File | Action | Lines | What |
|------|--------|-------|------|
| `frontend/src/hooks/useModelLoading.ts` | **CREATE** | 80 | WebSocket listener hook |
| `frontend/src/components/agents/config/model-selector.tsx` | Update | 40 | Add warm-up/unload logic |
| `frontend/src/components/thread/chat-input/chat-input.tsx` | Update | 20 | Non-blocking sends |

---

## Backend Implementation Checklist

### Phase 1: Setup (30 min)
- [ ] Create `backend/routes/models.py`
- [ ] Add imports: `fastapi`, `asyncio`, `httpx`, `websocket`
- [ ] Define request/response models (Pydantic)
- [ ] Register router in `backend/api.py`

### Phase 2: Endpoints (1.5 hours)
- [ ] Implement `POST /api/models/warmup`
  - [ ] Returns immediately
  - [ ] Spawns async task
  - [ ] Error handling
- [ ] Implement `POST /api/models/unload`
  - [ ] Returns immediately
  - [ ] Spawns async task
  - [ ] Error handling
- [ ] Implement `GET /api/models/{id}/status`
  - [ ] Query from cache
  - [ ] Return model metadata
  - [ ] Error handling

### Phase 3: Async Tasks (1 hour)
- [ ] `_trigger_model_load()` function
  - [ ] Validates model exists
  - [ ] Broadcasts "model_loading" event
  - [ ] Makes HTTP request to provider
  - [ ] Broadcasts "model_loaded" on success
  - [ ] Broadcasts "model_load_failed" on error
- [ ] `_unload_model()` function
  - [ ] Calls provider unload API
  - [ ] Handles errors gracefully
- [ ] `_broadcast_websocket_event()` helper
  - [ ] Sends event to all connected clients
  - [ ] Includes timestamp and metadata

### Phase 4: Testing (30 min)
- [ ] Test warmup endpoint (curl)
- [ ] Test unload endpoint (curl)
- [ ] Test status endpoint (curl)
- [ ] Verify WebSocket events arrive
- [ ] Test error scenarios (offline provider)

---

## Frontend Implementation Checklist

### Phase 1: Hook (45 min)
- [ ] Create `useModelLoading.ts`
- [ ] WebSocket connection logic
- [ ] Event listeners (4 event types)
- [ ] State management (ModelLoadingState)
- [ ] Toast integration
- [ ] Error handling
- [ ] Cleanup on unmount

### Phase 2: Components (1 hour)
- [ ] Update `AgentModelSelector`
  - [ ] Import hook
  - [ ] Add handleModelChange function
  - [ ] Call warmup and unload endpoints
  - [ ] Show loading spinner
  - [ ] Show ready badge
- [ ] Update `ChatInput`
  - [ ] Keep send button always enabled
  - [ ] Show optional warning during loading
  - [ ] Non-blocking send implementation

### Phase 3: Testing (15 min)
- [ ] Manual test: Select model → See toast
- [ ] Manual test: Send during loading
- [ ] Manual test: Error cases
- [ ] Browser console: No errors

---

## Endpoint Reference

### POST /api/models/warmup

```bash
# Request
curl -X POST http://localhost:8000/api/models/warmup \
  -H "Content-Type: application/json" \
  -d '{
    "model_id": "hermes-2-pro",
    "provider": "lmstudio"
  }'

# Expected Response (200 OK, <100ms)
{
  "status": "warming_up",
  "model_id": "hermes-2-pro",
  "estimated_time": 15
}

# Error: Provider offline (503)
{
  "error": "Provider unavailable",
  "error_code": "CONNECT_ERROR"
}
```

### POST /api/models/unload

```bash
# Request
curl -X POST http://localhost:8000/api/models/unload \
  -H "Content-Type: application/json" \
  -d '{
    "model_id": "hermes-2-pro",
    "provider": "lmstudio"
  }'

# Expected Response (200 OK, <100ms)
{
  "status": "unloading",
  "model_id": "hermes-2-pro"
}
```

### GET /api/models/{model_id}/status

```bash
# Request
curl http://localhost:8000/api/models/hermes-2-pro/status

# Expected Response (200 OK, <200ms)
{
  "model_id": "hermes-2-pro",
  "provider": "lmstudio",
  "status": "loaded",
  "load_time_ms": 5000,
  "context_window": 128000
}

# Not loaded (404)
{
  "error": "Model not found"
}
```

---

## WebSocket Event Reference

### Connection

```typescript
// Client connects
const ws = new WebSocket('ws://localhost:8000/ws')

// Subscribe to model events
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'model_events'
}))

// Confirmation
// → { type: 'subscribed', channel: 'model_events' }
```

### Events

```json
// 1. model_loading
{
  "type": "model_loading",
  "model_id": "hermes-2-pro",
  "estimated_time": 15
}

// 2. model_loaded
{
  "type": "model_loaded",
  "model_id": "hermes-2-pro",
  "load_time_ms": 5000
}

// 3. model_load_failed
{
  "type": "model_load_failed",
  "model_id": "hermes-2-pro",
  "error": "Connection timeout"
}

// 4. model_unloading
{
  "type": "model_unloading",
  "model_id": "hermes-2-pro"
}
```

---

## Testing Scenarios

### ✅ Happy Path Test

**Steps:**
1. Open browser to http://localhost:3000
2. Navigate to agent chat
3. Look for model selector dropdown
4. Select "Hermes-2-Pro"

**Expected (should happen in sequence):**
- ✅ Toast appears: "⏳ Loading Hermes-2-Pro... (est 15s)"
- ✅ Spinner shows in dropdown
- ✅ 5-30 seconds pass
- ✅ Toast disappears, new toast: "✅ Hermes-2-Pro ready!"
- ✅ Spinner disappears, checkmark shows

**Pass criteria:**
- [ ] Both toasts appear
- [ ] Spinner visible during loading
- [ ] Timing is reasonable (5-30s for model)
- [ ] No console errors
- [ ] Ready to send messages

---

### ✅ Non-Blocking Sends Test

**Steps:**
1. Previous test complete (model loaded)
2. Start new test: Select different model
3. **Immediately** (within 2 seconds) type in chat
4. Click Send button

**Expected:**
- ✅ Spinner shows for new model
- ✅ Send button is **ENABLED** (not greyed out)
- ✅ Can type and send while loading
- ✅ Message sends successfully
- ✅ Toast: "Message sent"
- ✅ Later, new model finishes loading

**Pass criteria:**
- [ ] Send button never disabled
- [ ] Message sends immediately (doesn't wait for load)
- [ ] No blocking behavior
- [ ] New model eventually loads in background
- [ ] No console errors

---

### ✅ Auto-Unload Test

**Steps:**
1. Load Model A (Hermes-2-Pro)
2. Wait for ready toast
3. Select Model B (Mistral-7B)

**Expected:**
- ✅ Model A unloading starts (optional quiet event)
- ✅ Model B loading starts
- ✅ Toast: "⏳ Loading Mistral-7B..."
- ✅ 5-30 seconds
- ✅ Toast: "✅ Mistral-7B ready!"

**Pass criteria:**
- [ ] Only one loading toast at a time
- [ ] No VRAM conflicts (check backend logs)
- [ ] Previous model unloads before new loads
- [ ] UI shows correct model as "current"
- [ ] No console errors

---

### ❌ Error Test: Provider Offline

**Setup:**
1. Stop LM Studio: `docker stop lmstudio` (or turn off)
2. Refresh browser

**Steps:**
1. Try to select a model

**Expected:**
- ✅ Toast: "⏳ Loading Hermes-2-Pro..."
- ✅ 5 seconds
- ✅ Toast: "❌ Failed to load Hermes-2-Pro"
- ✅ Error message shows reason

**Pass criteria:**
- [ ] Error toast appears
- [ ] Error message is helpful
- [ ] Spinner disappears
- [ ] App doesn't crash
- [ ] No console errors (only error logs expected)

**Recovery:**
1. Restart LM Studio: `docker start lmstudio`
2. Retry selecting model
3. Should work now

---

### ❌ Error Test: Model Timeout

**Setup:**
1. LM Studio running
2. Artificially slow network or small GPU

**Steps:**
1. Select very large model (>30GB if available)
2. Wait 35+ seconds

**Expected:**
- ✅ Toast: "⏳ Loading..." shows
- ✅ 35+ seconds
- ✅ Toast: "❌ Failed to load - timeout"
- ✅ Spinner disappears

**Pass criteria:**
- [ ] Timeout handled gracefully
- [ ] Error message is clear
- [ ] User can retry
- [ ] No hanging state

---

### ✅ Rapid Selection Test

**Steps:**
1. Select Model A
2. After 1 second, select Model B
3. After 1 second, select Model C
4. Wait for stabilization

**Expected:**
- ✅ Only one loading toast visible
- ✅ Toast updates to latest model (C)
- ✅ Previous toasts dismissed
- ✅ Only Model C loads
- ✅ Models A and B don't partially load

**Pass criteria:**
- [ ] UI is consistent (no conflicting toasts)
- [ ] Only requested model loads
- [ ] No VRAM thrashing
- [ ] Clean state after rapid selection
- [ ] No console errors

---

### ✅ Concurrent Users Test (if applicable)

**Setup:**
1. Open 2 browser windows
2. Both logged in

**Steps:**
1. Window 1: Select Model A
2. Window 2: Select Model B
3. Wait for both to load

**Expected:**
- ✅ Each window shows own loading state
- ✅ Both models load without conflict
- ✅ Each gets correct WebSocket events
- ✅ No cross-contamination of toasts

**Pass criteria:**
- [ ] Independent loading states
- [ ] Both models load
- [ ] Correct events per connection
- [ ] No mixed-up toasts

---

## Success Criteria

### Backend ✅

- [ ] Warmup endpoint returns immediately (<100ms)
- [ ] Unload endpoint returns immediately (<100ms)
- [ ] Status endpoint returns quickly (<200ms)
- [ ] Async tasks run in background (non-blocking)
- [ ] WebSocket broadcasts "model_loading" event
- [ ] WebSocket broadcasts "model_loaded" on success
- [ ] WebSocket broadcasts "model_load_failed" on error
- [ ] Error handling catches all 4 error scenarios
- [ ] Logging captures all operations
- [ ] All curl tests pass
- [ ] No console errors in backend logs

### Frontend ✅

- [ ] useModelLoading hook creates without errors
- [ ] WebSocket connection established
- [ ] Events received and processed
- [ ] Toast notifications appear
- [ ] Loading spinner visible during load
- [ ] Ready badge appears after load
- [ ] Model selector dropdown works
- [ ] Send button never disabled
- [ ] Can send during loading
- [ ] No console errors in browser

### Integration ✅

- [ ] End-to-end: Select → Toast → Load → Ready
- [ ] Can send messages after load
- [ ] Both providers work (Ollama + LM Studio)
- [ ] Error messages are helpful
- [ ] Performance acceptable (5-30s load time)
- [ ] Docker containers communicate
- [ ] Multiple concurrent operations work
- [ ] All 7 test scenarios pass
- [ ] No race conditions detected
- [ ] Clean shutdown (no hanging processes)

---

## Common Issues & Fixes

### Issue: Warmup endpoint hangs

**Symptom:** Curl takes 30+ seconds to return  
**Cause:** Task not spawned async  
**Fix:** Ensure using `asyncio.create_task()` not `await`

```python
# ❌ Wrong (waits for task)
await _trigger_model_load(...)

# ✅ Right (spawns and returns)
asyncio.create_task(_trigger_model_load(...))
```

---

### Issue: WebSocket events not arriving

**Symptom:** Hook state never updates  
**Cause 1:** WebSocket not connected  
**Fix 1:** Check browser console, verify ws:// URL

```typescript
ws.onopen = () => console.log('Connected')
ws.onerror = (e) => console.error('Error:', e)
```

**Cause 2:** Not subscribing to correct channel  
**Fix 2:** Send subscription message

```typescript
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'model_events'
}))
```

---

### Issue: Provider offline errors

**Symptom:** Every warmup fails with "Connection refused"  
**Cause:** LM Studio/Ollama not running  
**Fix:** Start providers

```bash
# LM Studio: Should be running on 1234
curl http://localhost:1234/api/v0/models

# Ollama: Should be running on 11434
curl http://localhost:11434/api/models
```

---

### Issue: Model doesn't actually load

**Symptom:** "Ready" toast appears but inference fails  
**Cause:** Model loaded but not active model for inference  
**Fix:** Ensure warmup endpoint makes dummy request

```python
# This triggers the load
response = await httpx.AsyncClient().post(
    f"{base_url}/v1/chat/completions",
    json={
        "model": model_id,
        "messages": [{"role": "user", "content": "test"}],
        "max_tokens": 1
    }
)
```

---

### Issue: Send button disabled

**Symptom:** Can't send messages while model loading  
**Cause:** Send button tied to loading state  
**Fix:** Only disable if no text, not based on loading

```typescript
// ❌ Wrong
disabled={isModelLoading}

// ✅ Right
disabled={!message.trim()}
```

---

## Quick Commands

### Test Backend Endpoints

```bash
# All in one test
echo "Testing warmup..."
curl -X POST http://localhost:8000/api/models/warmup \
  -H "Content-Type: application/json" \
  -d '{"model_id":"hermes-2-pro","provider":"lmstudio"}' && \
echo "\n\nTesting status..." && \
curl http://localhost:8000/api/models/hermes-2-pro/status && \
echo "\n\nTesting unload..." && \
curl -X POST http://localhost:8000/api/models/unload \
  -H "Content-Type: application/json" \
  -d '{"model_id":"hermes-2-pro","provider":"lmstudio"}'
```

### Monitor Backend Logs

```bash
# Show last 50 lines, follow new logs
docker compose logs backend -f --tail=50

# Search for errors
docker compose logs backend | grep -i error

# Search for WebSocket events
docker compose logs backend | grep -i "broadcast\|model_"
```

### Test Provider Connectivity

```bash
# Test LM Studio
curl http://localhost:1234/api/v0/models | python -m json.tool

# Test Ollama
curl http://localhost:11434/api/models | python -m json.tool
```

### Frontend Dev Server

```bash
cd frontend
npm run dev
# Opens http://localhost:3000

# With debugging
npm run dev -- --experimental-debug
```

---

## Timing Estimates

| Phase | Developer | Time |
|-------|-----------|------|
| Phase 1 (Backend endpoints) | Backend | 2-3h |
| Phase 2 (WebSocket integration) | Backend | 1h |
| Phase 3 (Frontend hook + components) | Frontend | 1-2h |
| Phase 4 (Testing) | QA/Both | 1h |
| **Total** | **2 developers** | **5-8h** |

**Parallel work:** Backend and frontend can work simultaneously (different files)

---

## Documentation Map

```
Quick Reference (THIS FILE)
├─ Use: Fast lookup during coding
├─ Role-based paths
├─ Checklists
├─ Command reference
└─ Timing & success criteria

01_IMPLEMENTATION_GUIDE.md
├─ Use: Main implementation document
├─ Code examples for all 3 endpoints
├─ Frontend hook and component code
├─ Testing checklist
└─ Phase 1-4 breakdown

02_ARCHITECTURE_AND_DECISIONS.md
├─ Use: Technical reference
├─ System architecture diagrams
├─ Request flow diagrams
├─ Error handling strategies
└─ Why hybrid REST + OpenAI-compatible
```

**Start here:** 01_IMPLEMENTATION_GUIDE.md for your role
**Reference:** This file during coding
**Deep dive:** 02_ARCHITECTURE_AND_DECISIONS.md when needed

---

✅ **Ready to start implementing!**

For questions, see 02_ARCHITECTURE_AND_DECISIONS.md or check logs:
```bash
docker compose logs -f
```
