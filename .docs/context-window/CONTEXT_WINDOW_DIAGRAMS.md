# Context Window Tracking - Sequence Diagram

## 1. Normal Message Flow (< 75% Capacity)

```
User                Frontend              Backend              Supabase
 │                    │                      │                    │
 ├─ Send Message ────→ │                      │                    │
 │                    │                      │                    │
 │                    ├─ POST /agent-run ───→ │                    │
 │                    │                      │                    │
 │                    │                      ├─ Load thread msg ──→ │
 │                    │                      │ ← messages[]        │
 │                    │                      │                    │
 │                    │                      ├─ Count tokens      │
 │                    │                      │  (context_manager) │
 │                    │                      │  total = 45,000    │
 │                    │                      │                    │
 │                    │                      ├─ Call LLM API      │
 │                    │                      │  token response    │
 │                    │                      │                    │
 │                    │ ← llm_response_end ──│                    │
 │                    │  { usage:            │                    │
 │                    │    total_tokens:     │                    │
 │                    │    50000 }           │                    │
 │                    │                      ├─ Store message ───→ │
 │                    │                      │   type:lmm_resp_end │
 │                    │                      │   usage: {50000}    │
 │                    │                      │
 │                    ├─ Load messages ─────→ │
 │                    │ ← [msg1, msg2,       │
 │                    │    llm_resp_end{...}]│
 │                    │
 │                    ├─ Extract usage       │
 │                    │ (find llm_resp_end)  │
 │                    │ current_tokens=50K   │
 │                    │
 │                    ├─ Check context_window│
 │                    │ (from model registry) │
 │                    │ context_window=1M    │
 │                    │
 │                    ├─ Calculate %         │
 │                    │ 50K / 1M = 5%        │
 │                    │
 │                    ├─ Check threshold     │
 │                    │ 5% < 75%?            │
 │                    │ YES → Return null    │
 │                    │
 │ ← No Indicator ────│                      │
 │   (hidden)         │
```

---

## 2. High Capacity Message Flow (>= 75% Capacity)

```
User                Frontend              Backend              Supabase
 │                    │                      │                    │
 ├─ Send Message ────→ │                      │                    │
 │                    │                      │                    │
 │                    ├─ POST /agent-run ───→ │                    │
 │                    │                      │                    │
 │                    │                      ├─ Load thread msg ──→ │
 │                    │                      │ ← messages[]        │
 │                    │                      │  (many messages!)   │
 │                    │                      │                    │
 │                    │                      ├─ Count tokens      │
 │                    │                      │ (750,000 existing)  │
 │                    │                      │                    │
 │                    │                      ├─ Call LLM API      │
 │                    │                      │ (with caching!)     │
 │                    │                      │                    │
 │                    │ ← llm_response_end ──│                    │
 │                    │  { usage:            │                    │
 │                    │    total_tokens:     │                    │
 │                    │    800000 }          │                    │
 │                    │  (including caching) │                    │
 │                    │                      ├─ Store message ───→ │
 │                    │                      │ type:llm_resp_end   │
 │                    │                      │ usage: {800000}     │
 │                    │                      │
 │                    ├─ Load messages ─────→ │
 │                    │ ← [msg1, msg2,       │
 │                    │    llm_resp_end{800K}│
 │                    │
 │                    ├─ Extract usage       │
 │                    │ current_tokens=800K  │
 │                    │
 │                    ├─ Zustand: setUsage   │
 │                    │ store[threadId]      │
 │                    │ = {current_tokens:800K}
 │                    │
 │                    ├─ Check context_window│
 │                    │ context_window=1M    │
 │                    │ (from model registry) │
 │                    │
 │                    ├─ Calculate %         │
 │                    │ 800K / 1M = 80%      │
 │                    │
 │                    ├─ Check threshold     │
 │                    │ 80% >= 75%?          │
 │                    │ YES → Render!        │
 │                    │
 │                    ├─ Render Component    │
 │                    │ ┌──────────────────┐ │
 │                    │ │ Circular Progress│ │
 │                    │ │ 80% filled       │ │
 │                    │ │                  │ │
 │                    │ │  Foreground color│ │
 │                    │ └──────────────────┘ │
 │                    │ (Tooltip on hover)   │
 │                    │
 │ ← Indicator shown ─│                      │
```

---

## 3. Context Compression Scenario

```
User                Frontend              Backend              Supabase
 │                    │                      │                    │
 ├─ Send Message ────→ │                      │                    │
 │                    │                      │                    │
 │                    ├─ POST /agent-run ───→ │                    │
 │                    │                      │                    │
 │                    │                      ├─ Load messages ───→ │
 │                    │                      │ ← [many messages]   │
 │                    │                      │                    │
 │                    │                      ├─ Count tokens:     │
 │                    │                      │  150,000 existing   │
 │                    │                      │  + new request      │
 │                    │                      │  = 155,000 total    │
 │                    │                      │                    │
 │                    │                      ├─ Check threshold    │
 │                    │                      │  155K > 120K limit? │
 │                    │                      │  YES!               │
 │                    │                      │                    │
 │                    │                      ├─ compress_messages()│
 │                    │                      │  Keep recent 10 msg │
 │                    │                      │  Summarize older 45 │
 │                    │                      │  tokens now: 85K    │
 │                    │                      │                    │
 │                    │                      ├─ Call LLM API      │
 │                    │                      │  (with new context) │
 │                    │                      │                    │
 │                    │ ← llm_response_end ──│                    │
 │                    │  { usage:            │                    │
 │                    │    total_tokens:     │                    │
 │                    │    95000 }           │                    │
 │                    │  (compressed!)       │                    │
 │                    │                      ├─ Store messages ──→ │
 │                    │                      │ including summary    │
 │                    │                      │
 │                    ├─ Load messages       │
 │                    │ ← [msg1, msg2,       │
 │                    │    summary_msg,      │
 │                    │    llm_resp_end{95K}]│
 │                    │
 │                    ├─ Extract: 95K tokens│
 │                    │ Calculate: 95K/1M=9% │
 │                    │ 9% < 75%             │
 │                    │ → Return null        │
 │                    │
 │ ← No Indicator ────│                      │
 │   (still < 75%)    │
```

---

## 4. Zustand Store State Flow

```
┌─────────────────────────────────────────────────────────────┐
│                  Zustand Store State                         │
│              useContextUsageStore                            │
└─────────────────────────────────────────────────────────────┘

           ┌──────────────────────────────┐
           │   usageByThread: {}           │
           │   (empty initially)           │
           └──────────────────────────────┘
                     │
                     │ setUsage(threadId, usage)
                     ↓
           ┌──────────────────────────────┐
           │ usageByThread: {              │
           │   "thread-123": {             │
           │     current_tokens: 45000     │
           │   }                           │
           │ }                             │
           └──────────────────────────────┘
                     │
                     │ getUsage("thread-123")
                     ↓
           ┌──────────────────────────────┐
           │ { current_tokens: 45000 }     │
           │ (returned to component)       │
           └──────────────────────────────┘
                     │
                     │ Used in calculation:
                     │ 45000 / 1000000 = 4.5%
                     │ → Component returns null
                     ↓
           ┌──────────────────────────────┐
           │ No Indicator Rendered         │
           └──────────────────────────────┘

Later: setUsage("thread-123", { current_tokens: 800000 })
                     │
                     ↓
           ┌──────────────────────────────┐
           │ usageByThread: {              │
           │   "thread-123": {             │
           │     current_tokens: 800000    │  ← Updated!
           │   }                           │
           │ }                             │
           └──────────────────────────────┘
                     │
                     │ getUsage("thread-123")
                     ↓
           ┌──────────────────────────────┐
           │ { current_tokens: 800000 }    │
           │ (returned to component)       │
           └──────────────────────────────┘
                     │
                     │ Used in calculation:
                     │ 800000 / 1000000 = 80%
                     │ → Render indicator!
                     ↓
           ┌──────────────────────────────┐
           │ Circular Progress Indicator   │
           │ ◐ 80%                         │
           │ Foreground color              │
           └──────────────────────────────┘
```

---

## 5. Conditional Rendering Logic

```
ContextUsageIndicator Component Load Sequence:

1. Component Mounts
   │
   ├─ contextUsage = useContextUsageStore.getUsage(threadId)
   │  (fetch from store by threadId)
   │
   ├─ allModels = useModelSelection().allModels
   │  (fetch all models from registry)
   │
   ├─ modelData = allModels.find(m => m.id === modelName)
   │  (find specific model in list)
   │
   └─ context_window = modelData?.contextWindow || 200000
      (get window, default to 200K)

2. Validation Check ⚠️
   │
   ├─ if (!contextUsage || !contextUsage.current_tokens)
   │  return null  ← EXIT HERE if no data
   │
   └─ Continue if data exists

3. Calculate Percentage
   │
   ├─ rawPct = (current_tokens / context_window) * 100
   │  e.g., (800000 / 1000000) * 100 = 80
   │
   └─ percentage = Math.max(0, Math.min(100, rawPct))
      (clamp to 0-100)

4. Determine Color
   │
   ├─ if (percentage < 75)
   │  strokeColor = "muted-foreground"
   │  (but component returns null before here!)
   │
   └─ else
      strokeColor = "foreground"  ← This is used when >= 75%

5. Render Decision 🎯
   │
   ├─ percentage >= 75%?
   │  YES → Render SVG circle with tooltip
   │  NO  → return null (not rendered)
   │
   └─ Component always checks early returns!


Actual Code Flow:

```typescript
// Step 1: Get data
const contextUsage = useContextUsageStore(state => state.getUsage(threadId));
const { allModels } = useModelSelection();

// Step 2: Early exit if no data
if (!contextUsage || !contextUsage.current_tokens) return null;  ⚠️ EXITS HERE for < 75%

// Step 3: Calculate
const { current_tokens } = contextUsage;
const context_window = modelData?.contextWindow || 200000;
const percentage = (current_tokens / context_window) * 100;

// Step 4: Determine color
const strokeColor = percentage < 75 ? "muted-foreground" : "foreground";

// Step 5: Render
return <svg>...</svg>;  ⚠️ ONLY REACHES HERE if current_tokens exists
```

Key Point: The early return happens BEFORE percentage check!
So component returns null for ANY case where contextUsage is missing.
```

---

## 6. Message Type Timeline

```
Timeline: Single Agent Run

T=0s
├─ User sends: "Analyze this"

T=0.5s
├─ Agent starts processing
├─ "status": "running"

T=3s
├─ Model generates response
├─ Token count calculated
├─ Backend creates "llm_response_end" message
└─ Event: { type: "llm_response_end", content: { usage: { total_tokens: 5234 } } }

T=3.1s
├─ Frontend receives stream event
├─ ✅ Message stored in DB

T=5s
├─ User clicks to view thread
├─ Frontend: getMessages(threadId)
├─ Backend returns all messages ordered by timestamp
├─ Message array:
   ├─ { type: "user", content: "..." }
   ├─ { type: "assistant", content: "..." }
   ├─ { type: "llm_response_end", content: "{ \"usage\": { \"total_tokens\": 5234 } }" }  ← Found!
   └─ { type: "assistant", content: "..." }

T=5.1s
├─ Frontend processes messages
├─ Filter: type === "llm_response_end"
├─ Get latest one
├─ Parse content JSON
├─ Extract: total_tokens = 5234
├─ Store: setUsage(threadId, { current_tokens: 5234 })

T=5.2s
├─ Component renders with:
   ├─ current_tokens = 5234 (from store)
   ├─ context_window = 1000000 (from model)
   ├─ percentage = 0.5%
   └─ 0.5% < 75% → return null

T=5.3s
├─ ✅ Component unmounts (not rendered)
└─ User sees no indicator (working as expected)
```

---

## 7. Model Registry to Frontend Flow

```
Step 1: Backend - Register Model
┌──────────────────────────────────────────┐
│ registry.register(Model(                  │
│   id="anthropic/claude-sonnet-4-5",       │
│   context_window=1_000_000,               │
│   ...                                     │
│ ))                                        │
└──────────────────────────────────────────┘
           │
           │ Stored in backend memory
           ↓
┌──────────────────────────────────────────┐
│ model_manager._models = {                 │
│   "anthropic/claude-sonnet-4-5": Model...│
│ }                                         │
└──────────────────────────────────────────┘

Step 2: Frontend Requests Models
┌──────────────────────────────────────────┐
│ GET /billing/available-models             │
│ (with JWT auth)                           │
└──────────────────────────────────────────┘
           │
           │ Backend endpoint
           ↓
┌──────────────────────────────────────────┐
│ models = model_manager.list_available()   │
│ {                                         │
│   id: "anthropic/claude-sonnet-4-5",      │
│   name: "Sonnet 4.5",                     │
│   context_window: 1000000,  ← INCLUDED    │
│   capabilities: [...],                    │
│   ...                                     │
│ }                                         │
└──────────────────────────────────────────┘

Step 3: Frontend Stores Models
┌──────────────────────────────────────────┐
│ useModelSelection() hook                  │
│ const { allModels } = useModelSelection() │
│                                           │
│ allModels = [                             │
│   {                                       │
│     id: "anthropic/claude-sonnet-4-5",    │
│     label: "Sonnet 4.5",                  │
│     contextWindow: 1000000,  ← Mapped     │
│   },                                      │
│   ...                                     │
│ ]                                         │
└──────────────────────────────────────────┘

Step 4: ContextUsageIndicator Uses It
┌──────────────────────────────────────────┐
│ const modelData = allModels.find(m =>     │
│   m.id === modelName                      │
│ )                                         │
│                                           │
│ context_window = modelData?.contextWindow │
│                = 1000000                  │
│                                           │
│ percentage = (current_tokens / context)   │
│           = (800000 / 1000000) * 100      │
│           = 80%                           │
└──────────────────────────────────────────┘
           │
           ↓
    80% >= 75%?
    YES → Render indicator
```

---

## 8. Default Fallback Path

```
If Model Not Found in Registry:

┌──────────────────────────────────────────┐
│ Component receives modelName="unknown"    │
└──────────────────────────────────────────┘
           │
           │ const modelData = allModels.find(m => m.id === "unknown")
           │ modelData = undefined  ← NOT FOUND
           ↓
┌──────────────────────────────────────────┐
│ const context_window =                    │
│   modelData?.contextWindow || 200000      │
│                               ↑           │
│                   Uses fallback default   │
│ context_window = 200000                   │
└──────────────────────────────────────────┘
           │
           ↓
┌──────────────────────────────────────────┐
│ percentage = (5000 / 200000) * 100 = 2.5%│
│ 2.5% < 75% → Component returns null       │
│              (not visible)                │
└──────────────────────────────────────────┘

Result: Component gracefully hides if model unknown
No error, no crash, just hidden
```

