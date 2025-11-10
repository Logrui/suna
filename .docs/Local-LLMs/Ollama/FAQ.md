# Quick FAQ: Ollama Model Loading

## Q: Does selecting a model in the frontend automatically load it in Ollama?
**A:** No. Selecting a model is purely a frontend UI operation. No signal is sent to Ollama.

---

## Q: When does the model actually get loaded?
**A:** When the user sends their first message using that model. The backend sends an HTTP request to Ollama, and Ollama automatically loads the model if it's not already in memory.

---

## Q: Does Ollama load the model every time?
**A:** No. After the first request, the model stays in Ollama's memory until manually unloaded or Ollama restarts. Subsequent requests are much faster.

---

## Q: How long does loading take?
**A:** Depends on model size:
- **Llama 3.2 (3B):** ~5 seconds
- **Llama 3.1 (8B):** ~15 seconds  
- **DeepSeek-R1 (8B):** ~20 seconds
- **GPT-OSS (20B):** ~60 seconds

---

## Q: What's the user experience?
**A:**
1. **First message with a model:** ~5-60 second delay (includes load time)
   ```
   User: "Hello!" → 20 second wait → Response appears
   ```

2. **Second message with same model:** ~1-3 second delay (model already loaded)
   ```
   User: "Goodbye!" → 2 second wait → Response appears
   ```

3. **Switch to different model:** ~5-60 second delay (unload first model, load second)
   ```
   User switches to GPT-OSS → 50 second wait → Response appears
   ```

---

## Q: Can we pre-load models to avoid the wait?
**A:** Yes, that's a future Phase 2 enhancement. We could warm up popular models on startup so they're always ready. Trade-off: uses more server memory.

---

## Q: What actually happens behind the scenes?

```
Frontend                Backend              Ollama
  │                       │                    │
  ├─ Click "Send"         │                    │
  │─────────────────────>│                    │
  │                       ├─ Resolve model    │
  │                       ├─ Get config       │
  │                       │                    │
  │                       ├─ HTTP POST        │
  │                       ├──────────────────>│
  │                       │                    ├─ Check: loaded?
  │                       │                    ├─ If no: Load (slow)
  │                       │                    ├─ If yes: Use cached
  │                       │                    ├─ Run inference
  │                       │                    │
  │                       │<──────────────────┤
  │                       │ Streaming tokens  │
  │<───────────────────────                   │
  │ Display in real-time  │                    │
```

---

## Q: Is there any way to trigger loading without sending a message?
**A:** Not with the current implementation. But you could:
1. Add a "Pre-load" button that sends a dummy request
2. Implement Phase 2 pre-loading on startup
3. Use Ollama's keep-alive endpoint directly

---

## Q: What if the user switches models frequently?
**A:** Each model will load when first used, then stay in memory. Ollama will automatically unload older models if memory is low. Performance depends on available RAM.

**Example:**
```
Request 1: Llama 3.2 → Loads (20s) → Cached
Request 2: Llama 3.2 → Cached (1s)
Request 3: DeepSeek-R1 → Loads (30s) → Cached
Request 4: Llama 3.2 → Cached (1s) - still in memory!
Request 5: Llama 3.1 → Loads (20s) → Cached
```

---

## Q: Should I worry about this in production?
**A:** Depends on your use case:
- **For internal tools:** Current behavior is fine
- **For user-facing product:** Consider Phase 2 pre-loading
- **For interactive users:** Pre-load top 3 models for best UX

---

## Q: How much memory do models use?
**A:** Depends on model size and quantization:
- **Llama 3.2 (3B, Q4_K_M):** ~2 GB RAM
- **Llama 3.1 (8B, Q4_K_M):** ~5 GB RAM
- **DeepSeek-R1 (8B, Q4_K_M):** ~5 GB RAM
- **GPT-OSS (20B, MXFP4):** ~14 GB RAM

---

## Q: What if I pre-load all 12 models?
**A:** You'd need ~70+ GB of RAM (rough estimate). Not practical.

Better strategy:
- Pre-load: Top 3 most popular models
- On-demand: Remaining 9 models

---

## Key Takeaway

> **Model selection is not model loading.**
> 
> When users select a model, they're just choosing which model to use for their *next* request. 
>
> The model only actually loads to Ollama when that request is sent.
>
> This is the standard, efficient behavior for on-demand ML model serving.

---

## What This Means for Users

| Action | Network Activity | Ollama Activity |
|--------|------------------|-----------------|
| Select model | ❌ None | ❌ None |
| Send message | ✅ HTTP request | ✅ Load model (if needed) + Inference |
| See response | ✅ Stream back | ✅ Serving cached model |
| Switch model | ❌ None (UI only) | ❌ None |
| Send with new model | ✅ HTTP request | ✅ Load new model + Inference |

---

## Next Steps (If Desired)

To improve first-request latency:

### Phase 2 Enhancement: Model Pre-Loading
```python
# Add during app startup
async def warm_up_ollama_models():
    """Pre-load popular models on startup"""
    popular_models = [
        "llama3.2:latest",      # Fast (3B)
        "deepseek-r1:8b",       # Popular
        "qwen2.5-coder:14b"     # Code-focused
    ]
    
    for model_name in popular_models:
        try:
            await ollama_client.keep_alive(model_name)
            logger.info(f"Pre-loaded {model_name}")
        except Exception as e:
            logger.warning(f"Failed to pre-load {model_name}: {e}")
```

This would eliminate the ~10-30 second first-request delay for popular models, while still supporting lazy loading for others.

---

## Resources

- `MODEL_LOADING_FLOW.md` - Detailed request flow explanation
- `VISUAL_REQUEST_FLOW.md` - Diagrams and timelines
- `USAGE_GUIDE.md` - How to enable/configure Ollama
- `DOCKER_FIX.md` - Docker networking troubleshooting
