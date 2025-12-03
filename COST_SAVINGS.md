# Cost Savings: Prompt Caching Optimization

This document summarizes the cost-saving changes incorporated from the upstream `kortix-ai/suna` PRODUCTION branch into `Logrui/suna:advanced-workflows`.

## Overview

These changes implement **mathematically optimized prompt caching** for Anthropic Claude models, achieving **70-90% cost and latency savings** in long conversations.

## How It Works

### Anthropic's Prompt Caching Pricing

| Operation | Cost Multiplier | Description |
|-----------|-----------------|-------------|
| **Cache Write** | 1.25x base cost | One-time overhead when caching content |
| **Cache Read (Hit)** | 0.1x base cost | **90% savings** on subsequent reuse |

**Break-even point**: 2-3 reuses of cached content

### The Math Behind 90% Savings

```
Standard cost for 100k tokens: $0.30 (at $3/million)
With caching (90% hit rate):
  - First call: 100k × $3 × 1.25 = $0.375 (cache write)
  - Subsequent calls: 100k × $3 × 0.1 = $0.03 each (90% savings)

10 conversations with same context:
  - Without caching: 10 × $0.30 = $3.00
  - With caching: $0.375 + (9 × $0.03) = $0.645
  - Savings: 78.5%

100 conversations:
  - Without caching: 100 × $0.30 = $30.00
  - With caching: $0.375 + (99 × $0.03) = $3.345
  - Savings: 88.8%
```

## Key Changes

### 1. Dynamic Cache Thresholds (`prompt_caching.py`)

The system calculates optimal cache thresholds using a mathematical formula:

```python
Threshold = Base (2.5% of context) × Stage × Context × Density
```

#### Threshold Scaling by Conversation Stage

| Stage | Messages | Multiplier | Strategy |
|-------|----------|------------|----------|
| **Early** | ≤20 | 0.3x | Aggressive caching for quick wins |
| **Growing** | 21-100 | 0.6x | Balanced approach |
| **Mature** | 101-500 | 1.0x | Larger chunks, preserve blocks |
| **Very Long** | 500+ | 1.8x | Conservative, maximum efficiency |

#### Example Thresholds by Model

| Model | Context | Early (≤20) | Growing (≤100) | Mature (≤500) | Very Long (500+) |
|-------|---------|-------------|----------------|---------------|------------------|
| Claude 3.7 | 200k | 1.5k tokens | 3k tokens | 5k tokens | 9k tokens |
| Claude Sonnet 4 | 1M | 7.5k tokens | 15k tokens | 25k tokens | 45k tokens |
| Gemini 2.5 Pro | 2M | 15k tokens | 30k tokens | 50k tokens | 90k tokens |

### 2. 4-Block Cache Strategy

The system uses Anthropic's 4-block cache limit strategically:

1. **Block 1**: System prompt (always cached if ≥1024 tokens)
2. **Blocks 2-4**: Conversation chunks that grow with message count
3. **Recent messages**: Stay uncached to prevent invalidation

### 3. Message Grouping for Bedrock (`group_messages_by_tool_calls_for_caching()`)

- Ensures assistant + tool_result message pairs stay together
- Prevents API errors from orphaned tool results
- Maintains cache block validity across tool call sequences

### 4. Module-Level Singleton Clients (`context_manager.py`)

- `_get_anthropic_client_singleton()` - Memory-efficient Anthropic client
- `_get_bedrock_client_singleton()` - Memory-efficient Bedrock client
- Reduces memory overhead from repeated client instantiation

### 5. Bidirectional Tool Call Validation

- Detects orphaned tool results (results without matching calls)
- Detects unanswered tool calls (calls without matching results)
- `repair_tool_call_pairing()` automatically fixes message structure

### 6. Performance Instrumentation (`thread_manager.py`)

- `[TIMING]` logs for profiling LLM calls, compression, and caching
- Pre-send validation with automatic repair before LLM calls
- Fast path optimization for cache creation tokens

## Files Changed

| File | Changes |
|------|---------|
| `backend/core/agentpress/prompt_caching.py` | Dynamic thresholds, message grouping, cache control preservation |
| `backend/core/agentpress/context_manager.py` | Singleton clients, tool call validation, message repair |
| `backend/core/agentpress/thread_manager.py` | Timing instrumentation, pre-send validation, fast path optimization |
| `backend/core/agentpress/PROMPT_CACHING.md` | Technical documentation |

## Expected Cost Savings

| Conversation Type | Expected Savings |
|-------------------|------------------|
| Short (≤20 messages) | 50-70% |
| Medium (21-100 messages) | 70-80% |
| Long (101-500 messages) | 80-90% |
| Very Long (500+ messages) | 85-95% |

## Monitoring

Track cache performance via logs:

```
🔥 Block X: Cached chunk (Y tokens, Z messages)
🎯 Total cache blocks used: X/4
📊 Processing N messages (X tokens)
🧮 Calculated optimal cache threshold: X tokens
⏱️ [TIMING] get_llm_messages(): Xms
```

## Dependencies

All required dependencies are present in `Logrui/suna:advanced-workflows`:

- ✅ `core.ai_models.registry` - ModelRegistry, ModelProvider
- ✅ `core.ai_models.manager` - model_manager
- ✅ `core.services.supabase` - DBConnection
- ✅ `core.billing.billing_integration` - billing_integration
- ✅ `core.utils.logger` - logger
- ✅ `litellm` - token_counter

## Notes

- The billing module refactoring from upstream was **NOT included** as it requires significant migration
- Local billing import path preserved: `core.billing.billing_integration`
- See `UPSTREAM_CHANGES_ANALYSIS.md` for complete diff analysis between branches

## References

- [Anthropic Prompt Caching Documentation](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)
- PR: Incorporate upstream cost-saving prompt caching and context management
