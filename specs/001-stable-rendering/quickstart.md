# Quickstart: Stable Rendering & Streaming Implementation

**Feature**: 001-stable-rendering | **Date**: 2025-11-13

## Overview

This guide provides step-by-step instructions for implementing the stable rendering and streaming optimizations in Suna. Follow the phases in order to minimize risk and validate improvements incrementally.

## Prerequisites

- Suna development environment set up
- `001-stable-rendering` branch created and checked out (direct copy of `dev`)
- `feature/malformed-tool-call-handler` branch available for comparison
- Backend and frontend development servers running
- Access to browser developer tools for monitoring
- Git knowledge for cherry-picking commits

## Phase 0: Baseline Analysis & Cherry-Pick Strategy

**CRITICAL FIRST STEP**: Establish a clean baseline by selectively integrating improvements from `feature/malformed-tool-call-handler`.

### Step 0.1: Generate Diff Summary

```bash
# View statistics of changes
git diff dev feature/malformed-tool-call-handler --stat

# Generate full diff for detailed review
git diff dev feature/malformed-tool-call-handler > malformed-handler-diff.patch

# View commits on the branch
git log dev..feature/malformed-tool-call-handler --oneline
```

### Step 0.2: Categorize and Review Changes

**Review each changed file against these categories**:

**SAFE TO CHERRY-PICK** (Low risk):
- Bug fixes in utility files, configuration, documentation
- Tool-related improvements (not core rendering)
- Helper functions and non-streaming utilities

**REVIEW CAREFULLY** (Medium risk):
- Changes to `response_processor.py` (understand the fix deeply)
- Changes to `thread_manager.py` (state management)
- Backend optimizations (test thoroughly)

**SKIP/REJECT** (High risk - implement separately):
- Refactoring of `ThreadContent.tsx`, `ShowToolStream.tsx`, `ThreadComponent.tsx`
- Changes to `useAgentStream.ts` hook implementation
- New message types or streaming protocol changes
- Large refactorings of core rendering logic

### Step 0.3: Cherry-Pick Approved Changes

```bash
# Create temporary branch for testing
git checkout -b temp-cherry-pick

# For each approved commit
git cherry-pick <commit-hash>

# If conflicts occur
git diff --ours   # See our version
git diff --theirs # See their version
# Resolve conflicts manually
git add <file>
git cherry-pick --continue

# Test after each cherry-pick
npm run dev        # Frontend
python -m uvicorn backend.main:app --reload  # Backend
```

### Step 0.4: Document Decisions

Create `CHERRY_PICK_LOG.md` in the feature branch:

```markdown
# Cherry-Pick Analysis: feature/malformed-tool-call-handler → 001-stable-rendering

## Approved Cherry-Picks
- [x] Commit ABC123 - Description
- [x] Commit DEF456 - Description

## Rejected Changes
- [ ] Commit GHI789 - Reason for rejection

## Notes
- List any conflicts resolved
- Document why risky files were skipped
```

### Step 0.5: Validate Baseline

After cherry-picks:

1. **Functional Test**:
   - Start a conversation
   - Verify streaming works smoothly
   - Trigger tool calls
   - Check browser console for errors

2. **Regression Test**:
   - Compare with `dev` branch behavior
   - Verify no new render errors
   - Check performance hasn't degraded

3. **Commit Strategy**:
   - Keep cherry-picked commits as-is
   - Add new commits for conflict resolutions
   - Push to `001-stable-rendering` branch

## Phase 1: Frontend Render Optimization (High Impact)

### Step 1.1: Add React.memo to Critical Components

**File**: `frontend/src/components/thread/content/ShowToolStream.tsx`

```typescript
// Add React.memo wrapper
export const ShowToolStream = React.memo<ShowToolStreamProps>(({
  content,
  messageId,
  onToolClick
}) => {
  // Existing component logic...
  
  // Add render count monitoring
  const renderCount = useRef(0);
  renderCount.current++;
  
  if (renderCount.current > 10) {
    console.warn(`ShowToolStream rendered ${renderCount.current} times for messageId: ${messageId}`);
  }
  
  // Memoize expensive parsing operations
  const parsedToolContent = useMemo(() => {
    return extractAndFormatToolContent(content);
  }, [content]);
  
  // Rest of component...
});

// Add display name for debugging
ShowToolStream.displayName = 'ShowToolStream';
```

**File**: `frontend/src/components/thread/content/ThreadContent.tsx`

```typescript
// Add React.memo wrapper
export const ThreadContent = React.memo<ThreadContentProps>(({
  messages,
  streamingTextContent,
  ...otherProps
}) => {
  // Add render monitoring
  const renderCount = useRef(0);
  renderCount.current++;
  
  if (renderCount.current > 15) {
    console.warn(`ThreadContent rendered ${renderCount.current} times`);
  }
  
  // Memoize message array to prevent unnecessary re-renders
  const memoizedMessages = useMemo(() => messages, [messages]);
  
  // Rest of component logic...
});

ThreadContent.displayName = 'ThreadContent';
```

### Step 1.2: Optimize useAgentStream Hook

**File**: `frontend/src/hooks/useAgentStream.ts`

```typescript
// Add render count tracking to the hook
export const useAgentStream = (/* existing params */) => {
  const renderCount = useRef(0);
  renderCount.current++;
  
  // Monitor excessive renders
  useEffect(() => {
    if (renderCount.current > 20) {
      console.warn(`useAgentStream hook rendered ${renderCount.current} times`);
    }
  });
  
  // Optimize content throttling (existing 16ms throttling is good)
  const flushPendingContent = useCallback(() => {
    if (pendingContentRef.current.length > 0) {
      const newContent = [...pendingContentRef.current];
      pendingContentRef.current = [];
      
      // Batch update for better performance
      setTextContent(prev => ({
        ...prev,
        content: prev.content + newContent.join(''),
        renderVersion: prev.renderVersion + 1
      }));
    }
  }, []);
  
  // Rest of hook logic...
};
```

### Step 1.3: Test Phase 1 Changes

**Manual Testing Checklist**:

1. **Basic Streaming Test**:
   - Start a conversation with a long response
   - Monitor browser console for render warnings
   - Verify smooth streaming without flicker

2. **Tool Call Test**:
   - Trigger a tool call with large output
   - Check `ShowToolStream` render count warnings
   - Verify auto-scroll works smoothly

3. **Rapid Input Test**:
   - Send multiple prompts quickly
   - Monitor `ThreadContent` render warnings
   - Ensure UI remains responsive

**Expected Results**:
- Render count warnings should be reduced by 50%+
- No visible performance degradation
- Streaming should feel smoother

## Phase 2: Backend Streaming Optimization (Internal Only)

### Step 2.1: Optimize ResponseProcessor for Reduced Updates

**File**: `backend/core/agentpress/response_processor.py`

**IMPORTANT**: Make internal optimizations WITHOUT changing the API contract or message types. Focus on:

1. **Reduce unnecessary yields**: Only yield content chunks when they have meaningful content
2. **Batch internally before yielding**: Accumulate small chunks before sending to Redis
3. **No new message types**: Keep existing 'chunk', 'tool_call', 'status' types

```python
# In ResponseProcessor.process_streaming_response()
# Add internal buffering (NOT a new message type)

pending_content = ""
pending_content_timeout = time.time()
CONTENT_BUFFER_SIZE = 5  # Buffer ~5 tokens
CONTENT_BUFFER_TIMEOUT = 0.05  # 50ms

async for chunk in llm_response:
    if delta and hasattr(delta, 'content') and delta.content:
        chunk_content = delta.content
        pending_content += chunk_content
        current_time = time.time()
        
        # Yield buffered content if threshold reached or timeout exceeded
        should_yield = (
            len(pending_content) >= CONTENT_BUFFER_SIZE or
            current_time - pending_content_timeout >= CONTENT_BUFFER_TIMEOUT
        )
        
        if should_yield and pending_content:
            # Yield using EXISTING 'chunk' type - no new types
            yield {
                "sequence": __sequence,
                "message_id": None,
                "thread_id": thread_id,
                "type": "assistant",
                "metadata": {"stream_status": "chunk"},
                "content": pending_content,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            pending_content = ""
            pending_content_timeout = current_time
            __sequence += 1
        
        # Continue with existing tool call processing...
```

**Key Point**: This is an INTERNAL optimization that doesn't change the API. The frontend still receives the same message types and structure.

### Step 2.2: Verify Backward Compatibility

**Testing**:

1. **Protocol Compatibility**:
   - Verify frontend still receives 'assistant', 'tool_call', 'status' types
   - No new message types introduced
   - Existing message handlers work unchanged

2. **Performance Improvement**:
   - Monitor network tab for reduced SSE message frequency
   - Verify content still streams smoothly
   - Check that render counts are reduced

3. **Upstream Sync Safety**:
   - Changes are internal to ResponseProcessor
   - No API endpoints modified
   - No new query parameters added
   - Safe to merge with upstream updates

## Phase 3: Error Boundaries

### Step 3.1: Create Tool Call Error Boundary

**File**: `frontend/src/components/common/ToolCallErrorBoundary.tsx`

```typescript
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  toolCall?: ToolCallData;
  fallback?: ComponentType<{ error: Error }>;
  onError?: (event: ErrorBoundaryEvent) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ToolCallErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ToolCallErrorBoundary caught an error:', error, errorInfo);
    
    // Report error event
    this.props.onError?.({
      component_name: 'ToolCallErrorBoundary',
      error_message: error.message,
      error_stack: error.stack,
      component_stack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      recovery_action: 'fallback'
    });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error!} />;
      }
      
      return (
        <div className="tool-call-error">
          <p>Tool call rendering failed</p>
          <button onClick={() => this.setState({ hasError: false })}>
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### Step 3.2: Wrap Tool Components

**File**: `frontend/src/components/thread/content/ShowToolStream.tsx`

```typescript
// Wrap the component with error boundary
export const SafeShowToolStream: React.FC<ShowToolStreamProps> = (props) => {
  return (
    <ToolCallErrorBoundary
      toolCall={props.toolCall}
      onError={(event) => {
        console.warn('Tool stream error:', event);
        // Could send to monitoring service
      }}
    >
      <ShowToolStream {...props} />
    </ToolCallErrorBoundary>
  );
};
```

## Phase 4: Custom Debug Endpoints

### Step 4.1: Implement Render Performance Metrics Endpoint

**File**: `backend/api/debug.py` (new file)

```python
from fastapi import APIRouter, HTTPException
from datetime import datetime
import logging

router = APIRouter(prefix="/render-performance", tags=["debug"])
logger = logging.getLogger(__name__)

@router.post("/metrics")
async def report_render_metrics(metrics: dict):
    """
    Custom debug endpoint for frontend to report render performance metrics.
    Useful for monitoring excessive renders and component performance.
    """
    try:
        component_name = metrics.get("component_name")
        render_count = metrics.get("render_count")
        
        if render_count > 50:
            logger.warning(
                f"High render count detected: {component_name} rendered {render_count} times",
                extra={
                    "component": component_name,
                    "render_count": render_count,
                    "thread_id": metrics.get("thread_id"),
                    "session_id": metrics.get("session_id")
                }
            )
        
        # Store metrics for analysis (could be sent to monitoring service)
        logger.info(f"Render metrics: {metrics}")
        
        return {"status": "recorded"}
    except Exception as e:
        logger.error(f"Error recording metrics: {str(e)}")
        raise HTTPException(status_code=400, detail="Invalid metrics data")
```

### Step 4.2: Implement Streaming Debug Events Endpoint

**File**: `backend/api/debug.py` (add to existing file)

```python
@router.post("/debug/streaming-events")
async def report_streaming_event(event: dict):
    """
    Custom debug endpoint for frontend to report streaming-related events
    (errors, retries, timeouts) for analysis and troubleshooting.
    """
    try:
        event_type = event.get("event_type")
        thread_id = event.get("thread_id")
        session_id = event.get("session_id")
        
        logger.info(
            f"Streaming event: {event_type}",
            extra={
                "event_type": event_type,
                "thread_id": thread_id,
                "session_id": session_id,
                "retry_count": event.get("retry_count"),
                "error_message": event.get("error_message")
            }
        )
        
        # Track streaming issues for debugging
        if event_type in ["error", "timeout", "malformed_response"]:
            logger.warning(f"Streaming issue detected: {event}")
        
        return {"status": "recorded"}
    except Exception as e:
        logger.error(f"Error recording streaming event: {str(e)}")
        raise HTTPException(status_code=400, detail="Invalid event data")
```

### Step 4.3: Register Debug Routes

**File**: `backend/main.py` or `backend/api/__init__.py`

```python
from backend.api import debug

# Add debug router to FastAPI app
app.include_router(debug.router)
```

## Phase 5: Network Resilience

### Step 5.1: Enhance Timeout Configuration

**File**: `frontend/src/hooks/useAgentStream.ts`

```typescript
const STREAM_CONFIG = {
  silenceThreshold: 15000,    // 15 seconds
  maxRetries: 10,             // Updated from research
  retryInterval: 5000,        // 5 seconds linear
  keepAliveInterval: 10000    // 10 seconds (updated)
};

// Add reconnection logic
const handleStreamError = useCallback(() => {
  setRetryCount(prev => {
    const newCount = prev + 1;
    
    if (newCount <= STREAM_CONFIG.maxRetries) {
      console.log(`Stream error, retrying ${newCount}/${STREAM_CONFIG.maxRetries}`);
      
      // Retry after interval
      setTimeout(() => {
        if (currentRunId) {
          streamAgent(currentRunId, callbacks);
        }
      }, STREAM_CONFIG.retryInterval);
    } else {
      console.error('Max retries exceeded, stream failed');
      setStreamStatus('failed');
    }
    
    return newCount;
  });
}, [currentRunId, callbacks]);
```

## Phase 5: Performance Monitoring

### Step 5.1: Add Render Count Hook

**File**: `frontend/src/hooks/useRenderCount.ts`

```typescript
export const useRenderCount = (componentName: string, threshold = 10) => {
  const renderCount = useRef(0);
  const startTime = useRef(Date.now());
  
  renderCount.current++;
  
  useEffect(() => {
    if (renderCount.current > threshold) {
      const duration = Date.now() - startTime.current;
      console.warn(`${componentName} rendered ${renderCount.current} times in ${duration}ms`);
      
      // Could send metrics to backend
      // reportRenderMetrics({ componentName, renderCount: renderCount.current, duration });
    }
  });
  
  return renderCount.current;
};
```

## Testing and Validation

### Manual Testing Checklist

**Basic Functionality**:
- [ ] Streaming works without interruption
- [ ] Tool calls display correctly
- [ ] No React errors in console
- [ ] UI remains responsive during heavy streaming

**Performance Tests**:
- [ ] Render count warnings reduced by 50%+
- [ ] Streaming latency under 100ms
- [ ] No visible flicker or jank
- [ ] Memory usage stable during long conversations

**Error Handling**:
- [ ] Error boundaries catch tool rendering errors
- [ ] Network disconnection handled gracefully
- [ ] Retry logic works correctly
- [ ] Malformed tool calls don't crash UI

**Stress Tests**:
- [ ] Multiple rapid prompts
- [ ] Very long tool outputs
- [ ] Network interruptions during streaming
- [ ] Multiple concurrent users (up to 10)

### Performance Metrics to Monitor

1. **Render Counts**: Should be reduced by 50%+ for critical components
2. **Streaming Latency**: Target <100ms token display
3. **Memory Usage**: Should remain stable during long sessions
4. **Error Rate**: Zero "Maximum update depth exceeded" errors
5. **User Experience**: Smooth streaming without visible performance issues

## Rollback Plan

If issues arise:

1. **Immediate Rollback**: Switch back to `dev` branch
2. **Partial Rollback**: Disable specific optimizations via feature flags
3. **Debug Mode**: Enable verbose logging to identify issues
4. **Performance Comparison**: Use browser dev tools to compare before/after

## Implementation Workflow Summary

**Phase Sequence**:
1. **Phase 0**: Baseline analysis & cherry-pick (establish clean foundation)
2. **Phase 1**: Frontend render optimization (React.memo, memoization)
3. **Phase 2**: Backend streaming optimization (internal buffering)
4. **Phase 3**: Error boundaries (tool call rendering safety)
5. **Phase 4**: Custom debug endpoints (monitoring & troubleshooting)
6. **Phase 5**: Network resilience (timeout handling, reconnection)
7. **Phase 6**: Testing and validation (manual checklist execution)

**Key Principles**:
- ✅ Maintain upstream parity (no API changes, no new message types)
- ✅ Incremental validation after each phase
- ✅ Manual testing for complex streaming behavior
- ✅ Careful review of core rendering components
- ✅ Document all cherry-pick decisions in Phase 0

## Next Steps

After successful implementation:

1. **Monitor Production**: Watch for performance improvements
2. **Gather Feedback**: User experience validation
3. **Iterate**: Fine-tune batch sizes and thresholds
4. **Document**: Update team knowledge base with learnings
