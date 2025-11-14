# Implementation Tasks: Stable Rendering & Streaming

**Feature**: 001-stable-rendering | **Date**: 2025-11-13  
**Branch**: `001-stable-rendering` | **Baseline Commit**: `22a36feb` (2025-11-13 00:44:22) from `feature/workflows-restoration` | **Status**: Ready for Implementation

**Overview**: Execute 7 phases of implementation to establish reliable streaming and eliminate React render loop errors. Start with Phase 0 baseline analysis, then proceed through frontend optimization, backend buffering, error boundaries, debug endpoints, network resilience, and validation.

---

## Phase 0: Baseline Analysis & Cherry-Pick Strategy ✅ COMPLETE

**Goal**: Establish clean foundation by selectively integrating improvements from `feature/malformed-tool-call-handler`

**Independent Test Criteria**:
- ✅ All cherry-picked commits applied cleanly without conflicts
- ✅ Streaming works without new render errors
- ✅ No experimental code introduced
- ✅ All decisions documented in Phase 0 analysis documents

**Status**: ✅ **COMPLETED** (2025-11-14)

### Phase 0 Tasks

- [X] T001 Generate comprehensive diff between `dev` and `feature/malformed-tool-call-handler` branches
- [X] T002 Categorize all changes by risk level (safe, review-carefully, skip) and document analysis files
- [X] T003 Review critical files for changes: `ThreadContent.tsx`, `ShowToolStream.tsx`, `useAgentStream.ts`, `response_processor.py`
- [X] T004 [P] Cherry-pick approved safe changes from `feature/malformed-tool-call-handler` (7 files implemented)
- [X] T005 [P] Test baseline after each cherry-pick: Docker build successful, all containers running
- [X] T006 Validate baseline against `dev` branch: UTF-8 encoding issues fixed, build verified
- [X] T007 Document final cherry-pick decisions with commit hashes and rationale in analysis documents
- [X] T008 Push validated baseline to `001-stable-rendering` branch (commits: 07ab95b5, 6afac24f, db386d66, 9aed9c33, 8cc97425, 0c52020a, d097fbde, a1758fa6)

---

## Phase 0.5: Problem Areas Investigation & Root Cause Analysis 🔍 IN PROGRESS

**Goal**: Investigate 7 identified problem areas through iterative testing and human-in-the-loop decision making to determine root cause of streaming failures

**Type**: Discovery & Investigation (NOT linear task execution)

**Independent Test Criteria**:
- Root cause of streaming failure identified
- Solution options generated for top priority issues
- At least 2 fixes implemented and verified
- Comprehensive logging added for monitoring
- Ready to proceed with Phase 1 with clear understanding of what needs fixing

**Status**: 🔍 **IN PROGRESS** (2025-11-14)

### Investigation Cycle Tasks (Iterative)

**NOTE**: These tasks are NOT executed linearly. Each problem area goes through its own investigation cycle.

#### Investigation Cycle Template
For each problem area:
1. Add logging/instrumentation
2. Run tests (manual + automated)
3. Analyze results
4. Generate solution options
5. Human decision on approach
6. Implement fix (if ready)
7. Verify fix works
8. Document findings

---

### Week 1 Priority: Critical Issues + Quick Win

#### 🔴 CRITICAL #1: Tool Exception Swallowing Investigation

- [ ] T008a [P] Add comprehensive logging around tool execution in `response_processor.py:471-476`
- [ ] T008b [P] Add try/except wrapper around `asyncio.create_task(self._execute_tool())` 
- [ ] T008c [P] Implement error yielding mechanism for tool execution failures
- [ ] T008d Create test tool that intentionally fails (e.g., division by zero, missing file)
- [ ] T008e Run test with failing tool, capture worker logs
- [ ] T008f Verify error messages reach Redis list
- [ ] T008g Verify error messages reach frontend SSE stream
- [ ] T008h **HUMAN DECISION**: Choose error handling approach (new handler vs extend existing)
- [ ] T008i **HUMAN DECISION**: Choose frontend error display strategy
- [ ] T008j Implement chosen solution
- [ ] T008k Verify fix: Test with failing tool, confirm graceful error display
- [ ] T008l Document findings in `Pre-Phase-1-Problem-Areas.md`

#### 🔴 CRITICAL #2: Error Propagation Investigation

- [ ] T008m Check worker logs for recent exceptions: `docker logs suna-worker-1 | grep -i error`
- [ ] T008n Check Redis for error messages: `redis-cli LRANGE "agent_run:*:responses" 0 -1`
- [ ] T008o Add logging to Redis error push operations in `run_agent_background.py:290-294`
- [ ] T008p Test frontend toast notification system with mock error
- [ ] T008q Verify error boundary catches and displays backend errors
- [ ] T008r **HUMAN DECISION**: Is existing error notification system sufficient?
- [ ] T008s **HUMAN DECISION**: Do we need retry logic for Redis error pushes?
- [ ] T008t Implement chosen improvements
- [ ] T008u Verify fix: Trigger backend error, confirm frontend notification
- [ ] T008v Document findings in `Pre-Phase-1-Problem-Areas.md`

#### 🔵 LOW: Keepalive Timeout (Quick Win)

- [ ] T008w [P] Reduce keepalive timeout from 30s to 15s in `agent_runs.py:1018-1020`
- [ ] T008x Test with slow tool execution, verify faster error detection
- [ ] T008y Document change in commit message

---

### Week 2 Priority: Race Conditions + UX Issues

#### 🟡 HIGH #3: Race Condition Investigation

- [ ] T008z Add logging to track message sequence numbers in backend
- [ ] T008aa Add logging to track message receipt order in frontend
- [ ] T008ab Monitor Redis list vs SSE delivery timing with timestamps
- [ ] T008ac Test with slow network conditions (throttle in DevTools)
- [ ] T008ad Analyze logs to identify if messages are lost or reordered
- [ ] T008ae Generate 3-5 solution options (e.g., ack-based, buffer-based, timeout-based)
- [ ] T008af **HUMAN DECISION**: Choose solution approach
- [ ] T008ag Implement chosen solution
- [ ] T008ah Verify fix: Test with slow network, confirm all messages delivered
- [ ] T008ai Document findings and chosen solution in `Pre-Phase-1-Problem-Areas.md`

#### 🟡 MEDIUM #7: React.startTransition Investigation

- [ ] T008aj Add logging before/after startTransition calls
- [ ] T008ak Test stream completion timing, measure transition delays
- [ ] T008al Verify flush is called before finalization
- [ ] T008am Create test branch: Remove startTransition entirely
- [ ] T008an Compare rendering behavior with/without startTransition
- [ ] T008ao **HUMAN DECISION**: Remove, keep, or modify startTransition?
- [ ] T008ap Implement chosen approach
- [ ] T008aq Verify fix: Confirm final content always renders
- [ ] T008ar Document findings in `Pre-Phase-1-Problem-Areas.md`

#### 🟠 MEDIUM #5: Redis Architecture Review

- [ ] T008as Review current Redis pub/sub implementation
- [ ] T008at Add timing logs for rpush and publish operations
- [ ] T008au Test message ordering under load (multiple rapid messages)
- [ ] T008av Evaluate await vs fire-and-forget tradeoffs
- [ ] T008aw **HUMAN DECISION**: Await Redis operations or keep fire-and-forget?
- [ ] T008ax **HUMAN DECISION**: Is batching compatible with current architecture?
- [ ] T008ay Document architecture review findings

---

### Deferred Investigations

#### 🟡 HIGH #4: Dependency Arrays (DEFERRED - Too Complex)

- [ ] T008az Profile callback recreation frequency (add console.log)
- [ ] T008ba Research alternative patterns without major refactor
- [ ] T008bb Test minimal fixes (e.g., useRef for specific callbacks)
- [ ] T008bc **HUMAN DECISION**: Worth the effort? Phase 2 or later?

#### 🟠 MEDIUM #6: Buffer Overflow (DEFERRED - Pending Decision)

- [ ] T008bd Profile buffer usage under production load
- [ ] T008be Test with high-speed streaming (100+ messages/sec)
- [ ] T008bf Compare frontend vs backend throttling approaches
- [ ] T008bg **HUMAN DECISION**: Improve frontend buffer or migrate to backend-only?

---

### Phase 0.5 Completion Checklist

- [ ] T008bh Root cause identified for streaming failure
- [ ] T008bi At least 2 critical issues fixed and verified
- [ ] T008bj Comprehensive logging added for ongoing monitoring
- [ ] T008bk All investigation findings documented
- [ ] T008bl Human decisions made on approach for top 3 issues
- [ ] T008bm Phase 1 plan updated based on findings
- [ ] T008bn Ready to proceed with Phase 1 implementation

---

## Phase 1: Frontend Render Optimization (BLOCKED - Pending Phase 0.5)

**Goal**: Reduce render frequency of critical components using React.memo and memoization (highest impact, no upstream divergence)

**Independent Test Criteria**:
- Render count warnings reduced by 50%+ for `ShowToolStream`, `ThreadContent`
- No visible performance degradation
- Streaming feels smoother without flicker
- Zero new React errors in console

### Phase 1 Tasks

- [ ] T009 [P] [US1] Add React.memo wrapper to `ShowToolStream` component in `frontend/src/components/thread/content/ShowToolStream.tsx`
- [ ] T010 [P] [US1] Add render count monitoring to `ShowToolStream` with console warnings when threshold exceeded
- [ ] T011 [P] [US1] Memoize expensive parsing operations in `ShowToolStream` using useMemo for `extractAndFormatToolContent()`
- [ ] T012 [P] [US1] Add React.memo wrapper to `ThreadContent` component in `frontend/src/components/thread/content/ThreadContent.tsx`
- [ ] T013 [P] [US1] Add render count monitoring to `ThreadContent` with console warnings
- [ ] T014 [P] [US1] Memoize message array in `ThreadContent` using useMemo to prevent unnecessary re-renders
- [ ] T015 [P] [US1] Optimize `useAgentStream` hook in `frontend/src/hooks/useAgentStream.ts` with render count tracking
- [ ] T016 [P] [US1] Add useCallback optimization to content throttling function in `useAgentStream`
- [ ] T017 [US1] Manual test Phase 1: Start conversation with rapid prompts, verify render warnings reduced, streaming smooth
- [ ] T018 [US1] Manual test Phase 1: Trigger tool calls with large output, verify no flicker, auto-scroll works
- [ ] T019 [US1] Verify Phase 1 changes: No new render errors, performance improved, streaming uninterrupted

---

## Phase 2: Backend Streaming Optimization (Internal Only)

**Goal**: Implement internal content buffering in ResponseProcessor without changing API or message types (maintains upstream compatibility)

**Independent Test Criteria**:
- Network tab shows reduced SSE message frequency
- Content still streams smoothly without visible delays
- Frontend receives same message types (no new types introduced)
- Streaming latency <100ms

### Phase 2 Tasks

- [ ] T020 [P] [US1] Implement internal content buffering in `ResponseProcessor.process_streaming_response()` in `backend/core/agentpress/response_processor.py`
- [ ] T021 [P] [US1] Add buffer configuration (batch_size=5, flush_interval=50ms) to ResponseProcessor
- [ ] T022 [P] [US1] Ensure buffering uses existing message types ('assistant', 'tool_call', 'status') - NO new types
- [ ] T023 [P] [US1] Test backend buffering: Verify content chunks are batched before yielding to Redis
- [ ] T024 [P] [US1] Verify frontend receives same message structure as before (backward compatible)
- [ ] T025 [US1] Manual test Phase 2: Monitor network tab for reduced SSE message frequency
- [ ] T026 [US1] Manual test Phase 2: Verify streaming latency remains <100ms
- [ ] T027 [US1] Verify Phase 2 changes: No API changes, no new message types, protocol compatible

---

## Phase 3: Error Boundaries for Tool Call Rendering

**Goal**: Add minimal error boundaries around known problem areas (tool calls, message rendering) to prevent cascading failures

**Independent Test Criteria**:
- Error boundaries catch tool rendering errors without crashing UI
- Fallback UI displays gracefully
- No infinite error loops
- Streaming continues despite tool call errors

### Phase 3 Tasks

- [ ] T028 [P] [US1] Create `ToolCallErrorBoundary` component in `frontend/src/components/common/ToolCallErrorBoundary.tsx`
- [ ] T029 [P] [US1] Implement error logging in `ToolCallErrorBoundary` with component stack trace
- [ ] T030 [P] [US1] Add fallback UI for tool call rendering errors in `ToolCallErrorBoundary`
- [ ] T031 [P] [US1] Wrap `ShowToolStream` component with `ToolCallErrorBoundary` in rendering logic
- [ ] T032 [P] [US1] Create `ThreadContentErrorBoundary` component in `frontend/src/components/common/ThreadContentErrorBoundary.tsx`
- [ ] T033 [P] [US1] Wrap `ThreadContent` component with `ThreadContentErrorBoundary`
- [ ] T034 [US1] Manual test Phase 3: Trigger malformed tool call, verify error boundary catches it
- [ ] T035 [US1] Manual test Phase 3: Verify fallback UI displays, streaming continues
- [ ] T036 [US1] Verify Phase 3 changes: No infinite error loops, UI remains responsive

---

## Phase 4: Custom Debug Endpoints

**Goal**: Add isolated debug endpoints for monitoring and troubleshooting (minimal upstream impact)

**Independent Test Criteria**:
- `/render-performance/metrics` endpoint accepts and logs render metrics
- `/debug/streaming-events` endpoint accepts and logs streaming events
- Debug endpoints don't affect core streaming functionality
- Metrics can be used for performance analysis

### Phase 4 Tasks

- [ ] T037 [P] Create `backend/api/debug.py` with debug endpoint routes
- [ ] T038 [P] Implement `/render-performance/metrics` POST endpoint in `backend/api/debug.py`
- [ ] T039 [P] Add render metrics logging with threshold warnings (>50 renders) in metrics endpoint
- [ ] T040 [P] Implement `/debug/streaming-events` POST endpoint in `backend/api/debug.py`
- [ ] T041 [P] Add streaming event logging (retry, timeout, error, reconnect, malformed_response) in debug endpoint
- [ ] T042 [P] Register debug routes in `backend/main.py` or `backend/api/__init__.py`
- [ ] T043 [P] [US3] Add frontend metrics reporting to `useAgentStream` hook for render counts
- [ ] T044 [P] [US3] Add frontend event reporting to `useAgentStream` for streaming errors/retries
- [ ] T045 [US3] Manual test Phase 4: Trigger render metrics endpoint, verify metrics logged
- [ ] T046 [US3] Manual test Phase 4: Trigger streaming error, verify event logged to debug endpoint
- [ ] T047 [US3] Verify Phase 4 changes: Debug endpoints isolated, no impact on core streaming

---

## Phase 5: Network Resilience & Timeout Handling

**Goal**: Enhance timeout configuration and reconnection logic for graceful degradation during network issues

**Independent Test Criteria**:
- Stream survives 10-15 seconds of silence before retry
- Retries work up to 10 times with linear intervals
- Keepalive interval is 10 seconds
- UI maintains pulsing/live appearance during throttling
- Reconnection succeeds after network recovery

### Phase 5 Tasks

- [ ] T048 [P] [US1] Update streaming timeout configuration in `frontend/src/hooks/useAgentStream.ts`
- [ ] T049 [P] [US1] Set silenceThreshold to 15000ms (15 seconds) in useAgentStream config
- [ ] T050 [P] [US1] Set maxRetries to 10 in useAgentStream config
- [ ] T051 [P] [US1] Set retryInterval to 5000ms (5 seconds linear) in useAgentStream config
- [ ] T052 [P] [US1] Set keepAliveInterval to 10000ms (10 seconds) in useAgentStream config
- [ ] T053 [P] [US1] Implement retry logic in `useAgentStream` with linear backoff (not exponential)
- [ ] T054 [P] [US1] Add reconnection logic to EventSource error handler in `useAgentStream`
- [ ] T055 [P] [US1] Maintain UI pulsing/live animations during throttle in `ThreadContent` message display - ensure animations never stop during retries. **Animation Details**: When `streamHookStatus === 'streaming' || 'connecting'` and no text content is available, display three pulsing dots (h-1 w-1 rounded-full) with staggered delays (0ms, 150ms, 300ms) using Tailwind's `animate-pulse duration-1000` class. Animation must remain visible and continuous during all 10 retry attempts; do NOT reset animation state or hide dots during retries.
- [ ] T056 [P] [US1] Implement stream cleanup on navigation to prevent stale subscriptions
- [ ] T057 [P] [US1] Create toast notification component for streaming errors in `frontend/src/components/common/StreamingErrorToast.tsx`
- [ ] T058 [P] [US1] Implement "Try Again" button in chat message area for manual stream retry after all automatic retries exhausted
- [ ] T059 [P] [US1] Add logic to show toast notification only after all 10 automatic retries fail (not during retries)
- [ ] T060 [P] [US1] Ensure animations remain consistent and continuous during all retry attempts - no flicker or animation reset. **Verification Criteria**: (1) Pulsing dots visible continuously from first retry through 10th retry attempt, (2) No animation interruption when status changes between 'streaming' and 'connecting', (3) Dots maintain consistent opacity/brightness throughout (no sudden dimming/brightening), (4) Staggered timing preserved (dots pulse in sequence, not synchronized)
- [ ] T061 [US1] Manual test Phase 5: Simulate 15 second network silence, verify pulsing animation continues uninterrupted
- [ ] T062 [US1] Manual test Phase 5: Verify toast notification appears only after all retries exhausted
- [ ] T063 [US1] Manual test Phase 5: Verify "Try Again" button works and retriggers stream
- [ ] T064 [US1] Manual test Phase 5: Simulate network disconnection, verify reconnection succeeds
- [ ] T065 [US1] Manual test Phase 5: Verify UI maintains pulsing appearance during throttle without interruption
- [ ] T066 [US1] Verify Phase 5 changes: Timeouts correct, retries work, reconnection succeeds, animations stable

---

## Phase 6: Testing & Validation

**Goal**: Execute comprehensive manual testing checklist to validate all improvements

**Independent Test Criteria**:
- All manual test scenarios pass
- No "Maximum update depth exceeded" errors
- Streaming latency <100ms
- Render counts reduced 50%+
- All edge cases handled gracefully

### Phase 6 Tasks

- [ ] T077 [US1] Manual test: Basic streaming - Start conversation, verify tokens stream smoothly
- [ ] T078 [US1] Manual test: Tool call rendering - Trigger tool call, verify display without errors
- [ ] T079 [US1] Manual test: Rapid input - Send multiple prompts quickly, verify UI responsive
- [ ] T080 [US1] Manual test: Long tool output - Trigger tool with large output, verify no performance degradation
- [ ] T081 [US1] Manual test: Network resilience - Simulate disconnect/reconnect, verify recovery
- [ ] T082 [US1] Manual test: Malformed response - Trigger malformed tool call, verify graceful handling
- [ ] T083 [US1] Manual test: Concurrent streams - Double-click submit, verify no overlapping renders
- [ ] T084 [US1] Manual test: Error boundary - Trigger tool rendering error, verify fallback UI
- [ ] T085 [US1] Manual test: Throttle scenario - Simulate backend throttle, verify UI maintains pulsing
- [ ] T086 [US1] Performance verification: Render counts reduced by 50%+ for critical components
- [ ] T087 [US1] Performance verification: Streaming latency <100ms
- [ ] T088 [US1] Performance verification: Zero "Maximum update depth exceeded" errors
- [ ] T089 [US2] Manual test: Feature parity - Verify cherry-picked features work correctly
- [ ] T090 [US2] Manual test: Smoke test - Run through basic workflows, verify no regressions
- [ ] T091 [US3] Verify logging: Check debug endpoints capture metrics and events
- [ ] T092 [US3] Verify observability: Logs describe failures without overwhelming volume
- [ ] T093 [US3] Verify observability: Confirm debug endpoints capture all required metrics and events without overwhelming volume

---

## Phase 7: Polish & Cross-Cutting Concerns

**Goal**: Final cleanup, documentation, and performance tuning

**Independent Test Criteria**:
- All code follows Suna conventions
- Documentation is complete and accurate
- Performance targets met
- Ready for production deployment

### Phase 7 Tasks

- [ ] T094 [P] Review all code changes for Suna conventions and style consistency
- [ ] T095 [P] Update CHERRY_PICK_LOG.md with final summary and lessons learned
- [ ] T096 [P] Document all Phase 0-6 changes in feature branch commit messages
- [ ] T097 [P] Create performance baseline comparison (before/after metrics)
- [ ] T098 [P] Verify all files have proper imports and dependencies
- [ ] T099 [P] Run linter on all modified files: `npm run lint` (frontend), `pylint` (backend)
- [ ] T100 [P] Test Windows compatibility: Verify asyncio and file paths work on Windows
- [ ] T101 Update `.docs/guidelines/Rendering_React_Best_Practices.md` with learnings from this feature
- [ ] T102 Create rollback plan documentation in feature branch
- [ ] T103 Final validation: Run full manual test checklist one more time
- [ ] T104 Prepare PR description with summary of changes and testing results

---

## Dependency Graph & Execution Strategy

### User Story Completion Order

```
Phase 0: Baseline (BLOCKING - must complete first)
  ↓
Phase 1: Frontend Render Optimization [US1]
  ↓
Phase 2: Backend Streaming Optimization [US1]
  ↓
Phase 3: Error Boundaries [US1]
  ↓
Phase 4: Debug Endpoints [US3]
  ↓
Phase 5: Network Resilience [US1]
  ↓
Phase 6: Testing & Validation [US1, US2, US3]
  ↓
Phase 7: Polish & Cross-Cutting [All]
```

### Parallelizable Tasks Within Phases

**Phase 1** (Frontend Optimization):
- T009-T016 can run in parallel (different files, no dependencies)
- T017-T019 sequential (dependent on T009-T016)

**Phase 2** (Backend Buffering):
- T020-T024 can run in parallel (different aspects of same file)
- T025-T027 sequential (dependent on T020-T024)

**Phase 3** (Error Boundaries):
- T028-T033 can run in parallel (different components)
- T034-T036 sequential (dependent on T028-T033)

**Phase 4** (Debug Endpoints):
- T037-T042 can run in parallel (backend endpoints)
- T043-T044 can run in parallel (frontend reporting)
- T045-T047 sequential (dependent on all)

**Phase 5** (Network Resilience):
- T048-T056 can run in parallel (different aspects)
- T057-T060 sequential (dependent on T048-T056)

**Phase 6** (Testing):
- T061-T069 can run in parallel (independent test scenarios)
- T070-T076 sequential (verification tasks)

**Phase 7** (Polish):
- T077-T083 can run in parallel (different concerns)
- T084-T087 sequential (final tasks)

### Suggested MVP Scope

**Minimum Viable Product** (Phase 0 + Phase 1 + Phase 2):
- Establish clean baseline via cherry-picking
- Implement frontend render optimization (React.memo, memoization)
- Implement backend content buffering (internal only)
- Validate streaming works without render errors

This MVP addresses the core problem (React render loop errors) and establishes the foundation for subsequent phases.

### Recommended Execution Plan

1. **Week 1**: Phase 0 (baseline analysis) + Phase 1 (frontend optimization)
2. **Week 2**: Phase 2 (backend buffering) + Phase 3 (error boundaries)
3. **Week 3**: Phase 4 (debug endpoints) + Phase 5 (network resilience)
4. **Week 4**: Phase 6 (testing) + Phase 7 (polish)

Each phase includes manual testing to validate improvements before proceeding.

---

## Implementation Strategy

### Key Principles

1. **Upstream Parity**: No API changes, no new message types, internal optimizations only
2. **Incremental Validation**: Test after each phase before proceeding
3. **Manual Testing**: Complex streaming behavior requires human validation
4. **Careful Review**: Core rendering components reviewed with extreme caution
5. **Documentation**: All decisions and cherry-picks documented

### Success Criteria

- ✅ Zero "Maximum update depth exceeded" errors
- ✅ Streaming latency <100ms
- ✅ Render count reduced 50%+ for critical components
- ✅ Graceful handling of network failures and malformed responses
- ✅ Upstream sync-safe implementation
- ✅ All user stories independently testable and completable

### Rollback Strategy

If issues arise:
1. Revert to `dev` branch
2. Disable specific optimizations via feature flags
3. Enable verbose logging to identify issues
4. Use browser dev tools to compare before/after

---

## Task Summary

**Total Tasks**: 147 (43 new investigation tasks added)  
**Phase 0 (Baseline)**: 8 tasks ✅ COMPLETE  
**Phase 0.5 (Investigation)**: 43 tasks 🔍 IN PROGRESS (iterative, not linear)  
**Phase 1 (Frontend Optimization)**: 11 tasks ⏸️ BLOCKED (pending Phase 0.5)  
**Phase 2 (Backend Buffering)**: 9 tasks ⏸️ BLOCKED (pending Phase 0.5)  
**Phase 3 (Error Boundaries)**: 9 tasks  
**Phase 4 (Debug Endpoints)**: 11 tasks  
**Phase 5 (Network Resilience)**: 19 tasks  
**Phase 6 (Testing & Validation)**: 17 tasks  
**Phase 7 (Polish & Cross-Cutting)**: 11 tasks  

**Investigation Approach**: Phase 0.5 uses iterative cycles, not linear execution  
**Parallelizable Opportunities**: Investigation tasks can be explored in parallel  
**Estimated Duration**: 
- Phase 0.5: 1-2 weeks (discovery phase)
- Remaining phases: 3-4 weeks (adjusted based on findings)
**Updated MVP Scope**: Phase 0 + Phase 0.5 + targeted fixes (not full Phase 1-2)
