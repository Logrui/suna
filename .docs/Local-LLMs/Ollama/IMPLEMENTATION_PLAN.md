# Ollama Advanced Integration Plan

**Last Updated:** November 1, 2025  
**Status:** Planning Phase  
**Priority:** High (unlocks full local model capabilities)

---

## 🎯 Constraints

- ✅ **Minimal code changes** to existing code bases
- ✅ Uses backend **ENV_MODE=local** flag to enable functionality
- ✅ Uses new backend **OLLAMA_ENABLED=true** flag to enable advanced functionalities
- ✅ **Backward compatible** with existing `OPENAI_COMPATIBLE_API_*` setup
- ✅ No breaking changes to current model registry system
- ✅ Must work alongside cloud providers (Anthropic, OpenAI, Gemini)

---

## 📋 MVP Requirements

### Core Functionality
- ✅ **Dynamic discovery** of models available using Ollama endpoints
- ✅ **Accurate context window detection** (no more 4K hardcoded limits!)
- ✅ Integration with current Suna **model priority system** (50+ priority for local models)
- ✅ **Caching mechanism** of model metadata (name, context window, capabilities, etc.)
- ✅ **Human-friendly display names** for Suna UI
- ✅ **Capability detection** (chat vs embedding vs code completion)
- ✅ Filter out non-chat models (embedding-only models)

### Non-Goals (Out of Scope for MVP)
- ❌ Model management UI (pull, delete models) - **Phase 2**
- ❌ Model warm-up/keep-alive optimization - **Phase 2**
- ❌ Custom model configuration per model - **Phase 2**
- ❌ Vision model support - **Phase 2**

---

## 🔌 API Integrations

### 1. List Available Models
**Endpoint:** `GET http://localhost:11434/api/tags`

**Purpose:** Discover all locally available Ollama models

**Response Structure:**
```json
{
  "models": [
    {
      "name": "llama3.2:latest",
      "model": "llama3.2:latest",
      "modified_at": "2025-08-28T04:10:43.7520268-04:00",
      "size": 2019393189,
      "digest": "a80c4f17acd55...",
      "details": {
        "parent_model": "",
        "format": "gguf",
        "family": "llama",
        "families": ["llama"],
        "parameter_size": "3.2B",
        "quantization_level": "Q4_K_M"
      }
    }
  ]
}
```

**Extraction Logic:**
```python
models = response.get("models", [])
for model_data in models:
    model_name = model_data["name"]  # e.g., "llama3.2:latest"
    parameter_size = model_data["details"]["parameter_size"]  # "3.2B"
    quantization = model_data["details"]["quantization_level"]  # "Q4_K_M"
    family = model_data["details"]["family"]  # "llama"
```

---

### 2. Get Model Specifications
**Endpoint:** `POST http://localhost:11434/api/show`

**Request Body:**
```json
{
  "name": "llama3.2:latest"
}
```

**Purpose:** Extract detailed model specifications (context window, capabilities, display name)

**Response Structure (Relevant Fields):**
```json
{
  "model_info": {
    "general.basename": "Llama-3.2",
    "general.finetune": "Instruct",
    "general.size_label": "3B",
    "llama.context_length": 131072,  // ⭐ Actual context window!
    "llama.embedding_length": 3072
  },
  "capabilities": ["completion", "tools"],
  "details": {
    "family": "llama",
    "parameter_size": "3.2B",
    "quantization_level": "Q4_K_M"
  }
}
```

**Context Window Extraction Logic:**
```python
def extract_context_window(model_info: dict) -> int:
    """
    Extract context window from model_info.
    Field name varies by architecture: {family}.context_length
    """
    architecture = model_info.get("general.architecture", "")
    
    # Try architecture-specific field first
    context_field = f"{architecture}.context_length"
    context_window = model_info.get(context_field)
    
    if context_window:
        return int(context_window)
    
    # Fallback to known architectures
    for arch in ["llama", "qwen2", "qwen3", "gemma3", "gemma"]:
        context_field = f"{arch}.context_length"
        context_window = model_info.get(context_field)
        if context_window:
            return int(context_window)
    
    # Final fallback
    return 4_000
```

---

### 3. Filter Chat-Only Models
**Logic:** Filter out embedding-only models

```python
def is_chat_model(capabilities: list) -> bool:
    """
    Check if model supports chat completion.
    Embedding-only models should be excluded.
    """
    if not capabilities:
        return True  # Assume chat if no capabilities listed
    
    # Has completion or tools capability = chat model
    if "completion" in capabilities or "tools" in capabilities:
        return True
    
    # Only has embedding = NOT a chat model
    if capabilities == ["embedding"]:
        return False
    
    return True

# Example usage:
["completion", "tools"] → True (chat model) ✅
["embedding"] → False (embedding only) ❌
["completion", "tools", "insert"] → True (chat + code) ✅
```

---

## 🎨 Display Name Construction

### Pseudo Code:
```python
def construct_display_name(model_info: dict, details: dict) -> str:
    """
    Construct human-friendly display name from Ollama model data.
    
    Format: "{BaseName} {Size} {Finetune} ({Quantization})"
    Examples:
      - "Llama-3.2 3B Instruct (Q4_K_M)"
      - "DeepSeek-R1 8B (Q4_K_M)"
      - "GPT-OSS 20.9B (MXFP4)"
    """
    basename = model_info.get("general.basename", "")
    finetune = model_info.get("general.finetune", "")
    size_label = model_info.get("general.size_label", "")
    
    # Fallback to details if model_info fields missing
    if not size_label and details:
        size_label = details.get("parameter_size", "")
    
    quantization = details.get("quantization_level", "")
    
    # Build display name
    parts = []
    
    if basename:
        parts.append(basename)
    
    if size_label:
        parts.append(size_label)
    
    if finetune:
        parts.append(finetune)
    
    display_name = " ".join(parts)
    
    if quantization:
        display_name += f" ({quantization})"
    
    # If no metadata available, fallback to model name cleanup
    if not display_name.strip():
        display_name = fallback_display_name(model_name)
    
    return display_name

def fallback_display_name(model_name: str) -> str:
    """
    Fallback: Convert model name to readable format.
    "llama3.2:latest" → "Llama3.2 Latest"
    "qwen2.5-coder:7b-instruct" → "Qwen2.5-Coder 7B Instruct"
    """
    # Remove tag
    name = model_name.split(":")[0]
    tag = model_name.split(":")[1] if ":" in model_name else ""
    
    # Capitalize
    name = name.replace("-", " ").replace("_", " ").title()
    tag = tag.replace("-", " ").title()
    
    if tag and tag.lower() != "latest":
        return f"{name} {tag}"
    return name
```

---

## 🏗️ Implementation Plan

### Phase 1: Backend Core (Priority: HIGH)

#### 1.1 Create Ollama Client
**File:** `backend/core/ai_models/ollama_client.py` (NEW)

```python
"""
Ollama API client for model discovery and specifications.
"""

import httpx
from typing import List, Dict, Any, Optional
from core.utils.logger import logger
from core.utils.config import config

class OllamaClient:
    """Client for interacting with Ollama API."""
    
    def __init__(self, base_url: str = None):
        self.base_url = base_url or self._detect_ollama_url()
        self.client = httpx.AsyncClient(timeout=30.0)
        self._cache = {}  # Simple in-memory cache
    
    def _detect_ollama_url(self) -> str:
        """Detect Ollama URL from OPENAI_COMPATIBLE_API_BASE."""
        base = config.OPENAI_COMPATIBLE_API_BASE
        if base and "11434" in base:
            return base.replace("/v1", "")
        return "http://localhost:11434"
    
    async def list_models(self) -> List[Dict[str, Any]]:
        """List all available Ollama models."""
        cache_key = "list_models"
        if cache_key in self._cache:
            return self._cache[cache_key]
        
        try:
            response = await self.client.get(f"{self.base_url}/api/tags")
            response.raise_for_status()
            data = response.json()
            models = data.get("models", [])
            self._cache[cache_key] = models
            return models
        except Exception as e:
            logger.error(f"Failed to list Ollama models: {e}")
            return []
    
    async def get_model_info(self, model_name: str) -> Optional[Dict[str, Any]]:
        """Get detailed information about a specific model."""
        cache_key = f"model_info_{model_name}"
        if cache_key in self._cache:
            return self._cache[cache_key]
        
        try:
            response = await self.client.post(
                f"{self.base_url}/api/show",
                json={"name": model_name}
            )
            response.raise_for_status()
            info = response.json()
            self._cache[cache_key] = info
            return info
        except Exception as e:
            logger.error(f"Failed to get model info for {model_name}: {e}")
            return None
    
    async def extract_context_window(self, model_name: str) -> int:
        """Extract context window from model info."""
        info = await self.get_model_info(model_name)
        if not info:
            return 4_000
        
        model_info = info.get("model_info", {})
        architecture = model_info.get("general.architecture", "")
        
        # Try architecture-specific field
        context_field = f"{architecture}.context_length"
        context_window = model_info.get(context_field)
        
        if context_window:
            return int(context_window)
        
        # Fallback to common architectures
        for arch in ["llama", "qwen2", "qwen3", "gemma3", "gemma"]:
            context_field = f"{arch}.context_length"
            context_window = model_info.get(context_field)
            if context_window:
                return int(context_window)
        
        return 4_000
    
    async def is_chat_model(self, model_name: str) -> bool:
        """Check if model supports chat (not embedding-only)."""
        info = await self.get_model_info(model_name)
        if not info:
            return True  # Assume chat if can't determine
        
        capabilities = info.get("capabilities", [])
        
        if not capabilities:
            return True
        
        # Has completion or tools = chat model
        if "completion" in capabilities or "tools" in capabilities:
            return True
        
        # Only embedding = not chat
        if capabilities == ["embedding"]:
            return False
        
        return True
    
    async def construct_display_name(self, model_name: str, model_data: Dict) -> str:
        """Construct human-friendly display name."""
        info = await self.get_model_info(model_name)
        if not info:
            return self._fallback_display_name(model_name)
        
        model_info = info.get("model_info", {})
        details = model_data.get("details", {})
        
        basename = model_info.get("general.basename", "")
        finetune = model_info.get("general.finetune", "")
        size_label = model_info.get("general.size_label", "")
        
        if not size_label:
            size_label = details.get("parameter_size", "")
        
        quantization = details.get("quantization_level", "")
        
        parts = []
        if basename:
            parts.append(basename)
        if size_label:
            parts.append(size_label)
        if finetune:
            parts.append(finetune)
        
        display_name = " ".join(parts)
        
        if quantization:
            display_name += f" ({quantization})"
        
        if not display_name.strip():
            return self._fallback_display_name(model_name)
        
        return display_name
    
    def _fallback_display_name(self, model_name: str) -> str:
        """Fallback display name from model name."""
        name = model_name.split(":")[0]
        tag = model_name.split(":")[1] if ":" in model_name else ""
        
        name = name.replace("-", " ").replace("_", " ").title()
        tag = tag.replace("-", " ").title()
        
        if tag and tag.lower() != "latest":
            return f"{name} {tag}"
        return name
```

**Estimated Time:** 2-3 hours

---

#### 1.2 Modify Model Registry
**File:** `backend/core/ai_models/registry.py`

**Changes:**
1. Add async initialization for Ollama models
2. Replace single generic model with per-model registration
3. Cache model metadata

```python
# Add to ModelRegistry class

async def _initialize_ollama_models(self):
    """Dynamically discover and register Ollama models."""
    # Only run if Ollama is enabled
    if not config.OLLAMA_ENABLED:
        logger.info("Ollama integration disabled - skipping model discovery")
        self._register_generic_openai_compatible()
        return
    
    # Check if OpenAI-compatible endpoint is configured
    if not (config.OPENAI_COMPATIBLE_API_KEY and config.OPENAI_COMPATIBLE_API_BASE):
        logger.info("OpenAI-compatible endpoint not configured")
        return
    
    # Check if this is actually Ollama (port 11434)
    if "11434" not in config.OPENAI_COMPATIBLE_API_BASE:
        logger.info("Not an Ollama endpoint - using generic registration")
        self._register_generic_openai_compatible()
        return
    
    # Initialize Ollama client
    from core.ai_models.ollama_client import OllamaClient
    ollama_client = OllamaClient()
    
    # Discover models
    models = await ollama_client.list_models()
    
    if not models:
        logger.warning("No Ollama models found - using generic fallback")
        self._register_generic_openai_compatible()
        return
    
    logger.info(f"Discovered {len(models)} Ollama models")
    
    # Register each chat model
    registered_count = 0
    for model_data in models:
        model_name = model_data.get("name", "")
        if not model_name:
            continue
        
        # Check if it's a chat model (filter out embedding-only)
        is_chat = await ollama_client.is_chat_model(model_name)
        if not is_chat:
            logger.info(f"Skipping embedding-only model: {model_name}")
            continue
        
        # Get specifications
        context_window = await ollama_client.extract_context_window(model_name)
        display_name = await ollama_client.construct_display_name(model_name, model_data)
        
        # Determine capabilities (basic for now)
        capabilities = [ModelCapability.CHAT]
        
        info = await ollama_client.get_model_info(model_name)
        if info and info.get("capabilities"):
            if "tools" in info["capabilities"]:
                capabilities.append(ModelCapability.FUNCTION_CALLING)
        
        # Register model
        model_id = f"ollama/{model_name}"
        
        self.register(Model(
            id=model_id,
            name=display_name,
            provider=ModelProvider.OPENAI,
            aliases=[model_name, f"local-{model_name}"],
            context_window=context_window,
            capabilities=capabilities,
            pricing=ModelPricing(
                input_cost_per_million_tokens=0.0,
                output_cost_per_million_tokens=0.0
            ),
            tier_availability=["free", "paid"],
            priority=50 + registered_count,  # Increment priority slightly
            enabled=True,
            config=ModelConfig(
                api_base=config.OPENAI_COMPATIBLE_API_BASE,
            ),
            fallback_models=[
                "anthropic/claude-haiku-4-5" if SHOULD_USE_ANTHROPIC else "bedrock/...",
            ],
            metadata={
                "ollama_model_name": model_name,
                "is_local": True,
            }
        ))
        
        registered_count += 1
        logger.info(f"Registered Ollama model: {model_name} → {display_name} (context: {context_window})")
    
    logger.info(f"Successfully registered {registered_count} Ollama chat models")

def _register_generic_openai_compatible(self):
    """Register generic OpenAI-compatible model (fallback/backward compat)."""
    self.register(Model(
        id="openai-compatible/local-model",
        name="Local LLM (OpenAI-Compatible)",
        provider=ModelProvider.OPENAI,
        aliases=["local-llm", "ollama", "lm-studio", "local"],
        context_window=4_000,
        capabilities=[ModelCapability.CHAT, ModelCapability.FUNCTION_CALLING],
        pricing=ModelPricing(
            input_cost_per_million_tokens=0.0,
            output_cost_per_million_tokens=0.0
        ),
        tier_availability=["free", "paid"],
        priority=50,
        enabled=True,
        config=ModelConfig(
            api_base=config.OPENAI_COMPATIBLE_API_BASE,
        ),
        fallback_models=[...],
    ))
```

**Estimated Time:** 2-3 hours

---

#### 1.3 Add Configuration
**File:** `backend/core/utils/config.py`

```python
# Add new config field
OLLAMA_ENABLED: bool = False  # Enable advanced Ollama integration
```

**File:** `backend/.env`

```bash
# Ollama Advanced Integration (optional)
OLLAMA_ENABLED=true
```

**Estimated Time:** 15 minutes

---

#### 1.4 Handle Async Initialization
**File:** `backend/core/ai_models/registry.py`

**Challenge:** Registry is initialized synchronously, but Ollama client uses async.

**Solution:** Lazy initialization or startup task

```python
# Option 1: Lazy async initialization
class ModelRegistry:
    def __init__(self):
        self._models: Dict[str, Model] = {}
        self._aliases: Dict[str, str] = {}
        self._ollama_initialized = False
        self._initialize_models()  # Sync init for non-Ollama
    
    async def ensure_ollama_initialized(self):
        """Ensure Ollama models are loaded (call once at startup)."""
        if not self._ollama_initialized and config.OLLAMA_ENABLED:
            await self._initialize_ollama_models()
            self._ollama_initialized = True

# In startup (backend/api.py or startup handler):
@app.on_event("startup")
async def startup_event():
    """Initialize async components."""
    from core.ai_models import registry
    await registry.ensure_ollama_initialized()
    logger.info("Ollama models initialized")
```

**Estimated Time:** 1 hour

---

### Phase 2: Frontend Integration (Priority: MEDIUM)

#### 2.1 Update Model Selection UI
**Files:**
- `frontend/src/hooks/use-model-selection.ts`
- `apps/mobile/lib/models/hooks.ts`

**Changes:**
- Models API already returns all models
- No changes needed! Display names will automatically appear
- Ollama models will show up with proper names

**Estimated Time:** 0 hours (no changes needed)

---

### Phase 3: Testing & Validation (Priority: HIGH)

#### 3.1 Test Cases

1. **Ollama Disabled**
   - Set `OLLAMA_ENABLED=false`
   - Should fallback to generic `local-model`
   - Backward compatibility test ✅

2. **Ollama Enabled, No Models**
   - Ollama running but no models pulled
   - Should gracefully fallback

3. **Ollama Enabled, Multiple Models**
   - Should list all chat models
   - Should filter out embedding-only models
   - Should show correct context windows

4. **Model Selection**
   - User selects Ollama model from dropdown
   - Requests route to correct model
   - Context window respected

5. **Fallback System**
   - Ollama model fails
   - Should fallback to cloud model

**Estimated Time:** 2-3 hours

---

## 📊 Success Metrics

### Before (Current State)
- ❌ 1 generic "Local LLM" model
- ❌ Hardcoded 4K context window
- ❌ No model differentiation
- ❌ Can't see actual model names

### After (MVP Complete)
- ✅ 13 individual Ollama models listed (for user's setup)
- ✅ Accurate context windows (128K for Llama 3.2, DeepSeek-R1)
- ✅ Human-friendly names ("Llama-3.2 3B Instruct (Q4_K_M)")
- ✅ Embedding models filtered out
- ✅ Zero cost tracking for local models
- ✅ Priority system integration (50-63 range)

---

## ⏱️ Time Estimate

| Task | Estimated Time |
|------|----------------|
| 1.1 Ollama Client | 2-3 hours |
| 1.2 Registry Modifications | 2-3 hours |
| 1.3 Configuration | 15 minutes |
| 1.4 Async Handling | 1 hour |
| 3.1 Testing | 2-3 hours |
| **Total MVP** | **8-11 hours** |

---

## 🚀 Rollout Plan

### Step 1: Development (1 day)
- Implement backend changes
- Local testing with your 13 Ollama models

### Step 2: Testing (0.5 days)
- Test all scenarios
- Verify context windows
- Check model selection

### Step 3: Documentation (0.5 days)
- Update README with Ollama setup
- Document new ENV variables

### Step 4: Deployment
- Merge to `dev` branch
- Users can enable with `OLLAMA_ENABLED=true`

---

## 🔮 Future Enhancements (Phase 2)

### Model Management
- Pull new models from UI
- Delete models to free space
- Update existing models

### Performance Optimization
- Model warm-up on startup
- Keep-alive configuration
- Request batching

### Advanced Features
- Vision model support (llama3.2-vision)
- Custom system prompts per model
- Model-specific temperature/top_p defaults
- GPU/CPU allocation settings

---

**Ready to implement?** This plan provides a clear path to unlock full Ollama integration in ~1-2 days of focused development! 🎯