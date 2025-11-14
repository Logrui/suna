# Implementation Tasks: Stable Rendering & Streaming

**Feature**: 001-stable-rendering | **Date**: 2025-11-14 (Updated)  
**Branch**: `001-stable-rendering` | **Baseline Commit**: `22a36feb` (2025-11-13 00:44:22) from `feature/workflows-restoration` | **Status**: Phase 0.5 Complete - Ready for Week 1 Cherry-Picks

**Overview**: Execute implementation to establish reliable streaming and eliminate React render loop errors. 

**Strategy**: Phase 0 (baseline) ✅ COMPLETE → Phase 0.5 (upstream research) ✅ COMPLETE → Phase 1 (Week 1 cherry-picks) 🚀 READY → Phase 2 (Week 2 evaluation) → Phases 3-7 (optimization, error handling, resilience, validation)

**Major Discovery**: Production-tested solutions exist in `upstream/PRODUCTION` branch. Pivoted from "implement from scratch" to "cherry-pick production-tested fixes" (lower risk, faster timeline, 60-80% expected issue resolution)

**Week 1 Focus**: Cherry-pick 4 high-priority commits from upstream/PRODUCTION:
1. `abadd6a6` - Cancellation event + graceful stoppage
2. `8b6b16f5` - 5-second drain timeout
3. `e56c2873` - Don't save cancelled responses
4. `26baa2ee` - Frontend cleanup and refactoring

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

## Phase 0.5: Problem Areas Investigation & Upstream Research ✅ COMPLETE

**Goal**: Investigate 7 identified problem areas and discover production-tested solutions in upstream branches

**Type**: Discovery & Research (completed with major pivot to cherry-pick strategy)

**Independent Test Criteria**:
- ✅ 7 problem areas identified and documented
- ✅ 673 commits analyzed across 3 upstream branches
- ✅ 4 high-priority commits identified for Week 1 cherry-picking
- ✅ 6 of 7 problem areas have potential upstream fixes (86% coverage)
- ✅ Clear escalation path defined (Track 1 → Track 2 → Track 3)
- ✅ Ready to proceed with Phase 1 cherry-pick strategy

**Status**: ✅ **COMPLETE** (2025-11-14)

**Major Discovery**: Production-tested solutions exist in `upstream/PRODUCTION` branch. Strategy pivoted from "implement from scratch" to "cherry-pick production-tested fixes".

### Phase 0.5 Completion Summary

**Research Findings**:
- ✅ Analyzed 673 commits across 3 upstream branches (PRODUCTION, native_tool_calling, parallel_tool)
- ✅ Identified 4 high-priority commits for Week 1 cherry-picking
- ✅ Discovered 6 of 7 problem areas have potential upstream fixes (86% coverage)
- ✅ Selected Track 1 (PRODUCTION) as baseline due to low risk and production-tested status
- ✅ Documented all findings in: Pre-Phase-1-Problem-Areas.md, Phase-0.5-Upstream-Review.md, upstream-file-diffs-research/research.md

**Key Commits Identified**:
1. `abadd6a6` - Cancellation event + graceful stoppage (addresses #2, #3)
2. `8b6b16f5` - 5-second drain timeout (addresses #6)
3. `e56c2873` - Don't save cancelled responses (addresses #3)
4. `26baa2ee` - Frontend cleanup and refactoring (addresses #4, #7)

**Documentation Generated**:
- [X] Pre-Phase-1-Problem-Areas.md - 7 critical problems with upstream fix information
- [X] Phase-0.5-Upstream-Review.md - Executive summary of research
- [X] upstream-file-diffs-research/research.md - Detailed analysis (673 commits, 3 branches)
- [X] plan.md - Updated with Phase 1 cherry-pick implementation strategy

---

## Phase 1: Cherry-Pick Selected Production Fixes (Week 1) 🚀 READY TO START

**Goal**: Apply 4 high-priority commits from `upstream/PRODUCTION` to address 6 of 7 identified problem areas

**Approach**: Cherry-pick production-tested commits instead of implementing from scratch (lower risk, faster timeline)

**Independent Test Criteria**:
- ✅ All 4 commits applied without breaking changes
- ✅ No new console errors or warnings
- ✅ Streaming completes without abrupt termination
- ✅ Tool calls display correctly
- ✅ No performance regressions
- ✅ Potential resolution of 60-80% of streaming issues

**Expected Outcome**: Potential resolution of 60-80% of streaming issues with Week 1 cherry-picks

### Phase 1 Tasks - Week 1 Cherry-Picks

**IMPORTANT**: All tasks are HUMAN-IN-THE-LOOP. Each cherry-pick requires manual review of file diffs, dependency analysis, and integration decisions.

#### Preparation Phase

- [ ] T009 Prepare implementation branch: `git checkout -b 001-stable-rendering-phase1-track-production`
- [ ] T010 [P] Verify upstream remote configured: `git remote -v | grep upstream`
- [ ] T011 [P] Fetch all upstream branches: `git fetch upstream PRODUCTION native_tool_calling parallel_tool_calling_and_flow_execution`

#### Commit 1: abadd6a6 (Cancellation event + graceful stoppage)

- [ ] T012 [US1] **HUMAN REVIEW**: View file diffs for commit `abadd6a6`: `git diff upstream/PRODUCTION~1 upstream/PRODUCTION -- backend/core/agentpress/response_processor.py`
- [ ] T013 [US1] **HUMAN ANALYSIS**: Identify all modified files and new dependencies in abadd6a6
- [ ] T014 [US1] **HUMAN DECISION**: Review changes and approve for cherry-pick
- [ ] T015 [US1] **DEPENDENCY CHECK**: Identify if new imports/packages needed (check requirements.txt, pyproject.toml changes)
- [ ] T016 [US1] **FILE PULL**: If new files created in abadd6a6, pull them: `git show upstream/PRODUCTION:<filepath> > <local_path>`
- [ ] T017 [US1] **DEPENDENCY PULL**: If dependencies changed, update requirements.txt or pyproject.toml from upstream
- [ ] T018 [US1] Cherry-pick `abadd6a6`: `git cherry-pick abadd6a6`
- [ ] T019 [US1] **CONFLICT RESOLUTION**: If conflicts, manually review: `git diff --ours` vs `git diff --theirs`, resolve, `git add <file>`, `git cherry-pick --continue`
- [ ] T020 [US1] **HUMAN VERIFICATION**: Review cherry-picked changes match expected diffs
- [ ] T021 [US1] Test after T018: Run backend tests `python -m pytest tests/ -v`, verify no conflicts
- [ ] T022 [US1] Manual test: Verify response_processor.py changes work correctly

#### Commit 2: 8b6b16f5 (5-second drain timeout)

- [ ] T023 [US1] **HUMAN REVIEW**: View file diffs for commit `8b6b16f5`: `git diff upstream/PRODUCTION~1 upstream/PRODUCTION -- backend/core/agentpress/response_processor.py`
- [ ] T024 [US1] **HUMAN ANALYSIS**: Identify all modified files and new dependencies in 8b6b16f5
- [ ] T025 [US1] **HUMAN DECISION**: Review changes and approve for cherry-pick
- [ ] T026 [US1] **DEPENDENCY CHECK**: Identify if new imports/packages needed
- [ ] T027 [US1] **FILE PULL**: If new files created, pull them from upstream
- [ ] T028 [US1] **DEPENDENCY PULL**: If dependencies changed, update from upstream
- [ ] T029 [US1] Cherry-pick `8b6b16f5`: `git cherry-pick 8b6b16f5`
- [ ] T030 [US1] **CONFLICT RESOLUTION**: If conflicts, manually resolve and continue
- [ ] T031 [US1] **HUMAN VERIFICATION**: Review cherry-picked changes match expected diffs
- [ ] T032 [US1] Test after T029: Verify timeout logic, check for conflicts with previous commit
- [ ] T033 [US1] Manual test: Verify 5-second drain timeout works correctly

#### Commit 3: e56c2873 (Don't save cancelled responses)

- [ ] T034 [US1] **HUMAN REVIEW**: View file diffs for commit `e56c2873`: `git diff upstream/PRODUCTION~1 upstream/PRODUCTION -- backend/core/agentpress/response_processor.py`
- [ ] T035 [US1] **HUMAN ANALYSIS**: Identify all modified files and new dependencies in e56c2873
- [ ] T036 [US1] **HUMAN DECISION**: Review changes and approve for cherry-pick
- [ ] T037 [US1] **DEPENDENCY CHECK**: Identify if new imports/packages needed
- [ ] T038 [US1] **FILE PULL**: If new files created, pull them from upstream
- [ ] T039 [US1] **DEPENDENCY PULL**: If dependencies changed, update from upstream
- [ ] T040 [US1] Cherry-pick `e56c2873`: `git cherry-pick e56c2873`
- [ ] T041 [US1] **CONFLICT RESOLUTION**: If conflicts, manually resolve and continue
- [ ] T042 [US1] **HUMAN VERIFICATION**: Review cherry-picked changes match expected diffs
- [ ] T043 [US1] Test after T040: Verify finish_reason checks, ensure no duplicates with abadd6a6
- [ ] T044 [US1] Manual test: Verify cancelled responses not saved

#### Commit 4: 26baa2ee (Frontend cleanup and refactoring)

- [ ] T045 [US1] **HUMAN REVIEW**: View file diffs for commit `26baa2ee`: `git diff upstream/PRODUCTION~1 upstream/PRODUCTION -- frontend/src/hooks/useAgentStream.ts`
- [ ] T046 [US1] **HUMAN ANALYSIS**: Identify all modified files and new dependencies in 26baa2ee
- [ ] T047 [US1] **HUMAN DECISION**: Review changes and approve for cherry-pick
- [ ] T048 [US1] **DEPENDENCY CHECK**: Identify if new npm packages needed (check package.json changes)
- [ ] T049 [US1] **FILE PULL**: If new files created, pull them from upstream
- [ ] T050 [US1] **DEPENDENCY PULL**: If dependencies changed, update package.json and run `npm install` or `yarn install`
- [ ] T051 [US1] Cherry-pick `26baa2ee`: `git cherry-pick 26baa2ee`
- [ ] T052 [US1] **CONFLICT RESOLUTION**: If conflicts, manually resolve and continue
- [ ] T053 [US1] **HUMAN VERIFICATION**: Review cherry-picked changes match expected diffs
- [ ] T054 [US1] Test after T051: Verify dependency array changes, check useAgentStream.ts
- [ ] T055 [US1] Manual test: Verify frontend cleanup works correctly

#### Comprehensive Testing & Documentation

- [ ] T056 [US1] Run comprehensive backend tests: `python -m pytest tests/ -v`
- [ ] T057 [US1] Run frontend tests (if applicable): `npm test` or `yarn test`
- [ ] T058 [US1] Manual test: Start conversation, verify streaming works without errors
- [ ] T059 [US1] Manual test: Trigger tool call, verify display without errors
- [ ] T060 [US1] Manual test: Check for console errors or warnings
- [ ] T061 [US1] **HUMAN ANALYSIS**: Review all test results and identify any issues
- [ ] T062 [US1] Document results in `CHERRY_PICK_RESULTS.md` with:
  - Status of each commit (applied/conflicts/skipped)
  - Files modified by each commit
  - Dependencies added/updated
  - New files pulled from upstream
  - Test results for each commit
  - Any manual resolutions made
  - Overall impact assessment
- [ ] T063 [US1] Verify Phase 1 changes: No new render errors, streaming completes, tool calls display correctly

**Conflict Resolution Strategy**:
- If conflicts occur: `git diff --ours` vs `git diff --theirs`, manually review and resolve, `git add <file>`, `git cherry-pick --continue`
- If unresolvable: `git cherry-pick --abort` and document why commit was skipped

**Dependency Management**:
- Backend: Check for new imports in `requirements.txt` or `pyproject.toml`, update if needed
- Frontend: Check for new packages in `package.json`, run `npm install` or `yarn install` if updated
- New Files: Use `git show upstream/PRODUCTION:<filepath>` to pull files not in current branch

**Success Criteria**:
- All 4 commits reviewed and analyzed by human
- All conflicts manually resolved
- All dependencies identified and pulled
- All new files integrated
- All 4 commits applied successfully (or documented as skipped with reason)
- No new console errors
- Streaming works without abrupt termination
- Tool calls display correctly
- No performance regressions

---

## Phase 2: Week 2 Evaluation & Additional Cherry-Picks 📊 PENDING

**Goal**: Evaluate Week 1 results and cherry-pick additional commits from Track 1 if needed

**Approach**: Based on Week 1 outcomes, cherry-pick additional commits to address remaining issues

**Independent Test Criteria**:
- Week 1 results evaluated and documented
- Remaining issues identified (if any)
- Additional commits cherry-picked if needed
- Cumulative impact: 60-80%+ of streaming issues resolved

**Decision Tree**:
- **If 60-80% resolved**: Continue with additional Track 1 commits (79 for #1, 91 for #5)
- **If 30-60% resolved**: Cherry-pick more commits + identify patterns in remaining issues
- **If <30% resolved**: Escalate to Track 2 (native_tool_calling) or from-scratch implementation

### Phase 2 Tasks - Week 2 Evaluation

- [ ] T026 Evaluate Week 1 results: Review `CHERRY_PICK_RESULTS.md` and test outcomes
- [ ] T027 [US1] Identify remaining issues: Compare expected vs actual behavior
- [ ] T028 [US1] Analyze patterns: Determine if remaining issues are in Problem #1 (tool exceptions) or #5 (Redis)
- [ ] T029 [US1] Decision: Proceed with additional Track 1 commits or escalate to Track 2?
- [ ] T030 [P] [US1] If proceeding with Track 1: Cherry-pick additional commits for Problem #1 (tool exception handling)
- [ ] T031 [P] [US1] If proceeding with Track 1: Cherry-pick additional commits for Problem #5 (Redis operations)
- [ ] T032 [US1] Test additional cherry-picks: Verify no new conflicts, streaming behavior improved
- [ ] T033 [US1] Document Week 2 results and decision in `CHERRY_PICK_RESULTS.md`
- [ ] T034 [US1] Verify Phase 2 changes: Cumulative impact on streaming issues resolved

**Success Criteria**:
- Week 1 results documented and analyzed
- Decision made on additional cherry-picks or escalation
- If cherry-picking: Additional commits applied successfully
- Cumulative impact: 60-80%+ of streaming issues resolved

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

**Total Tasks**: 134 (updated with cherry-pick strategy)  
**Phase 0 (Baseline)**: 8 tasks ✅ COMPLETE  
**Phase 0.5 (Upstream Research)**: ✅ COMPLETE (673 commits analyzed, 4 commits identified)  
**Phase 1 (Week 1 Cherry-Picks)**: 17 tasks 🚀 READY TO START  
**Phase 2 (Week 2 Evaluation)**: 9 tasks 📊 PENDING  
**Phase 3 (Error Boundaries)**: 9 tasks  
**Phase 4 (Debug Endpoints)**: 11 tasks  
**Phase 5 (Network Resilience)**: 19 tasks  
**Phase 6 (Testing & Validation)**: 17 tasks  
**Phase 7 (Polish & Cross-Cutting)**: 11 tasks  

**Strategy Change**: Pivoted from "implement from scratch" to "cherry-pick production-tested fixes"  
**Week 1 Focus**: Apply 4 high-priority commits from `upstream/PRODUCTION`  
**Week 2 Focus**: Evaluate results and cherry-pick additional commits if needed  
**Expected Outcome**: 60-80% of streaming issues potentially resolved with Week 1-2 cherry-picks  
**Escalation Path**: Track 1 → Track 2 (native_tool_calling) → Track 3 (parallel_tool) if needed  

**Estimated Duration**: 
- Phase 1 (Week 1): 2-3 days (cherry-pick 4 commits + testing)
- Phase 2 (Week 2): 2-3 days (evaluate + additional cherry-picks if needed)
- Phases 3-7: 2-3 weeks (based on Phase 1-2 outcomes)

**Updated MVP Scope**: Phase 0 + Phase 1 (Week 1 cherry-picks) = Potential 60-80% issue resolution
