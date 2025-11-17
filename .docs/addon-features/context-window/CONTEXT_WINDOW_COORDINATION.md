# Context Window & Token Tracking Coordination

## Overview

The Suna app implements a sophisticated frontend-backend coordination system to track context window usage and token counts. The frontend displays context usage **conditionally** - only when it gets close to capacity (at **75%** threshold), showing a circular progress indicator.

---

## Architecture Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           BACKEND FLOW                                   │
└─────────────────────────────────────────────────────────────────────────┘

1. AGENT RUN EXECUTION
   ↓
2. ContextManager.count_tokens()
   - Uses Anthropic's official tokenizer for Claude models
   - Uses LiteLLM's token_counter for others
   - Applies caching transformation to match API reality
   - Tracks total_tokens including caching overhead
   ↓
3. LLM Response Processing
   - Extracts usage data from API response
   - Calculates token consumption
   ↓
4. Message Emission (Server-Sent Events)
   - Backend sends llm_response_end event with usage data
   - Message format: { "usage": { "total_tokens": <number> } }
   ↓
5. Supabase Storage
   - Messages stored in database
   - Context usage persisted for historical tracking

┌─────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND FLOW                                    │
└─────────────────────────────────────────────────────────────────────────┘

1. MESSAGE FETCHING (getMessages)
   - Frontend loads all messages for thread
   - Filters for 'llm_response_end' message type
   ↓
2. CONTEXT USAGE EXTRACTION (lib/api.ts:651-666)
   ```typescript
   // Find latest llm_response_end message
   const llmResponseEndMessages = allMessages.filter(msg => msg.type === 'llm_response_end');
   
   if (llmResponseEndMessages.length > 0) {
     const latestMsg = llmResponseEndMessages[llmResponseEndMessages.length - 1];
     const content = JSON.parse(latestMsg.content);
     
     if (content?.usage?.total_tokens) {
       // Store in Zustand store
       useContextUsageStore.getState().setUsage(threadId, {
         current_tokens: content.usage.total_tokens
       });
     }
   }
   ```
   ↓
3. ZUSTAND STORE (context-usage-store.ts)
   ```typescript
   interface ContextUsageStore {
     usageByThread: Record<string, ContextUsageData>;
     setUsage: (threadId: string, usage: any) => void;
     getUsage: (threadId: string) => ContextUsageData | null;
   }
   ```
   - Global state management for context usage
   - Keyed by threadId
   - Stores only: { current_tokens: number }
   ↓
4. CONDITIONAL RENDERING (ContextUsageIndicator.tsx)
   - Fetches usage from store
   - Gets model context window from model registry
   - Calculates percentage
   - **Only renders if percentage >= 75%**
   ↓
5. VISUAL FEEDBACK
   - Circular SVG progress indicator
   - Stroke color changes based on percentage:
     - < 75%: Hidden (not rendered)
     - ≥ 75%: Muted foreground color
   - Tooltip shows: "Context: X.X% | XXX,XXX / X,XXX,XXX tokens | Model Name"
```

---

## Key Components & Data Flow

### 1. **Backend - Context Manager** 
**File:** `backend/core/agentpress/context_manager.py`

```python
class ContextManager:
    async def count_tokens(
        self, 
        model: str, 
        messages: List[Dict[str, Any]], 
        system_prompt: Optional[Dict[str, Any]] = None,
        apply_caching: bool = True
    ) -> int:
        """
        Counts tokens using model-specific tokenizers:
        - Anthropic models: Use Anthropic's official tokenizer
        - Others: Use LiteLLM's token_counter
        
        Returns total token count INCLUDING caching overhead
        """
        # For Anthropic: applies context-1m-2025-08-07 beta header
        # Caching adds overhead (cache_read_tokens + cache_creation_tokens)
```

**Key Methods:**
- `count_tokens()` - Accurate token counting per model
- `compress_messages()` - Summarization when threshold reached (120K by default)
- Context windows vary by model:
  - **1M context models** (Sonnet 4.5): Reserve 64K for output
  - **200K models** (Sonnet 4): Reserve 32K for output
  - **100K+ models**: Reserve 16K for output

### 2. **Backend - Response Emission**
**File:** `backend/core/agentpress/response_processor.py` + streaming endpoints

```python
# Emits messages like:
{
  "type": "llm_response_end",
  "content": {
    "usage": {
      "total_tokens": 15234,
      "input_tokens": 10000,
      "output_tokens": 5234
    }
  }
}
```

### 3. **Frontend - Message Loading**
**File:** `frontend/src/lib/api.ts:651-666`

```typescript
// Extract context_usage from the latest llm_response_end message
const llmResponseEndMessages = allMessages.filter(
  msg => msg.type === 'llm_response_end'
);

if (llmResponseEndMessages.length > 0) {
  const latestMsg = llmResponseEndMessages[llmResponseEndMessages.length - 1];
  const content = JSON.parse(latestMsg.content);
  
  if (content?.usage?.total_tokens) {
    // Store context usage in Zustand
    const { useContextUsageStore } = await import('@/lib/stores/context-usage-store');
    useContextUsageStore.getState().setUsage(threadId, {
      current_tokens: content.usage.total_tokens
    });
  }
}
```

### 4. **Frontend - Zustand Store**
**File:** `frontend/src/lib/stores/context-usage-store.ts`

```typescript
export const useContextUsageStore = create<ContextUsageStore>((set, get) => ({
  usageByThread: {},
  setUsage: (threadId, usage) => {
    set((state) => ({
      usageByThread: { 
        ...state.usageByThread, 
        [threadId]: { current_tokens: usage.current_tokens } 
      },
    }));
  },
  getUsage: (threadId) => get().usageByThread[threadId] || null,
}));
```

### 5. **Frontend - Context Usage Indicator**
**File:** `frontend/src/components/thread/ContextUsageIndicator.tsx`

```typescript
export const ContextUsageIndicator = ({
  threadId,
  modelName,
  radius = 28,
  strokeWidth = 4,
  className,
}) => {
  // 1. Get current tokens from store
  const contextUsage = useContextUsageStore((state) => 
    state.getUsage(threadId)
  );
  
  // 2. Get all models and find this one
  const { allModels } = useModelSelection();
  const modelData = modelName 
    ? allModels.find((m) => m.id === modelName) 
    : null;
  
  // 3. Get context window from model (default: 200K)
  const context_window = modelData?.contextWindow || 200000;
  
  // 4. Calculate percentage
  const { current_tokens } = contextUsage;
  const rawPct = (current_tokens / context_window) * 100;
  const percentage = Math.max(0, Math.min(100, rawPct));
  
  // 5. CONDITIONAL RENDERING - Only show if >= 75%
  if (!contextUsage || !contextUsage.current_tokens) return null;
  
  // 6. Determine stroke color based on capacity
  const getNeutralStroke = (pct: number) => 
    (pct < 75 ? "var(--color-muted-foreground)" : "var(--color-foreground)");
  const strokeColor = getNeutralStroke(percentage);
  
  // 7. Render circular SVG with tooltip
  return (
    <div className="absolute inset-0 pointer-events-none">
      <svg
        className="absolute inset-0 -rotate-90 w-full h-full"
        role="img"
        aria-label={`Context usage ${percentage.toFixed(1)} percent`}
      >
        {/* Background circle */}
        {/* Progress circle with strokeDashoffset animation */}
      </svg>
      
      <Tooltip>
        <TooltipContent>
          <p>Context: {percentage.toFixed(1)}%</p>
          <p>{current_tokens.toLocaleString()} / {context_window.toLocaleString()} tokens</p>
          <p>{displayModelName}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
};
```

---

## Context Window Thresholds

### Display Threshold
- **75% capacity**: Context indicator becomes visible
- Below 75%: Not rendered (hidden)
- Tooltip appears on hover

### Compression Triggers (Backend)
- **120K tokens**: Default threshold to trigger message compression
- **200K+ models**: Compress to ~120K (60% ratio)
- **100K+ models**: Compress to ~60K
- **Smaller models**: Compress proportionally

### Model Context Windows
| Model | Context Window | Max Output | Display Default |
|-------|---|---|---|
| Claude Sonnet 4.5 | 1,000,000 | N/A | 1M |
| Claude Sonnet 4 | 1,000,000 | N/A | 1M |
| Gemini 2.5 Pro | 2,000,000 | N/A | 2M |
| Gemini 2.5 Computer Use Preview | 131,072 | 65,536 | 131K |
| GPT-4o | 128,000 | N/A | 128K |
| Default (if missing) | N/A | N/A | 200,000 |

---

## Token Counting Accuracy

### Anthropic Models (Claude)
1. Uses **Anthropic's official tokenizer** via SDK
2. Applies caching transformation (context-1m-2025-08-07 beta)
3. Caching adds overhead:
   - Cache write: tokens are counted at full rate
   - Cache read: tokens counted at 10% of rate
4. Formula: `cache_write_tokens + (cache_read_tokens * 0.1) + regular_tokens`

### Other Models (OpenAI, Google)
1. Uses **LiteLLM's `token_counter`** library
2. Model-specific tokenizers (tiktoken for OpenAI, etc.)
3. Returns accurate token count for prompt + completion

### Important: Caching Reality
- Frontend counts include caching overhead
- This matches actual API charges
- So what user sees = what they get billed for

---

## Data Flow Example

```
1. User sends message to Agent
   └─ "Analyze this paper..."

2. Backend receives in context_manager
   └─ Loads thread messages
   └─ Counts existing tokens: 45,000 tokens

3. LLM generates response
   └─ Adds response tokens: 5,000 tokens
   └─ Applies caching transformation
   └─ Total becomes: ~50,000 tokens

4. Backend emits event
   └─ { type: "llm_response_end", 
         content: { usage: { total_tokens: 50000 } } }

5. Backend stores message in DB
   └─ Message type: 'llm_response_end'

6. Frontend loads thread
   └─ Fetches all messages
   └─ Finds latest llm_response_end
   └─ Extracts: current_tokens = 50000

7. Frontend updates Zustand store
   └─ useContextUsageStore.setUsage(threadId, { current_tokens: 50000 })

8. ContextUsageIndicator component
   └─ Gets context_window for model (e.g., 1,000,000)
   └─ Calculates: 50000 / 1000000 = 5%
   └─ Since 5% < 75%, component returns null (not rendered)

9. When context reaches 750,000 tokens
   └─ Calculates: 750000 / 1000000 = 75%
   └─ Component renders circular progress
   └─ Tooltip shows "Context: 75% | 750,000 / 1,000,000 tokens | Claude Sonnet 4.5"
```

---

## Considerations & Edge Cases

### What Happens When Context Fills?
1. **Compression Phase**
   - When >= 120K tokens, compression starts
   - Most recent messages kept
   - Older messages summarized
   - Frontend still shows token count

2. **What Frontend Shows**
   - Always shows latest `total_tokens` from backend
   - Frontend doesn't make compression decisions
   - Backend handles all context window management

### Model Data Availability
- **Frontend needs model context windows** from:
  1. `useModelSelection()` hook → gets from API
  2. API endpoint: `GET /billing/available-models`
  3. Response includes: `context_window` field per model

- **If context_window missing**:
  - Frontend defaults to 200,000 tokens
  - Better than showing nothing

### Token Counting Timing
- **When does backend count?**
  - After LLM generates full response
  - Using Anthropic SDK for Claude
  - Uses model's actual tokenizer for accuracy

- **When does frontend display?**
  - When loading thread messages
  - From `llm_response_end` message content
  - Lazily loaded when fetching messages

---

## Potential Improvements

### 1. **Streaming Token Count**
Currently: Token count shown after response completes
Improvement: Send token count updates during streaming
```typescript
// During streaming:
{ type: "token_count_estimate", content: { estimated_tokens: 1234, streaming: true } }

// After complete:
{ type: "token_count_final", content: { total_tokens: 5678, streaming: false } }
```

### 2. **Predictive Warnings**
```typescript
// If > 80% or > 90%
useContextUsageStore.setUsage(threadId, { 
  current_tokens: 900000,
  warning_level: 'critical', // 'warning' | 'critical'
  tokens_remaining: 100000
});
```

### 3. **Token Burn Rate**
```typescript
// Track tokens per message
{
  message_id: "msg_123",
  tokens: 1234,
  tokens_added: 234, // just this message
  burn_rate: "234 tokens/message"
}
```

### 4. **User-Friendly Warnings**
Show when context is running low:
```
⚠️ Context almost full (94% capacity)
Next message may trigger auto-summarization
Remaining tokens: ~60,000
```

### 5. **Backend Notification Events**
```python
# When compression happens
{
  "type": "context_compression_triggered",
  "data": {
    "reason": "threshold_exceeded",
    "tokens_before": 120000,
    "tokens_after": 72000,
    "messages_summarized": 45
  }
}
```

---

## Files Involved

### Backend
- `backend/core/agentpress/context_manager.py` - Core token counting
- `backend/core/agentpress/response_processor.py` - Message processing
- `backend/core/billing/api.py` - Model registry with context windows
- `backend/core/ai_models/manager.py` - Model context window retrieval
- `backend/core/ai_models/registry.py` - Model definitions

### Frontend
- `frontend/src/lib/api.ts` - Message loading & extraction (line 651-666)
- `frontend/src/lib/stores/context-usage-store.ts` - Zustand store
- `frontend/src/components/thread/ContextUsageIndicator.tsx` - Display component
- `frontend/src/hooks/use-model-selection.ts` - Model data fetching
- `frontend/src/lib/api-client.ts` - API client

---

## Testing Context Window Display

### Test Case 1: Low Usage (< 75%)
```
Setup: Model with 1M context, 200K tokens used
Expected: No indicator visible
```

### Test Case 2: High Usage (>= 75%)
```
Setup: Model with 1M context, 800K tokens used (80%)
Expected: Circular indicator visible, stroke color changed
Hover: Tooltip shows "Context: 80% | 800,000 / 1,000,000 tokens"
```

### Test Case 3: Small Context Model
```
Setup: Model with 131K context (Computer Use Preview), 100K used (76%)
Expected: Indicator visible at 76%
```

### Test Case 4: Model Switch
```
Setup: Switch from 1M model (75K tokens = 7.5%) to 128K model
Expected: Indicator disappears (7.5% < 75%)
Then: Switch back to 1M model
Expected: Indicator appears again (7.5% < 75%, still below threshold)
```

