# Visual Request Flow Diagram

## Simple Timeline

```
┌─ FRONTEND (User Interaction) ─────────────────────────────────┐
│                                                                │
│  1. User sees dropdown with 12 Ollama models                  │
│     ↓                                                          │
│  2. User selects "Llama-3.2 3B Instruct"                      │
│     ↓                                                          │
│  3. User types message and hits "Send"                        │
│     ↓                                                          │
│  4. Frontend sends: model_id + messages to backend            │
│                                                                │
└────────────────────────────────────────────────────────────────┘

┌─ BACKEND (Processing) ─────────────────────────────────────────┐
│                                                                │
│  5. Receive request with model_id                             │
│     ↓                                                          │
│  6. Resolve model_id → get config from registry               │
│     ↓                                                          │
│  7. Build LiteLLM params (api_base, model name, etc)          │
│     ↓                                                          │
│  8. Send to LiteLLM Router                                    │
│     ↓                                                          │
│  9. Router matches "openai-compatible/*" pattern              │
│     ↓                                                          │
│  10. Route to OpenAI-compatible provider                      │
│      ↓                                                         │
│      ⬇️ NOW OLLAMA GETS INVOLVED ⬇️                           │
│                                                                │
└────────────────────────────────────────────────────────────────┘

┌─ OLLAMA (Model Loading & Processing) ───────────────────────┐
│                                                              │
│  11. Receive HTTP POST: /v1/chat/completions                │
│      Headers: model=llama3.2:latest                         │
│      ↓                                                       │
│  12. Check: Is llama3.2:latest in memory?                   │
│      ↓                                                       │
│      ├─ First time: Load from disk (~15-30s)               │
│      ├─ Already loaded: Skip (instant)                      │
│      ↓                                                       │
│  13. Process the request (inference)                        │
│      ↓                                                       │
│  14. Stream tokens back to backend                          │
│                                                              │
└──────────────────────────────────────────────────────────────┘

┌─ BACKEND (Receive Response) ─────────────────────────────────┐
│                                                              │
│  15. Receive streaming tokens from Ollama                   │
│      ↓                                                       │
│  16. Send to frontend in real-time                          │
│                                                              │
└──────────────────────────────────────────────────────────────┘

┌─ FRONTEND (Display) ──────────────────────────────────────────┐
│                                                              │
│  17. Display tokens as they arrive (streaming)              │
│      ↓                                                       │
│  18. User sees response appearing character by character    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                         YOUR SERVER                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Suna Frontend (React/Next.js)                          │   │
│  │  ✓ Shows 12 Ollama models in dropdown                  │   │
│  │  ✓ User selects a model                                │   │
│  │  ✓ User types message                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                            │                                    │
│                   HTTP POST (model_id, messages)                │
│                            ↓                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Suna Backend (FastAPI)                                 │   │
│  │  ├─ api.py: Receives request                           │   │
│  │  ├─ llm.py: Calls make_llm_api_call()                  │   │
│  │  ├─ manager.py: Resolves model_id                      │   │
│  │  ├─ registry.py: Gets model config                     │   │
│  │  └─ Sends to LiteLLM Router                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                            │                                    │
│              HTTP POST (OpenAI-compatible protocol)             │
│                            ↓                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Ollama Server (localhost:11434)                        │   │
│  │  ├─ Receive chat completion request                    │   │
│  │  ├─ Check if model is loaded                           │   │
│  │  ├─ Load model if needed (STEP WHERE LOADING HAPPENS)  │   │
│  │  ├─ Run inference                                       │   │
│  │  └─ Stream tokens back                                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                            │                                    │
│               HTTP Streaming Response                           │
│                            ↓                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Suna Backend                                           │   │
│  │  └─ Relay streaming tokens to frontend                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                            │                                    │
│                    Streaming WebSocket                          │
│                            ↓                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Suna Frontend                                          │   │
│  │  └─ Display tokens in real-time                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Request Sequence Diagram

```
Browser          Backend          LiteLLM         Ollama
  │                 │               │               │
  │ POST /api/chat  │               │               │
  │─────────────────>               │               │
  │                 │               │               │
  │                 │ resolve model │               │
  │                 │ get_litellm_params           │
  │                 │               │               │
  │                 │ acompletion() │               │
  │                 │──────────────>               │
  │                 │               │               │
  │                 │               │ POST /v1/chat/completions
  │                 │               │──────────────>
  │                 │               │               │
  │                 │               │               ├─ Check if loaded
  │                 │               │               ├─ Load if needed (slow)
  │                 │               │               ├─ Run inference
  │                 │               │               │
  │                 │               │ Streaming    │
  │                 │               │<──────────── │
  │                 │ Streaming     │               │
  │                 │<──────────────│               │
  │ Streaming       │               │               │
  │<─────────────────               │               │
  │ (Display        │               │               │
  │  tokens as they │               │               │
  │  arrive)        │               │               │
  │                 │               │               │
```

---

## Performance Timeline - First Request vs Second Request

### First Request (Model Not Loaded)

```
T+0s:    User sends message
         ├─ Frontend → Backend: ~50ms
T+0.05s: Backend processes
         ├─ Model resolution: ~5ms
         ├─ Registry lookup: ~5ms
         ├─ LiteLLM setup: ~10ms
T+0.07s: Backend → Ollama: Network latency ~5ms
T+0.08s: Ollama receives request
         ├─ Check cache: miss ❌
         ├─ Load model from disk: ~10-30s (depends on model size)
         │   - Llama 3.2 (3B): ~5s
         │   - Llama 3.1 (8B): ~15s
         │   - DeepSeek-R1 (8B): ~20s
         │   - GPT-OSS (20B): ~60s
T+10-60s: Model loaded, inference starts
T+11-61s: First token generated
T+11-61s: Token → Backend: ~5ms
T+11-61s: Backend → Frontend: ~50ms
T+11-61s: First token appears in UI ✅
```

### Second Request (Model Already Loaded)

```
T+0s:    User sends message
         ├─ Frontend → Backend: ~50ms
T+0.05s: Backend processes
         ├─ Model resolution: ~5ms
         ├─ Registry lookup: ~5ms
         ├─ LiteLLM setup: ~10ms
T+0.07s: Backend → Ollama: Network latency ~5ms
T+0.08s: Ollama receives request
         ├─ Check cache: hit ✅
         ├─ Model already in memory
T+0.1s:  Inference starts immediately
T+0.5s:  First token generated
T+0.5s:  Token → Backend: ~5ms
T+0.5s:  Backend → Frontend: ~50ms
T+0.55s: First token appears in UI ✅ (FAST!)
```

---

## Model Selection vs Model Loading

### Timeline of Events

```
TIMELINE OF EVENTS
├─ T1: User opens Suna app
│       └─ Backend starts
│          └─ Discovers 12 Ollama models
│             └─ Creates registry entries
│                └─ No Ollama loading
│
├─ T2: Frontend renders
│       └─ Fetches model list from backend
│          └─ Shows dropdown with 12 models
│             └─ No Ollama interaction
│
├─ T3: User selects "Llama-3.2" from dropdown
│       └─ Just updates UI state
│          └─ No Ollama interaction
│
├─ T4: User types message and clicks "Send"
│       └─ Sends to backend (model_id in request)
│          └─ Backend processes request
│             └─ Sends to Ollama
│                └─ ⬅️⬅️⬅️ OLLAMA STARTS LOADING HERE ⬅️⬅️⬅️
│                   └─ Model loads from disk
│                      └─ Inference runs
│                         └─ Response sent back
│
└─ T5: Frontend displays response
        └─ Model now stays in memory for future requests
```

---

## Decision: Should We Auto-Load Models?

### Current Behavior (On-Demand)
```
✅ Pros:
- No wasted memory on unused models
- Users can have many models installed
- Server doesn't need huge amounts of RAM

❌ Cons:
- First request with each model is slow
- Users see latency when first trying a model
```

### Optional Phase 2: Pre-Loading
```
✅ Pros:
- Zero latency for first request
- Best user experience
- Models always ready

❌ Cons:
- High memory usage
- Can only load popular models
- Need more RAM on server
```

**Example:** Pre-load top 3 models
```python
PRELOAD_MODELS = [
    "llama3.2:latest",
    "deepseek-r1:8b",
    "qwen2.5-coder:14b"
]
```

Then on startup, warm them all up. Each subsequent model would still load on-demand.

---

## In Summary

```
Model Selection ≠ Model Loading
       ↓                ↓
   Just UI         Actually happens
  (no network)      (at request time)
```

**User's perspective:**
1. Pick a model from the dropdown (instant, no wait)
2. Type and send message
3. First message takes longer (includes load time)
4. Second message with same model is fast (uses cached model)
