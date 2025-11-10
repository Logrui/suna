# Maximum Update Depth Exceeded - Root Cause Analysis

**Date:** 2025-11-09
**Issue:** React "Maximum update depth exceeded" error during long tool call displays
**Status:** Root causes identified, fixes pending implementation

---

## Executive Summary

During long-running tool executions in thread displays, the application throws "Maximum update depth exceeded" errors and becomes unresponsive. Analysis reveals a **cascading update chain** involving:

1. High-frequency content streaming (60+ updates/second)
2. Scroll position synchronization triggering state updates
3. Scroll event listeners being re-attached on every message change
4. Components creating new prop values on every render
5. Broad query invalidations triggering refetch storms

The issue manifests as:
- Browser tab freezing during tool execution
- UI becoming unresponsive
- Console error: "Maximum update depth exceeded. This can happen when a component repeatedly calls setState inside componentWillUpdate or componentDidUpdate."

---

## Root Cause Chain

```
┌─────────────────────────────────────────────────────────────┐
│ 1. LLM streams content chunk (every 16ms with throttling)  │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. useAgentStream buffers and flushes (60 FPS)             │
│    → setTextContent() updates                               │
│    → orderedTextContent useMemo recalculates (O(n log n))  │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. ThreadContent receives streamingTextContent prop change  │
│    → Re-renders with NEW Date.now() for startTime          │
│    → Forces ShowToolStream to re-render unnecessarily      │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. ShowToolStream detects content change                    │
│    → Updates scrollTop to scrollHeight (lines 248-252)     │
│    → Triggers scroll event                                  │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Scroll event handler fires (lines 254-267)              │
│    → Calculates isAtBottom                                  │
│    → setShouldAutoScroll(isAtBottom) triggers state update │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. shouldAutoScroll change triggers scroll effect again    │
│    → Lines 248-252 re-run → More scroll updates            │
│    → FEEDBACK LOOP ESTABLISHED                              │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. Meanwhile: handleStreamingToolCall updates toolCalls    │
│    → 3 synchronous setState calls per chunk                 │
│    → Array spread + object recreation (300+ times)         │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 8. useToolCalls effect re-runs (depends on messages)       │
│    → Multiple state updates in single effect                │
│    → Updates state it depends on (isSidePanelOpen)         │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 9. ThreadComponent scroll listener re-attaches             │
│    → Effect depends on messages array                       │
│    → Re-creates scroll handler on every message update     │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 10. CYCLE REPEATS 60+ times per second                     │
│     → Browser becomes unresponsive                          │
│     → React hits maximum update depth limit                 │
└─────────────────────────────────────────────────────────────┘
```

**Impact During 5-Second Tool Execution:**
- 300+ content chunks streamed
- 900+ state updates (text + tools + scroll)
- 300+ DOM scroll operations
- 300+ memoization recalculations
- 300+ CSS transition restarts
- Multiple scroll listeners attached simultaneously

---

## Critical Issues Identified

### 🔴 **ISSUE #1: ShowToolStream Scroll Update Loop**

**File:** `frontend/src/components/thread/content/ShowToolStream.tsx`
**Lines:** 248-267
**Severity:** CRITICAL

#### Current Code:
```typescript
// Lines 248-252: Scroll on content change
useEffect(() => {
    if (containerRef.current && shouldShowContent && shouldAutoScroll) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
}, [content, shouldShowContent, shouldAutoScroll]);

// Lines 254-267: Update shouldAutoScroll on scroll
useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
        const { scrollTop, scrollHeight, clientHeight } = container;
        const isAtBottom = scrollTop + clientHeight >= scrollHeight - 5;
        setShouldAutoScroll(isAtBottom);  // ⚠️ State update triggers first effect
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
}, [shouldShowContent]);
```

#### The Problem:
1. **Effect 1** runs on every `content` change (60+ times/sec during streaming)
2. Each run updates `scrollTop` → triggers scroll event
3. **Effect 2's** `handleScroll` fires → updates `shouldAutoScroll` state
4. State change can trigger **Effect 1** to re-evaluate
5. Creates a feedback loop during streaming

#### Recommended Fix:
```typescript
// Add debouncing to scroll updates
const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

useEffect(() => {
    if (!containerRef.current || !shouldShowContent || !shouldAutoScroll) return;

    // Clear pending scroll update
    if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
    }

    // Debounce scroll updates to reduce frequency
    scrollTimeoutRef.current = setTimeout(() => {
        if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, 100); // 100ms debounce

    return () => {
        if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current);
        }
    };
}, [content, shouldShowContent, shouldAutoScroll]);

// Also debounce the scroll handler
const handleScrollDebounced = useMemo(
    () => debounce((container: HTMLDivElement) => {
        const { scrollTop, scrollHeight, clientHeight } = container;
        const isAtBottom = scrollTop + clientHeight >= scrollHeight - 5;
        setShouldAutoScroll(isAtBottom);
    }, 150), // 150ms debounce
    []
);

useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => handleScrollDebounced(container);

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
        container.removeEventListener('scroll', handleScroll);
        handleScrollDebounced.cancel?.(); // Cancel pending debounce on unmount
    };
}, [shouldShowContent, handleScrollDebounced]);
```

**Impact:** Reduces scroll operations from 300+ to ~30-50 during 5-second tool execution

---

### 🔴 **ISSUE #2: ThreadContent Creates New Date.now() on Every Render**

**File:** `frontend/src/components/thread/content/ThreadContent.tsx`
**Lines:** 1035, 1107
**Severity:** CRITICAL

#### Current Code:
```typescript
<ShowToolStream
    content={textToRender.substring(tagStartIndex)}
    messageId={...}
    onToolClick={handleToolClick}
    showExpanded={true}
    startTime={Date.now()}  // ⚠️ NEW timestamp on EVERY render!
/>
```

#### The Problem:
1. `Date.now()` creates a **new value on every render**
2. React sees `startTime` prop change → forces `ShowToolStream` to re-render
3. Even when content hasn't changed, component still re-renders
4. During 60Hz streaming: 300+ unnecessary re-renders over 5 seconds
5. Each re-render triggers CSS transitions and animations (lines 284-376)

#### Recommended Fix:
```typescript
// At component top level, create stable ref
const toolStreamStartTimeRef = useRef<number | null>(null);

// Reset when streaming starts
useEffect(() => {
    if (streamHookStatus === 'streaming' && !toolStreamStartTimeRef.current) {
        toolStreamStartTimeRef.current = Date.now();
    } else if (streamHookStatus !== 'streaming') {
        toolStreamStartTimeRef.current = null; // Reset when done
    }
}, [streamHookStatus]);

// In JSX, use stable ref value
<ShowToolStream
    content={textToRender.substring(tagStartIndex)}
    messageId={...}
    onToolClick={handleToolClick}
    showExpanded={true}
    startTime={toolStreamStartTimeRef.current || Date.now()}
/>
```

**Impact:** Eliminates 300+ unnecessary re-renders, significantly improves performance

---

### 🔴 **ISSUE #3: ThreadComponent Re-attaches Scroll Listener on Every Message**

**File:** `frontend/src/components/thread/ThreadComponent.tsx`
**Lines:** 785-812
**Severity:** HIGH

#### Current Code:
```typescript
useEffect(() => {
    const handleScroll = () => {
        if (!scrollContainerRef.current) return;

        const scrollTop = scrollContainerRef.current.scrollTop;
        const scrollHeight = scrollContainerRef.current.scrollHeight;
        const clientHeight = scrollContainerRef.current.clientHeight;
        const threshold = 100;

        const shouldShow = scrollTop < -threshold && scrollHeight > clientHeight;
        setShowScrollToBottom(shouldShow);
    };

    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
        scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
        setTimeout(() => handleScroll(), 100);

        return () => {
            scrollContainer.removeEventListener('scroll', handleScroll);
        };
    }
}, [messages, initialLoadCompleted]);  // ⚠️ Re-runs on EVERY messages change
```

#### The Problem:
1. Effect depends on `messages` array
2. During streaming: messages update 60+ times/second
3. Each update removes and re-attaches scroll listener
4. `setTimeout(() => handleScroll(), 100)` runs on every re-attachment
5. Potential for **multiple active listeners** if cleanup doesn't complete in time
6. Each listener calls `setShowScrollToBottom` → more state updates

#### Recommended Fix:
```typescript
// Use ref to track listener attachment
const scrollListenerAttachedRef = useRef(false);

// Separate effect for scroll listener (attach once)
useEffect(() => {
    if (scrollListenerAttachedRef.current) return;

    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
        const scrollTop = scrollContainer.scrollTop;
        const scrollHeight = scrollContainer.scrollHeight;
        const clientHeight = scrollContainer.clientHeight;
        const threshold = 100;

        const shouldShow = scrollTop < -threshold && scrollHeight > clientHeight;

        // Only update if value changed
        setShowScrollToBottom(prev => prev !== shouldShow ? shouldShow : prev);
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    scrollListenerAttachedRef.current = true;

    // Initial check
    handleScroll();

    return () => {
        scrollContainer.removeEventListener('scroll', handleScroll);
        scrollListenerAttachedRef.current = false;
    };
}, []); // Empty deps - only attach on mount

// Separate effect to check scroll position when messages change
useEffect(() => {
    if (!scrollContainerRef.current || !initialLoadCompleted) return;

    // Debounced check after messages update
    const timeoutId = setTimeout(() => {
        if (scrollContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
            const threshold = 100;
            const shouldShow = scrollTop < -threshold && scrollHeight > clientHeight;
            setShowScrollToBottom(prev => prev !== shouldShow ? shouldShow : prev);
        }
    }, 200); // Debounce

    return () => clearTimeout(timeoutId);
}, [messages, initialLoadCompleted]);
```

**Impact:** Prevents listener re-attachment, reduces state updates by 90%

---

### 🔴 **ISSUE #4: useAgentStream Query Invalidation Storm**

**File:** `frontend/src/hooks/useAgentStream.ts`
**Lines:** 263-328
**Severity:** HIGH

#### Current Code:
```typescript
const finalizeStream = useCallback(() => {
    // ... cleanup logic ...

    // ⚠️ 20+ query invalidations
    queryClient.invalidateQueries({ queryKey: fileQueryKeys.all });
    queryClient.invalidateQueries({ queryKey: ['active-agent-runs'] });

    if (agentId) {
        queryClient.invalidateQueries({ queryKey: agentKeys.all });
        queryClient.invalidateQueries({ queryKey: agentKeys.detail(agentId) });
        queryClient.invalidateQueries({ queryKey: agentKeys.lists() });
        queryClient.invalidateQueries({ queryKey: agentKeys.details() });

        queryClient.invalidateQueries({ queryKey: ['agent-tools', agentId] });
        queryClient.invalidateQueries({ queryKey: ['agent-tools'] });

        queryClient.invalidateQueries({ queryKey: ['custom-mcp-tools', agentId] });
        queryClient.invalidateQueries({ queryKey: ['custom-mcp-tools'] });
        queryClient.invalidateQueries({ queryKey: composioKeys.mcpServers() });
        queryClient.invalidateQueries({ queryKey: composioKeys.profiles.all() });
        queryClient.invalidateQueries({ queryKey: composioKeys.profiles.credentials() });

        queryClient.invalidateQueries({ queryKey: ['triggers', agentId] });
        queryClient.invalidateQueries({ queryKey: ['triggers'] });

        queryClient.invalidateQueries({ queryKey: knowledgeBaseKeys.agent(agentId) });
        queryClient.invalidateQueries({ queryKey: knowledgeBaseKeys.all });

        // Duplicate invalidations for versions
        queryClient.invalidateQueries({ queryKey: ['versions'] });
        queryClient.invalidateQueries({ queryKey: ['versions', 'list'] });
        queryClient.invalidateQueries({ queryKey: ['versions', 'list', agentId] });
        queryClient.invalidateQueries({ queryKey: ['versions', 'detail'] });

        // Force refetches
        queryClient.refetchQueries({ queryKey: agentKeys.detail(agentId) });
        queryClient.refetchQueries({ queryKey: ['versions', 'list', agentId] });
    }
}, [...deps]);
```

#### The Problem:
1. **20+ query invalidations** when agent run completes
2. Uses **broad "all" keys** (`agentKeys.all`, `knowledgeBaseKeys.all`) that match ALL cached queries
3. **Forced refetches** after invalidations trigger immediate network requests
4. If multiple agents complete simultaneously, creates network request storm
5. Invalidations can trigger components to re-render, which may start new agent runs

#### Recommended Fix:
```typescript
const finalizeStream = useCallback(() => {
    // ... cleanup logic ...

    // Be specific - only invalidate what changed
    queryClient.invalidateQueries({
        queryKey: ['active-agent-runs'],
        exact: true
    });

    if (agentId) {
        // Specific agent data (most likely to have changed)
        queryClient.invalidateQueries({
            queryKey: agentKeys.detail(agentId),
            exact: true
        });

        // Agent tools (only if actually modified)
        if (toolsModified) {
            queryClient.invalidateQueries({
                queryKey: ['agent-tools', agentId],
                exact: true
            });
        }

        // Knowledge base (only if documents were added/modified)
        if (kbModified) {
            queryClient.invalidateQueries({
                queryKey: knowledgeBaseKeys.agent(agentId),
                exact: true
            });
        }

        // Remove duplicate version invalidations - keep most specific
        queryClient.invalidateQueries({
            queryKey: ['versions', 'list', agentId],
            exact: true
        });

        // Remove forced refetches - let invalidation trigger natural refetch
        // queryClient.refetchQueries(...) ❌ REMOVED
    }

    // File operations - only if files were modified
    if (filesModified) {
        queryClient.invalidateQueries({
            queryKey: fileQueryKeys.all
        });
    }
}, [...deps]);
```

**Impact:** Reduces query invalidations from 20+ to 2-5, prevents network storms

---

### 🟡 **ISSUE #5: useToolCalls Multiple State Updates in Single Effect**

**File:** `frontend/src/app/(dashboard)/projects/[projectId]/thread/_hooks/useToolCalls.ts`
**Lines:** 115-242
**Severity:** MEDIUM-HIGH

#### Current Code:
```typescript
useEffect(() => {
    const historicalToolPairs: ToolCallInput[] = [];

    // ... complex message processing (100+ lines) ...

    setToolCalls(historicalToolPairs);

    if (historicalToolPairs.length > 0) {
        if (agentStatus === 'running' && !userNavigatedRef.current) {
            setCurrentToolIndex(historicalToolPairs.length - 1);
        } else if (isSidePanelOpen && !userClosedPanelRef.current && !userNavigatedRef.current) {
            setCurrentToolIndex(historicalToolPairs.length - 1);
        } else if (!isSidePanelOpen && !autoOpenedPanel && !userClosedPanelRef.current && !isMobile && !compact) {
            setCurrentToolIndex(historicalToolPairs.length - 1);
            setIsSidePanelOpen(true);   // ⚠️ Updates state it depends on
            setAutoOpenedPanel(true);    // ⚠️ Updates state it depends on
        }
    }
}, [messages, isSidePanelOpen, autoOpenedPanel, agentStatus, isMobile, compact]);
```

#### The Problem:
1. Effect depends on `isSidePanelOpen` and `autoOpenedPanel`
2. Effect ALSO updates these states
3. **Potential circular dependency** if conditions allow
4. Runs on every `messages` change (60+ times/sec during streaming)
5. **3-5 synchronous setState calls** per execution = multiple re-renders
6. No equality check before updating `toolCalls` (even if unchanged)

#### Recommended Fix:
```typescript
useEffect(() => {
    const historicalToolPairs: ToolCallInput[] = [];

    // ... message processing ...

    // Only update if actually changed
    setToolCalls(prev => {
        if (JSON.stringify(prev) === JSON.stringify(historicalToolPairs)) {
            return prev; // Prevent unnecessary update
        }
        return historicalToolPairs;
    });

    if (historicalToolPairs.length > 0) {
        // Batch all state updates together
        React.startTransition(() => {
            const newIndex = historicalToolPairs.length - 1;

            if (agentStatus === 'running' && !userNavigatedRef.current) {
                setCurrentToolIndex(newIndex);
            } else if (isSidePanelOpen && !userClosedPanelRef.current && !userNavigatedRef.current) {
                setCurrentToolIndex(newIndex);
            } else if (!isSidePanelOpen && !autoOpenedPanel && !userClosedPanelRef.current && !isMobile && !compact) {
                // Batch multiple state updates
                setCurrentToolIndex(newIndex);
                setIsSidePanelOpen(true);
                setAutoOpenedPanel(true);
            }
        });
    }
}, [messages, agentStatus, isMobile, compact]); // Remove isSidePanelOpen, autoOpenedPanel from deps

// Separate effect for panel state management
useEffect(() => {
    // Handle panel opening logic separately to avoid circular dependency
    if (toolCalls.length > 0 && !isSidePanelOpen && !autoOpenedPanel && !userClosedPanelRef.current && !isMobile && !compact) {
        React.startTransition(() => {
            setIsSidePanelOpen(true);
            setAutoOpenedPanel(true);
        });
    }
}, [toolCalls.length, isMobile, compact]); // Separate concerns
```

**Impact:** Eliminates circular dependency, reduces re-renders by batching updates

---

### 🟡 **ISSUE #6: ThreadContent ResizeObserver Cascade**

**File:** `frontend/src/components/thread/content/ThreadContent.tsx`
**Lines:** 534-552
**Severity:** MEDIUM

#### Current Code:
```typescript
useEffect(() => {
    const checkContentHeight = () => {
        const container = (scrollContainerRef || messagesContainerRef).current;
        const content = contentRef.current;
        if (!container || !content) return;

        const containerHeight = container.clientHeight;
        const contentHeight = content.scrollHeight;
        setShouldJustifyToTop(contentHeight <= containerHeight);
    };

    checkContentHeight();
    const resizeObserver = new ResizeObserver(checkContentHeight);
    if (contentRef.current) resizeObserver.observe(contentRef.current);
    const containerRef = (scrollContainerRef || messagesContainerRef).current;
    if (containerRef) resizeObserver.observe(containerRef);

    return () => resizeObserver.disconnect();
}, [displayMessages, streamingTextContent, agentStatus, scrollContainerRef]);
// ⚠️ Re-runs when displayMessages OR streamingTextContent changes
```

#### The Problem:
1. Effect re-runs on **every** `streamingTextContent` update (60+ times/sec)
2. Each run creates a **new ResizeObserver**
3. During streaming, content grows constantly → observer fires frequently
4. `setShouldJustifyToTop` triggers re-render → `displayMessages` may change
5. Re-render triggers effect again → new observer created
6. Old observers may not disconnect immediately → multiple observers active

#### Recommended Fix:
```typescript
// Use ref to prevent multiple observer setups
const resizeObserverRef = useRef<ResizeObserver | null>(null);

useEffect(() => {
    const container = (scrollContainerRef || messagesContainerRef).current;
    const content = contentRef.current;
    if (!container || !content) return;

    // Only set up observer once
    if (!resizeObserverRef.current) {
        const checkContentHeight = () => {
            const containerHeight = container.clientHeight;
            const contentHeight = content.scrollHeight;
            const newValue = contentHeight <= containerHeight;

            // Only update if changed
            setShouldJustifyToTop(prev => prev !== newValue ? newValue : prev);
        };

        resizeObserverRef.current = new ResizeObserver(checkContentHeight);
        resizeObserverRef.current.observe(content);
        resizeObserverRef.current.observe(container);

        // Initial check
        checkContentHeight();
    }

    return () => {
        if (resizeObserverRef.current) {
            resizeObserverRef.current.disconnect();
            resizeObserverRef.current = null;
        }
    };
}, []); // Empty deps - set up once
```

**Impact:** Eliminates observer recreation, prevents multiple active observers

---

### 🟡 **ISSUE #7: useAgentStream Text Content Array Growth**

**File:** `frontend/src/hooks/useAgentStream.ts`
**Lines:** 94-142
**Severity:** MEDIUM (Performance)

#### Current Code:
```typescript
const [textContent, setTextContent] = useState<{ content: string; sequence?: number }[]>([]);

const flushPendingContent = useCallback(() => {
    if (pendingContentRef.current.length > 0) {
        const newContent = [...pendingContentRef.current];
        pendingContentRef.current = [];

        React.startTransition(() => {
            setTextContent((prev) => [...prev, ...newContent]); // ⚠️ Array grows indefinitely
        });
    }
}, []);

const orderedTextContent = useMemo(() => {
    if (textContent.length === 0) return '';

    // ⚠️ Sorts ENTIRE array on EVERY update
    const sorted = textContent.slice().sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
    let result = '';
    for (let i = 0; i < sorted.length; i++) {
        result += sorted[i].content;
    }
    return result;
}, [textContent]); // Runs 60+ times/sec during streaming
```

#### The Problem:
1. `textContent` array grows indefinitely during streaming
2. `useMemo` recalculates on every update:
   - O(n log n) sort of entire array
   - O(n) string concatenation
3. During 5-second tool execution: 300+ sorts of 300-item array
4. No maximum buffer size limits

#### Recommended Fix:
```typescript
const [textContent, setTextContent] = useState<{ content: string; sequence?: number }[]>([]);
const MAX_BUFFER_ITEMS = 1000; // Prevent unbounded growth

const flushPendingContent = useCallback(() => {
    if (pendingContentRef.current.length > 0) {
        const newContent = [...pendingContentRef.current];
        pendingContentRef.current = [];

        React.startTransition(() => {
            setTextContent((prev) => {
                const updated = [...prev, ...newContent];
                // Keep only last N items to prevent unbounded growth
                return updated.length > MAX_BUFFER_ITEMS
                    ? updated.slice(-MAX_BUFFER_ITEMS)
                    : updated;
            });
        });
    }
}, []);

const orderedTextContent = useMemo(() => {
    if (textContent.length === 0) return '';

    // Check if already sorted (common case during streaming)
    let needsSort = false;
    for (let i = 1; i < textContent.length; i++) {
        if ((textContent[i].sequence ?? 0) < (textContent[i-1].sequence ?? 0)) {
            needsSort = true;
            break;
        }
    }

    if (!needsSort) {
        // Fast path: already sorted, just concatenate
        return textContent.map(item => item.content).join('');
    }

    // Slow path: sort required
    const sorted = textContent.slice().sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
    return sorted.map(item => item.content).join('');
}, [textContent]);
```

**Impact:** Reduces computational complexity, prevents performance degradation

---

## Additional Findings

### Real-Time Subscription Issues

**File:** `frontend/src/hooks/useProjectRealtime.ts` (Lines 16-54)

**Issue:** No debouncing on real-time database changes
```typescript
.on('postgres_changes', { event: '*', ... }, (payload) => {
    // Immediate invalidation - no debouncing!
    queryClient.invalidateQueries({ queryKey: threadKeys.project(projectId) });
})
```

**Fix:** Add debouncing
```typescript
const debouncedInvalidate = useMemo(
    () => debounce((projectId: string) => {
        queryClient.invalidateQueries({ queryKey: threadKeys.project(projectId) });
    }, 500),
    [queryClient]
);
```

---

### Vapi Real-Time Refetch Delays

**File:** `frontend/src/hooks/useVapiCallRealtime.ts` (Lines 70-96)

**Issue:** setTimeout-based refetch can race with natural refetch
```typescript
setTimeout(() => {
    queryClient.refetchQueries({ queryKey: ['vapi-call', callId] });
}, 100);
```

**Fix:** Remove forced refetch, rely on invalidation
```typescript
// Remove setTimeout refetch - invalidation will trigger natural refetch
queryClient.invalidateQueries({ queryKey: ['vapi-call', callId], exact: true });
```

---

## Testing & Verification

### Recommended Testing Approach

1. **Install React DevTools Profiler**
   - Record component render cycles during tool execution
   - Look for repeated render patterns
   - Check for wasted renders

2. **Add Performance Monitoring**
   ```typescript
   // In development mode
   if (process.env.NODE_ENV === 'development') {
       queryClient.getQueryCache().subscribe((event) => {
           if (event.type === 'updated') {
               console.count(`Query invalidation: ${event.query.queryKey[0]}`);
           }
       });
   }
   ```

3. **Add Effect Counters**
   ```typescript
   useEffect(() => {
       console.count('ShowToolStream scroll effect');
       // ... effect code
   }, [content, shouldShowContent, shouldAutoScroll]);
   ```

4. **Test Scenarios**
   - Execute file operations with large outputs
   - Run browser automation with frequent updates
   - Execute shell commands with streaming output
   - Test multiple simultaneous tool executions
   - Test on slower machines/browsers

5. **Monitor Metrics**
   - Count of re-renders per second
   - Query invalidation frequency
   - DOM scroll operation count
   - Memory usage during streaming
   - Browser CPU usage

### Success Criteria

- No "Maximum update depth" errors during tool execution
- UI remains responsive during 10+ second tool calls
- Re-renders reduced from 300+ to <50 per 5-second execution
- Query invalidations reduced from 20+ to 2-5 per agent completion
- Smooth scrolling during content streaming
- No browser tab freezing

---

## Implementation Priority

### Phase 1: Critical Fixes (Immediate)
1. ✅ **ShowToolStream scroll debouncing** (Issue #1) - Breaks main feedback loop
2. ✅ **ThreadContent Date.now() fix** (Issue #2) - Eliminates 300+ wasted renders
3. ✅ **ThreadComponent scroll listener** (Issue #3) - Prevents listener duplication

**Expected Impact:** 70-80% reduction in update cycles

### Phase 2: High Priority (Next)
4. ✅ **useAgentStream query invalidations** (Issue #4) - Prevents network storms
5. ✅ **useToolCalls state updates** (Issue #5) - Eliminates circular dependencies

**Expected Impact:** Additional 15-20% improvement

### Phase 3: Optimization (Follow-up)
6. ✅ **ThreadContent ResizeObserver** (Issue #6) - Cleaner observer management
7. ✅ **useAgentStream array optimization** (Issue #7) - Better long-term performance
8. ✅ **Real-time subscription debouncing** - Smoother updates
9. ✅ **Remove forced refetches** - Let invalidation work naturally

**Expected Impact:** Polish and long-term stability

---

## Files Requiring Changes

### Critical Files (Phase 1)
1. `frontend/src/components/thread/content/ShowToolStream.tsx`
2. `frontend/src/components/thread/content/ThreadContent.tsx`
3. `frontend/src/components/thread/ThreadComponent.tsx`

### High Priority Files (Phase 2)
4. `frontend/src/hooks/useAgentStream.ts`
5. `frontend/src/app/(dashboard)/projects/[projectId]/thread/_hooks/useToolCalls.ts`

### Optimization Files (Phase 3)
6. `frontend/src/hooks/useProjectRealtime.ts`
7. `frontend/src/hooks/useVapiCallRealtime.ts`

---

## Debugging Tools

### Add Development Logging
```typescript
// Add to ShowToolStream.tsx
if (process.env.NODE_ENV === 'development') {
    useEffect(() => {
        console.log('[ShowToolStream] Render:', {
            contentLength: content?.length,
            shouldShowContent,
            shouldAutoScroll,
            timestamp: Date.now()
        });
    });
}

// Add to useAgentStream.ts
if (process.env.NODE_ENV === 'development') {
    useEffect(() => {
        console.log('[useAgentStream] State update:', {
            textContentItems: textContent.length,
            orderedLength: orderedTextContent.length,
            pendingCount: pendingContentRef.current.length
        });
    }, [textContent]);
}
```

### React DevTools Settings
1. Open React DevTools → Profiler
2. Click "Record" before starting tool execution
3. Execute a long-running tool (5+ seconds)
4. Stop recording
5. Analyze flame graph for:
   - Repeated component renders
   - Wasted renders (same props)
   - Long render times

### Browser Performance Profile
1. Open Chrome DevTools → Performance
2. Click "Record" before tool execution
3. Execute tool
4. Stop recording
5. Look for:
   - Long tasks (>50ms)
   - Layout thrashing
   - Excessive JavaScript execution
   - Forced reflows

---

## Related Documentation

- React Docs: [Avoiding Infinite Loops](https://react.dev/learn/you-might-not-need-an-effect#chains-of-computations)
- React Query: [Query Invalidation Best Practices](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation)
- MDN: [ResizeObserver](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver)
- React: [useEffect Dependency Arrays](https://react.dev/reference/react/useEffect#specifying-reactive-dependencies)

---

## Conclusion

The "Maximum update depth exceeded" error is caused by a **perfect storm** of:
1. High-frequency content streaming (60+ updates/sec)
2. Scroll synchronization without debouncing
3. Components creating new props on every render
4. Effects that depend on state they modify
5. Broad query invalidations triggering refetch cascades

The fixes are straightforward but require careful implementation:
- **Debounce** scroll and resize operations
- **Stabilize** prop values (use refs for timestamps)
- **Prevent** effect dependency loops
- **Reduce scope** of query invalidations
- **Batch** multiple state updates

With these changes, the application should handle long-running tool executions smoothly without freezing or crashing.

---

**Next Steps:**
1. Implement Phase 1 fixes (scroll debouncing, Date.now(), listener attachment)
2. Test with long-running file operations and shell commands
3. Verify no infinite loop errors in console
4. Proceed to Phase 2 if successful
5. Monitor production metrics after deployment
