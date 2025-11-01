# Ollama Integration Documentation

**Last Updated:** November 1, 2025

---

## 📚 Documentation Index

### 1. [LLM Call Flow & Priority System](./LLM_CALL_FLOW_AND_PRIORITY_SYSTEM.md)
**Comprehensive analysis of how LLMs are called in Suna App**

**Topics Covered:**
- Architecture overview (Application → Model Manager → LLM Service → LiteLLM Router → Providers)
- Model registry with priority system (102-50 scale)
- Dual fallback systems (LiteLLM router + application-level)
- Rate limit detection and intelligent retry logic
- Provider-specific configuration management
- Complete model listing with capabilities
- Performance characteristics and cost analysis
- Best practices and recommendations

**Key Insights:**
- 7+ provider support with seamless failover
- Anthropic/Bedrock models prioritized (102-100)
- Google Gemini secondary (98-96)
- OpenAI tertiary (95-92)
- Local models (Ollama/LM Studio) as fallback (50)

---

### 2. [Ollama Integration Status](./OLLAMA_INTEGRATION_STATUS.md)
**Complete assessment of current Ollama support and required improvements**

**Current Status:** ⚠️ Basic (OpenAI-Compatible API only)

**Topics Covered:**
- Current implementation analysis (environment variables, routing, limitations)
- What works vs. what doesn't work
- Missing features (model discovery, context window detection, capabilities)
- Required advanced integrations (3 phases)
- Code examples for improvements
- Priority recommendations
- LM Studio compatibility notes

**Key Findings:**
- ❌ No dynamic model discovery from Ollama API
- ❌ Hardcoded 4K context window (inaccurate)
- ❌ Single generic "local-model" instead of per-model selection
- ❌ No model management (pull, delete, update)
- ✅ Basic chat completion works
- ✅ Fallback to cloud models works

**Recommendations:**
1. **Priority 1 (Critical):** Fix context window detection, dynamic model discovery
2. **Priority 2 (Important):** Capability detection, model info display
3. **Priority 3 (Nice-to-have):** Model management UI, performance optimizations

---

## 🎯 Quick Reference

### Current Ollama Setup

```bash
# Environment variables
OPENAI_COMPATIBLE_API_KEY=ollama
OPENAI_COMPATIBLE_API_BASE=http://localhost:11434/v1

# Start Ollama
ollama serve

# Test in Suna
# Select "ollama" or "local-llm" model
```

### Integration Level Matrix

| Feature | Current | Advanced Needed |
|---------|---------|-----------------|
| Basic Chat | ✅ Works | - |
| Context Window | ❌ 4K hardcoded | ✅ Auto-detect |
| Model Selection | ❌ Single generic | ✅ Per-model |
| Model Management | ❌ None | ✅ Pull/Delete |
| Capabilities | ❌ Generic | ✅ Detect vision/embed |

### Ollama API Endpoints (Not Currently Used)

```python
GET  /api/tags            # List models
POST /api/show            # Get model specs
POST /api/pull            # Download model
DELETE /api/delete        # Remove model
POST /api/embeddings      # Generate embeddings
```

---

## 📖 Related Documentation

- [File Storage & Embeddings](..//file%20storage%20and%20embeddings/) - How embeddings work (OpenAI-only currently)
- Backend README - Overall architecture
- Frontend README - UI components

---

## 🔄 Document Updates

- **Nov 1, 2025:** Initial documentation created
  - LLM call flow analysis completed
  - Ollama integration assessment completed
  - Priority recommendations established

---

## 🤝 Contributing

If you implement any of the recommended improvements:

1. Update the relevant documentation
2. Mark completed items with ✅
3. Add implementation notes
4. Update the "Last Updated" date

---

**Questions?** Check the detailed documents above or open an issue on GitHub.
