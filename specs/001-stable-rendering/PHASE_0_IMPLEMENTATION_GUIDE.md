# Phase 0: Implementation Guide

**Purpose**: Step-by-step instructions for cherry-picking and implementing the 7 approved files

---

## File 1: response_processor.py (Backend Batching)

### Cherry-Pick Command
```bash
git cherry-pick f01c371f -- backend/core/agentpress/response_processor.py
```

### What's Included
- Backend batching logic (50ms intervals)
- Content chunk batching
- Tool call handling improvements

### Verification
```bash
# Check that batching logic is present
grep -n "batch" backend/core/agentpress/response_processor.py
grep -n "flush_interval" backend/core/agentpress/response_processor.py
```

### Testing
```bash
# Start backend
python -m uvicorn backend.main:app --reload

# Test streaming - should see batched updates
# Monitor console for batch timing
```

---

## File 2: MalformedToolCallView.tsx (Error Display)

### Cherry-Pick Command
```bash
git cherry-pick f01c371f -- \
  frontend/src/components/thread/tool-views/MalformedToolCallView.tsx
```

### What's Included
- New component for displaying malformed tool call errors
- Error details scrollable area
- Copy-to-clipboard button
- User-friendly error message

### Verification
```bash
# Check file exists and has proper structure
ls -la frontend/src/components/thread/tool-views/MalformedToolCallView.tsx

# Verify imports
grep -n "import" frontend/src/components/thread/tool-views/MalformedToolCallView.tsx
```

### Testing
```bash
# Trigger a malformed tool call to see error display
# Should show red error box with details
```

---

## File 3: react-error-boundary.tsx (Safety Net)

### Cherry-Pick Command
```bash
git cherry-pick f01c371f -- frontend/src/utils/react-error-boundary.tsx
```

### What's Included
- React error boundary component
- Error #185 detection
- User-friendly error UI
- Component stack display

### Verification
```bash
# Check file exists
ls -la frontend/src/utils/react-error-boundary.tsx

# Verify error #185 detection
grep -n "185" frontend/src/utils/react-error-boundary.tsx
```

### Integration
```typescript
// In layout.tsx or _app.tsx
import { ReactErrorBoundary } from '@/utils/react-error-boundary';

export default function RootLayout({ children }) {
    return (
        <ReactErrorBoundary>
            {children}
        </ReactErrorBoundary>
    );
}
```

---

## File 4: ToolViewRegistry.tsx (Registry Entry)

### Cherry-Pick Command
```bash
git cherry-pick f01c371f -- \
  frontend/src/components/thread/tool-views/wrapper/ToolViewRegistry.tsx
```

### What's Included
- Import of MalformedToolCallView
- Registry entry for malformed tool calls

### Verification
```bash
# Check registry entry exists
grep -n "malformed_tool_call" \
  frontend/src/components/thread/tool-views/wrapper/ToolViewRegistry.tsx
```

---

## File 5: ThreadComponent.tsx (Memoized Callbacks)

### Cherry-Pick Command
```bash
git cherry-pick f01c371f -- \
  frontend/src/components/thread/ThreadComponent.tsx
```

### What to Accept
```typescript
// Memoized callbacks object
const streamCallbacks = React.useMemo(() => ({
    onMessage: handleNewMessageFromStream,
    onStatusChange: handleStreamStatusChange,
    onError: handleStreamError,
    onClose: handleStreamClose,
}), [dependencies]);
```

### What to SKIP (Manual Removal)
```typescript
// REMOVE: Throttled tool call updates (100ms)
// This is redundant with backend batching
const streamingToolCallThrottleRef = useRef<NodeJS.Timeout | null>(null);
// ... remove entire throttle logic
```

### Verification
```bash
# Check memoized callbacks exist
grep -n "useMemo" frontend/src/components/thread/ThreadComponent.tsx

# Verify no throttle logic
grep -n "streamingToolCallThrottleRef" \
  frontend/src/components/thread/ThreadComponent.tsx
# Should return nothing if properly cleaned
```

---

## File 6: useAgentStream.ts (Frontend Optimizations)

### Cherry-Pick Command
```bash
git cherry-pick f01c371f -- frontend/src/hooks/useAgentStream.ts
```

### What to Accept

**1. Deep Equality Checks**
```typescript
setToolCall((prev) => {
    if (prev && prev.tool_index === newToolCall.tool_index && ...) {
        return prev; // Skip update if unchanged
    }
    return newToolCall;
});
```

**2. Cleanup on Unmount**
```typescript
useEffect(() => {
    return () => {
        if (throttleRef.current) clearTimeout(throttleRef.current);
        if (toolCallThrottleRef.current) clearTimeout(toolCallThrottleRef.current);
        flushPendingContent();
        flushPendingToolCall();
    };
}, []);
```

**3. Buffer Monitoring**
```typescript
if (pendingContentRef.current.length > MAX_BUFFER_ITEMS * 0.8) {
    console.warn(`Buffer approaching capacity...`);
}
```

### What to SKIP (Manual Removal)

**1. Fixed-Interval Batching (50ms)**
```typescript
// REMOVE: This is redundant with backend batching
const BATCH_INTERVAL = 50;
if (!throttleRef.current) {
    throttleRef.current = setTimeout(() => {
        flushPendingContent();
        throttleRef.current = null;
    }, BATCH_INTERVAL);
}
// Instead, keep existing 16ms throttling or remove entirely
```

**2. React.startTransition**
```typescript
// REMOVE: Delays updates unnecessarily
React.startTransition(() => {
    setToolCall(newToolCall);
});
// Replace with direct state update
```

### Verification
```bash
# Check deep equality checks exist
grep -n "tool_index ===" frontend/src/hooks/useAgentStream.ts

# Check cleanup exists
grep -n "clearTimeout" frontend/src/hooks/useAgentStream.ts

# Check buffer monitoring exists
grep -n "MAX_BUFFER_ITEMS" frontend/src/hooks/useAgentStream.ts

# Verify no fixed-interval batching
grep -n "BATCH_INTERVAL" frontend/src/hooks/useAgentStream.ts
# Should return nothing if properly cleaned
```

---

## File 7: ThreadContent.tsx (Error Display + System Parsing)

### Manual Implementation (Don't Cherry-Pick Entire File)

**What to Add**:

1. Malformed Tool Call Error Display
```typescript
// Add error display for malformed tool calls
if (message.type === 'malformed_tool_call') {
    return <MalformedToolCallView {...message} />;
}
```

2. System Message Parsing
```typescript
// Add system message parsing logic
const parseSystemMessage = (content: string) => {
    // Parse system messages from streaming
};
```

**What to SKIP**:

1. Circuit Breaker
```typescript
// DO NOT ADD: Returns empty fragment
if (shouldDelay > 0) {
    return <></>;
}
```

2. Removed Streaming Dependencies
```typescript
// DO NOT REMOVE: Keep all streaming deps
// streamingTextContent, streamingText, isStreamingText
// These are needed for memoization to work
```

3. Frontend Batching
```typescript
// DO NOT ADD: Redundant with backend
// No throttling or batching logic
```

### Verification
```bash
# Check error display exists
grep -n "malformed_tool_call" \
  frontend/src/components/thread/content/ThreadContent.tsx

# Check system parsing exists
grep -n "parseSystemMessage" \
  frontend/src/components/thread/content/ThreadContent.tsx

# Verify no circuit breaker
grep -n "shouldDelay" \
  frontend/src/components/thread/content/ThreadContent.tsx
# Should return nothing if properly cleaned
```

---

## Post-Cherry-Pick Cleanup

### Remove Redundant Files
```bash
# These files should NOT be cherry-picked
# They contain experimental/broken code

# Skip these:
# - circuit-breaker.ts (automatic no)
# - run.py max_xml_tool_calls change (risky)
```

### Verify No Conflicts
```bash
# Check git status
git status

# If conflicts exist, resolve carefully:
git diff --ours   # See our version
git diff --theirs # See their version
git add <resolved-file>
git cherry-pick --continue
```

---

## Testing After Implementation

### Functional Testing
```bash
# Start frontend
npm run dev

# Start backend
python -m uvicorn backend.main:app --reload

# Test streaming
# 1. Start a conversation
# 2. Verify streaming works
# 3. Trigger tool calls
# 4. Check for errors
```

### Regression Testing
```bash
# Compare with baseline
# 1. No blank screens
# 2. Animations visible
# 3. No render errors
# 4. Smooth tool call display
```

### Performance Monitoring
```bash
# Check console for:
# - Buffer monitoring logs
# - No "maximum update depth" errors
# - Render count < 10 per message cycle
```

---

## Troubleshooting

### Issue: Conflicts During Cherry-Pick
```bash
# Resolve conflicts manually
git cherry-pick --abort  # Start over if needed
# Or resolve and continue
git cherry-pick --continue
```

### Issue: Blank Screens
```bash
# Check for circuit breaker code
grep -n "return <>" frontend/src/components/thread/content/ThreadContent.tsx
# Remove if found
```

### Issue: Stale Content
```bash
# Check streaming dependencies in useMemo
grep -n "streamingTextContent" \
  frontend/src/components/thread/content/ThreadContent.tsx
# Should be present in dependency array
```

### Issue: Render Spam
```bash
# Check for multiple batching layers
grep -n "BATCH_INTERVAL" frontend/src/hooks/useAgentStream.ts
grep -n "throttleRef" frontend/src/components/thread/ThreadComponent.tsx
# Remove if multiple layers exist
```

---

## Success Criteria

✅ All 7 files cherry-picked or manually implemented  
✅ No conflicts or errors during cherry-pick  
✅ No blank screens during streaming  
✅ Animations remain visible  
✅ No "maximum update depth" errors  
✅ Render count < 10 per message cycle  
✅ Tool calls render smoothly  
✅ Malformed tool call errors display correctly  
✅ Error boundary catches React errors  

