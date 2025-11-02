# Quick Reference: Context Window Coordination

## The 75% Rule 🎯

**The frontend only displays the context usage indicator when capacity exceeds 75%**

```
0%  ────────────────────────────────── 75%  ────────────────────── 100%
     (NOT VISIBLE)                        ↑                            ↑
                                   Shows indicator            Full capacity
```

---

## Data Flow (Short Version)

1. **Backend calculates token count** → `context_manager.count_tokens()`
2. **Backend emits message** → `{ type: "llm_response_end", content: { usage: { total_tokens: X } } }`
3. **Frontend loads messages** → `getMessages()` → extracts from latest `llm_response_end`
4. **Frontend stores in Zustand** → `useContextUsageStore.setUsage(threadId, { current_tokens: X })`
5. **ContextUsageIndicator component**:
   - Gets `current_tokens` from store
   - Gets `context_window` from model registry
   - Calculates percentage: `(current_tokens / context_window) * 100`
   - **If < 75%: returns null (not rendered)**
   - **If >= 75%: renders circular SVG progress indicator + tooltip**

---

## Key Code Locations

### Extract Context Usage from Messages (Frontend)
📍 `frontend/src/lib/api.ts:651-666`
```typescript
const llmResponseEndMessages = allMessages.filter(msg => msg.type === 'llm_response_end');
if (llmResponseEndMessages.length > 0) {
  const latestMsg = llmResponseEndMessages[llmResponseEndMessages.length - 1];
  const content = JSON.parse(latestMsg.content);
  if (content?.usage?.total_tokens) {
    useContextUsageStore.getState().setUsage(threadId, {
      current_tokens: content.usage.total_tokens
    });
  }
}
```

### Zustand Store (Frontend State)
📍 `frontend/src/lib/stores/context-usage-store.ts`
```typescript
export const useContextUsageStore = create<ContextUsageStore>((set, get) => ({
  usageByThread: {},
  setUsage: (threadId, usage) => { /* ... */ },
  getUsage: (threadId) => get().usageByThread[threadId] || null,
}));
```

### Display Component (Conditional Rendering)
📍 `frontend/src/components/thread/ContextUsageIndicator.tsx`
```typescript
// CONDITIONAL: Only renders if contextUsage exists AND percentage >= 75%
if (!contextUsage || !contextUsage.current_tokens) return null;

const percentage = (current_tokens / context_window) * 100;
const strokeColor = percentage < 75 
  ? "var(--color-muted-foreground)"  // Neutral if below threshold
  : "var(--color-foreground)";        // Foreground if at/above threshold
```

### Count Tokens (Backend)
📍 `backend/core/agentpress/context_manager.py`
```python
async def count_tokens(self, model: str, messages: List[Dict], ...) -> int:
    # Uses Anthropic's tokenizer for Claude models
    # Uses LiteLLM's tokenizer for others
    # Returns total including caching overhead
```

### Model Context Windows (Backend)
📍 `backend/core/billing/api.py:817-830` (available-models endpoint)
```python
"context_window": model_data["context_window"]  # Returned in API response
```

---

## Model Context Windows

| Model | Context | Notes |
|-------|---------|-------|
| **Claude Sonnet 4.5** | 1,000,000 | Thinking capable |
| **Claude Sonnet 4** | 1,000,000 | Thinking capable |
| **Gemini 2.5 Pro** | 2,000,000 | Largest |
| **Gemini 2.5 Computer Use** | 131,072 | Vision + Computer control |
| **Gemini 2.5 Flash** | 1,000,000 | Fast |
| **GPT-5** | 128,000 | Latest OpenAI |
| **GPT-4o** | 128,000 | Legacy |
| **Default** | 200,000 | Fallback if model not found |

---

## When Does Backend Emit Token Count?

✅ **After** LLM generates full response
✅ In `llm_response_end` message event
✅ With structure: `{ "usage": { "total_tokens": <number> } }`
❌ Not during streaming (only at end currently)

---

## When Does Frontend Display?

✅ When loading thread messages
✅ When `current_tokens >= 75%` of context window
✅ Hovering shows exact numbers in tooltip
❌ Not shown for < 75% capacity (returns null)

---

## Threshold Calculations

### Display Threshold
```
threshold_percentage = 75%
show_indicator = (current_tokens / context_window) * 100 >= 75
```

### Examples
```
Model: Claude 1M context
- 200K tokens → 200K/1M = 20% → NOT SHOWN
- 500K tokens → 500K/1M = 50% → NOT SHOWN
- 750K tokens → 750K/1M = 75% → SHOWN ✅
- 800K tokens → 800K/1M = 80% → SHOWN ✅

Model: Computer Use 131K context
- 50K tokens → 50K/131K = 38% → NOT SHOWN
- 95K tokens → 95K/131K = 72% → NOT SHOWN
- 99K tokens → 99K/131K = 75% → SHOWN ✅
```

---

## Backend Token Compression

When tokens exceed **120K threshold**:
- Backend triggers message compression
- Recent messages kept intact
- Older messages summarized
- Frontend doesn't know about compression (happens server-side)
- Frontend just shows updated token count from `llm_response_end`

---

## What If Context Window Missing?

**Frontend Default:** 200,000 tokens
- Used if model not found in registry
- Better than 0 or error
- User sees indicator at 150K+ tokens

**Backend Default:** Model must have context_window
- Set in `backend/core/ai_models/registry.py`
- Returned in `/billing/available-models` endpoint
- Always available when model is loaded

---

## Testing Checklist

- [ ] Load thread with < 75% capacity → no indicator
- [ ] Load thread with >= 75% capacity → indicator visible
- [ ] Switch to different model → indicator updates
- [ ] Hover over indicator → tooltip shows exact numbers
- [ ] Token count updates after new message → indicator recalculates
- [ ] Message with 0 tokens → no indicator shown
- [ ] Model not in registry → uses 200K default

---

## Common Issues & Solutions

### Issue: Indicator not showing even at high usage
**Cause:** Context usage not extracted from messages
**Solution:** Check if `llm_response_end` message contains `usage.total_tokens`

### Issue: Wrong context window displayed
**Cause:** Model not in registry or wrong model ID
**Solution:** Verify model ID in `available-models` API response

### Issue: Indicator appears at 30%
**Cause:** Different context window than expected
**Solution:** Check actual model context window from registry

### Issue: Token count not updating
**Cause:** New message type not being processed
**Solution:** Check backend is sending `llm_response_end` events

---

## Architecture Pattern

```
BACKEND                          FRONTEND
─────────────────────────────────────────────────────────────

count_tokens() ─────→ llm_response_end ─────→ getMessages()
                      { usage: {...} }             ↓
                                        setUsage(store)
                                             ↓
                                    ContextUsageIndicator
                                    (if >= 75%)
```

This is a **pull model** (frontend fetches), not push (no WebSocket updates).

---

## Key Insights

🔑 **75% is a UX decision, not a technical limit**
- Context still works below 75%
- Just not displayed to user
- Reduces visual clutter

🔑 **Backend does the heavy lifting**
- All token counting
- All compression decisions
- All LLM interactions
- Frontend is read-only

🔑 **Frontend is reactive**
- Reads from Zustand store
- Reads from model registry
- Only displays, doesn't decide

🔑 **Model context windows are critical**
- If missing → defaults to 200K
- If wrong → wrong percentage shown
- Must be in registry to display properly

---

## Next Steps to Improve

1. **Add streaming token updates** during LLM response
2. **Show warning at 80%** and **critical at 90%**
3. **Display token burn rate** (tokens per message)
4. **Notify on compression** (when summarization happens)
5. **Track historical usage** across multiple messages

