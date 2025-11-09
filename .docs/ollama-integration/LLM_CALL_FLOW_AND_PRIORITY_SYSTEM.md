# LLM Call Flow & Priority System in Suna App

**Document Date:** November 1, 2025  
**Status:** Comprehensive Flow Analysis

---

## 📋 Executive Summary

Suna implements a sophisticated multi-layer LLM calling system with:
- **7+ provider support** via LiteLLM router
- **Priority-based model selection** (102-50 priority scale)
- **Dual fallback systems** (LiteLLM router fallbacks + manual model fallbacks)
- **Rate limit detection** with intelligent retry logic
- **Provider-specific configuration** management
- **OpenAI-compatible local model support** (Ollama, LM Studio, vLLM)

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                  Application Layer                          │
│         (AgentPress, FileProcessor, Response Handler)      │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────────┐
│              Model Manager & Registry                       │
│  - Model resolution and alias mapping                       │
│  - Priority-based selection (102-50 scale)                  │
│  - Tier-based availability (free/paid)                      │
│  - LiteLLM parameter generation                             │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────────┐
│          LLM Service Layer (llm.py)                          │
│  - API key setup and provider configuration                 │
│  - Rate limit detection and fallback routing                │
│  - Streaming response wrapper with fallback handling        │
│  - Error processing and logging                             │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────────┐
│          LiteLLM Router (provider_router)                    │
│  - Unified interface to 7+ providers                         │
│  - Built-in fallback chains for Bedrock models              │
│  - Model name resolution and routing                        │
│  - OpenAI-compatible endpoint support                       │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────────┐
│         External LLM Providers (7+ Supported)                │
│  - OpenAI (GPT-5, GPT-4o, GPT-4o-mini)                      │
│  - Anthropic (Claude Sonnet 4.5, 4, Haiku 4.5)             │
│  - Google (Gemini 2.5 Pro/Flash/Flash-Lite)                │
│  - AWS Bedrock (MAP-tagged inference profiles)              │
│  - OpenRouter (Proxy to multiple providers)                │
│  - OpenAI-Compatible (Ollama, LM Studio, vLLM)             │
│  - Other providers via LiteLLM support                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Model Registry & Priority System

### Priority Scale (Highest to Lowest)

| Priority | Model ID | Name | Provider | Context | Capabilities | Status |
|----------|----------|------|----------|---------|--------------|--------|
| **102** | `anthropic/claude-haiku-4-5` | Haiku 4.5 | Anthropic/Bedrock | 200K | Chat, Functions, Vision | ✅ Active |
| **101** | `anthropic/claude-sonnet-4-5-...` | Sonnet 4.5 | Anthropic/Bedrock | 1M | Chat, Functions, Vision, Thinking | ✅ Active |
| **100** | `anthropic/claude-sonnet-4-...` | Sonnet 4 | Anthropic/Bedrock | 1M | Chat, Functions, Vision, Thinking | ✅ Active |
| **98** | `gemini/gemini-2.5-flash-lite` | Gemini 2.5 Flash-Lite | Google | 1M | Chat, Functions, Vision | ✅ Active |
| **97** | `gemini/gemini-2.5-flash` | Gemini 2.5 Flash | Google | 1M | Chat, Functions, Vision | ✅ Active |
| **96** | `gemini/gemini-2.5-pro` | Gemini 2.5 Pro | Google | 2M | Chat, Functions, Vision, Structured Output | ✅ Active |
| **95** | `openai/gpt-5` | GPT-5 | OpenAI | 128K | Chat, Functions, Vision, Structured Output | ⚠️ Conditional |
| **94** | `openai/gpt-5-mini` | GPT-5 Mini | OpenAI | 128K | Chat, Functions, Vision | ⚠️ Conditional |
| **93** | `openai/gpt-4o` | GPT-4o (Legacy) | OpenAI | 128K | Chat, Functions, Vision, Structured Output | ⚠️ Conditional |
| **92** | `openai/gpt-4o-mini` | GPT-4o Mini (Legacy) | OpenAI | 128K | Chat, Functions, Vision | ⚠️ Conditional |
| **50** | `openai-compatible/local-model` | Local LLM | OpenAI-Compatible | 4K* | Chat, Functions | ⚠️ Conditional |

**Legend:**  
✅ Always active (Bedrock/Anthropic configured)  
⚠️ Conditional (requires API key)  
\* Context window can be overridden in configuration

### Key Priority Insights

1. **Anthropic/Bedrock models dominate** (Priority 102-100)
   - Using global MAP-tagged inference profiles
   - 14B tokens/day quota for application routing
   - Recommended for most workloads

2. **Google Gemini follows** (Priority 98-96)
   - Excellent context windows (up to 2M for Pro)
   - Cost-effective for large documents (Flash-Lite)
   - Fallback to OpenAI if unavailable

3. **OpenAI models as secondary** (Priority 95-92)
   - Only enabled if `OPENAI_API_KEY` is configured
   - GPT-5 line is newest but may have availability issues
   - GPT-4o is legacy but reliable

4. **Local models lowest priority** (Priority 50)
   - Only registered if both `OPENAI_COMPATIBLE_API_KEY` and `OPENAI_COMPATIBLE_API_BASE` are set
   - Fallback to professional models if rate-limited
   - Useful for development and offline scenarios

---

## 🔄 LLM Call Flow

### Step 1: Model Resolution

```python
# Input: model_name (can be alias or full ID)
resolved_model_id = model_manager.resolve_model_id(model_name)

# Examples:
"gpt-4o" → "openai/gpt-4o"
"sonnet" → "anthropic/claude-sonnet-4-20250514"
"local" → "openai-compatible/local-model"
```

**Resolution Logic:**
- Checks direct ID match first
- Falls back to alias matching
- Returns original ID if no match found

### Step 2: Configuration Assembly

```python
# Retrieve model from registry
model = model_manager.get_model(resolved_model_id)

# Generate LiteLLM parameters
params = model_manager.get_litellm_params(
    resolved_model_id,
    messages=messages,
    temperature=0,
    response_format=response_format,
    top_p=top_p,
    stream=stream,
    api_key=api_key,        # Optional override
    api_base=api_base,      # Optional override
    headers=headers,        # Optional override
    extra_headers=extra_headers  # Optional override
)
```

**Parameters Assembled:**
- Model ID and aliases
- API configuration (key, base, headers)
- Model-specific headers (e.g., Anthropic beta features)
- Temperature, max_tokens, response format
- Tool definitions (if applicable)
- Streaming options with usage tracking

### Step 3: LiteLLM Router Call

```python
# Non-streaming path
response = await provider_router.acompletion(**params)

# Streaming path (wraps with fallback handler)
if hasattr(response, '__aiter__') and stream:
    return _wrap_streaming_response(response, resolved_model_id, params)
```

**What LiteLLM Router Does:**
1. Matches model name to provider
2. Routes to appropriate LiteLLM provider handler
3. Applies LiteLLM-level fallbacks (Bedrock MAP profiles only)
4. Returns response or raises exception

### Step 4: Error Detection & Fallback

#### 4a. Non-Streaming Error Path

```python
except Exception as e:
    # Check if rate limit error
    is_rate_limit = any(keyword in str(e).lower() 
                       for keyword in ['rate_limit', 'quota', 'ratelimit', 
                                      '429', 'overloaded'])
    
    if is_rate_limit:
        # Get fallback models from registry
        model = model_manager.get_model(resolved_model_id)
        fallback_models = model.fallback_models if model else []
        
        # Try each fallback sequentially
        for fallback_model in fallback_models:
            try:
                params_copy = params.copy()
                params_copy["model"] = fallback_model
                response = await provider_router.acompletion(**params_copy)
                
                if hasattr(response, '__aiter__') and stream:
                    return _wrap_streaming_response(response)
                return response
            except Exception as fallback_error:
                logger.debug(f"Fallback to {fallback_model} failed")
                continue
```

#### 4b. Streaming Error Path

```python
async def _wrap_streaming_response(response, resolved_model_name, params):
    try:
        async for chunk in response:
            yield chunk
    except Exception as e:
        # Detect mid-stream rate limit errors
        is_rate_limit = any(keyword in str(e).lower() 
                           for keyword in ['rate_limit', 'quota', 'ratelimit', 
                                          '429', 'overloaded', 'mid', 'stream'])
        
        if is_rate_limit:
            model = model_manager.get_model(resolved_model_name)
            fallback_models = model.fallback_models if model else []
            
            # Try each fallback
            for fallback_model in fallback_models:
                try:
                    params_copy = params.copy()
                    params_copy["model"] = fallback_model
                    response = await provider_router.acompletion(**params_copy)
                    
                    if hasattr(response, '__aiter__'):
                        async for chunk in response:
                            yield chunk
                        return
                except Exception as fallback_error:
                    continue
```

---

## 🛡️ Fallback Chain System

### Two-Layer Fallback Architecture

#### Layer 1: LiteLLM Router Fallbacks (Built-in)

**Bedrock MAP-Tagged Profiles Only:**

```python
fallbacks = [
    # Haiku 4.5 (DEFAULT) → Sonnet 4 → Sonnet 4.5 → Anthropic native
    {
        "bedrock/.../heol2zyy5v48": [  # Haiku
            "bedrock/.../tyj1ks3nj9qf",    # Sonnet 4
            "bedrock/.../few7z4l830xh",    # Sonnet 4.5
            "anthropic/claude-haiku-4-5-20251001",
            "anthropic/claude-sonnet-4-20250514"
        ]
    },
    # Sonnet 4.5 → Sonnet 4 → Haiku → Anthropic native
    {
        "bedrock/.../few7z4l830xh": [  # Sonnet 4.5
            "bedrock/.../tyj1ks3nj9qf",    # Sonnet 4
            "bedrock/.../heol2zyy5v48",    # Haiku
            "anthropic/claude-sonnet-4-5-20250929",
            "anthropic/claude-sonnet-4-20250514"
        ]
    },
    # Sonnet 4 → Haiku → Anthropic native
    {
        "bedrock/.../tyj1ks3nj9qf": [  # Sonnet 4
            "bedrock/.../heol2zyy5v48",    # Haiku
            "anthropic/claude-sonnet-4-20250514"
        ]
    }
]
```

**Key Points:**
- LiteLLM Router automatically tries fallbacks for Bedrock profiles
- Happens **before** reaching application layer
- Transparent to application code
- Only applies to Bedrock MAP-tagged models

#### Layer 2: Application-Level Fallbacks (Manual)

Each model has a `fallback_models` list:

```python
Model(
    id="openai/gpt-5",
    fallback_models=[
        "openai/gpt-5-mini",
        "openai/gpt-4o",
        "anthropic/claude-sonnet-4-20250514"  # Cross-provider fallback
    ]
)
```

**Fallback Chains by Model:**

1. **Haiku 4.5** (Priority 102)
   - → Sonnet 4
   - → Sonnet 4.5

2. **Sonnet 4.5** (Priority 101)
   - → Sonnet 4
   - → Haiku 4.5

3. **Sonnet 4** (Priority 100)
   - → Sonnet 4.5
   - → Haiku 4.5

4. **Gemini 2.5 Flash-Lite** (Priority 98)
   - → Gemini 2.5 Flash
   - → Gemini 2.5 Pro
   - → OpenAI GPT-4o (if available)
   - → Anthropic Claude Sonnet 4
   - → Bedrock Sonnet 4

5. **Gemini 2.5 Flash** (Priority 97)
   - → Gemini 2.5 Pro
   - → OpenAI GPT-4o-mini (if available)
   - → Anthropic Claude Haiku 4.5

6. **Gemini 2.5 Pro** (Priority 96)
   - → OpenAI GPT-4o (if available)
   - → Anthropic Claude Sonnet 4

7. **GPT-5** (Priority 95)
   - → GPT-5 Mini
   - → GPT-4o
   - → Anthropic Claude Sonnet 4

8. **GPT-5 Mini** (Priority 94)
   - → GPT-4o
   - → Anthropic Claude Haiku 4.5

9. **GPT-4o** (Priority 93)
   - → Anthropic Claude Sonnet 4

10. **GPT-4o Mini** (Priority 92)
    - → Anthropic Claude Haiku 4.5

11. **Local OpenAI-Compatible** (Priority 50)
    - → Anthropic Claude Haiku 4.5
    - → OpenAI GPT-4o-mini (if available)
    - → Gemini 2.5 Flash (if available)
    - → Anthropic Claude Sonnet 4

**Fallback Strategy:**
- Triggered on rate limit errors (429, quota, ratelimit keywords)
- Tries each fallback model sequentially
- Returns first successful response
- Logs each attempt for debugging
- Raises error if all fallbacks fail

---

## 📂 Use Case: File Summarization Pipeline

### FileProcessor Summary Generation

**Model Selection Strategy:**

```python
models = [
    ("google/gemini-2.5-flash-lite", 1_000_000),      # 1st Priority
    ("openrouter/google/gemini-2.5-flash-lite", 1_000_000),  # 2nd Priority
    ("gpt-5-mini", 400_000)                            # 3rd Priority
]
```

**Flow:**

1. **Estimate content size** in tokens (rough: 1 token ≈ 4 chars)

2. **Try Gemini 2.5 Flash-Lite first**
   - 1M context window
   - Cheapest option ($0.10/$0.40 per MTok)
   - If fails → try OpenRouter version

3. **Fallback to OpenRouter proxy**
   - Routes through OpenRouter infrastructure
   - May have better availability
   - Same model, different endpoint

4. **Final fallback to GPT-5 Mini**
   - 400K context window
   - More expensive ($0.25/$2.00 per MTok)
   - If this fails, all models have failed

5. **Last resort: Intelligent fallback summary**
   - Extract headers, bullet points, code blocks
   - Generate summary without LLM
   - Provides graceful degradation

---

## ⚙️ Configuration & Setup

### Required Environment Variables

```bash
# --- API Keys (all optional, determined by enabled models) ---
OPENAI_API_KEY                    # For GPT-5, GPT-4o series
GEMINI_API_KEY                    # For Gemini 2.5 series
ANTHROPIC_API_KEY                 # For Claude (local mode only)
AWS_BEARER_TOKEN_BEDROCK          # For Bedrock models

# --- OpenAI-Compatible Setup (for Ollama, LM Studio, vLLM) ---
OPENAI_COMPATIBLE_API_KEY         # Authentication token
OPENAI_COMPATIBLE_API_BASE        # Endpoint URL (e.g., http://localhost:11434/v1)

# --- OpenRouter (if using proxy) ---
OPENROUTER_API_KEY                # API key for OpenRouter
OPENROUTER_API_BASE              # Base URL for OpenRouter

# --- Environment Mode ---
ENV_MODE                          # "local" or "production"
```

### Local Model Configuration (Ollama Example)

```bash
# 1. Start Ollama server
ollama serve

# 2. Set environment variables
export OPENAI_COMPATIBLE_API_KEY="dummy-key"
export OPENAI_COMPATIBLE_API_BASE="http://localhost:11434/v1"

# 3. Application will:
#    - Register "openai-compatible/local-model" with priority 50
#    - Use it as fallback when cloud models fail
#    - Preserve chat history without cloud costs
```

### Bedrock Authentication

The system uses AWS Bedrock with **MAP-tagged application inference profiles** for global routing:

```
bedrock/converse/arn:aws:bedrock:us-west-2:935064898258:application-inference-profile/heol2zyy5v48  (Haiku)
bedrock/converse/arn:aws:bedrock:us-west-2:935064898258:application-inference-profile/tyj1ks3nj9qf  (Sonnet 4)
bedrock/converse/arn:aws:bedrock:us-west-2:935064898258:application-inference-profile/few7z4l830xh  (Sonnet 4.5)
```

**Benefits:**
- Global request routing (14B tokens/day)
- Automatic failover between profiles
- Load balancing across regions
- No per-region API keys needed

---

## 🔍 Rate Limit Detection

### Detection Keywords

The system searches for these keywords in error messages to identify rate limits:

```python
keywords = [
    'rate_limit',
    'quota',
    'ratelimit',
    '429',           # HTTP 429 Too Many Requests
    'overloaded'
]
```

**Examples:**
- `RateLimitError: Rate limit exceeded`
- `429 Too Many Requests`
- `Quota exceeded for this API key`
- `API is overloaded`
- `Ratelimit: too many requests`

### Retry Strategy

**On Rate Limit Detection:**

1. ✅ Log rate limit incident
2. ✅ Retrieve model's fallback chain
3. ✅ Try each fallback model in order
4. ✅ Return first successful response
5. ❌ Raise error if all fallbacks exhausted

**No Exponential Backoff:**
- Application assumes fallback model is different provider
- No retry delays needed
- Immediate failover for resilience

---

## 🧠 Advanced Features

### Model Tier Availability

Each model specifies tier availability:

```python
tier_availability=["free", "paid"]  # Available to both tiers
tier_availability=["paid"]           # Premium only
```

**Tier-Based Selection:**

```python
# Get default model for tier
default_model = model_manager.get_default_model(tier="free")

# Get best model with capabilities
best_model = model_manager.select_best_model(
    tier="paid",
    required_capabilities=[ModelCapability.VISION, ModelCapability.FUNCTION_CALLING],
    min_context_window=500_000,
    prefer_cheaper=False  # If True, sort by cost instead of priority
)
```

### Model Capabilities

```python
class ModelCapability(Enum):
    CHAT = "chat"
    FUNCTION_CALLING = "function_calling"
    VISION = "vision"
    CODE_INTERPRETER = "code_interpreter"
    WEB_SEARCH = "web_search"
    THINKING = "thinking"
    STRUCTURED_OUTPUT = "structured_output"
```

**Example: Finding models with vision**

```python
vision_models = model_manager.get_models_with_capability(ModelCapability.VISION)
# Returns all enabled models supporting vision
```

### Pricing & Cost Calculation

```python
# Calculate cost for a request
cost = model_manager.calculate_cost(
    model_id="openai/gpt-4o",
    input_tokens=5000,
    output_tokens=2000
)
# Returns: float (in dollars)

# Get per-token rates
model = model_manager.get_model("openai/gpt-4o")
input_cost_per_token = model.pricing.input_cost_per_token
output_cost_per_token = model.pricing.output_cost_per_token
```

### Provider Router Configuration

```python
# OpenAI-compatible routing
provider_router = Router(
    model_list=[
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
    ],
    fallbacks=bedrock_fallback_chains
)
```

---

## 📊 Token Estimation Fallback

When actual token counts unavailable (some providers):

```python
# Fallback estimation: 1 word ≈ 1.3 tokens
fallback_prompt = word_count * 1.3
fallback_completion = content_word_count * 1.3

# Logged as:
{
    "prompt_tokens": int(fallback_prompt),
    "completion_tokens": int(fallback_completion),
    "total_tokens": int(fallback_prompt + fallback_completion),
    "estimated": True,
    "fallback": True
}
```

---

## 🚨 Error Handling

### Error Processing Pipeline

```python
try:
    response = await provider_router.acompletion(**params)
except Exception as e:
    # 1. Structured error processing
    processed_error = ErrorProcessor.process_llm_error(
        e, 
        context={"model": model_name}
    )
    
    # 2. Logging with context
    ErrorProcessor.log_error(processed_error)
    
    # 3. Re-raise as LLMError
    raise LLMError(processed_error.message)
```

### Error Context Captured

- **Model name** used
- **Provider** attempted
- **Error type** (rate limit, API error, network, etc.)
- **Error message** sanitized
- **Timestamp** of error
- **Fallback attempts** if applicable

---

## 🔗 Key Files Reference

| File | Purpose |
|------|---------|
| `backend/core/services/llm.py` | Main LLM service, provider routing, error handling |
| `backend/core/ai_models/registry.py` | Model definitions, priority, fallback chains |
| `backend/core/ai_models/manager.py` | Model selection, resolution, cost calculation |
| `backend/core/ai_models/ai_models.py` | Data classes (Model, ModelPricing, ModelCapability) |
| `backend/core/knowledge_base/file_processor.py` | FileProcessor summarization with fallbacks |
| `backend/core/agentpress/response_processor.py` | Response parsing, token estimation, tool execution |
| `backend/core/services/langfuse.py` | Logging and observability |

---

## 📈 Performance Characteristics

### Latency by Model

| Model | First Response | Typical Speed | Cost Efficiency |
|-------|---|---|---|
| Haiku 4.5 | ~500ms | Very Fast | Excellent |
| Sonnet 4.5 | ~1500ms | Fast | Good |
| Sonnet 4 | ~1500ms | Fast | Good |
| Gemini 2.5 Flash-Lite | ~1000ms | Very Fast | Excellent |
| Gemini 2.5 Flash | ~1200ms | Fast | Good |
| Gemini 2.5 Pro | ~2000ms | Moderate | Moderate |
| GPT-5 | ~2500ms | Moderate | Moderate |
| GPT-4o | ~2000ms | Moderate | Good |
| Local (Ollama) | ~500ms* | Variable | Excellent** |

\* Depends on hardware  
\*\* No API costs

### Cost per 1M Tokens (Input)

| Model | Cost |
|-------|------|
| Gemini 2.5 Flash-Lite | $0.10 |
| Haiku 4.5 | $1.00 |
| Gemini 2.5 Flash | $0.30 |
| GPT-5 Mini | $0.25 |
| Gemini 2.5 Pro | $1.25 |
| GPT-5 | $1.25 |
| Sonnet 4 | $3.00 |
| Sonnet 4.5 | $3.00 |
| GPT-4o | $2.50 |
| Local (Ollama) | $0.00 |

---

## 🎯 Best Practices

### 1. **Use Correct Tier When Selecting Models**

```python
# ✅ Good
model = model_manager.select_best_model(
    tier="paid",
    required_capabilities=[ModelCapability.VISION]
)

# ❌ Bad - may select disabled model
model = model_manager.get_model("openai/gpt-5")
```

### 2. **Let Fallbacks Handle Transient Errors**

```python
# ✅ Good - fallback will handle rate limits
response = await make_llm_api_call(...)

# ❌ Bad - manual retry without fallback
for i in range(3):
    try:
        response = await make_llm_api_call(...)
    except:
        pass
```

### 3. **Monitor Fallback Usage**

```python
# Check logs for fallback messages
# "Rate limit hit for gpt-5. Trying fallback models: ..."
# Indicates need for model diversification
```

### 4. **Use Context Windows Appropriately**

```python
# ✅ Good - pick model based on needs
if len(content) > 500_000_tokens:
    model = "gemini/gemini-2.5-pro"  # 2M context
elif len(content) > 1_000_000_tokens:
    # Consider chunking
    
# ❌ Bad - risk of context overflow
model = "gpt-4o-mini"  # Only 128K context
```

### 5. **Cache Model Lookups**

```python
# ✅ Good - resolved once
resolved_id = model_manager.resolve_model_id(user_model_choice)

# ❌ Bad - resolves on every call
for i in range(1000):
    model_manager.resolve_model_id(user_model_choice)
```

---

## 🔮 Future Enhancements

### Potential Improvements

1. **Dynamic Priority Adjustment**
   - Adjust priority based on success rate
   - Learn from recent fallback patterns
   - Weighted random selection for testing

2. **Provider Load Tracking**
   - Monitor provider status and latency
   - Preemptively shift to less-loaded providers
   - Implement circuit breakers for failing providers

3. **Cost Optimization**
   - Route requests to cheapest model meeting requirements
   - Budget tracking and enforcement
   - Cost alerting per user tier

4. **Advanced Observability**
   - Per-model success/failure rates
   - Latency percentiles (p50, p99)
   - Provider comparison dashboards

5. **Intelligent Fallback Reordering**
   - ML-based optimal fallback chain ordering
   - Context-aware fallback selection
   - Learning from historical patterns

6. **Streaming Optimizations**
   - Token buffering for stable streaming
   - Automatic model switching mid-stream
   - Fallback response merging for consistency

---

## 📝 Summary

The Suna LLM calling system provides:

✅ **Robust multi-provider support** with seamless failover  
✅ **Intelligent priority and tier-based selection**  
✅ **Dual-layer fallback system** for high resilience  
✅ **Rate limit handling** with automatic retries  
✅ **Local model support** for offline/cost optimization  
✅ **Rich model capabilities** filtering and selection  
✅ **Provider-agnostic interface** through LiteLLM  
✅ **Comprehensive logging** for debugging and monitoring  

This architecture ensures reliable LLM access across diverse providers while maintaining cost efficiency and providing graceful degradation when services are unavailable.

---

**Last Updated:** November 1, 2025  
**Version:** 1.0  
**Status:** Comprehensive Documentation Complete
