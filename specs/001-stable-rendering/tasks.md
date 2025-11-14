# Implementation Tasks: Stable Rendering & Streaming

**Feature**: 001-stable-rendering | **Date**: 2025-11-13  
**Branch**: `001-stable-rendering` | **Baseline Commit**: `22a36feb` (2025-11-13 00:44:22) from `feature/workflows-restoration` | **Status**: Ready for Implementation

**Overview**: Execute 7 phases of implementation to establish reliable streaming and eliminate React render loop errors. Start with Phase 0 baseline analysis, then proceed through frontend optimization, backend buffering, error boundaries, debug endpoints, network resilience, and validation.

---

## Phase 0: Baseline Analysis & Cherry-Pick Strategy

**Goal**: Establish clean foundation by selectively integrating improvements from `feature/malformed-tool-call-handler`

**Independent Test Criteria**:
- All cherry-picked commits applied cleanly without conflicts
- Streaming works without new render errors
- No experimental code introduced
- All decisions documented in CHERRY_PICK_LOG.md

### Phase 0 Tasks

- [ ] T001 Generate comprehensive diff between `dev` and `feature/malformed-tool-call-handler` branches
- [ ] T002 Categorize all changes by risk level (safe, review-carefully, skip) and document in CHERRY_PICK_LOG.md
- [ ] T003 Review critical files for changes: `ThreadContent.tsx`, `ShowToolStream.tsx`, `useAgentStream.ts`, `response_processor.py`
- [ ] T004 [P] Cherry-pick approved safe changes from `feature/malformed-tool-call-handler` (bug fixes, utilities, non-rendering code)
- [ ] T005 [P] Test baseline after each cherry-pick: verify streaming works, no render errors, no console warnings
- [ ] T006 Validate baseline against `dev` branch: compare behavior, verify no regressions
- [ ] T007 Document final cherry-pick decisions with commit hashes and rationale in CHERRY_PICK_LOG.md
- [ ] T008 Push validated baseline to `feature/stable-rendering` branch

---

## Phase 1: Frontend Render Optimization

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

**Total Tasks**: 104  
**Phase 0 (Baseline)**: 8 tasks  
**Phase 1 (Frontend Optimization)**: 11 tasks  
**Phase 2 (Backend Buffering)**: 9 tasks  
**Phase 3 (Error Boundaries)**: 9 tasks  
**Phase 4 (Debug Endpoints)**: 11 tasks  
**Phase 5 (Network Resilience)**: 19 tasks (6 new tasks for graceful degradation)  
**Phase 6 (Testing & Validation)**: 17 tasks (added T093 for observability verification)  
**Phase 7 (Polish & Cross-Cutting)**: 11 tasks (renumbered T094-T104)  

**Parallelizable Opportunities**: ~40% of tasks can run in parallel within phases  
**Estimated Duration**: 4 weeks with incremental validation  
**MVP Scope**: Phases 0-2 (28 tasks, 1-2 weeks)
