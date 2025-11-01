# Ollama Integration - Usage Guide

## ✅ Implementation Complete

The advanced Ollama integration has been successfully implemented with all core features.

---

## 🚀 How to Use

### Enable Ollama Integration

Add to your `backend/.env` file:

```bash
# Enable advanced Ollama integration
OLLAMA_ENABLED=true

# Already configured:
OPENAI_COMPATIBLE_API_KEY=ollama
OPENAI_COMPATIBLE_API_BASE=http://localhost:11434/v1
```

### Disable (Backward Compatible)

To use the old generic "local-model" behavior:

```bash
# Option 1: Set to false
OLLAMA_ENABLED=false

# Option 2: Comment out or remove the line (defaults to false)
# OLLAMA_ENABLED=true
```

---

## 🎯 What Changed

### Files Modified

1. **`backend/core/utils/config.py`**
   - Added `OLLAMA_ENABLED: Optional[bool] = False` field

2. **`backend/core/ai_models/ollama_client.py`** (NEW)
   - Async HTTP client for Ollama API
   - Methods: `list_models()`, `get_model_info()`, `extract_context_window()`, `is_chat_model()`, `construct_display_name()`

3. **`backend/core/ai_models/registry.py`**
   - Added `_register_generic_openai_compatible()` - fallback method
   - Added `initialize_ollama_models()` - async discovery method
   - Removed inline OpenAI-compatible registration from `_initialize_models()`

4. **`backend/api.py`**
   - Added `await registry.initialize_ollama_models()` to FastAPI lifespan
   - Runs during startup after Redis initialization

---

## 📊 Expected Behavior

### With `OLLAMA_ENABLED=true`:

**On Startup:**
```
[INFO] Starting Ollama model discovery...
[INFO] Found 13 Ollama models
[DEBUG] Skipping embedding-only model: embeddinggemma:latest
[DEBUG] Registered Ollama model: Llama-3.2 3B Instruct (Q4_K_M) (context: 131072, priority: 51)
[DEBUG] Registered Ollama model: DeepSeek-R1 8B (Q4_K_M) (context: 131072, priority: 54)
...
[INFO] Successfully registered 12 Ollama models
[DEBUG] Ollama model initialization completed
```

**In Model Registry:**
- ✅ 12 individual models (13 total minus 1 embedding-only)
- ✅ Accurate context windows (128K for Llama 3.2, DeepSeek-R1)
- ✅ Human-friendly names: "Llama-3.2 3B Instruct (Q4_K_M)"
- ✅ Priority 50-63 (larger models get higher priority)
- ✅ Zero cost ($0.00 per million tokens)

**In Frontend:**
Users will see dropdown with:
- Llama-3.2 3B Instruct (Q4_K_M)
- DeepSeek-R1 8B (Q4_K_M)
- GPT-OSS 20.9B (MXFP4)
- Qwen2.5-Coder 14B (Q4_K_M)
- ... etc

### With `OLLAMA_ENABLED=false` (or not set):

**On Startup:**
```
[INFO] OLLAMA_ENABLED is False, using generic OpenAI-compatible registration
[DEBUG] Ollama model initialization completed
```

**In Model Registry:**
- ✅ 1 generic model: "Local LLM (OpenAI-Compatible)"
- ✅ Context window: 4,000 tokens (hardcoded default)
- ✅ Priority: 50
- ✅ Same behavior as before (backward compatible)

### With Ollama Stopped/Unavailable:

**On Startup:**
```
[ERROR] Failed to list Ollama models: All connection attempts failed
[ERROR] Ollama model discovery failed: ...
[INFO] Falling back to generic OpenAI-compatible registration
[DEBUG] Ollama model initialization completed
```

**Result:**
- ✅ Gracefully falls back to generic model
- ✅ Application continues to run normally
- ✅ No crashes or failures

---

## 🔍 How It Works

### Startup Flow

1. **FastAPI lifespan starts**
2. Database initialization
3. Redis initialization
4. **Ollama initialization** ⬅️ NEW
   - If `OLLAMA_ENABLED=false`: Register generic model
   - If `OLLAMA_ENABLED=true`: 
     - Query `GET /api/tags` to list models
     - For each model: Query `POST /api/show` for details
     - Filter out embedding-only models
     - Extract context windows (architecture-aware)
     - Construct display names
     - Calculate priority based on size
     - Register each model individually
   - If errors occur: Fallback to generic registration
5. Other service initializations continue

### Model Selection

When a user makes a request:
1. Frontend sends model ID (e.g., `"openai-compatible/llama3.2:latest"`)
2. `ModelManager.resolve_model_id()` validates the model
3. `LLMService.make_llm_api_call()` gets model config
4. LiteLLM Router matches `"openai-compatible/*"` pattern
5. Routes to `http://localhost:11434/v1` with model name
6. Ollama handles the request

### Fallback Chain

If an Ollama model fails during runtime:
1. Model's `fallback_models` list is consulted
2. Falls back to cloud models (Claude Haiku, GPT-4o-mini, etc.)
3. LiteLLM Router's built-in fallback handles provider failures

---

## 🎨 Display Name Examples

| Ollama Model Name | Display Name in UI |
|-------------------|-------------------|
| `llama3.2:latest` | Llama-3.2 3B Instruct (Q4_K_M) |
| `deepseek-r1:8b` | DeepSeek-R1 8B (Q4_K_M) |
| `gpt-oss:latest` | GPT-OSS 20.9B (MXFP4) |
| `qwen2.5-coder:14b` | Qwen2.5-Coder 14B (Q4_K_M) |
| `gemma3:4b` | Gemma3 4B (Q4_K_M) |

---

## ⚙️ Technical Details

### Context Window Extraction

The implementation handles architecture-specific field names:

```python
# Llama models
model_info["llama.context_length"] = 131072

# Qwen models  
model_info["qwen2.context_length"] = 131072

# Gemma models
model_info["gemma2.context_length"] = 8192
```

### Priority Calculation

```python
base_priority = 50

# Larger models get priority boost
# 3.2B → +1 priority = 51
# 8B → +4 priority = 54
# 14B → +7 priority = 57
# 33B → +13 priority = 63 (capped)

priority = base_priority + min(int(size_in_billions / 2), 13)
```

### Capability Detection

```python
capabilities = ["completion", "tools"]      # ✅ Chat model
capabilities = ["embedding"]                # ❌ Filtered out
capabilities = ["completion", "embedding"]  # ✅ Chat model (has completion)
```

---

## 🧪 Testing Your Setup

### 1. Start the Backend

```powershell
cd D:\Homelab\suna\backend
# Make sure .env has OLLAMA_ENABLED=true
python -m uvicorn api:app --reload
```

### 2. Check Startup Logs

Look for:
```
[INFO] Starting Ollama model discovery...
[INFO] Successfully registered 12 Ollama models
```

### 3. Test API Endpoint

```powershell
# List all models (should include Ollama models)
Invoke-RestMethod -Uri "http://localhost:8000/api/models" -Method Get
```

### 4. Test in Frontend

- Open Suna frontend
- Navigate to model selection dropdown
- Should see all your Ollama models with friendly names
- Select an Ollama model and make a request
- Should route to local Ollama instance

---

## 🐛 Troubleshooting

### Issue: No Ollama models appearing

**Check:**
1. `OLLAMA_ENABLED=true` in `.env`
2. Ollama is running: `Invoke-RestMethod http://localhost:11434/api/tags`
3. Check backend startup logs for errors

### Issue: Wrong context windows

**Solution:** Context windows are now queried from Ollama API automatically. No configuration needed.

### Issue: Embedding models showing up

**Solution:** They should be filtered automatically. Check logs for `"Skipping embedding-only model"` messages.

### Issue: Application won't start

**Check:**
1. Startup logs - should show "Falling back to generic OpenAI-compatible registration"
2. Set `OLLAMA_ENABLED=false` to bypass Ollama integration
3. Verify all environment variables are set correctly

---

## 📈 Next Steps (Future Enhancements)

**Phase 2 Features (Not Implemented):**
- Model management UI (pull/delete models)
- Model warm-up on startup
- Keep-alive optimization
- Vision model support
- Custom per-model configurations

**Current Implementation:**
- ✅ Dynamic model discovery
- ✅ Accurate context windows
- ✅ Human-friendly display names
- ✅ Capability filtering
- ✅ Priority-based ranking
- ✅ Backward compatibility
- ✅ Graceful fallbacks

---

## 📝 Commit Summary

**Commit:** `e38bc350`

**Files Changed:**
- `backend/core/utils/config.py` (+1 line)
- `backend/core/ai_models/ollama_client.py` (+236 lines, NEW)
- `backend/core/ai_models/registry.py` (+176 lines, -28 lines)
- `backend/api.py` (+8 lines)
- `.docs/ollama-integration/PRE_IMPLEMENTATION_RESEARCH.md` (+594 lines, NEW)

**Total:** ~1,015 insertions, ~28 deletions

---

**Ready to use!** Just set `OLLAMA_ENABLED=true` in your `.env` and restart the backend. 🚀
