# Feature Specification: Stable Rendering & Streaming

**Feature**: 001-stable-rendering | **Date**: 2025-11-13  
**Branch**: `001-stable-rendering` | **Baseline Commit**: `22a36feb` (2025-11-13 00:44:22) from `feature/workflows-restoration` | **Status**: Ready for Implementation: "Cherry-pick carefully from `feature/workflows-restoration` baseline to establish stable rendering and eliminate render-loop errors (especially React's maximum depth issue)."

**Implementation Approach**: 
1. **Phase 0** (Baseline): Diff and cherry-pick safe improvements from `feature/malformed-tool-call-handler` (see plan.md) ✅ COMPLETE
2. **Phase 0.5** (Upstream Research): Root cause analysis of 7 identified problem areas + discovery of production-tested solutions in upstream branches ✅ COMPLETE (2025-11-14)
3. **Phases 1-7** (Improvements): Cherry-pick 4 production-tested commits (Phase 1), evaluate results (Phase 2), then implement error boundaries (Phase 3), debug endpoints (Phase 4), network resilience (Phase 5), comprehensive testing (Phase 6), and polish (Phase 7)

## Clarifications

### Session 2025-11-13

- Q: How should the UI behave when the backend throttles an active stream? → A: Keep the UI pulsing/animating as live, extend frontend timeouts/retries before declaring the conversation stopped, and favor batched streaming payloads to reduce constant high-frequency updates.
- Q: What specific timeout values should the frontend use before declaring a stream "stopped" during throttling scenarios? → A: 10-15 seconds with linear retry intervals - UI should be fast and responsive, constantly checking for streams, but after 10-15 seconds of pure silence, wait 2-3 times before timing out the stream.
- Q: How should the system handle the "Maximum update depth exceeded" React error when it occurs? → A: Minimal effort guards and error boundaries on commonly known sources like tool call displays. Primary solution is backend batching/throttling to prevent spamming the frontend rather than complex frontend handling.
- Q: When selectively merging features from `feature/malformed-tool-call-handler`, what criteria should determine if a feature is "safe" to include? → A: Include any feature that doesn't directly touch React state management or streaming logic. For changes affecting thread component rendering or related frontend systems, manually review each file to identify code blocks that could cause flickering issues and exclude them, especially experimental frontend throttling mechanisms.
- Q: What are the target performance benchmarks for the streaming system in terms of concurrent users and message throughput? → A: 10-25 concurrent users, 500 messages/hour per user - this is a private fork with less than 10 concurrent users.
- Q: What specific data structures and state management patterns should the streaming system use to prevent the render loop issues? → A: Immutable message objects with stable IDs, useCallback for handlers, React.memo for components. Review current implementation and refactor render-heavy issues without giant refactor.
- Q: What are the critical failure scenarios that could break the streaming system and need explicit handling? → A: All failure modes with graceful degradation - network disconnection/reconnection, malformed streaming responses, concurrent streams/rapid inputs, plus safely handling extremely long and complex tool calls in Suna's XML/JSON hybrid format.
- Q: What specific testing strategy should be used to validate the stable rendering across different conversation scenarios? → A: Manual testing with a checklist of conversation types and tool call scenarios - automation is difficult for this complex UI behavior, requires human browser testing.

### Session 2025-11-14 - Phase 0.5 Investigation

**Context**: After Phase 0 completion, streaming still fails. Deep-dive code analysis identified 7 critical problem areas requiring investigation before proceeding with optimization phases.

- Q: What is the root cause of streaming failures? → A: Under investigation - could be backend (tool exception swallowing, error propagation), frontend (dependency arrays, startTransition delays), or both (race conditions, Redis message loss). Phase 0.5 uses iterative testing to identify root cause.
- Q: Should we proceed with Phase 1 frontend optimization before knowing the root cause? → A: No - Phase 1 is blocked until Phase 0.5 completes. Can't optimize rendering if root cause is backend. Risk of wasted effort on wrong layer.
- Q: How do we handle the investigation phase in our workflow? → A: Phase 0.5 is NOT a linear task list - it's discovery and investigation requiring human-in-the-loop decision making. Each problem area goes through: logging → testing → analysis → solution options → human decision → implementation → verification.

## Expected User Experience

### Current State (Before Phase 0.5 Fixes)

**Symptom**: User sends a message, sees initial streaming response, then stream abruptly ends after tool call starts. No error message displayed.

**User Perception**:
- "The AI stopped responding mid-conversation"
- "Tool calls seem to break the chat"
- "I don't know if it's still processing or if it failed"
- Confusion and frustration - no feedback on what went wrong

**Impact**: Complete loss of trust in system reliability. Users cannot complete tasks requiring tool usage.

### Target State (After Phase 0.5 Fixes)

**Expected Behavior**:
1. **Tool Execution Errors**: If a tool fails, user sees inline error message: "Tool execution failed: [error details]" with option to retry or continue conversation
2. **Backend Errors**: If backend crashes, user sees toast notification: "Connection lost. Retrying..." with automatic recovery attempts
3. **Stream Completion**: All messages delivered before completion signal, no lost content
4. **Final Content Rendering**: Last chunks of streaming text always render, never lost due to timing issues
5. **Graceful Degradation**: During network issues, UI shows pulsing animation with "Connecting..." status, maintains state through retries

**User Perception**:
- "The system tells me what's happening"
- "Errors are clear and actionable"
- "I can retry when things fail"
- Confidence that system is working as intended

## Expected Developer Experience

### Current State (Before Phase 0.5 Fixes)

**Symptom**: Developer sees "stream failed" but no clear error in logs. Langfuse has minimal details. Hard to debug.

**Developer Challenges**:
- Silent exceptions in tool execution - no error yielded to stream
- Backend errors not reliably reaching frontend
- Race conditions between completion signal and message delivery
- Callback dependencies causing mid-stream handler loss
- Redis pub/sub messages potentially lost or reordered
- Frontend buffer overflow with no backpressure
- React.startTransition delaying critical final updates

**Debugging Experience**:
- "Where did the exception occur?"
- "Did the error reach Redis? Did it reach the frontend?"
- "Are messages being lost or just delayed?"
- Hours spent adding logging to trace message flow

### Target State (After Phase 0.5 Fixes)

**Expected Capabilities**:
1. **Comprehensive Logging**: Tool execution wrapped in try/except, all exceptions logged and yielded to stream
2. **Error Propagation**: Backend errors reliably pushed to Redis with retry logic, frontend receives and displays all errors
3. **Message Ordering**: Sequence numbers logged, gaps detected, completion waits for message flush
4. **Stable Callbacks**: Critical callbacks use refs to prevent mid-stream recreation
5. **Redis Reliability**: Operations awaited or properly batched with ordering guarantees
6. **Buffer Monitoring**: Frontend buffer warns at capacity, implements backpressure or migrates to backend-only
7. **Render Completion**: Explicit flush before stream finalization, no startTransition delays

**Debugging Experience**:
- Clear error messages with stack traces in logs
- Sequence numbers show exactly which messages were delivered
- Timing logs reveal race conditions
- Buffer warnings indicate overflow before data loss
- "I can see exactly where and why it failed"

### Investigation Workflow (Phase 0.5)

**Developer Process**:
1. **Select Problem Area**: Choose from 7 identified issues based on priority
2. **Add Instrumentation**: Add logging, timing, sequence tracking
3. **Run Tests**: Manual tests with intentionally failing tools, slow networks, rapid inputs
4. **Analyze Results**: Review logs, identify patterns, confirm or rule out hypothesis
5. **Generate Options**: Create 3-5 solution approaches with tradeoffs
6. **Human Decision**: Choose approach based on complexity, performance, maintainability
7. **Implement Fix**: Make targeted changes, avoid over-engineering
8. **Verify Fix**: Test with same scenarios, confirm issue resolved
9. **Document**: Update problem areas doc with findings and chosen solution

**Key Principle**: Iterative discovery, not linear execution. Multiple investigations can run in parallel. Human decisions required at key points.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Uninterrupted streaming (Priority: P1)

A user sends prompts and expects the assistant responses to stream continuously without stalls or recurrence of “Maximum update depth exceeded” errors.

**Why this priority**: Streaming outage is already present in `dev` and prevents any useful experience, so reestablishing it is the central success criteria.

**Independent Test**: Start a conversation with several rapid prompts and verify the UI shows a single streaming response per turn, no React render errors, and the stream completes or surfaces an error message cleanly.

**Acceptance Scenarios**:
1. **Given** the assistant is connected, **When** the user submits a prompt, **Then** tokens render incrementally without interruptions or flicker, and the response list settles once the stream ends.
2. **Given** the backend throttles or a malformed tool call occurs, **When** streaming fails, **Then** the UI shows a retry or error indicator but does not crash or enter an infinite loop.

---

### User Story 1.5 - Error visibility and recovery (Priority: P1) [Phase 0.5]

A user encounters a tool execution failure or backend error and expects clear feedback with recovery options, not silent failure.

**Why this priority**: Phase 0 revealed that streaming failures are silent - users see no error message, just abrupt termination. This breaks trust and prevents task completion.

**Independent Test**: Trigger a tool execution error (e.g., invalid parameters) and verify: (1) User sees inline error message with details, (2) Conversation continues without crash, (3) User can retry or proceed with next message.

**Acceptance Scenarios**:
1. **Given** a tool execution fails during streaming, **When** the error occurs, **Then** the user sees an inline error message with actionable details (not just "something went wrong") and the stream continues gracefully.
2. **Given** the backend worker crashes mid-stream, **When** the error is detected, **Then** the frontend shows a toast notification "Connection lost. Retrying..." and attempts automatic recovery up to 10 times before showing manual retry option.
3. **Given** messages are being delivered during stream completion, **When** the completion signal arrives, **Then** all pending messages are flushed and rendered before the stream closes (no lost content).
4. **Given** the final chunks of text are being rendered, **When** the stream completes, **Then** all text appears in the UI (React.startTransition does not delay or drop final updates).

---

### User Story 2 - Stable feature parity (Priority: P2)

A QA engineer verifies that the new features present on `feature/malformed-tool-call-handler`—excluding any experimental thread refactor—are available in `feature/stable-rendering` while the branch remains smooth.

**Why this priority**: We want to reuse working investments from the unstable branch without reintroducing flickering or regressions.

**Independent Test**: Diff the two branches, then verify each selected feature file-by-file and run smoke tests to ensure no render anomalies.

**Acceptance Scenarios**:
1. **Given** a candidate file diffed against `dev`, **When** the diff is applied to `feature/stable-rendering`, **Then** it passes lint, the related UI shows the improvement, and streaming still behaves correctly.
2. **Given** new features require threads or tool-call handling tweaks, **When** they are gated behind feature flags, **Then** the default branch path stays stable.

---

### User Story 3 - Observability & recovery (Priority: P3)

An SRE or engineer needs enough logging and metrics to understand streaming failures or render-thread issues without spewing console noise.

**Why this priority**: Logging aids debugging the remaining streaming instability and provides clues if future regressions occur.

**Independent Test**: Trigger a malformed tool call or backend error and confirm logs/console messages describe the failure without overwhelming volume.

**Acceptance Scenarios**:
1. **Given** a throttled backend, **When** the stream pauses or aborts, **Then** logs include the throttling signal and the UI surfaces a neutral state.
2. **Given** the UI faces a maximum update depth risk, **When** the guard activates, **Then** the render path halts early but surfaces a safe fallback state.

---

### Edge Cases

- What happens when a stream resumes while the user navigates to a different conversation? Ensure cleanup cancels the previous subscription and the UI keeps its live/pulsing state until the new stream fully attaches.
- How does the UI behave when the backend returns a partial answer followed by a tool call error? Avoid flicker and ensure the tool error is shown inline.
- How is throttling signaled when the backend pauses the stream and then restarts? The UI should keep subtle pending/pulsing animations, extend timeouts, and auto-resume once the server is ready.
- What occurs if two concurrent streams are accidentally started (e.g., double-click submit)? Prevent overlapping renders.
- How does the system recover from React "Maximum update depth exceeded" warnings? Introduce guard rails rather than rely on retries.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST render response streaming tokens in a single append-only list per conversation turn.
- **FR-002**: System MUST gracefully handle backend throttle or malformed tool-call errors without triggering React's maximum update depth exception, primarily through backend batching/throttling rather than complex frontend handling.
- **FR-003**: Engineers MUST be able to compare `feature/malformed-tool-call-handler` and `dev` diffs file-by-file, selectively cherry-picking stable code into the new branch. Include features that don't touch React state management or streaming logic; manually review and exclude rendering/thread component changes that could cause flickering, especially experimental frontend throttling mechanisms.
- **FR-004**: Logging/Metrics MUST capture stream lifecycle events (connect, data, error, complete) plus any malformed tool-call exceptions.
- **FR-006**: UI state cleanup MUST cancel stale streaming subscriptions when the user navigates away or starts a new conversation.
- **FR-007**: Frontend MUST maintain visible "live" animations during throttle, only declaring a stream stopped after 10-15 seconds of silence and up to 10 linear retry attempts.
- **FR-008**: Frontend MUST support batching of streaming payloads to reduce update frequency while preserving the real-time feel.
- **FR-009**: Frontend MUST implement minimal error boundaries around tool call displays and other known sources of React render errors.
- **FR-010**: System MUST handle extremely long and complex tool calls in Suna's XML/JSON hybrid format without causing render performance degradation.
- **FR-011**: System MUST gracefully handle network disconnection/reconnection during active streams with automatic recovery.
- **FR-012**: System MUST prevent concurrent stream conflicts when users rapidly submit multiple prompts.

### Key Entities *(include if feature involves data)*

- **StreamingSession**: Tracks the active stream, current token buffer, and subscription metadata (status, start timestamp, backend id, throttling flag).
- **MessageThread**: Represents a sequence of messages in the UI; updates should be incremental and keyed by stable IDs to avoid rerender churn.
- **ToolCallRecord**: Captures tool invocation inputs/responses plus malformed flags so the UI can render errors inline and avoid infinite retries.
- **RenderGuard**: Tracks component render counts and prevents excessive re-renders by implementing useCallback, React.memo, and stable object references.
- **StreamBatch**: Groups streaming tokens into batches to reduce frontend update frequency while maintaining real-time user experience.

### Non-Functional Requirements

- **Performance**: Target <100ms latency for streaming token display, <10 renders per message update cycle.
- **Reliability**: 99% uptime for streaming functionality during normal backend operation, graceful degradation during throttling.
- **Graceful Degradation**: When backend throttles or network disconnects, UI maintains pulsing/live animations continuously without interruption. Silent automatic retries (up to 10 linear attempts) without user-facing error messages. If all retries fail, display toast notification with "Try Again" button in chat for manual retry.
- **Scalability**: Support up to 10 concurrent users with 500 messages/hour per user without performance degradation.
- **Maintainability**: Incremental refactoring approach with specific constraints: (1) NO modifications to existing API endpoints or message types, (2) NO large refactors of core rendering components (ThreadContent.tsx, ShowToolStream.tsx, useAgentStream.ts), (3) Frontend changes limited to React.memo, useCallback, and memoization optimizations only, (4) Backend batching/throttling in ResponseProcessor is the primary solution for frontend render issues, (5) Manual bug fix pass on frontend during Phase 0 cherry-picking to identify and fix existing bugs before optimization.
- **Observability**: Stream lifecycle logging, render count monitoring, error boundary reporting for debugging.

## Success Criteria *(mandatory)*

### Measurable Outcomes

#### Phase 0.5 Investigation Success Criteria

- **SC-001a**: Identify root cause of streaming failures through investigation of 7 problem areas within 1-2 weeks.
- **SC-001b**: Implement and verify fixes for at least 2 critical issues (tool exception swallowing, error propagation) before proceeding to Phase 1.
- **SC-001c**: Add comprehensive logging to enable <5 minute debugging of future streaming failures (sequence numbers, timing, error traces).
- **SC-001d**: Document all investigation findings, solution options, and human decisions in `Pre-Phase-1-Problem-Areas.md`.
- **SC-001e**: Generate 3-5 solution options for each high-priority problem area with clear tradeoffs documented.
- **SC-001f**: Verify that tool execution errors are caught, logged, and yielded to frontend with actionable error messages.
- **SC-001g**: Confirm backend errors reliably reach frontend with toast notifications and automatic retry attempts.
- **SC-001h**: Validate that stream completion waits for all pending messages to flush (no lost content).
- **SC-001i**: Ensure final text chunks always render before stream closes (no React.startTransition delays).

#### Overall Feature Success Criteria

- **SC-002**: Reduce streaming interruptions to zero in manual regression tests for two consecutive sessions.
- **SC-003**: Ensure React logs report zero "Maximum update depth exceeded" warnings across three different simulated threads.
- **SC-004**: Verify the hybrid branch retains at least 90% of the non-experimental features from `feature/malformed-tool-call-handler` that were marked safe.
- **SC-005**: Confirm log/console volume stays within 3x the baseline set in `dev` while still recording streaming failures.
- **SC-006**: Document streaming lifecycle in less than 5 minutes by reviewing the new metrics/logs.
- **SC-007**: Achieve <100ms token display latency and <10 renders per message cycle in performance testing.
- **SC-008**: Successfully handle complex XML/JSON hybrid tool calls without UI freezing or excessive render loops.
- **SC-009**: Complete manual testing checklist covering conversation types, tool scenarios, and network interruption recovery.
- **SC-010**: Zero silent failures - all errors visible to users with clear recovery options.

### Testing Strategy

#### Manual Testing Checklist
- **Basic Streaming**: Simple text conversations, rapid prompts, long responses
- **Tool Call Scenarios**: Simple tools, complex XML/JSON hybrid calls, malformed tool responses, extremely long tool outputs
- **Network Resilience**: Disconnect/reconnect during streaming, backend throttling simulation, timeout scenarios
- **Concurrency**: Multiple rapid prompts, thread switching during streams, overlapping tool calls
- **Error Boundaries**: Trigger known render error sources, verify graceful fallbacks
- **Performance**: Monitor render counts, check for flicker/jank, validate animation smoothness during throttling

#### Acceptance Validation
- Zero "Maximum update depth exceeded" errors in browser console
- Smooth streaming animation without visible flicker
- Successful recovery from network interruptions
- Tool call errors displayed inline without crashing UI
- Clean stream termination and proper subscription cleanup
