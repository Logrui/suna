# Streaming Architecture Codemap Analysis

**Feature**: 001-stable-rendering | **Date**: 2025-11-14

## Prompt: Generate End-to-End Streaming Architecture Codemap

**Objective**: Create a detailed, file-by-file codemap that traces the complete streaming data flow from LLM response generation through backend processing, Redis pub/sub, SSE transmission, frontend reception, state management, and final UI rendering.

**Context**: 
- Working on `001-stable-rendering` branch (baseline commit `22a36feb`)
- Message streaming is currently failing after Phase 0 optimizations
- Need to identify if issue originates in backend (message generation/Redis) or frontend (receiving/rendering)
- Tech stack: FastAPI backend, Redis pub/sub, SSE, React 18, Next.js App Router, TypeScript

**Required Analysis**:

### 1. Backend Streaming Flow
Trace the complete path from LLM response to SSE output:

**Files to analyze**:
- `backend/api/routes/agent_runs.py` - SSE endpoint that streams to frontend
- `backend/core/agentpress/response_processor.py` - Processes LLM responses, yields messages
- `backend/core/agentpress/thread_manager.py` - Manages thread execution
- Redis pub/sub configuration - Message queue between backend components

**For each file, document**:
1. Entry point and trigger conditions
2. Message yielding logic (how often? what triggers yield?)
3. Message format and structure
4. Any throttling, batching, or rate limiting
5. Redis pub/sub publish calls
6. SSE event emission logic
7. Error handling and edge cases

**Key questions to answer**:
- How many messages are yielded per LLM token/chunk?
- Is there backend throttling? (50ms? 100ms? None?)
- Does Redis pub/sub batch messages or send individually?
- Are there any feedback loops or recursive yields?

### 2. Frontend Streaming Flow
Trace from SSE connection through React state updates to DOM rendering:

**Files to analyze**:
- `frontend/src/hooks/useAgentStream.ts` - Core streaming hook, message parsing, state management
- `frontend/src/components/thread/ThreadComponent.tsx` - Message array management, callback definitions
- `frontend/src/components/thread/content/ThreadContent.tsx` - Message grouping, rendering logic
- `frontend/src/components/thread/content/ShowToolStream.tsx` - Individual tool display component

**For each file, document**:
1. EventSource/SSE connection setup
2. Message parsing and transformation logic
3. State update calls (useState, setState)
4. useEffect dependencies and triggers
5. useCallback/useMemo usage and dependencies
6. Component re-render triggers
7. Child component props and prop changes

**Key questions to answer**:
- How many state updates per SSE message?
- Are there dependency array issues causing extra renders?
- Do components re-render on every message?
- Are there stale closures capturing old state?
- Is there a render cascade (parent → child → grandchild)?

### 3. Critical Interaction Points
Identify where backend and frontend interact:

**Document**:
1. SSE endpoint URL and connection parameters
2. Message format contract (JSON structure, required fields)
3. Event types and their handlers
4. Connection lifecycle (open, message, error, close)
5. Reconnection logic and retry behavior
6. Error propagation from backend to frontend

### 4. State Management Flow
Map all state updates and their propagation:

**Document**:
1. All useState/useReducer calls in streaming components
2. State update frequency (per token? per message? batched?)
3. State dependencies between components
4. Props drilling and prop change propagation
5. Context providers and consumers (if any)
6. Redux/Zustand stores (if used for streaming)

### 5. Render Cycle Analysis
Identify all render triggers:

**Document**:
1. Component render count per message
2. What triggers each render (state change? prop change? parent render?)
3. Are renders necessary or redundant?
4. React.memo usage and effectiveness
5. useMemo/useCallback usage and cache hit rate
6. Dependency arrays completeness and correctness

### 6. Performance Bottlenecks
Identify potential problem areas:

**Look for**:
1. Synchronous operations in render path
2. Large object comparisons or deep equality checks
3. Array operations (map, filter, reduce) on large datasets
4. DOM manipulation or layout thrashing
5. Missing memoization on expensive computations
6. Over-specified or under-specified dependency arrays

### Output Format

For each file analyzed, provide:

```markdown
## File: [path/to/file]

**Purpose**: [Brief description]

**Entry Points**:
- [Function/hook name]: [When it's called]

**Data Flow**:
1. Input: [What data comes in]
2. Processing: [What happens to it]
3. Output: [What data goes out]

**State Updates**:
- [State variable]: Updated [frequency] by [trigger]

**Render Triggers**:
- [What causes this component to re-render]

**Dependencies**:
- Depends on: [Other files/components]
- Used by: [Other files/components]

**Potential Issues**:
- ⚠️ [Any red flags or concerns]

**Message Flow**:
[Trace a single message through this file]
```

### Deliverable

Create a comprehensive markdown document that:
1. Maps the complete streaming flow from backend to frontend
2. Identifies all state updates and render triggers
3. Highlights potential bottlenecks or issues
4. Answers the key question: **Is this a backend issue (too many messages) or frontend issue (too many renders)?**
5. Provides specific recommendations for where to implement fixes
