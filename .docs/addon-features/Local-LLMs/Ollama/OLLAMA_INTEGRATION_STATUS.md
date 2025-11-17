# Ollama Integration Status in Suna App

**Assessment Date:** November 1, 2025  
**Integration Type:** Basic (OpenAI-Compatible API)  
**Status:** ⚠️ Functional but Limited

---

## 📋 Executive Summary

**Current State:** Suna App supports Ollama through a **basic OpenAI-compatible integration** only. This is a generic pass-through approach that treats Ollama as any other OpenAI-compatible endpoint, without utilizing Ollama-specific features or APIs.

**Integration Level:** **BASIC** ⚠️

**Key Limitations:**
- ❌ No dynamic model discovery from Ollama API
- ❌ No automatic context window detection
- ❌ No model specification pulling
- ❌ Hardcoded 4K context window (inaccurate for most Ollama models)
- ❌ No Ollama-specific capabilities (vision, embeddings) detection
- ❌ No integration with Ollama's `/api/tags` or `/api/show` endpoints
- ❌ No model management (pull, list, delete) functionality

---

## 🔍 Current Implementation Analysis

### 1. Configuration Method

**Environment Variables Required:**
```bash
OPENAI_COMPATIBLE_API_KEY=ollama        # Can be any value
OPENAI_COMPATIBLE_API_BASE=http://localhost:11434/v1
```

**Registration Location:** `backend/core/ai_models/registry.py` (Lines 355-383)

```python
# Only registered if both API key and base URL are configured
if config.OPENAI_COMPATIBLE_API_KEY and config.OPENAI_COMPATIBLE_API_BASE:
    self.register(Model(
        id="openai-compatible/local-model",
        name="Local LLM (OpenAI-Compatible)",
        provider=ModelProvider.OPENAI,
        aliases=["local-llm", "ollama", "lm-studio", "local"],
        context_window=4_000,  # ⚠️ HARDCODED - NOT DYNAMIC
        capabilities=[
            ModelCapability.CHAT,
            ModelCapability.FUNCTION_CALLING,
        ],
        pricing=ModelPricing(
            input_cost_per_million_tokens=0.0,
            output_cost_per_million_tokens=0.0
        ),
        tier_availability=["free", "paid"],
        priority=50,  # Lower priority - fallback option
        enabled=True,
        config=ModelConfig(
            api_base=config.OPENAI_COMPATIBLE_API_BASE,
        ),
        fallback_models=[...cloud models...]
    ))
```

### 2. Routing Mechanism

**LiteLLM Router Configuration:** `backend/core/services/llm.py` (Lines 81-103)

```python
model_list = [
    {
        "model_name": "openai-compatible/*",
        "litellm_params": {
            "model": "openai/*",
            "api_key": config.OPENAI_COMPATIBLE_API_KEY,
            "api_base": config.OPENAI_COMPATIBLE_API_BASE,
        },
    },
    {
        "model_name": "*",  # All other providers
        "litellm_params": {
            "model": "*",
        },
    },
]
```

**How It Works:**
1. User selects "ollama" or "local-llm" model
2. System resolves to `openai-compatible/local-model`
3. LiteLLM routes request to `api_base + /v1/chat/completions`
4. Ollama's OpenAI-compatible endpoint handles the request
5. Response is streamed back through LiteLLM

### 3. What's Missing

#### No Model Discovery

**Ollama API Endpoint:** `GET http://localhost:11434/api/tags`

**Expected Response:**
```json
{
  "models": [
    {
      "name": "llama3.2:latest",
      "model": "llama3.2:latest",
      "modified_at": "2024-10-15T12:30:45Z",
      "size": 2618624512,
      "digest": "abc123...",
      "details": {
        "parent_model": "",
        "format": "gguf",
        "family": "llama",
        "families": ["llama"],
        "parameter_size": "3B",
        "quantization_level": "Q4_0"
      }
    },
    {
      "name": "mistral:7b",
      "model": "mistral:7b",
      ...
    }
  ]
}
```

**Current Behavior:** ❌ Not used. Suna doesn't query this endpoint.

#### No Model Specifications

**Ollama API Endpoint:** `POST http://localhost:11434/api/show`

**Request:**
```json
{
  "name": "llama3.2:latest"
}
```

**Expected Response:**
```json
{
  "modelfile": "...",
  "parameters": "...",
  "template": "...",
  "details": {
    "parent_model": "",
    "format": "gguf",
    "family": "llama",
    "families": ["llama"],
    "parameter_size": "3B",
    "quantization_level": "Q4_0"
  },
  "model_info": {
    "general.architecture": "llama",
    "general.file_type": 2,
    "general.parameter_count": 3213383680,
    "llama.context_length": 8192,
    "llama.embedding_length": 3072,
    "llama.block_count": 26,
    "llama.feed_forward_length": 8192,
    "llama.attention.head_count": 24,
    "llama.attention.head_count_kv": 8
  }
}
```

**Current Behavior:** ❌ Not used. Context window is hardcoded to 4K.

**Impact:**
- Llama 3.2 (8K context) → reported as 4K ❌
- Mistral 7B (32K context) → reported as 4K ❌
- Qwen 2.5 (128K context) → reported as 4K ❌
- CodeLlama (100K context) → reported as 4K ❌

### 4. Model Priority & Fallback

**Priority Level:** 50 (Lowest in the system)

**Fallback Chain:**
```
Local Ollama Model (fails)
  ↓
Claude Haiku 4.5 (Anthropic/Bedrock)
  ↓
GPT-4o Mini (OpenAI) or Gemini 2.5 Flash
  ↓
Claude Sonnet 4
```

**Behavior:** Ollama is treated as **least reliable** and will fallback to expensive cloud models immediately on any error.

---

## 🚫 What Doesn't Work

### 1. Accurate Context Window
```python
# Current: HARDCODED
context_window=4_000

# Reality for popular Ollama models:
llama3.2:latest      → 8,192 tokens   (2x underestimated)
mistral:7b          → 32,768 tokens  (8x underestimated)
qwen2.5:7b          → 131,072 tokens (32x underestimated)
codellama:13b       → 100,000 tokens (25x underestimated)
```

**Impact:** Users can't utilize full context capabilities of their local models.

### 2. Model Selection

**Current:** Single hardcoded model `openai-compatible/local-model`

**Desired:** Dynamic list of all pulled Ollama models
```
- llama3.2:latest
- mistral:7b-instruct-v0.2
- qwen2.5:7b
- codellama:13b-instruct
- deepseek-coder:6.7b
```

**Impact:** Users can't switch between different Ollama models within the app.

### 3. Capability Detection

**Current:** Assumes only `CHAT` and `FUNCTION_CALLING`

**Ollama Models Support:**
- Vision (llama3.2-vision, llava)
- Embeddings (nomic-embed-text, mxbai-embed-large)
- Code completion (codellama, deepseek-coder)
- Thinking/reasoning (qwq, deepseek-r1)

**Impact:** Vision models, embedding models, and specialized capabilities are not recognized.

### 4. Model Management

**Not Available:**
- ❌ Pull new models from Ollama registry
- ❌ List locally available models
- ❌ Delete unused models
- ❌ Check model sizes and disk usage
- ❌ Update existing models

### 5. Performance Optimization

**Not Implemented:**
- ❌ Model warm-up (first request is slow)
- ❌ Keep-alive configuration
- ❌ GPU/CPU allocation settings
- ❌ Concurrent request handling
- ❌ Streaming optimization

---

## ✅ What Works

### 1. Basic Chat Completion

**Endpoint:** `POST http://localhost:11434/v1/chat/completions`

**Works For:**
- ✅ Simple text generation
- ✅ Conversation history
- ✅ System prompts
- ✅ Temperature/top_p parameters
- ✅ Streaming responses
- ✅ Max tokens limiting

**Example:**
```python
# User selects "ollama" model
response = await make_llm_api_call(
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "What is Python?"}
    ],
    model_name="ollama",
    temperature=0.7,
    stream=True
)
```

### 2. Function Calling (Limited)

**Status:** ⚠️ Depends on Ollama model support

**Works For:**
- ✅ Models with function calling support (llama3.2, mistral)
- ❌ Older models without tool support

### 3. Cost Tracking

**Configuration:**
```python
pricing=ModelPricing(
    input_cost_per_million_tokens=0.0,
    output_cost_per_million_tokens=0.0
)
```

**Works:** ✅ Correctly reports $0.00 costs for local inference

### 4. Fallback System

**Works:** ✅ If Ollama fails (server down, rate limit, error), system falls back to cloud models

**Benefit:** Resilience for production deployments

---

## 🔧 Required Advanced Integrations

### Phase 1: Model Discovery & Specifications

#### 1.1 List Available Models

**API Endpoint:** `GET /api/tags`

**Implementation Needed:**
```python
# backend/core/ai_models/ollama_client.py (NEW FILE)
import httpx
from typing import List, Dict, Any, Optional
from core.utils.logger import logger

class OllamaClient:
    def __init__(self, base_url: str = "http://localhost:11434"):
        self.base_url = base_url
        self.client = httpx.AsyncClient(timeout=30.0)
    
    async def list_models(self) -> List[Dict[str, Any]]:
        """List all available Ollama models."""
        try:
            response = await self.client.get(f"{self.base_url}/api/tags")
            response.raise_for_status()
            data = response.json()
            return data.get("models", [])
        except Exception as e:
            logger.error(f"Failed to list Ollama models: {e}")
            return []
    
    async def get_model_info(self, model_name: str) -> Optional[Dict[str, Any]]:
        """Get detailed information about a specific model."""
        try:
            response = await self.client.post(
                f"{self.base_url}/api/show",
                json={"name": model_name}
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Failed to get model info for {model_name}: {e}")
            return None
    
    async def extract_context_window(self, model_name: str) -> int:
        """Extract context window from model info."""
        info = await self.get_model_info(model_name)
        if not info:
            return 4_000  # Default fallback
        
        # Try to extract from model_info
        model_info = info.get("model_info", {})
        context_length = model_info.get("llama.context_length")
        
        if context_length:
            return int(context_length)
        
        # Fallback to known defaults by family
        family = info.get("details", {}).get("family", "").lower()
        family_defaults = {
            "llama": 8_192,
            "mistral": 32_768,
            "qwen": 131_072,
            "codellama": 100_000,
            "gemma": 8_192,
        }
        
        return family_defaults.get(family, 4_000)
    
    async def detect_capabilities(self, model_name: str) -> List[str]:
        """Detect model capabilities based on name and info."""
        info = await self.get_model_info(model_name)
        capabilities = ["CHAT"]  # All models support chat
        
        # Check for vision models
        if "vision" in model_name.lower() or "llava" in model_name.lower():
            capabilities.append("VISION")
        
        # Check for embedding models
        if "embed" in model_name.lower():
            capabilities.append("EMBEDDINGS")
            return capabilities  # Embedding models don't chat
        
        # Most modern models support function calling
        if info:
            family = info.get("details", {}).get("family", "").lower()
            if family in ["llama", "mistral", "qwen"]:
                capabilities.append("FUNCTION_CALLING")
        
        return capabilities
```

#### 1.2 Dynamic Registry Population

**Integration Point:** `backend/core/ai_models/registry.py`

```python
async def _initialize_ollama_models(self):
    """Dynamically discover and register Ollama models."""
    if not (config.OPENAI_COMPATIBLE_API_KEY and config.OPENAI_COMPATIBLE_API_BASE):
        return
    
    # Check if this is an Ollama endpoint
    if "11434" not in config.OPENAI_COMPATIBLE_API_BASE:
        # Not Ollama, register generic model
        self._register_generic_openai_compatible()
        return
    
    # Initialize Ollama client
    from core.ai_models.ollama_client import OllamaClient
    ollama_client = OllamaClient(base_url=config.OPENAI_COMPATIBLE_API_BASE.replace("/v1", ""))
    
    # Discover models
    models = await ollama_client.list_models()
    
    if not models:
        logger.warning("No Ollama models found, registering generic fallback")
        self._register_generic_openai_compatible()
        return
    
    # Register each discovered model
    for model_data in models:
        model_name = model_data.get("name", "")
        if not model_name:
            continue
        
        # Get detailed specs
        context_window = await ollama_client.extract_context_window(model_name)
        capabilities_list = await ollama_client.detect_capabilities(model_name)
        
        # Convert to ModelCapability enum
        capabilities = [
            ModelCapability[cap] for cap in capabilities_list
            if cap in ModelCapability.__members__
        ]
        
        # Register model
        self.register(Model(
            id=f"ollama/{model_name}",
            name=f"Ollama: {model_name}",
            provider=ModelProvider.OPENAI,
            aliases=[model_name, f"local-{model_name}"],
            context_window=context_window,
            capabilities=capabilities,
            pricing=ModelPricing(
                input_cost_per_million_tokens=0.0,
                output_cost_per_million_tokens=0.0
            ),
            tier_availability=["free", "paid"],
            priority=50 + models.index(model_data),  # Slightly higher priority for first models
            enabled=True,
            config=ModelConfig(
                api_base=config.OPENAI_COMPATIBLE_API_BASE,
            ),
            fallback_models=[
                "anthropic/claude-haiku-4-5" if SHOULD_USE_ANTHROPIC else "bedrock/...",
            ]
        ))
        
        logger.info(f"Registered Ollama model: {model_name} (context: {context_window})")
```

### Phase 2: Model Management UI

#### 2.1 Backend API Endpoints

**File:** `backend/core/ai_models/api.py` (NEW)

```python
from fastapi import APIRouter, Depends, HTTPException
from core.utils.auth_utils import verify_and_get_user_id_from_jwt
from core.ai_models.ollama_client import OllamaClient
from pydantic import BaseModel
from typing import List, Dict, Any

router = APIRouter()

class PullModelRequest(BaseModel):
    model_name: str

@router.get("/ollama/models")
async def list_ollama_models(
    account_id: str = Depends(verify_and_get_user_id_from_jwt)
) -> Dict[str, Any]:
    """List all locally available Ollama models."""
    ollama_client = OllamaClient()
    models = await ollama_client.list_models()
    
    return {
        "models": models,
        "count": len(models)
    }

@router.post("/ollama/models/pull")
async def pull_ollama_model(
    request: PullModelRequest,
    account_id: str = Depends(verify_and_get_user_id_from_jwt)
) -> Dict[str, str]:
    """Pull a new model from Ollama registry."""
    # Implementation: stream progress, handle errors
    pass

@router.delete("/ollama/models/{model_name}")
async def delete_ollama_model(
    model_name: str,
    account_id: str = Depends(verify_and_get_user_id_from_jwt)
) -> Dict[str, str]:
    """Delete an Ollama model to free up space."""
    # Implementation: delete model, update registry
    pass

@router.get("/ollama/models/{model_name}/info")
async def get_ollama_model_info(
    model_name: str,
    account_id: str = Depends(verify_and_get_user_id_from_jwt)
) -> Dict[str, Any]:
    """Get detailed information about a specific model."""
    ollama_client = OllamaClient()
    info = await ollama_client.get_model_info(model_name)
    
    if not info:
        raise HTTPException(status_code=404, detail="Model not found")
    
    return info
```

#### 2.2 Frontend Model Selection

**Enhancement:** `frontend/src/hooks/use-model-selection.ts`

```typescript
// Add Ollama-specific model fetching
export const useOllamaModels = () => {
  return useQuery({
    queryKey: ['models', 'ollama'],
    queryFn: async () => {
      const response = await fetch('/api/v1/ollama/models', {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch Ollama models');
      return response.json();
    },
    staleTime: 1 * 60 * 1000, // 1 minute
    refetchOnWindowFocus: true,
  });
};
```

### Phase 3: Performance Optimizations

#### 3.1 Model Keep-Alive Configuration

```python
# backend/core/ai_models/ollama_client.py
async def configure_keep_alive(self, model_name: str, duration: str = "5m"):
    """Configure how long a model stays loaded in memory."""
    # POST /api/generate with keep_alive parameter
    pass
```

#### 3.2 Warm-Up Popular Models

```python
async def warmup_model(self, model_name: str):
    """Send a dummy request to load model into memory."""
    await self.client.post(
        f"{self.base_url}/api/generate",
        json={
            "model": model_name,
            "prompt": "Hello",
            "keep_alive": "5m"
        }
    )
```

---

## 📊 Comparison: Current vs Advanced

| Feature | Current (Basic) | Advanced (Needed) |
|---------|----------------|-------------------|
| **Model Discovery** | ❌ Hardcoded single model | ✅ Dynamic list from `/api/tags` |
| **Context Window** | ❌ 4K hardcoded | ✅ Auto-detected from model specs |
| **Model Selection** | ❌ Generic "local-model" | ✅ Dropdown of all Ollama models |
| **Capability Detection** | ❌ Assumes chat + functions | ✅ Detects vision, embeddings, etc. |
| **Model Management** | ❌ None | ✅ Pull, delete, update via UI |
| **Performance** | ⚠️ Cold starts | ✅ Warm-up, keep-alive optimization |
| **User Experience** | ⚠️ Generic "local LLM" | ✅ See actual model names |
| **Accuracy** | ❌ Wrong context limits | ✅ Accurate specifications |
| **Integration Depth** | ⚠️ OpenAI passthrough | ✅ Native Ollama API usage |

---

## 🎯 Recommendations

### Priority 1: Critical (Immediate)

1. **Fix Context Window Detection**
   - Impact: HIGH
   - Effort: LOW
   - Implementation: Query `/api/show` endpoint once per model
   - Benefit: Users can utilize full model capabilities

2. **Dynamic Model Discovery**
   - Impact: HIGH
   - Effort: MEDIUM
   - Implementation: Query `/api/tags` on startup
   - Benefit: Users can select between their local models

### Priority 2: Important (Short-term)

3. **Capability Detection**
   - Impact: MEDIUM
   - Effort: MEDIUM
   - Implementation: Parse model info for vision/embedding support
   - Benefit: Proper routing for specialized tasks

4. **Model Information Display**
   - Impact: MEDIUM
   - Effort: LOW
   - Implementation: Show size, family, quantization in UI
   - Benefit: Better user understanding of models

### Priority 3: Nice-to-Have (Long-term)

5. **Model Management UI**
   - Impact: MEDIUM
   - Effort: HIGH
   - Implementation: Pull/delete models from app
   - Benefit: One-stop management experience

6. **Performance Optimizations**
   - Impact: LOW
   - Effort: MEDIUM
   - Implementation: Keep-alive, warm-up strategies
   - Benefit: Faster response times

---

## 🔗 Ollama API Documentation

**Official Docs:** https://github.com/ollama/ollama/blob/main/docs/api.md

**Key Endpoints:**

| Endpoint | Purpose | Priority |
|----------|---------|----------|
| `GET /api/tags` | List models | 🔴 Critical |
| `POST /api/show` | Model specifications | 🔴 Critical |
| `POST /api/pull` | Download models | 🟡 Important |
| `DELETE /api/delete` | Remove models | 🟡 Important |
| `POST /api/generate` | Text generation | ✅ Working (via /v1 compat) |
| `POST /api/chat` | Chat completion | ✅ Working (via /v1 compat) |
| `POST /api/embeddings` | Get embeddings | 🟢 Optional |

---

## 📝 LM Studio Compatibility

**Status:** Same basic integration applies

**Differences:**
- LM Studio also provides OpenAI-compatible endpoint
- Default port: `http://localhost:1234/v1`
- Same limitations apply
- LM Studio has its own model management UI (less critical to integrate)

**Configuration:**
```bash
OPENAI_COMPATIBLE_API_KEY=lm-studio
OPENAI_COMPATIBLE_API_BASE=http://localhost:1234/v1
```

---

## 🎓 Summary

### Current State
Suna App supports Ollama through a **basic OpenAI-compatible passthrough**. It works for simple chat completion but lacks:
- Dynamic model discovery
- Accurate model specifications
- Advanced Ollama features
- Model management capabilities

### Integration Level
**BASIC** (20% of potential)

### Required Work
To achieve **ADVANCED** integration (80%+), implement:
1. ✅ Dynamic model listing via `/api/tags`
2. ✅ Context window detection via `/api/show`
3. ✅ Capability detection (vision, embeddings)
4. ✅ Model management (pull, delete)
5. ✅ Performance optimizations (keep-alive, warm-up)

### Recommended Approach
Start with **Priority 1** items (context window + model discovery) as they provide the most value with the least effort. This will give users accurate model information and the ability to switch between their local models.

---

**Last Updated:** November 1, 2025  
**Status:** Complete Assessment  
**Next Steps:** Implement Priority 1 recommendations
