# Ollama Model Loading & Request Flow

## Short Answer

**No, selecting the model does NOT automatically send a signal to load it.** 

The model must already be loaded in Ollama before the request is sent. When a user actually makes a request using the selected Ollama model, the request flows directly to Ollama via the OpenAI-compatible API endpoint. **Ollama will then load the model if it's not already loaded** (or serve it if it's already in memory).

---

## Complete Request Flow

### Step 1: User Selects Model in Frontend
```
Frontend: "I want to use openai-compatible/llama3.2:latest"
└─ Sends model ID to backend via API request
```

**What happens:**
- Just displays the model name in UI
- No signal sent to Ollama
- No loading happens yet

---

### Step 2: Backend Receives Request with Model ID

**File:** `backend/api.py` (or wherever the endpoint is)

```python
# User makes a request, specifying the model
POST /api/chat
{
    "model": "openai-compatible/llama3.2:latest",
    "messages": [{"role": "user", "content": "Hello!"}]
}
```

---

### Step 3: Model Resolution

**File:** `backend/core/services/llm.py` → `make_llm_api_call()`

```python
async def make_llm_api_call(model_name: str, ...):
    # Resolve the model ID (convert alias to canonical ID)
    resolved_model_name = model_manager.resolve_model_id(model_name)
    # Result: "openai-compatible/llama3.2:latest"
```

**What happens:**
- Model ID is validated and aliased
- No network calls yet
- Still no Ollama interaction

---

### Step 4: Get LiteLLM Parameters

**File:** `backend/core/ai_models/manager.py` → `get_litellm_params()`

```python
def get_litellm_params(self, model_id: str, **override_params):
    model = self.get_model(model_id)  # Fetch from registry
    params = model.get_litellm_params(**override_params)
    return params
```

**Generated params for Ollama models:**
```python
{
    "model": "openai-compatible/llama3.2:latest",  # The model name Ollama expects
    "api_base": "http://host.docker.internal:11434/v1",  # Where to send request
    "messages": [...],
    "temperature": 0,
    "stream": True,
    # ... other params
}
```

**What happens:**
- Parameters assembled from model configuration
- `api_base` is set to your Ollama server URL
- Still no actual request sent

---

### Step 5: Send Request to LiteLLM Router

**File:** `backend/core/services/llm.py` → `make_llm_api_call()`

```python
response = await provider_router.acompletion(**params)
```

**What happens:**
- LiteLLM Router receives the request
- Pattern matching: `"openai-compatible/*"` matches `"openai-compatible/llama3.2:latest"`
- Routes to OpenAI-compatible provider

---

### Step 6: OpenAI-Compatible Protocol Request

**What LiteLLM sends to Ollama:**

```http
POST http://host.docker.internal:11434/v1/chat/completions
Content-Type: application/json

{
    "model": "llama3.2:latest",
    "messages": [{"role": "user", "content": "Hello!"}],
    "temperature": 0,
    "stream": true
    # ... other OpenAI-compatible params
}
```

**What happens HERE:**
- **THIS is where Ollama receives the request**
- Ollama checks if `llama3.2:latest` is loaded in memory
- **If NOT loaded:** Ollama loads it from disk (takes 5-60 seconds depending on model size)
- **If loaded:** Ollama starts processing immediately
- Ollama sends back streaming responses

---

### Step 7: Response Streams Back

```
Ollama → LiteLLM → Backend → Frontend
   ↓        ↓          ↓         ↓
 "Hello..." → streaming chunks → displayed in real-time
```

---

## Key Points

### ✅ Model Loading Happens At Request Time

| When | What Happens |
|------|--------------|
| **Frontend Selection** | No network activity |
| **Backend Processing** | No Ollama contact |
| **First API Call** | ⬅️ **OLLAMA LOADS MODEL HERE** |
| **Subsequent Calls** | Model already in memory = fast |

### ✅ Ollama Handles Everything

```
Your Suna Backend
        ↓
    (sends HTTP request)
        ↓
    Ollama Server
        ├─ Check: Is llama3.2:latest loaded?
        ├─ If No: Load from disk (may take 30 seconds)
        ├─ If Yes: Already in memory (instant)
        ├─ Process the request
        └─ Send response
        ↓
    (streams back responses)
        ↓
Your Frontend
```

---

## Practical Examples

### Example 1: First Request with Llama 3.2

```
Timeline:
T+0s: User clicks "Send" with llama3.2 selected
T+0s: Request sent to backend
T+0s: Backend sends HTTP POST to Ollama
T+2-15s: Ollama loads llama3.2:latest from disk
       (shows in Ollama: "Loading llama3.2:latest...")
T+15s: Ollama starts processing
T+16s: First token appears in frontend
T+20s: Full response received
```

### Example 2: Second Request with Llama 3.2

```
Timeline:
T+0s: User clicks "Send" with llama3.2 selected
T+0s: Request sent to backend
T+0s: Backend sends HTTP POST to Ollama
T+0.5s: Ollama sees llama3.2:latest already in memory
T+0.5s: Ollama starts processing immediately
T+1s: First token appears in frontend
T+5s: Full response received
```

### Example 3: Switch Between Models

```
Timeline:
T+0s: User was using llama3.2
T+0s: User selects deepseek-r1:8b and clicks "Send"
T+0s: Request sent for deepseek-r1:8b
T+5-30s: Ollama unloads llama3.2 (or keeps both if memory allows)
T+5-30s: Ollama loads deepseek-r1:8b
T+30s: Response starts appearing
```

---

## No Pre-Loading or Warm-Up

**Current Implementation:**
- ❌ No pre-loading of models
- ❌ No warm-up on startup
- ❌ No keep-alive mechanism
- ✅ On-demand loading (lazy)

**Result:** 
- First request with a model takes longer (load time + processing)
- Subsequent requests are fast (model stays in memory until manually unloaded)

---

## Future Optimization (Phase 2)

We could add optional features:

```python
# Pseudo-code for Phase 2 enhancement
async def warm_up_ollama_models():
    """Optionally pre-load popular models on startup"""
    for model_name in ["llama3.2:latest", "deepseek-r1:8b"]:
        try:
            await ollama_client.keep_alive(model_name)
            logger.info(f"Pre-loaded {model_name}")
        except:
            pass  # Model might fail to load, that's OK
```

This would:
- Load models during app startup
- Eliminate first-request latency
- Use more server memory
- Improve perceived speed for users

---

## Summary

| Question | Answer |
|----------|--------|
| **Does selecting a model load it?** | No |
| **When does Ollama get involved?** | When the actual request is made (step 6) |
| **Does Ollama load the model?** | Yes, automatically if not already loaded |
| **How long does loading take?** | 2-60 seconds depending on model size |
| **Does it load every time?** | No, only if not already in memory |
| **Can we pre-load models?** | Yes, that would be Phase 2 enhancement |

**TL;DR:** Selecting a model is just UI selection. The actual Ollama loading happens when you send the first message using that model. Ollama handles everything automatically.
