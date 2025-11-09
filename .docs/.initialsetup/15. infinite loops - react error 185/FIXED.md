# React Error 185: Maximum Update Depth Exceeded - FIXED

## Issue Description
**Error:** "Maximum update depth exceeded. This can happen when a component repeatedly calls setState inside componentWillUpdate or componentDidUpdate. React limits the number of nested updates to prevent infinite loops."

**When it occurred:** During thread initialization and when agent starts executing tools

**Models affected:** All models (GPT-5, Claude Sonnet, Haiku, etc.)

---

## Root Cause Analysis

Two separate infinite loops were identified in React hooks managing thread state:

### **Loop #1: useThreadData Hook**
**File:** `frontend/src/app/(dashboard)/projects/[projectId]/thread/_hooks/useThreadData.ts`

**The Problem:**
```typescript
// First useEffect - loads thread data and calls setMessages()
useEffect(() => {
  // ... loads data
  setMessages(unifiedMessages); // Sets messages
}, [threadId, messagesQuery.data, ...]);

// Second useEffect - has messages.length in dependencies
useEffect(() => {
  if (messagesQuery.data) {
    const shouldReload = messages.length === 0 || messagesQuery.data.length > messages.length + 50;
    if (shouldReload) {
      setMessages(...); // Sets messages again
    }
  }
}, [messagesQuery.data, messages.length, ...]); // ❌ messages.length triggers loop
```

**The Loop:**
1. First effect calls `setMessages()` → messages state changes
2. `messages.length` changes → triggers second effect
3. Second effect calls `setMessages()` → triggers first effect
4. **Infinite loop**

---

### **Loop #2: useToolCalls Hook**
**File:** `frontend/src/app/(dashboard)/projects/[projectId]/thread/_hooks/useToolCalls.ts`

**The Problem:**
```typescript
useEffect(() => {
  // Process messages and extract tool calls
  const historicalToolPairs = [...];
  setToolCalls(historicalToolPairs);
  
  if (historicalToolPairs.length > 0) {
    // Conditionally opens side panel
    if (!isSidePanelOpen && !autoOpenedPanel && ...) {
      setIsSidePanelOpen(true);  // ❌ Modifies state
      setAutoOpenedPanel(true);  // ❌ Modifies state
    }
  }
}, [messages, isSidePanelOpen, autoOpenedPanel, ...]); // ❌ These states trigger re-run
```

**The Loop:**
1. Effect calls `setIsSidePanelOpen(true)` → state changes
2. `isSidePanelOpen` in dependency array → triggers effect again
3. Effect evaluates conditions and potentially calls setters again
4. **Infinite loop**

---

## The Fixes

### **Fix #1: useThreadData - Reference Comparison**

**Added ref to track processed query data:**
```typescript
const lastMessagesQueryDataRef = useRef<ApiMessageType[] | null>(null);
```

**Modified second useEffect:**
```typescript
useEffect(() => {
  if (messagesQuery.data && messagesQuery.status === 'success' && !isLoading) {
    // ✅ Check if query data has actually changed (reference comparison)
    const dataHasChanged = lastMessagesQueryDataRef.current !== messagesQuery.data;
    
    if (!dataHasChanged) {
      return; // Data hasn't changed, don't process
    }
    
    // Update the ref to track we've processed this data
    lastMessagesQueryDataRef.current = messagesQuery.data;
    
    // Only reload if needed
    const shouldReload = messages.length === 0 || messagesQuery.data.length > messages.length + 50;
    
    if (shouldReload) {
      // ... process and setMessages
    }
  }
}, [messagesQuery.data, messagesQuery.status, isLoading, threadId]); 
// ✅ Removed: messages.length
```

**Reset ref on thread change:**
```typescript
useEffect(() => {
  // Reset refs when thread changes
  lastMessagesQueryDataRef.current = null; // ✅ Clear for new thread
  setMessages([]);
  // ...
}, [threadId, ...]);
```

---

### **Fix #2: useToolCalls - Reference Comparison**

**Added ref to track processed messages:**
```typescript
const lastProcessedMessagesRef = useRef<UnifiedMessage[]>([]);
```

**Modified main useEffect:**
```typescript
useEffect(() => {
  // ✅ Check if messages have actually changed (reference comparison)
  const messagesHaveChanged = lastProcessedMessagesRef.current !== messages;
  
  if (!messagesHaveChanged) {
    return; // Messages haven't changed, skip processing
  }
  
  // Update ref to track we've processed these messages
  lastProcessedMessagesRef.current = messages;
  
  const historicalToolPairs: ToolCallInput[] = [];
  // ... process tool calls
  
  setToolCalls(historicalToolPairs);
  
  if (historicalToolPairs.length > 0) {
    // Side panel logic can still call setState safely
    if (!isSidePanelOpen && !autoOpenedPanel && ...) {
      setIsSidePanelOpen(true);
      setAutoOpenedPanel(true);
    }
  }
}, [messages, agentStatus, isMobile, compact]);
// ✅ Removed: isSidePanelOpen, autoOpenedPanel
```

---

## Key Principles Applied

### **Anti-Pattern (Causes Infinite Loops):**
```typescript
useEffect(() => {
  setState(newValue); // Effect modifies state
}, [state]); // ❌ BAD: State is in dependencies → infinite loop
```

### **Correct Pattern (Prevents Loops):**
```typescript
const lastDataRef = useRef(null);

useEffect(() => {
  // ✅ GOOD: Check if input data actually changed
  if (lastDataRef.current === data) return;
  lastDataRef.current = data;
  
  setState(newValue); // Safe to modify state now
}, [data]); // ✅ GOOD: Only external data in dependencies
```

### **Rules:**
1. **Never include state that the effect modifies** in the dependency array
2. **Use refs for reference comparison** to detect actual data changes
3. **React Query data is stable** - compare by reference, not length/content
4. **Reset refs when context changes** (e.g., threadId changes)

---

## Verification

### **Build Status:**
✅ Frontend rebuilt successfully  
✅ No TypeScript compilation errors  
✅ Docker containers started properly

### **Testing Checklist:**
- [ ] Open existing thread - no errors during initialization
- [ ] Send message to GPT-5 agent - no errors when tools execute
- [ ] Send message to Claude Sonnet agent - no errors when tools execute
- [ ] Side panel auto-opens correctly when tools run
- [ ] Switching between threads doesn't cause errors
- [ ] Refresh page doesn't cause errors

---

## Files Modified

1. **`frontend/src/app/(dashboard)/projects/[projectId]/thread/_hooks/useThreadData.ts`**
   - Added `lastMessagesQueryDataRef` ref
   - Modified second useEffect to check reference before processing
   - Removed `messages.length` from dependency array
   - Reset ref on thread change

2. **`frontend/src/app/(dashboard)/projects/[projectId]/thread/_hooks/useToolCalls.ts`**
   - Added `lastProcessedMessagesRef` ref
   - Modified main useEffect to check reference before processing
   - Removed `isSidePanelOpen` and `autoOpenedPanel` from dependency array

---

## Date Fixed
November 9, 2025

## Branch
`localfix/singletonrealtime`
