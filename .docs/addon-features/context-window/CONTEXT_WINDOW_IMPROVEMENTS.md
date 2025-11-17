# Context Window Improvements & Future Enhancements

## Current Implementation Analysis

### ✅ What Works Well
- **Accurate token counting** - Uses model-specific tokenizers
- **Conditional rendering** - Only shows when relevant (>= 75%)
- **Clean separation** - Backend counts, frontend displays
- **No performance impact** - Simple percentage calculation
- **Graceful fallback** - Defaults to 200K if model unknown

### ⚠️ Current Limitations
1. **Token count only at end** - Not during streaming
2. **No warning levels** - User unaware until 75%
3. **No compression notifications** - Happens silently
4. **No token burn rate** - Can't predict when full
5. **No historical tracking** - Can't see trends

---

## Improvement Recommendations

### 1. ⭐ HIGH PRIORITY: Streaming Token Estimates

**Current:** Token count shown only after response completes
**Improvement:** Show token estimates during streaming

#### Implementation

**Backend Changes** (`response_processor.py`):
```python
# During streaming chunks, emit token estimates
async def stream_with_token_updates(self, ...):
    chunks = []
    estimated_tokens = 0
    
    async for chunk in response_stream:
        chunks.append(chunk)
        
        # Estimate tokens from chunk (rough approximation)
        estimated_tokens += estimate_chunk_tokens(chunk)
        
        # Every 5 chunks, send estimate
        if len(chunks) % 5 == 0:
            yield {
                "type": "token_estimate",
                "data": {
                    "estimated_tokens": estimated_tokens,
                    "is_estimate": True,
                    "chunk_count": len(chunks)
                }
            }
    
    # Final accurate count
    final_count = count_tokens_accurate(chunks)
    yield {
        "type": "llm_response_end",
        "data": {
            "total_tokens": final_count,
            "is_estimate": False
        }
    }
```

**Frontend Changes** (`context-usage-store.ts`):
```typescript
interface ContextUsageData {
  current_tokens: number;
  is_estimate?: boolean;  // NEW
  confidence?: number;    // NEW (0-100)
}

export const useContextUsageStore = create<ContextUsageStore>((set, get) => ({
  usageByThread: {},
  setUsage: (threadId, usage) => {
    set((state) => ({
      usageByThread: { 
        ...state.usageByThread, 
        [threadId]: { 
          current_tokens: usage.current_tokens,
          is_estimate: usage.is_estimate ?? false,
          confidence: usage.confidence ?? 100
        } 
      },
    }));
  },
  getUsage: (threadId) => get().usageByThread[threadId] || null,
}));
```

**Frontend Changes** (`ContextUsageIndicator.tsx`):
```typescript
export const ContextUsageIndicator = ({ threadId, modelName, ... }) => {
  const contextUsage = useContextUsageStore((state) => state.getUsage(threadId));
  
  // Show even estimates if approaching threshold
  if (!contextUsage || !contextUsage.current_tokens) return null;
  
  const { current_tokens, is_estimate, confidence } = contextUsage;
  const percentage = (current_tokens / context_window) * 100;
  
  // Lower threshold for estimates (70% vs 75%)
  const showThreshold = is_estimate ? 70 : 75;
  if (percentage < showThreshold) return null;
  
  // Reduce opacity for estimates
  const opacity = is_estimate ? 0.6 : 1;
  
  return (
    <svg style={{ opacity }}>
      {/* Show indicator */}
      {is_estimate && (
        <title>Token estimate (final count coming)</title>
      )}
    </svg>
  );
};
```

**Expected Result:**
- User sees token indicator appearing during streaming
- Updates every few chunks
- Shows "~estimated" in tooltip
- Final count updates when stream ends

---

### 2. ⭐ HIGH PRIORITY: Multi-Level Warnings

**Current:** No warnings until indicator visible at 75%
**Improvement:** Progressive warnings at 80% and 90%

#### Implementation

**Frontend Changes** (`ContextUsageIndicator.tsx`):
```typescript
const getWarningLevel = (percentage: number) => {
  if (percentage >= 95) return 'critical';    // Red
  if (percentage >= 85) return 'warning';     // Yellow
  if (percentage >= 75) return 'caution';     // Orange
  return null;
};

// Change stroke color based on warning level
const getStrokeColor = (pct: number) => {
  const level = getWarningLevel(pct);
  switch(level) {
    case 'critical': return "var(--color-destructive)";     // Red
    case 'warning':  return "var(--color-warning)";          // Orange
    case 'caution':  return "var(--color-muted-foreground)"; // Gray
    default: return "var(--color-foreground)";
  }
};

// Show badge with warning
const warningBadge = (() => {
  const level = getWarningLevel(percentage);
  if (!level) return null;
  
  const messages = {
    caution: "Context at 75% - Still room",
    warning: "⚠️ Context at 85% - Getting full",
    critical: "🔴 Context at 95% - Almost full"
  };
  
  return (
    <Badge 
      variant={level === 'critical' ? 'destructive' : 'warning'}
      className="ml-2"
    >
      {messages[level]}
    </Badge>
  );
})();
```

**Backend Changes** (Optional notification):
```python
# Send notification when hitting thresholds
async def check_and_notify_context_usage(thread_id, current_tokens, context_window):
    percentage = (current_tokens / context_window) * 100
    
    if percentage >= 95:
        await send_user_notification(
            thread_id,
            "🔴 CRITICAL: Context is 95% full",
            level="critical"
        )
    elif percentage >= 85:
        await send_user_notification(
            thread_id,
            "⚠️ WARNING: Context is 85% full",
            level="warning"
        )
```

**Expected Result:**
- 75-85%: Gray indicator
- 85-95%: Orange/yellow with warning
- 95%+: Red with critical badge
- User gets clear visual escalation

---

### 3. ⭐ MEDIUM PRIORITY: Token Burn Rate

**Current:** User doesn't know how fast tokens are consumed
**Improvement:** Show tokens per message trend

#### Implementation

**Frontend Changes** (`context-usage-store.ts`):
```typescript
interface MessageTokenCount {
  message_id: string;
  tokens_added: number;
  timestamp: number;
}

interface ContextUsageData {
  current_tokens: number;
  is_estimate?: boolean;
  confidence?: number;
  message_tokens?: MessageTokenCount[];  // NEW
}

// Calculate burn rate
export const calculateBurnRate = (usage: ContextUsageData): {
  average_per_message: number;
  messages_until_full: number;
} | null => {
  if (!usage.message_tokens || usage.message_tokens.length < 3) {
    return null; // Need at least 3 data points
  }
  
  const recent = usage.message_tokens.slice(-10); // Last 10 messages
  const avgTokens = recent.reduce((sum, m) => sum + m.tokens_added, 0) / recent.length;
  
  // Rough estimate: how many messages until full?
  const tokensRemaining = 1000000 - usage.current_tokens; // Assume 1M
  const messagesUntilFull = tokensRemaining / avgTokens;
  
  return {
    average_per_message: avgTokens,
    messages_until_full: Math.floor(messagesUntilFull)
  };
};
```

**Frontend Display**:
```typescript
// In tooltip or card
{burnRate && (
  <div className="text-xs text-muted-foreground mt-2">
    <p>~{burnRate.average_per_message.toFixed(0)} tokens/message</p>
    <p>{burnRate.messages_until_full} messages until full</p>
  </div>
)}
```

**Expected Result:**
- User sees "~1,234 tokens per message"
- "~15 messages until full"
- Can plan conversation length accordingly

---

### 4. MEDIUM PRIORITY: Compression Notifications

**Current:** Backend silently compresses when threshold hit
**Improvement:** Notify user when compression happens

#### Implementation

**Backend Changes** (`response_processor.py`):
```python
async def compress_if_needed(thread_id, messages, context_window):
    token_count = await count_tokens(messages)
    threshold = context_window * 0.6
    
    if token_count > threshold:
        compressed = await compress_messages(messages)
        new_count = await count_tokens(compressed)
        
        # Emit notification event
        yield {
            "type": "compression_notification",
            "data": {
                "reason": "context_threshold_exceeded",
                "before_tokens": token_count,
                "after_tokens": new_count,
                "messages_compressed": len(messages) - len(compressed),
                "recovered_tokens": token_count - new_count
            }
        }
```

**Frontend Display**:
```typescript
// Show toast notification
if (event.type === 'compression_notification') {
  toast.info(
    `Conversation compressed! Freed up ${event.data.recovered_tokens} tokens`,
    {
      description: `${event.data.messages_compressed} older messages summarized`,
      duration: 5000
    }
  );
}
```

**Expected Result:**
- User sees: "Conversation auto-compressed! Freed 30K tokens"
- Can see details in sidebar
- Understands why older messages changed

---

### 5. MEDIUM PRIORITY: Historical Context Tracking

**Current:** Only current token count tracked
**Improvement:** Track token count over time per thread

#### Implementation

**Frontend Changes** (`context-usage-store.ts`):
```typescript
interface ContextUsageHistory {
  timestamp: number;
  current_tokens: number;
  percentage: number;
  message_count?: number;
}

interface ContextUsageData {
  current_tokens: number;
  history?: ContextUsageHistory[];  // NEW
}

// Add historical data
setUsage: (threadId, usage) => {
  set((state) => {
    const existing = state.usageByThread[threadId];
    const history = existing?.history ?? [];
    
    history.push({
      timestamp: Date.now(),
      current_tokens: usage.current_tokens,
      percentage: (usage.current_tokens / 1000000) * 100
    });
    
    // Keep last 100 data points
    if (history.length > 100) history.shift();
    
    return {
      usageByThread: {
        ...state.usageByThread,
        [threadId]: {
          ...usage,
          history
        }
      }
    };
  });
}
```

**Visualization Component**:
```typescript
export const ContextUsageChart = ({ threadId }) => {
  const usage = useContextUsageStore(s => s.getUsage(threadId));
  
  if (!usage?.history || usage.history.length < 2) return null;
  
  // Render sparkline or small chart
  return (
    <div className="text-xs text-muted-foreground">
      <p>Context usage trend:</p>
      <Sparkline 
        data={usage.history.map(h => h.percentage)}
        height={20}
        width={100}
      />
      <p>{usage.history[0].percentage.toFixed(1)}% → {usage.history[-1].percentage.toFixed(1)}%</p>
    </div>
  );
};
```

**Expected Result:**
- Users can see context growth over conversation
- Helps predict when full
- Visual feedback on compression impact

---

### 6. LOW PRIORITY: Advanced Features

#### 6.1 Context Summary View
```typescript
// Show what's taking up space
{
  messages: 45,
  system_prompt: 2000,
  user_messages: 15000,
  assistant_responses: 25000,
  tool_outputs: 8000,
  caching_overhead: 5000,
  total: 55000
}
```

#### 6.2 Per-Model Alerts
```typescript
// Different warning thresholds per model
const getWarningThreshold = (contextWindow) => {
  if (contextWindow > 500000) return 80;     // 80% for large
  if (contextWindow > 100000) return 75;     // 75% for medium
  return 70;                                  // 70% for small
};
```

#### 6.3 User Preferences
```typescript
// Let users set their own thresholds
{
  show_indicator_at: 70,        // percentage
  show_warning_at: 85,
  show_critical_at: 95,
  auto_compress_at: 60,         // auto-summarize at this point
  notify_on_compression: true
}
```

---

## Implementation Priority Matrix

```
┌─────────────────────────────────────────────────────┐
│ IMPLEMENTATION PRIORITY                             │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Impact ↑                                            │
│   │                                                 │
│   │  ⭐ Streaming         ⭐ Multi-level            │
│   │     Token Updates       Warnings                │
│   │  (HIGH)              (HIGH)                     │
│   │                                                 │
│   │                       📊 Burn Rate              │
│   │  🔔 Compression       (MEDIUM)                  │
│   │     Notify                                      │
│   │  (MEDIUM)             📈 History                │
│   │                          (MEDIUM)               │
│   │                                                 │
│   └────────────────────────────────────────────────→
│   Effort →                                          │
│                                                     │
└─────────────────────────────────────────────────────┘

Quick Wins (Best ROI):
1. Multi-level Warnings → 30 min, huge UX improvement
2. Streaming Estimates → 1-2 hours, smooth experience
3. Burn Rate → 1 hour, practical information

Nice-to-Haves:
4. Compression Notification → 1 hour
5. Historical Tracking → 1.5 hours
6. Advanced Features → 3+ hours
```

---

## Implementation Checklist

### Phase 1: Warnings (Day 1)
- [ ] Update `ContextUsageIndicator` to show warning levels
- [ ] Add stroke color mapping for percentages
- [ ] Update tooltip to show warning message
- [ ] Test at 75%, 85%, 95%

### Phase 2: Streaming Tokens (Day 2-3)
- [ ] Modify backend response streaming
- [ ] Add `token_estimate` event type
- [ ] Handle in frontend message processing
- [ ] Update Zustand store for estimates
- [ ] Show estimates with lower confidence

### Phase 3: Token Burn (Day 3-4)
- [ ] Track tokens per message
- [ ] Calculate burn rate
- [ ] Add burn rate display
- [ ] Test predictions

### Phase 4: Notifications (Day 4)
- [ ] Backend compression notification
- [ ] Frontend toast display
- [ ] Test compression scenarios

### Phase 5: History (Day 5)
- [ ] Store historical data points
- [ ] Create sparkline component
- [ ] Add trend visualization

---

## Testing Strategy

### Unit Tests
```typescript
// calculateBurnRate
test('calculates burn rate correctly', () => {
  const usage = {
    current_tokens: 100000,
    message_tokens: [
      { tokens_added: 1000 },
      { tokens_added: 1200 },
      { tokens_added: 1100 }
    ]
  };
  
  const rate = calculateBurnRate(usage);
  expect(rate.average_per_message).toBe(1100);
});

// getWarningLevel
test('returns correct warning level', () => {
  expect(getWarningLevel(95)).toBe('critical');
  expect(getWarningLevel(85)).toBe('warning');
  expect(getWarningLevel(75)).toBe('caution');
  expect(getWarningLevel(50)).toBe(null);
});
```

### Integration Tests
```typescript
// Full flow
test('displays indicator at correct percentage', async () => {
  const { getByRole } = render(
    <ContextUsageIndicator threadId="t123" modelName="claude-sonnet-4-5" />
  );
  
  // Set 75% usage
  store.setUsage('t123', { current_tokens: 750000 });
  
  expect(getByRole('img')).toBeInTheDocument();
});
```

### E2E Tests
```typescript
// Real scenario
test('shows warning progression', async () => {
  // Send message
  await user.type(input, 'test message');
  await user.click(sendButton);
  
  // Monitor: 5% → 50% → 75% → 85% → 95%
  // Verify indicator appears at 75%
  // Verify color changes at 85% and 95%
  // Verify tooltip updates
});
```

---

## Performance Considerations

### Store Updates
- Only update store when token count actually changes
- Avoid re-renders for estimate updates (debounce)
- Keep history to max 100 entries

### Component Optimization
```typescript
// Memoize calculations
const percentage = useMemo(
  () => (current_tokens / context_window) * 100,
  [current_tokens, context_window]
);

const warningLevel = useMemo(
  () => getWarningLevel(percentage),
  [percentage]
);
```

### Backend Optimization
- Send token estimates only every 5-10 chunks
- Don't send both estimate and final (one or other)
- Compress token count calcs with caching

---

## Migration Path from Current to Enhanced

### Step 1: Deploy Warnings (No Breaking Changes)
- Just styling changes
- Backwards compatible
- Safe to deploy

### Step 2: Add Estimate Events (With Fallback)
- Backend sends estimates IF available
- Frontend handles missing estimates gracefully
- No schema changes needed

### Step 3: Enable Burn Rate (New Store Field)
- Optional field in store
- Component safely handles missing
- Progressive enhancement

### Step 4: Add Notifications (New Event Type)
- New event type, old ones still work
- Frontend ignores unknown events
- Safe deploy

**Result:** Zero downtime, gradual enhancement

