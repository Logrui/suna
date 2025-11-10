# Quick Reference: LM Studio Integration

## 🚀 Quick Start

### What Was Built
- Backend: 4 REST endpoints + WebSocket broadcaster for real-time model events
- Frontend: Provider logos + WebSocket listener + loading UI
- Integration: Non-blocking model selection with real-time feedback

### Key Files
| File | Purpose | Type | Lines |
|------|---------|------|-------|
| `backend/core/models_api.py` | API endpoints | NEW | 374 |
| `backend/core/ai_models/lmstudio_client.py` | LM Studio client | NEW | 143 |
| `backend/core/websocket/broadcaster.py` | Event broadcaster | NEW | 120 |
| `frontend/src/hooks/useModelLoading.ts` | WebSocket listener | NEW | 180 |
| `frontend/src/lib/api/models.ts` | API client | NEW | 87 |
| `frontend/src/lib/model-provider-icons.tsx` | Provider detection | MODIFIED | +40 |
| `frontend/src/components/agents/config/model-selector.tsx` | UI integration | MODIFIED | +50 |

---

## 🔌 API Endpoints

### Warmup Model (Load)
```bash
POST /api/models/warmup
Content-Type: application/json

{
  "model_id": "lmstudio-llama2-7b"
}

# Response (< 100ms, non-blocking)
{
  "success": true,
  "message": "Model warmup initiated"
}
```

### Unload Model
```bash
POST /api/models/unload
{
  "model_id": "lmstudio-llama2-7b"
}
```

### Get Status
```bash
GET /api/models/lmstudio-llama2-7b/status

{
  "model_id": "lmstudio-llama2-7b",
  "status": "loaded" | "unloaded" | "loading" | "error",
  "error": null
}
```

### Unload Provider
```bash
POST /api/models/unload_provider
{
  "provider": "lmstudio"
}
```

---

## 📡 WebSocket Events

### Connect
```typescript
const ws = new WebSocket('wss://your-api.com/ws');
```

### Listen for Events
```typescript
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  // Events: model_loading | model_loaded | model_load_failed | model_unloading
  console.log(data.type, data.model_id, data.load_time_ms);
};
```

### Event Payloads
```json
// model_loading
{
  "type": "model_loading",
  "model_id": "lmstudio-llama2-7b",
  "timestamp": "2025-11-10T12:00:00Z"
}

// model_loaded
{
  "type": "model_loaded",
  "model_id": "lmstudio-llama2-7b",
  "load_time_ms": 7250,
  "timestamp": "2025-11-10T12:00:07Z"
}

// model_load_failed
{
  "type": "model_load_failed",
  "model_id": "lmstudio-llama2-7b",
  "error": "Model not found",
  "timestamp": "2025-11-10T12:00:01Z"
}
```

---

## 🎨 Frontend Usage

### Use Model Loading Hook
```typescript
import { useModelLoading } from '@/hooks/useModelLoading';

function MyComponent() {
  const {
    isLoading,
    currentModel,
    status,
    error,
    loadTimeMs,
    isConnected
  } = useModelLoading();

  return (
    <div>
      {isLoading && <Spinner />}
      {error && <ErrorBanner message={error} />}
      {status === 'loaded' && <Success time={loadTimeMs} />}
    </div>
  );
}
```

### Call Warmup API
```typescript
import { warmupModel } from '@/lib/api/models';

async function selectModel(modelId: string) {
  if (modelId.includes('lmstudio') || modelId.includes('ollama')) {
    const { success, error } = await warmupModel(modelId);
    if (!success) {
      console.error('Failed to warmup:', error);
    }
  }
}
```

### Provider Icons
```typescript
import { ModelProviderIcon } from '@/lib/model-provider-icons';

<ModelProviderIcon modelId="lmstudio-llama2-7b" size={24} />
// Shows LM Studio logo

<ModelProviderIcon modelId="ollama-neural-chat" size={24} />
// Shows Ollama logo
```

---

## 🔧 Backend Usage

### Import Models Router
```python
# In backend/api.py
from core.models_api import router as models_router

app.include_router(models_router)  # Already done! ✅
```

### Use Broadcaster
```python
from core.websocket.broadcaster import broadcaster

# Broadcast events
await broadcaster.broadcast_model_loading("model-id")
await broadcaster.broadcast_model_loaded("model-id", load_time_ms=5000)
await broadcaster.broadcast_model_load_failed("model-id", error="Failed")
await broadcaster.broadcast_model_unloading("model-id")
```

### Use LM Studio Client
```python
from core.ai_models.lmstudio_client import lmstudio_client

models = await lmstudio_client.list_models()
info = await lmstudio_client.get_model_info("llama2-7b")
await lmstudio_client.unload_model("llama2-7b")
is_available = await lmstudio_client.is_available()
```

---

## 🌍 Environment Setup

### Required Services
```bash
# Terminal 1: LM Studio
# Download from: https://lmstudio.ai/
# Start LM Studio - listens on localhost:1234

# Terminal 2: Ollama
# Download from: https://ollama.ai/
# Start: ollama serve
# Listens on localhost:11434

# Terminal 3: Backend
cd backend
python -m uvicorn api:app --reload --port 8000

# Terminal 4: Frontend
cd frontend
npm run dev
# Listens on localhost:3000
```

### Environment Variables
```env
# .env.local (frontend)
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_REALTIME_URL=wss://localhost:8000/ws

# backend/.env
LM_STUDIO_URL=http://localhost:1234
OLLAMA_URL=http://localhost:11434
```

---

## 📊 Data Flow

```
User selects model
  ↓
model-selector.tsx: handleSelect()
  ↓
onChange() callback (immediate)
  ↓
warmupModel() API call (for local models)
  ↓
Backend: models_api.py /warmup endpoint
  ├─ Returns immediately (< 100ms)
  └─ Background task starts
     ├─ broadcast_model_loading()
     ├─ Connect to LM Studio/Ollama
     ├─ Load model
     ├─ broadcast_model_loaded() or broadcast_model_load_failed()
  ↓
WebSocket: broadcaster sends event
  ↓
Frontend: useModelLoading hook receives
  ├─ Updates state
  ├─ Toast notification
  └─ UI updates
```

---

## 🧪 Testing

### Test Model Selection
```javascript
// 1. Open model dropdown
// 2. Click LM Studio model
// 3. Verify: dropdown closes immediately ✅
// 4. Verify: spinner appears ✅
// 5. Verify: toast "Loading..." appears ✅
// 6. Wait 5-10s
// 7. Verify: success toast appears ✅
// 8. Verify: spinner disappears ✅
```

### Test WebSocket
```bash
# In browser console
ws = new WebSocket('wss://localhost:8000/ws');
ws.onmessage = (e) => console.log(JSON.parse(e.data));

# Then trigger model load from UI
# You should see events logged
```

### Test API
```bash
# Warmup model
curl -X POST http://localhost:8000/api/models/warmup \
  -H "Content-Type: application/json" \
  -d '{"model_id": "lmstudio-llama2-7b"}'

# Get status
curl http://localhost:8000/api/models/lmstudio-llama2-7b/status
```

---

## 🐛 Debugging

### Enable Logging
```typescript
// In useModelLoading.ts
const [debug] = useState(true);
if (debug) {
  console.log('WebSocket event:', data);
  console.log('State update:', setState);
}
```

### Check Backend Events
```python
# In broadcaster.py
import logging
logger = logging.getLogger(__name__)
logger.debug(f"Broadcasting event: {event}")
```

### Monitor WebSocket
```bash
# Use Chrome DevTools > Network > WS
# Filter by WebSocket connections
# Watch message payloads
```

---

## 📚 Documentation

- **PHASE_1_2_COMPLETE_SUMMARY.md** - Full implementation summary
- **PHASE_1_2_INTEGRATION_GUIDE.md** - Detailed architecture & flow
- **PHASE_2_FRONTEND_COMPLETE.md** - Frontend implementation details
- **PHASE_1_*.md** (6 files) - Phase 1 backend documentation

---

## ✅ Verification Checklist

Before testing:
- [ ] Backend running on port 8000
- [ ] Frontend running on port 3000
- [ ] LM Studio running on port 1234
- [ ] Ollama running on port 11434
- [ ] Environment variables set correctly
- [ ] Database migrations run
- [ ] WebSocket URL correct (wss for HTTPS)

---

## 🚀 Deployment

### Local Development
1. Start services (see Environment Setup)
2. Open http://localhost:3000
3. Select a local model
4. Watch real-time loading feedback

### Docker
```bash
# Build images
docker-compose build --no-cache

# Run services
docker-compose up

# Backend: http://localhost:8000
# Frontend: http://localhost:3000
# LM Studio: http://localhost:1234
```

### Production
1. Update NEXT_PUBLIC_REALTIME_URL to wss://your-domain.com/ws
2. Rebuild frontend: `docker-compose build frontend --no-cache`
3. Deploy to production server
4. Monitor logs and metrics

---

## 🎯 Key Features

✅ Non-blocking model selection
✅ Real-time loading feedback
✅ Custom provider logos
✅ Automatic reconnection
✅ Error handling
✅ Toast notifications
✅ Type-safe API client
✅ Background async loading

---

**Version:** 1.0 (November 10, 2025)  
**Status:** Ready for Testing ✅  
**Branch:** feature/lmstudio
