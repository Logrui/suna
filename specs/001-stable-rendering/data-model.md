# Data Model: Stable Rendering & Streaming

**Feature**: 001-stable-rendering | **Date**: 2025-11-13

**Note**: This data model describes the logical entities and state management patterns for the stable rendering implementation. Phase 0 (baseline cherry-pick) will establish the foundation, then Phases 1-6 will implement these optimizations incrementally.

## Core Entities

### StreamingSession

Tracks the active streaming session state and metadata.

**Fields**:
- `id: string` - Unique session identifier (UUID)
- `threadId: string` - Associated conversation thread ID
- `status: 'connecting' | 'streaming' | 'paused' | 'completed' | 'failed'` - Current session state
- `startTimestamp: number` - Session start time (Unix timestamp)
- `lastTokenTimestamp: number` - Last received token timestamp
- `backendId: string` - Backend service identifier
- `throttlingFlag: boolean` - Whether backend is currently throttling
- `retryCount: number` - Number of retry attempts (0-10, updated from research)
- `batchSize: number` - Current token batching size
- `totalTokens: number` - Total tokens received in session
- `keepAliveInterval: number` - Keepalive interval (10000ms, updated from research)

**Relationships**:
- Belongs to one `MessageThread`
- Has many `StreamBatch` records

**Validation Rules**:
- `retryCount` must be between 0 and 10 (updated from research)
- `status` transitions: connecting → streaming → (paused ↔ streaming) → completed/failed
- `lastTokenTimestamp` must be >= `startTimestamp`
- `batchSize` must be between 1 and 50
- `keepAliveInterval` must be >= 5000ms

**State Transitions**:
```
connecting → streaming (first token received)
streaming → paused (backend throttling detected)
paused → streaming (throttling resolved)
streaming → completed (stream end signal)
streaming → failed (timeout or error after 10 retries)
connecting → failed (connection timeout)
```

### MessageThread

Represents a conversation thread with incremental message updates.

**Fields**:
- `id: string` - Stable thread identifier
- `messages: readonly StreamingMessage[]` - Immutable message array
- `activeStreamId: string | null` - Currently active streaming session ID
- `lastUpdateTimestamp: number` - Last thread modification time
- `renderCount: number` - Total render count for monitoring
- `isStreaming: boolean` - Whether thread has active streaming
- `maxRenderThreshold: number` - Warning threshold for excessive renders (default: 100)

**Relationships**:
- Has many `StreamingMessage` records
- Has zero or one active `StreamingSession`

**Validation Rules**:
- Messages must be ordered by timestamp
- Only one active stream per thread
- `renderCount` should not exceed `maxRenderThreshold` per minute (performance warning)
- Message array must be immutable (new array on updates)

### StreamingMessage

Immutable message object with stable identity and streaming state.

**Fields**:
- `id: string` - Stable message identifier (UUID)
- `threadId: string` - Parent thread identifier
- `content: string` - Message content (immutable)
- `isStreaming: boolean` - Whether message is currently streaming
- `isComplete: boolean` - Whether message streaming is finished
- `timestamp: number` - Message creation timestamp
- `toolCalls: readonly ToolCallRecord[]` - Associated tool calls (immutable array)
- `renderVersion: number` - Incremental version for React reconciliation
- `contentLength: number` - Character count for performance monitoring
- `streamingChunks: readonly string[]` - Individual streaming chunks for replay

**Relationships**:
- Belongs to one `MessageThread`
- Has many `ToolCallRecord` records

**Validation Rules**:
- `content` is immutable once set
- `isStreaming` and `isComplete` are mutually exclusive when both true
- `toolCalls` array is immutable (new array on updates)
- `renderVersion` increments on each content update
- `streamingChunks` preserves original streaming sequence

### ToolCallRecord

Captures tool invocation data with malformed call handling.

**Fields**:
- `id: string` - Unique tool call identifier
- `messageId: string` - Parent message identifier
- `name: string` - Tool function name
- `arguments: object` - Tool arguments (JSON)
- `status: 'started' | 'running' | 'completed' | 'failed' | 'malformed'` - Execution status
- `result: object | null` - Tool execution result
- `error: string | null` - Error message if failed
- `startTimestamp: number` - Tool call start time
- `endTimestamp: number | null` - Tool call completion time
- `isMalformed: boolean` - Whether XML parsing detected malformation
- `malformationDetails: object | null` - Details about parsing issues
- `renderSafe: boolean` - Whether safe to render without error boundary

**Relationships**:
- Belongs to one `StreamingMessage`
- May have one `ToolCallErrorBoundary` wrapper

**Validation Rules**:
- `name` must match registered tool in ToolViewRegistry
- `arguments` must be valid JSON object
- `endTimestamp` must be >= `startTimestamp` when set
- `malformationDetails` required when `isMalformed` is true
- `renderSafe` defaults to false for unknown tools

**State Transitions**:
```
started → running (execution begins)
running → completed (successful execution)
running → failed (execution error)
started → malformed (XML parsing failed)
malformed → failed (cannot recover)
```

### RenderGuard

Tracks component render counts and prevents excessive re-renders.

**Fields**:
- `componentName: string` - React component name
- `renderCount: number` - Current render count
- `lastRenderTimestamp: number` - Last render timestamp
- `renderHistory: number[]` - Recent render timestamps (sliding window)
- `warningThreshold: number` - Render count threshold for warnings (default: 10)
- `errorThreshold: number` - Render count threshold for errors (default: 50)
- `isThrottled: boolean` - Whether component is currently throttled

**Validation Rules**:
- `renderCount` resets every minute
- `renderHistory` maintains last 100 render timestamps
- `warningThreshold` must be < `errorThreshold`
- Throttling activates when `errorThreshold` exceeded

**Methods**:
- `incrementRender()` - Records new render event
- `shouldThrottle()` - Returns true if component should throttle renders
- `reset()` - Resets counters (called on component unmount)

### StreamBatch

Groups streaming tokens into batches to reduce frontend update frequency.

**Fields**:
- `id: string` - Unique batch identifier
- `sessionId: string` - Parent streaming session ID
- `tokens: readonly string[]` - Batched tokens
- `batchSize: number` - Number of tokens in batch
- `flushTimestamp: number` - When batch was flushed to frontend
- `flushInterval: number` - Target flush interval (50ms from research)
- `contentLength: number` - Total character count in batch

**Relationships**:
- Belongs to one `StreamingSession`

**Validation Rules**:
- `tokens` array is immutable
- `batchSize` must equal `tokens.length`
- `flushInterval` must be between 16ms and 200ms
- `contentLength` must equal sum of token lengths

## Data Flow Patterns

### Streaming Message Update Flow

```typescript
interface MessageUpdateFlow {
  // 1. New streaming chunk arrives
  incomingChunk: string;
  
  // 2. Update message with new content (immutable)
  updatedMessage: StreamingMessage = {
    ...currentMessage,
    content: currentMessage.content + incomingChunk,
    renderVersion: currentMessage.renderVersion + 1,
    streamingChunks: [...currentMessage.streamingChunks, incomingChunk]
  };
  
  // 3. Update thread with new message array (immutable)
  updatedThread: MessageThread = {
    ...currentThread,
    messages: currentThread.messages.map(msg => 
      msg.id === updatedMessage.id ? updatedMessage : msg
    ),
    lastUpdateTimestamp: Date.now(),
    renderCount: currentThread.renderCount + 1
  };
}
```

### Tool Call Processing Flow

```typescript
interface ToolCallFlow {
  // 1. XML tool call detected in stream
  xmlContent: string;
  
  // 2. Parse and validate tool call
  toolCall: ToolCallRecord = {
    id: generateId(),
    name: extractToolName(xmlContent),
    arguments: parseToolArguments(xmlContent),
    status: 'started',
    isMalformed: false,
    renderSafe: isKnownTool(toolName)
  };
  
  // 3. Execute tool (backend)
  // 4. Update with result
  completedToolCall: ToolCallRecord = {
    ...toolCall,
    status: 'completed',
    result: executionResult,
    endTimestamp: Date.now()
  };
}
```

### Render Guard Integration

```typescript
interface RenderGuardFlow {
  // 1. Component render begins
  renderGuard.incrementRender();
  
  // 2. Check if throttling needed
  if (renderGuard.shouldThrottle()) {
    // Skip expensive operations
    return memoizedResult;
  }
  
  // 3. Proceed with full render
  return fullRenderResult;
}
```

## Performance Considerations

### Memory Management

- **Immutable Updates**: All message and thread updates create new objects to prevent reference issues
- **Chunk History**: `streamingChunks` array allows replay but may grow large for long responses
- **Render History**: `renderHistory` arrays use sliding windows to prevent memory leaks
- **Tool Call Results**: Large tool results should be paginated or truncated for display

### Render Optimization

- **Stable IDs**: All entities use stable string IDs for React key props
- **Version Numbers**: `renderVersion` enables efficient React reconciliation
- **Memoization Keys**: Immutable objects provide reliable memoization dependencies
- **Batch Updates**: `StreamBatch` reduces frontend update frequency

### Error Recovery

- **Malformed Tool Calls**: Tracked separately to prevent UI crashes
- **Render Guards**: Automatic throttling prevents infinite render loops
- **Error Boundaries**: Isolate failures to specific components
- **State Rollback**: Immutable updates enable easy state rollback on errors
