# Research: Stable Rendering & Streaming

**Feature**: 001-stable-rendering | **Date**: 2025-11-13 | **Updated**: 2025-11-14

## Overview

This research document addresses the technical decisions and implementation approaches for creating a stable streaming system in Suna that eliminates React render loops while maintaining real-time responsiveness.

## Phase 0 Findings (2025-11-14)

**⚠️ CRITICAL DISCOVERY**: After implementing Phase 0 cherry-picked optimizations (memoization, deep equality checks, error handling), the message stream is still failing. This confirms:

1. **Root cause is NOT in f01c371f changes** - The commit only had malformed error handling, no backend batching
2. **Baseline architecture has streaming issues** - The problem exists in the current `22a36feb` baseline
3. **Comprehensive analysis required** - Need full file-by-file streaming flow analysis before Phase 1

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
1. Where do render loops originate? (useAgentStream deps? ThreadContent re-renders?)
2. How should message batching work? (Backend throttling? Frontend debouncing?)
3. Which components need React.memo? (ShowToolStream? ThreadContent?)
4. What backend throttling is required? (50ms batching? 100ms?)
5. Are there stale closures in useAgentStream? (Dependency array issues?)
6. Is Redis pub/sub causing message spam? (Too many events?)

**Files Requiring Deep Analysis**:
- `backend/core/agentpress/response_processor.py` - Message yielding logic
- `backend/api/routes/agent_runs.py` - SSE endpoint implementation
- `frontend/src/hooks/useAgentStream.ts` - State management and updates
- `frontend/src/components/thread/ThreadComponent.tsx` - Message array handling
- `frontend/src/components/thread/content/ThreadContent.tsx` - Rendering logic

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

## Summary

This research document establishes the technical foundation for the stable rendering feature:

**Core Problems Addressed**:
- React "Maximum update depth exceeded" errors from excessive re-renders
- Streaming interruptions due to high-frequency frontend updates
- Malformed tool call handling without UI crashes
- Network resilience during throttling scenarios

**Key Technical Decisions**:
1. Frontend render optimization via React.memo and memoization (highest impact, no upstream divergence)
2. Internal backend buffering without API changes (maintains upstream compatibility)
3. Minimal error boundaries on known problem areas (surgical approach)
4. Custom debug endpoints for monitoring (isolated from core streaming)
5. Phase 0 baseline establishment via careful cherry-picking (safe integration of improvements)

**Implementation Strategy**:
- Start with Phase 0 baseline analysis to establish clean foundation
- Proceed incrementally through Phases 1-6 with testing after each phase
- Maintain upstream parity by avoiding API changes and new message types
- Use manual testing for complex streaming behavior validation

**Success Criteria**:
- Zero "Maximum update depth exceeded" errors
- Streaming latency <100ms
- Render count reduced by 50%+ for critical components
- Graceful handling of network failures and malformed responses
- Upstream sync-safe implementation
