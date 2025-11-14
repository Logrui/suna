# Research: Stable Rendering & Streaming

**Feature**: 001-stable-rendering | **Date**: 2025-11-13 | **Updated**: 2025-11-14

## Overview

This research document addresses the technical decisions and implementation approaches for creating a stable streaming system in Suna that eliminates React render loops while maintaining real-time responsiveness.

## Phase 0 Findings (2025-11-14)

**⚠️ CRITICAL DISCOVERY**: After implementing Phase 0 cherry-picked optimizations (memoization, deep equality checks, error handling), the message stream is still failing. This confirms:

1. **Root cause is NOT in f01c371f changes** - The commit only had malformed error handling, no backend batching
2. **Baseline architecture has streaming issues** - The problem exists in the current `22a36feb` baseline
3. **Origin unknown** - Could be backend (message generation/Redis), frontend (receiving/rendering), or both
4. **Comprehensive analysis required** - Need full file-by-file streaming flow analysis before Phase 1

**Required Analysis Before Phase 1**:

### Streaming Data Flow Analysis

**Backend Streaming Path**:
```
agent_runs.py (SSE endpoint) 
  ↓
response_processor.py (LLM response handling)
  ↓
Redis pub/sub (message queue)
  ↓
SSE stream to frontend
```

**Frontend Streaming Path**:
```
SSE connection (EventSource)
  ↓
useAgentStream.ts (message parsing, state updates)
  ↓
ThreadComponent.tsx (message array management)
  ↓
ThreadContent.tsx (message grouping, rendering)
  ↓
ShowToolStream.tsx (individual tool display)
```

**Key Questions to Answer**:
1. **Is this a backend or frontend issue?** (Message generation spam vs render loop?)
2. **Backend investigation**: Is response_processor yielding too many messages? Is Redis pub/sub flooding?
3. **Frontend investigation**: Are React components re-rendering excessively? Stale closures in useAgentStream?
4. **Where do render loops originate?** (useAgentStream deps? ThreadContent re-renders? ShowToolStream updates?)
5. **How should message batching work?** (Backend throttling? Frontend debouncing? Both?)
6. **Which components need React.memo?** (ShowToolStream? ThreadContent? Both?)
7. **What backend throttling is required?** (50ms batching? 100ms? Per-message or per-batch?)
8. **Are there dependency array issues?** (Stale closures? Missing deps? Over-specified deps?)

**Files Requiring Deep Analysis**:
- `backend/core/agentpress/response_processor.py` - Message yielding logic
- `backend/api/routes/agent_runs.py` - SSE endpoint implementation
- `frontend/src/hooks/useAgentStream.ts` - State management and updates
- `frontend/src/components/thread/ThreadComponent.tsx` - Message array handling
- `frontend/src/components/thread/content/ThreadContent.tsx` - Rendering logic

## Phase 0.5: Upstream Research Complete ✅ (2025-11-14)

**STATUS**: ✅ COMPLETE - Three-phase analysis conducted, Track 1 (PRODUCTION) selected as baseline

### Upstream Research Methodology

Conducted comprehensive analysis of 673 commits across 3 upstream branches to identify production-tested fixes for 7 streaming problem areas:

**Phase 1: Quick Scan** ✅
- Scanned 20 critical files for upstream activity
- Result: 16 files with upstream commits identified
- Runtime: ~30 seconds

**Phase 2: State Comparison** ✅
- Compared current branch vs upstream state
- Result: All 16 files BEHIND upstream (HIGH PRIORITY)
- Runtime: ~1 minute

**Phase 3: Branch-Aware Analysis** ✅
- Generated detailed commit analysis per branch
- Critical Discovery: **Upstream branches are NOT merged into each other**
- Result: 4 output files with 673 commits analyzed
- Runtime: ~2 minutes

### Critical Discovery: Branch Separation

**Three separate upstream branches identified:**

| Branch | Status | Commits | Risk Level | Latest Activity |
|--------|--------|---------|------------|-----------------||
| `upstream/PRODUCTION` | ✅ Production | 650 | LOW | Nov 8, 2025 |
| `upstream/native_tool_calling` | ⚠️ Feature | 14 | MEDIUM | Nov 10, 2025 |
| `upstream/parallel_tool_calling_and_flow_execution` | ⚠️ Feature | 9 | MEDIUM-HIGH | Nov 2, 2025 |

**Verification**: Branches are NOT merged into each other - each represents a different approach to solving similar problems.

### Decision: Track 1 (PRODUCTION) Selected as Baseline ✅

**Why Track 1**:
- ✅ **Production-Tested**: All 650 commits already deployed and validated in production
- ✅ **Direct Problem Coverage**: Addresses 6 of 7 identified problem areas (86%)
- ✅ **Low Integration Risk**: Cherry-pick compatible, no architectural changes required
- ✅ **Immediate Actionability**: 4 specific high-priority commits identified
- ✅ **Fallback Options**: Track 2/3 available if Track 1 insufficient

**Why Track 2 & 3 Deferred**:
- Track 2: Requires full architectural rewrite (XML → Native tool calling), higher risk
- Track 3: Conflicts with Track 2, not production-tested, last resort only

### Streaming Data Flow Analysis

**Backend Streaming Path**:
```
agent_runs.py (SSE endpoint) 
  ↓
response_processor.py (LLM response handling)
  ↓
Redis pub/sub (message queue)
  ↓
SSE stream to frontend
```

**Frontend Streaming Path**:
```
SSE connection (EventSource)
  ↓
useAgentStream.ts (message parsing, state updates)
  ↓
ThreadComponent.tsx (message array management)
  ↓
ThreadContent.tsx (message grouping, rendering)
  ↓
ShowToolStream.tsx (individual tool display)
```

**Most Active Files (Track 1 Commits)**:
- `ThreadContent.tsx` - 110 commits (Race conditions, dependency arrays)
- `run_agent_background.py` - 62 commits (Error propagation, Redis)
- `run.py` - 57 commits (Tool exceptions, error propagation)
- `useAgentStream.ts` - 35 commits (Multiple frontend issues)
- `thread_manager.py` - 30 commits (Tool exceptions, race conditions)
- `agent_runs.py` - 29 commits (Race conditions, Redis)

## High-Priority Cherry-Pick Candidates (Week 1)

### 4 Commits Identified for Immediate Cherry-Picking

#### 1. **`abadd6a6`** (Nov 3, 2025) - response_processor.py
- **Subject**: "fix string parsing task list bug, add graceful premature llm stoppage"
- **Changes**: 
  - Adds `cancellation_event: Optional[asyncio.Event]` parameter
  - Implements cancellation checks in streaming loop
  - Graceful handling of premature LLM stoppage
- **Addresses**: Problem #2 (Error Propagation), #3 (Race Conditions)
- **Impact**: HIGH - Prevents abrupt stream termination
- **Status**: Ready for cherry-pick

#### 2. **`8b6b16f5`** (Oct 22, 2025) - response_processor.py
- **Subject**: "fix: task list freezing issue - introduce buffer for 5 seconds"
- **Changes**:
  - Adds 5-second drain timeout for XML tool limit
  - Prevents infinite stream draining with max 100 chunks
  - Captures usage data before timeout
- **Addresses**: Problem #6 (Buffer Overflow)
- **Impact**: HIGH - Prevents stream hanging
- **Status**: Ready for cherry-pick

#### 3. **`e56c2873`** (Nov 3, 2025) - response_processor.py
- **Subject**: "fix"
- **Changes**:
  - Don't save partial response if user cancelled
  - Checks `finish_reason != "cancelled"` before saving
- **Addresses**: Problem #3 (Race Conditions)
- **Impact**: MEDIUM - Cleaner cancellation handling
- **Status**: Ready for cherry-pick

#### 4. **`26baa2ee`** (Nov 6, 2025) - useAgentStream.ts
- **Subject**: "cleaning in progress"
- **Changes**: Frontend cleanup and refactoring
- **Addresses**: Problem #4 (Dependency Arrays), #7 (startTransition)
- **Impact**: MEDIUM - Frontend stability improvements
- **Status**: Ready for cherry-pick

**Expected Outcome**: 60-80% of streaming issues resolved with these 4 commits

### Problem Area Coverage (Track 1)

| Problem Area | Priority | Track 1 Coverage | Key Commits |
|--------------|----------|------------------|-------------|
| #1 Tool Exception Swallowing | P1 | ✅ 79 commits | response_processor.py, run.py |
| #2 Missing Error Propagation | P1 | ✅ 62 commits + `abadd6a6` | run_agent_background.py |
| #3 Race Conditions | P2 | ✅ 29 commits + `abadd6a6`, `e56c2873` | agent_runs.py, response_processor.py |
| #4 Dependency Arrays | P2 | ✅ 35 commits + `26baa2ee` | useAgentStream.ts |
| #5 Redis Message Loss | P3 | ✅ 91 commits | run_agent_background.py, agent_runs.py |
| #6 Buffer Overflow | P3 | ✅ `8b6b16f5` (5s timeout) | response_processor.py |
| #7 startTransition Delays | P4 | ⚠️ `26baa2ee` (partial) | useAgentStream.ts |

**Overall Coverage**: 6 of 7 problem areas (86%)

## Research Areas

### 1. React Render Loop Prevention

**Decision**: Implement render guards using useCallback, React.memo, and stable object references, focusing on critical streaming components

**Rationale**: 
- Based on codemap analysis, the main render-heavy components are:
  - `useAgentStream` hook with 16ms throttling (60fps) for content updates
  - `ShowToolStream` component with auto-scroll and debounced updates
  - `ThreadContent` component managing message arrays
- Current system already has some throttling (16ms content updates) but needs optimization
- Incremental refactoring approach minimizes risk compared to architectural rewrites

**Alternatives Considered**:
- **Redux/Zustand global state**: More predictable but adds complexity and migration overhead
- **Custom state machine**: Maximum control but high implementation cost
- **Error boundaries only**: Reactive rather than preventive approach

**Critical Components to Optimize**:
```typescript
// useAgentStream.ts - Already has 16ms throttling, needs render count monitoring
const addContentThrottled = useCallback((content) => {
  pendingContentRef.current.push(content);
  if (!throttleRef.current) {
    throttleRef.current = setTimeout(flushPendingContent, 16); // 60fps
  }
}, [flushPendingContent]);

// ShowToolStream.tsx - Has 100ms scroll debounce, needs React.memo
const ShowToolStream = React.memo(({ content, messageId }) => {
  // Auto-scroll with debouncing already implemented
  const scrollDebounceRef = useRef<NodeJS.Timeout>();
});

// ThreadContent.tsx - Needs message array optimization
const ThreadContent = React.memo(({ messages, streamingTextContent }) => {
  const memoizedMessages = useMemo(() => messages, [messages]);
});
```

### 2. Backend Streaming Architecture Analysis

**Current System**: Redis pub/sub with immediate SSE yield (no batching)

**Key Findings from Codemaps**:
- Backend uses `ResponseProcessor.process_streaming_response()` to handle LLM chunks
- Each content chunk is immediately yielded with 'chunk' status
- Redis pub/sub publishes 'new' notifications for each response
- SSE endpoint (`stream_agent_run`) immediately yields responses as they arrive
- No artificial delays or batching currently implemented

**Decision**: Implement selective batching in ResponseProcessor for content chunks only

**Rationale**:
- Current architecture already optimized for real-time streaming
- Frontend 16ms throttling handles most smoothness issues
- Tool calls and status messages should remain immediate for responsiveness
- Only batch rapid content chunks to reduce frontend render pressure

**Implementation Approach**:
```python
# In ResponseProcessor.process_streaming_response()
class ContentBatcher:
    def __init__(self, batch_size=5, flush_interval=50):  # 50ms for responsiveness
        self.pending_chunks = []
        self.flush_timer = None
        
    async def add_content_chunk(self, chunk_data):
        self.pending_chunks.append(chunk_data)
        if len(self.pending_chunks) >= self.batch_size or not self.flush_timer:
            await self.flush_batch()
            
    async def flush_batch(self):
        if self.pending_chunks:
            # Combine chunks into single yield
            combined_content = ''.join([c['content'] for c in self.pending_chunks])
            yield combined_chunk_response(combined_content)
            self.pending_chunks.clear()
```

### 3. Network Resilience & Timeout Handling

**Decision**: Implement progressive timeout strategy with 10-15 second silence detection and 2-3 linear retries

**Rationale**:
- Balances responsiveness with stability
- Avoids exponential backoff complexity for small user base
- Provides clear user feedback without indefinite waiting

**Alternatives Considered**:
- **Exponential backoff**: Overkill for <10 user private fork
- **Immediate failure**: Poor user experience during temporary network issues
- **Indefinite retries**: Risk of resource leaks and poor UX

**Timeout Strategy**:
```typescript
interface StreamTimeoutConfig {
  silenceThreshold: 15000;  // 15 seconds
  maxRetries: 10
  retryInterval: 5000;      // 5 seconds linear
  keepAliveInterval: 10000// 10 seconds
}
```

### 4. XML/JSON Hybrid Tool Call Handling

**Current System Analysis**: Based on codemaps, Suna has sophisticated tool call processing:

**Backend Processing**:
- `ResponseProcessor._extract_xml_chunks()` parses XML tool calls from streaming content
- `_parse_xml_tool_call()` and `_validate_parsed_tool_call()` handle validation
- Tool execution happens in parallel via `asyncio.create_task()`
- Tool results are persisted to database and streamed to frontend

**Frontend Processing**:
- `ShowToolStream` component handles streaming tool call display
- `extractToolNameFromStream()` parses tool names from XML content
- Auto-scrolling with 100ms debounce for smooth UX
- Tool-specific views via `ToolViewRegistry` (50+ specialized views)

**Decision**: Optimize existing XML parsing with better error boundaries and render performance

**Rationale**:
- Current XML parsing system is already sophisticated and working
- Focus on performance optimization rather than architectural changes
- Add error boundaries around tool rendering components
- Improve streaming display performance for large tool outputs

**Optimization Areas**:
```typescript
// ShowToolStream.tsx - Add React.memo and optimize re-renders
const ShowToolStream = React.memo(({ content, messageId }) => {
  // Memoize expensive parsing operations
  const parsedToolContent = useMemo(() => {
    return extractAndFormatToolContent(content);
  }, [content]);
  
  // Optimize scroll handling (already has 100ms debounce)
  const handleScroll = useMemo(() => 
    debounce((e) => updateScrollState(e), 150), []
  );
});

// Add error boundary around tool displays
<ToolCallErrorBoundary>
  <ShowToolStream content={toolContent} />
</ToolCallErrorBoundary>
```

### 5. Error Boundary Strategy

**Decision**: Minimal error boundaries around known problem areas (tool calls, message rendering)

**Rationale**:
- Surgical approach targets specific render error sources
- Avoids over-engineering for private fork scale
- Maintains debugging visibility while preventing crashes

**Alternatives Considered**:
- **Application-wide error boundary**: Too broad, loses error context
- **No error boundaries**: Allows crashes to propagate
- **Comprehensive error boundary tree**: Over-engineered for current needs

**Boundary Placement**:
```typescript
// Around tool call displays
<ToolCallErrorBoundary>
  <ToolCallDisplay call={toolCall} />
</ToolCallErrorBoundary>

// Around streaming message content
<MessageErrorBoundary>
  <StreamingMessageContent message={message} />
</MessageErrorBoundary>
```

### 6. State Management Patterns

**Decision**: Immutable message objects with stable IDs and incremental updates

**Rationale**:
- Prevents reference equality issues that trigger unnecessary renders
- Stable IDs enable React's reconciliation optimization
- Incremental updates minimize DOM manipulation

**Alternatives Considered**:
- **Mutable updates**: Risk of missed re-renders and stale closures
- **Full message replacement**: Expensive for large conversations
- **Normalized state**: Adds complexity for current scale

**Message Structure**:
```typescript
interface StreamingMessage {
  readonly id: string;           // Stable identifier
  readonly content: string;      // Immutable content
  readonly isStreaming: boolean; // Streaming state
  readonly toolCalls: readonly ToolCall[]; // Immutable arrays
  readonly timestamp: number;    // Creation time
}
```

### 7. Performance Monitoring

**Decision**: Simple render count tracking and console logging for development

**Rationale**:
- Lightweight monitoring sufficient for private fork
- Development-time visibility into render performance
- No production overhead or complex analytics

**Alternatives Considered**:
- **React DevTools Profiler**: Manual process, not automated
- **Performance monitoring service**: Overkill for private fork
- **No monitoring**: Blind to performance regressions

**Monitoring Implementation**:
```typescript
const useRenderCount = (componentName: string) => {
  const renderCount = useRef(0);
  renderCount.current++;
  
  if (renderCount.current > 10) {
    console.warn(`${componentName} rendered ${renderCount.current} times`);
  }
};
```

## Technology Stack Decisions

### Frontend Optimizations
- **React.memo**: Prevent unnecessary component re-renders
- **useCallback/useMemo**: Stable references for props and handlers
- **Immutable updates**: Prevent reference equality issues
- **Error boundaries**: Isolate failures in tool call rendering

### Backend Streaming
- **Redis pub/sub**: Existing infrastructure for real-time messaging
- **FastAPI StreamingResponse**: Native streaming support
- **Token batching**: Reduce frontend update frequency
- **Graceful degradation**: Handle network failures and throttling

### Testing Strategy
- **Manual testing checklist**: Human validation of complex streaming behavior
- **Browser console monitoring**: Development-time render tracking
- **Network simulation**: Disconnect/reconnect testing
- **Load simulation**: Multiple concurrent users (up to 10)

## Implementation Priorities

Based on upstream research and problem area analysis:

### Week 1: Track 1 Cherry-Picks (IMMEDIATE)

**Phase 1: High-Priority Commits**
1. Cherry-pick `abadd6a6` - Cancellation event + graceful stoppage
2. Cherry-pick `8b6b16f5` - 5-second drain timeout
3. Cherry-pick `e56c2873` - Don't save cancelled responses
4. Cherry-pick `26baa2ee` - Frontend cleanup

**Testing Strategy**:
- Test each commit individually in isolated branch
- Verify streaming behavior with tool execution
- Validate cancellation handling
- Check buffer overflow scenarios
- Confirm frontend stability

**Expected Outcome**: 60-80% of streaming issues resolved

### Week 2: Evaluation & Additional Cherry-Picks

**Evaluate Results**:
- Review remaining issues
- Identify additional relevant commits from Track 1
- Cherry-pick secondary priority commits if needed

**Decision Point**:
- ✅ If 80%+ problems solved → Done, close spec
- ⚠️ If significant issues remain → Proceed to Track 2 evaluation

### Week 3+: Track 2 Evaluation (If Needed)

**Only if Track 1 insufficient**:
1. Deep dive into native tool calling approach
2. Evaluate full branch merge vs selective adaptation
3. Plan comprehensive testing strategy
4. Consider long-term architectural benefits

---

### Original Implementation Plan (Backup if Track 1 Insufficient)

Based on codemap analysis and upstream parity constraints:

0. **Phase 0**: Baseline analysis & cherry-pick strategy (CRITICAL FIRST STEP)
   - Generate comprehensive diff between `dev` and `feature/malformed-tool-call-handler`
   - Categorize changes by risk level
   - Carefully review core rendering components for any changes
   - Cherry-pick only safe, isolated improvements
   - Document all decisions in `CHERRY_PICK_LOG.md`
   - Validate baseline after cherry-picks
   - **Upstream Impact**: Establishes clean baseline for implementation

1. **Phase 1**: Frontend render optimization (highest impact)
   - Add React.memo to `ShowToolStream`, `ThreadContent` components
   - Optimize `useAgentStream` hook render counting
   - Memoize expensive operations in tool parsing
   - **Upstream Impact**: None (frontend-only changes)

2. **Phase 2**: Backend streaming optimization (internal only)
   - Implement internal content buffering in `ResponseProcessor`
   - NO new message types, NO API changes
   - Buffer small chunks before yielding to Redis
   - Target 50ms buffer intervals for responsiveness
   - **Upstream Impact**: None (internal refactoring only)

3. **Phase 3**: Error boundaries around critical components
   - `ShowToolStream` component (tool call rendering)
   - `ThreadContent` component (message list rendering)
   - Tool-specific views in `ToolViewRegistry`
   - **Upstream Impact**: None (new React components)

4. **Phase 4**: Custom debug endpoints (isolated)
   - `/render-performance/metrics` - Frontend render monitoring
   - `/debug/streaming-events` - Streaming troubleshooting
   - Useful for debugging without affecting core streaming
   - **Upstream Impact**: Minimal (isolated debug endpoints)

5. **Phase 5**: Network resilience improvements
   - Enhance existing 30s keepalive in SSE endpoint
   - Add reconnection logic to `useAgentStream`
   - Improve timeout handling in EventSource connections
   - **Upstream Impact**: None (internal logic only)

6. **Phase 6**: Testing and validation
   - Manual testing checklist execution
   - Performance regression testing
   - Tool call stress testing with large outputs
   - **Upstream Impact**: None (testing only)

## Risk Mitigation

- **Incremental approach**: Small changes reduce regression risk
- **Manual testing**: Human validation catches complex interaction issues
- **Error boundaries**: Prevent cascading failures
- **Graceful degradation**: System remains functional during partial failures
- **Rollback plan**: Git branch allows easy reversion if issues arise
- **Phase 0 baseline**: Careful cherry-pick strategy prevents introducing experimental code

## Key Learnings from Upstream Research

### Research Methodology

**✅ What Worked**:
- Three-phase approach efficiently narrowed 20 files → 16 → 4 priority commits
- Branch-aware analysis prevented mixing incompatible approaches
- Automated scripts saved days of manual git archaeology
- Relevance scoring helped prioritize commits

**📝 Lessons Learned**:
- Upstream branches may not be merged - always verify
- Production branches are safer starting points than feature branches
- Commit message quality varies - need to review diffs, not just subjects
- Some "fixes" are actually architectural rewrites in disguise

### Technical Discoveries

**Cancellation Handling** (`abadd6a6`):
- Production code now supports graceful cancellation via `cancellation_event`
- Prevents abrupt stream termination
- Directly addresses Problem #2 and #3

**Buffer Management** (`8b6b16f5`):
- 5-second timeout prevents infinite stream draining
- Max 100 chunks limit prevents memory issues
- Directly addresses Problem #6

**Tool System Evolution**:
- Track 2 represents fundamental shift: XML → Native tool calling
- Track 3 enhances XML with flow control
- Both approaches valid but mutually exclusive

## Summary

This research document establishes the technical foundation for the stable rendering feature:

**Core Problems Addressed**:
- React "Maximum update depth exceeded" errors from excessive re-renders
- Streaming interruptions due to high-frequency frontend updates
- Malformed tool call handling without UI crashes
- Network resilience during throttling scenarios
- Error propagation and race conditions in streaming
- Buffer overflow and Redis message loss

**Key Technical Decisions**:
1. **Track 1 (PRODUCTION) Selected**: 650 production-tested commits available
2. **4 High-Priority Commits Identified**: Ready for immediate cherry-picking
3. **86% Problem Coverage**: 6 of 7 problem areas directly addressed
4. **Low-Risk Approach**: Cherry-pick compatible, no architectural changes required
5. **Clear Escalation Path**: Track 2/3 available if Track 1 insufficient

**Implementation Strategy**:
- **Week 1**: Cherry-pick 4 high-priority commits from Track 1
- **Week 2**: Evaluate results, cherry-pick additional commits if needed
- **Week 3+**: Escalate to Track 2 only if Track 1 insufficient
- Maintain upstream parity by using production-tested commits
- Use manual testing for complex streaming behavior validation

**Success Criteria**:
- ✅ All 4 high-priority commits successfully cherry-picked
- ✅ No merge conflicts or build errors
- ✅ Existing tests pass
- ✅ At least 60% of streaming issues resolved
- 🎯 80%+ of streaming issues resolved (stretch goal)
- 🎯 All P1 and P2 problems addressed (stretch goal)
- 🎯 No new bugs introduced (stretch goal)
