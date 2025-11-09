# Visual Summary: Context Window System

## The 75% Display Threshold

```
█ = 100 tokens (for visualization)

0%                          50%                          75%                    100%
├─────────────────────────┼──────────────────────────┼─────────────────────────┤
│                         │          ●                │◐◐◐◐◐◐◐◐◐◐◐◐◐◐◐◐◐◐◐◐│
│                         │          │                │                         │
│  [Component hidden]     │  [Still hidden]           │  [APPEARS HERE]         │  Full
│  Nothing shown          │  User unaware             │  Indicator visible      │  Context
│                         │                          │  Tooltip shows          │
│                         │                          │  Warnings start         │
                         ●                          ●
                    Current tokens           Threshold
```

---

## Component Render Logic Flowchart

```
┌─────────────────────────────────────────────────────────────┐
│         ContextUsageIndicator Component Mount               │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ↓
        ┌──────────────────────────────────┐
        │ Get contextUsage from Zustand    │
        │ store.getUsage(threadId)         │
        └──────────┬───────────────────────┘
                   │
                   ↓
        ┌──────────────────────────────────┐
        │ Is contextUsage null or empty?   │
        │ OR current_tokens = undefined?   │
        └────┬─────────────────────────┬───┘
             │                         │
            YES                       NO
             │                         │
             ↓                         ↓
      ┌─────────────┐      ┌──────────────────────┐
      │ return null │      │ Get model context    │
      │             │      │ from registry        │
      │ (HIDDEN)    │      │ (default 200K)       │
      └─────────────┘      └────────┬─────────────┘
                                    │
                                    ↓
                           ┌────────────────────┐
                           │ Calculate percent  │
                           │ (current/window)*  │
                           │ 100               │
                           └────────┬───────────┘
                                    │
                                    ↓
                           ┌────────────────────┐
                           │ percentage >= 75%? │
                           └────┬───────────┬───┘
                                │           │
                              NO           YES
                                │           │
                                ↓           ↓
                         ┌────────────┐  ┌──────────────────┐
                         │return null │  │ Determine color: │
                         │            │  │ < 75%: muted     │
                         │ (HIDDEN)   │  │ >= 75%:foreground│
                         └────────────┘  └────────┬─────────┘
                                                  │
                                                  ↓
                                         ┌────────────────────┐
                                         │ Render SVG circle  │
                                         │ + tooltip          │
                                         │                    │
                                         │ ◐ 80%              │
                                         │ 800K/1M tokens     │
                                         │                    │
                                         └────────────────────┘
```

---

## Data Journey Map

```
START
  │
  └──→ User sends chat message
       │
       └──→ Backend receives in context_manager
           │
           ├──→ Load existing thread messages
           │   (count current tokens)
           │
           ├──→ Send to LLM API
           │   ├─ Includes Anthropic caching headers (if Claude)
           │   └─ Gets token usage in response
           │
           ├──→ Calculate total tokens
           │   │ (existing + response + caching overhead)
           │   │
           │   └──→ [BACKEND COUNTS: 50,000 tokens]
           │
           └──→ Emit "llm_response_end" event
               │ {
               │   "type": "llm_response_end",
               │   "content": {
               │     "usage": {
               │       "total_tokens": 50000
               │     }
               │   }
               │ }
               │
               └──→ Store in Supabase
                   │
                   └──→ Frontend loads messages
                       │
                       ├──→ Filter: type === "llm_response_end"
                       │   (get latest one)
                       │
                       ├──→ Parse content JSON
                       │   Extract: total_tokens = 50000
                       │
                       └──→ [EXTRACT: 50,000 tokens]
                           │
                           └──→ Zustand: setUsage(threadId, { current_tokens: 50000 })
                               │
                               ├──→ Store updated
                               │
                               └──→ [STORE: current_tokens = 50,000]
                                   │
                                   └──→ Component renders
                                       │
                                       ├──→ Get context_window from model
                                       │   (1,000,000 for Claude)
                                       │
                                       ├──→ Calculate: 50K / 1M = 5%
                                       │
                                       ├──→ Check: 5% >= 75%?
                                       │   NO → return null
                                       │
                                       └──→ [DISPLAY: HIDDEN]
                                           (not shown to user)
END
```

---

## Message Type Flow

```
Database Messages:

Time  │ Type                  │ Content/Payload
──────┼──────────────────────┼─────────────────────────────────────
T0    │ "user"               │ "Analyze this paper..."
      │                      │
T1    │ "assistant"          │ "I'll analyze the paper..."
      │                      │
T2    │ "tool_call"          │ { name: "search", args: {...} }
      │                      │
T3    │ "tool_result"        │ [search results...]
      │                      │
T4    │ "assistant"          │ "Based on my search..."
      │                      │
T5    │ "llm_response_end"   │ ← IMPORTANT: Contains usage data!
      │                      │ {
      │                      │   "usage": {
      │                      │     "total_tokens": 15234,
      │                      │     "input": 10000,
      │                      │     "output": 5234
      │                      │   }
      │                      │ }
      │                      │
T6    │ "user"               │ "Tell me more..."

Frontend extracts from latest llm_response_end (T5):
  current_tokens = 15234
```

---

## Context Window Capacity Visualization

### Small Model (131K - Computer Use)
```
0%                                  50%                75%              100%
├──────────────────────────────────┼──────────────────┼────────────────┤
                                                       ↑
                                                   Shows here
                                                   ~98K tokens

Practical breakdown:
  - System prompt: 2K
  - Previous messages: 50K
  - Current usage: 98K (75%)
  - Remaining: 33K
```

### Medium Model (128K - GPT-5/4o)
```
0%                                  50%                75%              100%
├──────────────────────────────────┼──────────────────┼────────────────┤
                                                       ↑
                                                   Shows here
                                                   ~96K tokens

Practical breakdown:
  - System: 2K
  - History: 60K
  - Current: 96K (75%)
  - Remaining: 32K
```

### Large Model (1M - Claude Sonnet 4.5)
```
0%                    50%              75%                              100%
├─────────────────────┼────────────────┼──────────────────────────────┤
                                       ↑
                                   Shows here
                                   ~750K tokens

Practical breakdown:
  - System: 2K
  - Long history: 200K
  - Many tool outputs: 300K
  - Current: 750K (75%)
  - Remaining: 250K
```

### Extra Large Model (2M - Gemini 2.5 Pro)
```
0%                              50%              75%                100%
├──────────────────────────────┼─────────────────┼──────────────────┤
                                               ↑
                                           Shows here
                                           ~1.5M tokens

Practical breakdown:
  - System: 2K
  - Extended history: 800K
  - Tool outputs: 600K
  - Current: 1500K (75%)
  - Remaining: 500K
```

---

## Token Count Updates

### Backend Token Counting Timeline

```
T=0s: User sends message
      │
      └──→ "Analyze this paper in detail"

T=0.5s: Backend processes
        ├─ Load existing: 10,000 tokens
        ├─ New message: +500 tokens
        ├─ Total input: 10,500 tokens
        │
        └──→ Send to Claude API

T=2s: Claude responds (streaming)
      ├─ Chunk 1: ▀▀▀ (buffering)
      ├─ Chunk 2: ▀▀▀▀ (buffering)
      ├─ Chunk 3: ▀▀▀▀ (buffering)
      │
      └──→ Count output: 5,000 tokens

T=2.5s: Count complete
        ├─ Input: 10,500 tokens
        ├─ Output: 5,000 tokens
        ├─ Caching: +250 tokens (overhead)
        ├─ ────────────────────────
        └─ TOTAL: 15,750 tokens

T=3s: Emit event
      {
        type: "llm_response_end",
        content: {
          usage: {
            total_tokens: 15750  ← This value
          }
        }
      }

T=3.5s: Store in DB ✅

T=5s: Frontend loads
      ├─ Extract: 15,750
      ├─ Store: current_tokens = 15,750
      ├─ Calculate: 15,750 / 1,000,000 = 1.6%
      ├─ Check: 1.6% >= 75%?
      └─ NO → Hide component ✅
```

---

## Threshold Decision Tree

```
                    ┌─ Current Tokens ─┐
                    │  (from store)    │
                    └────────┬─────────┘
                             │
                             ↓
                    ┌─────────────────────┐
                    │ Context Window:     │
                    │ - From model: 1M    │
                    │ - Default: 200K     │
                    └────────┬────────────┘
                             │
                             ↓
                    ┌─────────────────────┐
                    │ Percentage =        │
                    │ tokens / window * 100
                    └────────┬────────────┘
                             │
                             ↓
              ┌──────────────┴──────────────┐
              │                             │
         < 75%                         >= 75%
              │                             │
              ↓                             ↓
      ┌───────────────┐          ┌───────────────────┐
      │ return null   │          │ if percentage:    │
      │               │          │   < 75: gray      │
      │ Component NOT │          │   >= 75: color    │
      │ rendered      │          │   >= 85: orange   │
      │               │          │   >= 95: red      │
      │ Result:       │          │                   │
      │ ✅ HIDDEN     │          │ Result:           │
      └───────────────┘          │ ✅ SHOWN          │
                                 └───────────────────┘
```

---

## Component Conditional Rendering

```
ContextUsageIndicator Rendering:

Component called with: threadId="t-123", modelName="claude-sonnet-4-5"

Step 1: Get data from store
        contextUsage = store.getUsage("t-123")
        ├─ If null → return null (EXIT)
        ├─ If empty → return null (EXIT)
        └─ If valid → continue

Step 2: Get model data
        modelData = allModels.find(m => m.id === "claude-sonnet-4-5")
        ├─ If not found → use default 200K
        └─ If found → use contextWindow

Step 3: Calculate percentage
        percentage = (current_tokens / context_window) * 100
        ├─ Example: (800000 / 1000000) * 100
        └─ Result: 80%

Step 4: Determine display
        ├─ 80% >= 75%? YES
        └─ Render component:
           
           <div className="absolute inset-0">
             <svg>
               <circle strokeDashoffset={adjusted for 80%} />
             </svg>
             <Tooltip>
               Context: 80%
               800,000 / 1,000,000 tokens
               Claude Sonnet 4.5
             </Tooltip>
           </div>
```

---

## Zustand Store Operations

```
Store State:

usageByThread = {
  "thread-1": { current_tokens: 50000 },
  "thread-2": { current_tokens: 500000 },
  "thread-3": null
}


Operation 1: setUsage("thread-1", { current_tokens: 75000 })
Before:  { current_tokens: 50000 }
         │
         └─→ Update
After:   { current_tokens: 75000 }
         │
         └─→ Components re-render with new value


Operation 2: getUsage("thread-1")
Returns: { current_tokens: 75000 }
         ├─ Used in ContextUsageIndicator
         ├─ Used in token burn rate calc
         └─ Used in historical tracking


Operation 3: getUsage("thread-unknown")
Returns: null
         ├─ Component returns null (not rendered)
         └─ No error
```

---

## Performance Profile

```
Operation          │ Time      │ Impact  │ Trigger
───────────────────┼───────────┼─────────┼──────────────
Store setUsage()   │ < 1ms     │ Minimal │ After LLM
Store getUsage()   │ < 0.5ms   │ None    │ Component mount
Calculate %        │ < 0.1ms   │ None    │ Every render
Component render   │ < 5ms     │ Low     │ On data change
DOM update (SVG)   │ < 3ms     │ Low     │ Percentage change
Tooltip calculation│ < 2ms     │ None    │ On hover

Total lifecycle: < 15ms from store update to rendered
Memory per thread: ~200 bytes
Re-renders: Only when tokens change
Browser repaints: Only SVG circle (no layout recalc)
```

---

## Integration Points

```
Frontend Components:
  │
  ├─→ ContextUsageIndicator.tsx
  │   ├─ useContextUsageStore (Zustand)
  │   ├─ useModelSelection (Model data)
  │   └─ Renders circular progress
  │
  ├─→ Thread Components
  │   ├─ Load messages via getMessages()
  │   ├─ Extract and store usage
  │   └─ Pass threadId to indicator
  │
  └─→ Model Selection Hook
      ├─ Fetches from /billing/available-models
      ├─ Provides context_window per model
      └─ Used by indicator for calculation


Backend Endpoints:
  │
  ├─→ /billing/available-models
  │   ├─ Returns: context_window for each model
  │   └─ Used by: Frontend model registry
  │
  └─→ /agent-run/{id}/stream
      ├─ Emits: llm_response_end events
      ├─ Contains: usage.total_tokens
      └─ Consumed by: Frontend message processor


Database:
  │
  └─→ messages table
      ├─ Stores: type, content (JSON)
      ├─ Query: WHERE type = 'llm_response_end'
      └─ Extract: content.usage.total_tokens
```

---

## Quick Decision Guide

**Question: Will the indicator show?**

```
1. Is there a contextUsage in store?
   NO  → Won't show
   YES → Continue

2. Does it have current_tokens > 0?
   NO  → Won't show
   YES → Continue

3. Is there a model in registry?
   NO  → Use 200K default
   YES → Use model's context_window

4. Calculate percentage
   percentage = (current_tokens / context_window) * 100

5. Is percentage >= 75%?
   NO  → Won't show ❌
   YES → Will show ✅
```

