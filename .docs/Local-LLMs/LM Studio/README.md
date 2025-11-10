# LM Studio Integration for Suna

**Status:** 📋 **Planning Phase - Ready for Development**  
**Last Updated:** November 9, 2025  
**Mirrors:** Ollama Integration  
**Estimated Development Time:** 3.5-6 hours

---

## 📚 Documentation Index

### 1. [Implementation Plan](./IMPLEMENTATION_PLAN.md)
**Complete technical roadmap with code examples**

**Covers:**
- API integration points (`/api/v0/models` and `/api/v0/models/{id}`)
- LMStudioClient class design
- Registry integration strategy
- Configuration flags and Docker setup
- Dual provider support (Ollama + LM Studio)
- Fallback chain mechanisms
- Full checklist for development

**Key Section:** Phase 1 implementation with pseudo-code for all changes

---

### 2. [Usage Guide](./USAGE_GUIDE.md)
**How to set up and use LM Studio with Suna**

**Covers:**
- Quick start in 5 steps
- Configuration options (minimal, full, dual provider)
- Expected startup behavior
- Troubleshooting guide
- Performance characteristics
- Environment variable reference
- Comparison with Ollama

**Key Section:** Configuration examples and Docker setup

---

### 3. [Status & API Reference](./STATUS_AND_API_REFERENCE.md)
**Technical details, API endpoints, and comparison**

**Covers:**
- LM Studio REST API specification
- API comparison with Ollama
- Implementation code structure comparison
- Fallback chain scenarios
- Error handling patterns
- Performance profiles
- Learning resources

**Key Section:** API endpoint documentation with response examples

---

## 🎯 Quick Overview

### What is LM Studio?

**Local LLM inference platform** similar to Ollama:
- ✅ Run models locally (privacy)
- ✅ No API keys needed
- ✅ Free inference
- ✅ Full control over models
- ✅ Better UI than Ollama
- ✅ Excellent REST API

### Why Implement It?

**Same benefits as Ollama, better implementation:**
- ✅ Cleaner REST API (no nested parsing)
- ✅ Direct context window exposure
- ✅ Better documentation
- ✅ Simpler code (easier to verify)

### How It Works

```
LM Studio Running
   ↓ (discovers models)
/api/v0/models endpoint
   ↓ (lists available models)
Suna Backend
   ↓ (extracts metadata)
Model Registry
   ↓ (registers each model)
Frontend Dropdown
   ↓ (user selects)
LiteLLM Router
   ↓ (routes to endpoint)
/v1/chat/completions
   ↓ (OpenAI-compatible)
LM Studio Response
   ↓
User
```

---

## 🚀 At a Glance

### Files to Create
```
backend/core/ai_models/lmstudio_client.py  (NEW, ~250 lines)
```

### Files to Modify
```
backend/core/utils/config.py                (+2 lines)
backend/core/ai_models/registry.py         (+150 lines)
backend/api.py                              (+5 lines)
```

### Configuration
```bash
# In backend/.env
LMSTUDIO_ENABLED=true
OPENAI_COMPATIBLE_API_KEY=lmstudio
OPENAI_COMPATIBLE_API_BASE=http://localhost:1234/v1

# Docker networking (if containerized)
LMSTUDIO_API_BASE=http://host.docker.internal:1234
```

### Implementation Approach
1. **Mirrors Ollama:** Uses same pattern for consistency
2. **Simpler API:** LM Studio's endpoint is cleaner
3. **No Breaking Changes:** Backward compatible
4. **Dual Provider:** Can run both simultaneously
5. **Fallback Support:** Fails over to cloud models gracefully

---

## 🔀 Comparison Matrix

### LM Studio vs Ollama

| Feature | LM Studio | Ollama | Winner |
|---------|-----------|--------|--------|
| **Installation** | Download app | One command | Tie |
| **API Complexity** | Simple, flat | Complex, nested | 🟢 LM Studio |
| **Context Window** | Direct field | Parse architecture | 🟢 LM Studio |
| **Documentation** | Excellent | Good | 🟢 LM Studio |
| **Community** | Growing | Large | 🟢 Ollama |
| **Dual Support** | ✅ Yes | ✅ Yes | Tie |
| **Implementation** | ~400 lines | ~400 lines | Tie |

**Verdict:** LM Studio has cleaner implementation, Ollama has larger community. Both excellent.

---

## 📊 Model Examples

### Models from LM Studio

```
Meta Llama 3.1 8B Instruct Q4_K_M
  - Context: 131,072 tokens
  - Size: 4.7 GB
  - Speed: Fast
  - Quality: Excellent

Mistral 7B Instruct V0.3 Q4_0
  - Context: 32,768 tokens
  - Size: 4 GB
  - Speed: Very Fast
  - Quality: Good

DeepSeek Coder 33B Q4_0
  - Context: 4,096 tokens
  - Size: 19 GB
  - Speed: Slower
  - Quality: Excellent for code
```

### In Suna UI

Users will see these with friendly names:
- Select "Meta Llama 3.1 8B Instruct Q4_K_M" from dropdown
- Automatic fallback to Claude Sonnet if unavailable
- Full feature parity with cloud models

---

## 🔄 Architecture Integration

### Placement in Model Hierarchy

```
Priority 102-100: Claude (Anthropic)
Priority 98-96:   Gemini (Google)
Priority 95-92:   GPT (OpenAI)
Priority 51-63:   LM Studio ← NEW
Priority 50-63:   Ollama (if enabled)
```

### In ModelRegistry

```python
class ModelRegistry:
    def __init__(self):
        self._initialize_models()  # Cloud models only
    
    async def initialize_ollama_models(self):
        """Discovery at startup (Phase 1)"""
        # Existing implementation
    
    async def initialize_lmstudio_models(self):
        """Discovery at startup (Phase 2) ← NEW"""
        # New implementation (mirrors Ollama)
```

### Request Flow

```
User Request
    ↓
Model Selection
    ↓
resolve_model_id()
    ↓
get_litellm_params()
    ↓
LiteLLM Router
    ↓
Pattern Match: "openai-compatible/*"
    ↓
Route to: model.config.api_base
    ↓
Send to LM Studio (or Ollama)
    ↓
Response
```

---

## ✅ Implementation Checklist

### Phase 1: Core Implementation
- [ ] Create `lmstudio_client.py`
- [ ] Add config flags
- [ ] Update registry
- [ ] Update API startup
- [ ] Test with single model
- [ ] Test with multiple models

### Phase 2: Testing & Validation
- [ ] Docker networking
- [ ] Fallback behavior
- [ ] Error handling
- [ ] Parallel with Ollama

### Phase 3: Documentation
- [ ] Update main README
- [ ] Add examples
- [ ] Create troubleshooting guide

### Phase 4: Optimization (Future)
- [ ] Model warm-up
- [ ] Keep-alive mechanisms
- [ ] Performance monitoring

---

## 🎓 What You'll Learn

### Technical Concepts
- Async HTTP clients (httpx library)
- API integration patterns
- Error handling and fallbacks
- Configuration management
- Model registry design

### Practical Skills
- Integration testing
- Docker networking
- API documentation reading
- Performance profiling
- Debugging async code

### Architecture Understanding
- Multi-provider model management
- Priority-based selection
- Graceful degradation
- Provider abstraction

---

## 🔗 Quick Links

| Document | Purpose |
|----------|---------|
| [Implementation Plan](./IMPLEMENTATION_PLAN.md) | How to build it |
| [Usage Guide](./USAGE_GUIDE.md) | How to use it |
| [API Reference](./STATUS_AND_API_REFERENCE.md) | Technical details |
| [Ollama Docs](../Ollama/README.md) | Reference implementation |

---

## 🚀 Get Started

### For Developers

1. **Read** [Implementation Plan](./IMPLEMENTATION_PLAN.md)
2. **Review** comparison with Ollama in [API Reference](./STATUS_AND_API_REFERENCE.md)
3. **Create** `lmstudio_client.py` following the pattern
4. **Integrate** with `ModelRegistry`
5. **Test** with real LM Studio instance
6. **Document** findings

### For Users

1. **Install** LM Studio from [lmstudio.ai](https://lmstudio.ai)
2. **Download** models you want
3. **Start** server (`lms server start`)
4. **Set** `LMSTUDIO_ENABLED=true` in `.env`
5. **Restart** backend
6. **Select** LM Studio models from dropdown

---

## 💡 Key Insights

### Why Mirror Ollama?

✅ **Consistency:** Same pattern, easier to understand  
✅ **Proven:** Already works in production  
✅ **Maintainability:** Clear conventions  
✅ **Testing:** Can reuse test patterns  

### Why Simpler for LM Studio?

✅ **Better API:** Flat structure vs nested  
✅ **No Parsing:** Direct context window field  
✅ **Modern Design:** Versioned endpoints  
✅ **Education:** Easier to verify correctness  

### Why Both Can Coexist?

✅ **Namespace:** `ollama/*` vs `lmstudio/*`  
✅ **Priority:** Overlapping but distinct  
✅ **Fallback:** One never blocks the other  
✅ **Config:** Independent setup  

---

## ⚠️ Potential Issues & Solutions

### Port Conflict
**Problem:** Both Ollama (11434) and LM Studio (1234) running  
**Solution:** Use both ports, they're different by default ✅

### Docker Networking
**Problem:** Container can't reach host services  
**Solution:** Use `host.docker.internal:1234` ✅

### Model Loading Time
**Problem:** First request is slow  
**Solution:** Expected behavior, models cache after load ✅

### Context Window Errors
**Problem:** Some models missing context info  
**Solution:** LM Studio has direct field (no fallback needed) ✅

---

## 📈 Success Metrics

### Implementation Complete When:
- ✅ `lmstudio_client.py` working
- ✅ Models auto-discovered on startup
- ✅ Accurate context windows detected
- ✅ All tests passing
- ✅ Documentation complete
- ✅ Works with Docker containers
- ✅ Graceful fallback to cloud models

### User-Visible Signs:
- ✅ Models appear in frontend dropdown
- ✅ Can select and use LM Studio models
- ✅ Responses work correctly
- ✅ Falls back if LM Studio unavailable

---

## 🎯 End Result

Once implemented, you will have:

```
Multi-Provider Model System
├─ ✅ Cloud Providers (Anthropic, Google, OpenAI)
├─ ✅ Ollama (Local, free)
└─ ✅ LM Studio (Local, free) ← NEW
    └─ ✅ Dual support (can run both)
```

**User Experience:**
```
"Choose your model"
├─ Cloud Models (fast APIs, cost $$)
└─ Local Models (free, private)
    ├─ Ollama: llama3.2 8B
    └─ LM Studio: Mistral 7B ← NEW
```

**Cost Impact:**
```
Before: 🔴 Cloud-only = daily costs
After:  🟢 Cloud + Local = optional costs
```

---

## 🎓 References

- [LM Studio Docs](https://lmstudio.ai/docs)
- [LM Studio REST API](https://lmstudio.ai/docs/developer/rest/endpoints)
- [Ollama Docs](https://ollama.ai/)
- [LiteLLM Router](https://litellm.vercel.app/)

---

**Ready to implement? Start with [Implementation Plan](./IMPLEMENTATION_PLAN.md)** 🚀
