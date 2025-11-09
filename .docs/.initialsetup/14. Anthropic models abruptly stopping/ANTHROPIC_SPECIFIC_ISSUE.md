# Anthropic Models Abruptly Stopping - Investigation Summary

## Issue Scope
**Confirmed: Problem is specific to Anthropic Claude models (Sonnet, Haiku)**

### Models Affected
- ✅ Claude Sonnet 4.5 (`anthropic/claude-sonnet-4-5-20250929`)
- ✅ Claude Haiku 4.5 (`anthropic/claude-haiku-4-5`)
- ✅ All Bedrock-served Claude variants

### Models NOT Affected
- ❌ Gemini (works fine)
- ❌ GPT-4o
- ❌ Other non-Anthropic providers

---

## Symptom Pattern

**After successful tool execution (file creation, command execution):**
1. Agent creates file or executes command ✅
2. User requests to "show me the file" or "continue"
3. Model stops generating responses ❌
4. User repeats request multiple times
5. Eventually agent marks as "completed" with **0 tokens** generated
6. No continuation response is ever provided

**Langfuse Evidence:**
- Trace ID: `818bc812-5ee6-47f8-8752-c8a3a075c7c9` (2025-11-09 07:23:19)
- Token counts: `input=0, output=0` (indicates response not properly tracked/logged)
- Model: Sonnet 4.5
- Duration: 47 seconds from start to completion with no output

---

## Root Cause Hypothesis

The issue appears to be in **Anthropic-specific caching logic**:

### Key Evidence
1. **Only Anthropic models use prompt caching** - `apply_anthropic_caching_strategy()` in `prompt_caching.py`
2. **Cache control headers applied** - `add_cache_control()` adds ephemeral cache control to messages
3. **Hard 4-block limit** - Anthropic API has strict 4-block cache limit
4. **Cache block management** - System prompt + conversation chunks + tool results = potential block overflow

### Suspected Failure Points
1. **Tool result caching** - Tool results might be cached incorrectly, preventing proper streaming
2. **Cache block overflow** - System prompt (1 block) + conversation chunks (2+ blocks) + tool results (1+ block) = exceeds 4-block limit
3. **Stream finalization** - Cache control headers may be breaking stream closure/finalization
4. **Response processor stalling** - After tool execution, processor may not properly finalize response due to cache state

---

## Investigation Checklist

- [ ] Verify cache block count doesn't exceed 4 during/after tool execution
- [ ] Check if tool result messages are being cached (should they be?)
- [ ] Review `process_streaming_response()` cache handling
- [ ] Verify `cache_control` headers aren't breaking response stream
- [ ] Check `apply_anthropic_caching_strategy()` for post-tool-execution behavior
- [ ] Compare working (Gemini) vs broken (Sonnet) response patterns

---

## Related Files
- `backend/core/agentpress/prompt_caching.py` - Anthropic caching strategy (lines 1-705)
- `backend/core/agentpress/response_processor.py` - Response stream processing (lines 220-280)
- `backend/core/agentpress/thread_manager.py` - LLM call execution (lines 240-350)
- `backend/core/services/llm.py` - LLM API interface (lines 100-200)

---

## Next Steps
Focus investigation on Anthropic-specific caching logic and how it interacts with streaming responses post-tool-execution.
