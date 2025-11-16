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

## Phase 1: Manual Review & Code Integration (Week 1) 🚀 IN PROGRESS

**Goal**: Apply 4 high-priority commits from `upstream/PRODUCTION` to address 6 of 7 identified problem areas

**Approach**: Manual human review of each commit with COMMIT_hash_REVIEW.md documentation, then manually apply code changes (lower risk, full transparency, better control)

**Independent Test Criteria**:
- ✅ All 4 commits reviewed and documented
- ✅ All 4 commits manually integrated without breaking changes
- ✅ No new console errors or warnings
- ✅ Streaming completes without abrupt termination
- ✅ Tool calls display correctly
- ✅ No performance regressions
- ✅ Potential resolution of 60-80% of streaming issues

**Expected Outcome**: Potential resolution of 60-80% of streaming issues with Week 1 manual integrations

### Phase 1 Tasks - Week 1 Manual Review & Integration

**IMPORTANT**: All tasks are HUMAN-IN-THE-LOOP. Each commit requires:
1. Create COMMIT_hash_REVIEW.md with detailed analysis
2. Human review and approval
3. Manual code integration (not cherry-pick)
4. Testing and verification
5. Document results in CHERRY_PICK_RESULTS.md

#### Preparation Phase

- [X] T009 Prepare implementation branch: `git checkout -b 001-stable-rendering-phase1-track-production`
- [X] T010 [P] Verify upstream remote configured: `git remote -v | grep upstream`
- [X] T011 [P] Fetch all upstream branches: `git fetch upstream PRODUCTION native_tool_calling parallel_tool_calling_and_flow_execution`

#### Commit 1: abadd6a6 (Cancellation event + graceful stoppage)

- [X] T012 [US1] **HUMAN REVIEW**: Create COMMIT_abadd6a6_REVIEW.md with detailed analysis
- [X] T013 [US1] **HUMAN ANALYSIS**: Identify all modified files and new dependencies in abadd6a6
- [X] T014 [US1] **HUMAN DECISION**: Review changes and approve for manual integration
- [X] T014.5 [US1] **HUMAN APPROVAL GATE**: Explicitly approve abadd6a6 integration (documented in CHERRY_PICK_RESULTS.md)
- [X] T015 [US1] **DEPENDENCY CHECK**: Identify if new imports/packages needed (check requirements.txt, pyproject.toml changes)
- [X] T016 [US1] **FILE PULL**: Pull new files created in abadd6a6: `api_sanitized.py`, `message_sanitizer.py`
- [X] T017 [US1] **DEPENDENCY PULL**: Verify no requirements.txt or pyproject.toml changes needed
- [X] T018 [US1] **MANUAL CODE INTEGRATION**: Manually apply code changes from abadd6a6 to:
  - `backend/core/agentpress/response_processor.py` - Add cancellation event system
  - `backend/core/run.py` - Propagate cancellation event parameter
  - `backend/run_agent_background.py` - Create and set cancellation event
  - `backend/core/agentpress/thread_manager.py` - Propagate cancellation event
- [X] T019 [US1] **COMMIT CHANGES**: Stage and commit manual integration: `git add .` then `git commit -m "abadd6a6 manually code additions/reviews"`
- [ ] T020 [US1] **HUMAN VERIFICATION**: Review integrated code matches expected changes from COMMIT_abadd6a6_REVIEW.md
- [ ] T021 [US1] **BACKEND TESTS**: Run backend tests `python -m pytest tests/ -v`, verify no errors
- [ ] T022 [US1] **MANUAL TEST**: Verify response_processor.py changes work correctly (streaming, cancellation, cleanup)

#### Commit 2: 8b6b16f5 (5-second drain timeout)

- [ ] T023 [US1] **HUMAN REVIEW**: Create COMMIT_8b6b16f5_REVIEW.md with detailed analysis
- [ ] T024 [US1] **HUMAN ANALYSIS**: Identify all modified files and new dependencies in 8b6b16f5
- [ ] T025 [US1] **HUMAN DECISION**: Review changes and approve for manual integration
- [ ] T025.5 [US1] **HUMAN APPROVAL GATE**: Explicitly approve 8b6b16f5 integration (document in CHERRY_PICK_RESULTS.md)
- [ ] T026 [US1] **DEPENDENCY CHECK**: Identify if new imports/packages needed
- [ ] T027 [US1] **FILE PULL**: If new files created, pull them from upstream
- [ ] T028 [US1] **DEPENDENCY PULL**: If dependencies changed, update from upstream
- [ ] T029 [US1] **MANUAL CODE INTEGRATION**: Manually apply code changes from 8b6b16f5 to response_processor.py
- [ ] T030 [US1] **COMMIT CHANGES**: Stage and commit manual integration
- [ ] T031 [US1] **HUMAN VERIFICATION**: Review integrated code matches expected changes from COMMIT_8b6b16f5_REVIEW.md
- [ ] T032 [US1] **BACKEND TESTS**: Run backend tests `python -m pytest tests/ -v`, verify no conflicts with previous commit
- [ ] T033 [US1] **MANUAL TEST**: Verify 5-second drain timeout works correctly

#### Commit 3: e56c2873 (Don't save cancelled responses)

- [ ] T034 [US1] **HUMAN REVIEW**: Create COMMIT_e56c2873_REVIEW.md with detailed analysis
- [ ] T035 [US1] **HUMAN ANALYSIS**: Identify all modified files and new dependencies in e56c2873
- [ ] T036 [US1] **HUMAN DECISION**: Review changes and approve for manual integration
- [ ] T036.5 [US1] **HUMAN APPROVAL GATE**: Explicitly approve e56c2873 integration (document in CHERRY_PICK_RESULTS.md)
- [ ] T037 [US1] **DEPENDENCY CHECK**: Identify if new imports/packages needed
- [ ] T038 [US1] **FILE PULL**: If new files created, pull them from upstream
- [ ] T039 [US1] **DEPENDENCY PULL**: If dependencies changed, update from upstream
- [ ] T040 [US1] **MANUAL CODE INTEGRATION**: Manually apply code changes from e56c2873 to response_processor.py
- [ ] T041 [US1] **COMMIT CHANGES**: Stage and commit manual integration
- [ ] T042 [US1] **HUMAN VERIFICATION**: Review integrated code matches expected changes from COMMIT_e56c2873_REVIEW.md
- [ ] T043 [US1] **BACKEND TESTS**: Run backend tests `python -m pytest tests/ -v`, verify no conflicts with previous commits
- [ ] T044 [US1] **MANUAL TEST**: Verify cancelled responses not saved, ensure no duplicates with abadd6a6

#### Commit 4: 26baa2ee (Frontend cleanup and refactoring)

- [ ] T045 [US1] **HUMAN REVIEW**: Create COMMIT_26baa2ee_REVIEW.md with detailed analysis
- [ ] T046 [US1] **HUMAN ANALYSIS**: Identify all modified files and new dependencies in 26baa2ee
- [ ] T047 [US1] **HUMAN DECISION**: Review changes and approve for manual integration
- [ ] T047.5 [US1] **HUMAN APPROVAL GATE**: Explicitly approve 26baa2ee integration (document in CHERRY_PICK_RESULTS.md)
- [ ] T048 [US1] **DEPENDENCY CHECK**: Identify if new npm packages needed (check package.json changes)
- [ ] T049 [US1] **FILE PULL**: If new files created, pull them from upstream
- [ ] T050 [US1] **DEPENDENCY PULL**: If dependencies changed, update package.json and run `npm install` or `yarn install`
- [ ] T051 [US1] **MANUAL CODE INTEGRATION**: Manually apply code changes from 26baa2ee to useAgentStream.ts and related files
- [ ] T052 [US1] **COMMIT CHANGES**: Stage and commit manual integration
- [ ] T053 [US1] **HUMAN VERIFICATION**: Review integrated code matches expected changes from COMMIT_26baa2ee_REVIEW.md
- [ ] T054 [US1] **FRONTEND TESTS**: Run frontend tests `npm test` or `yarn test`, verify dependency array changes
- [ ] T055 [US1] **MANUAL TEST**: Verify frontend cleanup works correctly

#### Logging & Observability (Phase 1)

- [ ] T056a [US1] **ADD DEBUG LOGGING**: Add debug logging to abadd6a6 changes in `response_processor.py` (log cancellation events, graceful stoppage)
- [ ] T056b [US1] **ADD DEBUG LOGGING**: Add debug logging to 8b6b16f5 changes (log drain timeout triggers and duration)
- [ ] T056c [US1] **ADD DEBUG LOGGING**: Add debug logging to e56c2873 changes (log finish_reason checks and response save decisions)
- [ ] T056d [US1] **ADD DEBUG LOGGING**: Add debug logging to 26baa2ee changes in `useAgentStream.ts` (log dependency array changes and hook lifecycle)
- [ ] T056e [US1] **MONITOR REACT ERRORS**: During all manual tests, monitor browser console for "Maximum update depth exceeded" warnings and log any occurrences

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

**Conflict Resolution Strategy** (HUMAN-IN-THE-LOOP):

When conflicts occur during cherry-pick:

1. **HUMAN REVIEW**: Examine conflicts
   - `git status` - See conflicted files
   - `git diff --ours` - See our current version
   - `git diff --theirs` - See upstream version
   - `git diff --ours --theirs` - See full diff with markers

2. **HUMAN ANALYSIS**: Understand the conflict
   - Why did this conflict occur?
   - Which version is correct for our codebase?
   - Are there dependencies on both versions?
   - Does this conflict affect other cherry-picks?

3. **HUMAN DECISION**: Choose resolution approach
   - **Option A**: Keep our version (ours): `git checkout --ours <file>`
   - **Option B**: Take upstream version (theirs): `git checkout --theirs <file>`
   - **Option C**: Manual merge: Edit file to combine both versions
   - **Option D**: Abort and skip: `git cherry-pick --abort`

4. **HUMAN VERIFICATION**: Validate resolution
   - Review the resolved file for correctness
   - Ensure no syntax errors or broken logic
   - Check that dependencies are satisfied
   - Verify the resolution aligns with commit intent

5. **COMPLETION**:
   - `git add <file>` - Mark as resolved
   - `git cherry-pick --continue` - Continue cherry-pick
   - OR `git cherry-pick --abort` - Abort if unresolvable

**If Unresolvable**:
- `git cherry-pick --abort` - Abort the cherry-pick
- Document in `CHERRY_PICK_RESULTS.md`:
  - Which commit was skipped and why
  - What conflicts prevented resolution
  - Recommendation for manual integration later
  - Impact on streaming fixes

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

- [ ] T064 Evaluate Week 1 results: Review `CHERRY_PICK_RESULTS.md` and test outcomes
- [ ] T065 [US1] Identify remaining issues: Compare expected vs actual behavior
- [ ] T066 [US1] Analyze patterns: Determine if remaining issues are in Problem #1 (tool exceptions) or #5 (Redis)
- [ ] T067 [US1] Decision: Proceed with additional Track 1 commits or escalate to Track 2?
- [ ] T068 [P] [US1] If proceeding with Track 1: Cherry-pick additional commits for Problem #1 (tool exception handling)
- [ ] T069 [P] [US1] If proceeding with Track 1: Cherry-pick additional commits for Problem #5 (Redis operations)
- [ ] T070 [US1] Test additional cherry-picks: Verify no new conflicts, streaming behavior improved
- [ ] T071 [US1] Document Week 2 results and decision in `CHERRY_PICK_RESULTS.md`
- [ ] T072 [US1] Verify Phase 2 changes: Cumulative impact on streaming issues resolved

**Success Criteria**:
- Week 1 results documented and analyzed
- Decision made on additional cherry-picks or escalation
- If cherry-picking: Additional commits applied successfully
- Cumulative impact: 60-80%+ of streaming issues resolved

### 🚨 MVP VALIDATION GATE (CRITICAL)

**BEFORE PROCEEDING TO PHASES 3-7**, Phase 2 evaluation MUST complete and meet one of these criteria:

1. **✅ PROCEED WITH PHASES 3-7**: If Phase 1-2 cherry-picks achieve **60-80%+ issue resolution**
   - Streaming is stable without abrupt termination
   - Tool calls display correctly
   - No new React render errors
   - Proceed to Phase 3 (Error Boundaries)

2. **⚠️ CONDITIONAL PROCEED**: If Phase 1-2 cherry-picks achieve **30-60% issue resolution**
   - Some streaming issues remain
   - Additional Track 1 commits cherry-picked in Phase 2
   - Proceed to Phase 3 with understanding that additional fixes may be needed
   - Monitor Phase 6 testing closely for remaining issues

3. **❌ ESCALATE**: If Phase 1-2 cherry-picks achieve **<30% issue resolution**
   - Track 1 approach insufficient
   - **DO NOT PROCEED** to Phases 3-7
   - **ESCALATE** to Track 2 (native_tool_calling branch) or from-scratch implementation
   - Document findings in `CHERRY_PICK_RESULTS.md` for future reference

**Gate Enforcement**:
- [ ] T072.5 [US1] **PHASE 2 COMPLETION GATE**: Evaluate Phase 2 results against criteria above
- [ ] T072.6 [US1] **DECISION GATE**: Document decision (proceed/conditional/escalate) in `CHERRY_PICK_RESULTS.md`
- [ ] T072.7 [US1] **ESCALATION TRIGGER** (if <30% resolved): Create escalation report and notify team before proceeding

---

## Phase 3: Error Boundaries for Tool Call Rendering

**Goal**: Add minimal error boundaries around known problem areas (tool calls, message rendering) to prevent cascading failures

**Independent Test Criteria**:
- Error boundaries catch tool rendering errors without crashing UI
- Fallback UI displays gracefully
- No infinite error loops
- Streaming continues despite tool call errors

### Phase 3 Tasks

- [ ] T073 [P] [US1] Create `ToolCallErrorBoundary` component in `frontend/src/components/common/ToolCallErrorBoundary.tsx`
- [ ] T074 [P] [US1] Implement error logging in `ToolCallErrorBoundary` with component stack trace
- [ ] T075 [P] [US1] Add fallback UI for tool call rendering errors in `ToolCallErrorBoundary`
- [ ] T076 [P] [US1] Wrap `ShowToolStream` component with `ToolCallErrorBoundary` in rendering logic
- [ ] T077 [P] [US1] Create `ThreadContentErrorBoundary` component in `frontend/src/components/common/ThreadContentErrorBoundary.tsx`
- [ ] T078 [P] [US1] Wrap `ThreadContent` component with `ThreadContentErrorBoundary`
- [ ] T079 [US1] Manual test Phase 3: Trigger malformed tool call, verify error boundary catches it
- [ ] T080 [US1] Manual test Phase 3: Verify fallback UI displays, streaming continues
- [ ] T081 [US1] Verify Phase 3 changes: No infinite error loops, UI remains responsive

---

## Phase 4: Custom Debug Endpoints

**Goal**: Add isolated debug endpoints for monitoring and troubleshooting (minimal upstream impact)

**Independent Test Criteria**:
- `/render-performance/metrics` endpoint accepts and logs render metrics
- `/debug/streaming-events` endpoint accepts and logs streaming events
- Debug endpoints don't affect core streaming functionality
- Metrics can be used for performance analysis

### Phase 4 Tasks

- [ ] T082 [P] Create `backend/api/debug.py` with debug endpoint routes
- [ ] T083 [P] Implement `/render-performance/metrics` POST endpoint in `backend/api/debug.py`
- [ ] T084 [P] Add render metrics logging with threshold warnings (>50 renders) in metrics endpoint
- [ ] T085 [P] Implement `/debug/streaming-events` POST endpoint in `backend/api/debug.py`
- [ ] T086 [P] Add streaming event logging (retry, timeout, error, reconnect, malformed_response) in debug endpoint
- [ ] T087 [P] Register debug routes in `backend/main.py` or `backend/api/__init__.py`
- [ ] T088 [P] [US3] Add frontend metrics reporting to `useAgentStream` hook for render counts
- [ ] T089 [P] [US3] Add frontend event reporting to `useAgentStream` for streaming errors/retries
- [ ] T090 [US3] Manual test Phase 4: Trigger render metrics endpoint, verify metrics logged
- [ ] T091 [US3] Manual test Phase 4: Trigger streaming error, verify event logged to debug endpoint
- [ ] T092 [US3] Verify Phase 4 changes: Debug endpoints isolated, no impact on core streaming

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

- [ ] T093 [P] [US1] Update streaming timeout configuration in `frontend/src/hooks/useAgentStream.ts`
- [ ] T094 [P] [US1] Set silenceThreshold to 15000ms (15 seconds) in useAgentStream config
- [ ] T095 [P] [US1] Set maxRetries to 10 in useAgentStream config
- [ ] T096 [P] [US1] Set retryInterval to 5000ms (5 seconds linear) in useAgentStream config
- [ ] T097 [P] [US1] Set keepAliveInterval to 10000ms (10 seconds) in useAgentStream config
- [ ] T098 [P] [US1] Implement retry logic in `useAgentStream` with linear backoff (not exponential)
- [ ] T099 [P] [US1] Add reconnection logic to EventSource error handler in `useAgentStream`
- [ ] T100 [P] [US1] Maintain UI pulsing/live animations during throttle in `ThreadContent` message display - ensure animations never stop during retries. **Animation Details**: When `streamHookStatus === 'streaming' || 'connecting'` and no text content is available, display three pulsing dots (h-1 w-1 rounded-full) with staggered delays (0ms, 150ms, 300ms) using Tailwind's `animate-pulse duration-1000` class. Animation must remain visible and continuous during all 10 retry attempts; do NOT reset animation state or hide dots during retries.
- [ ] T101 [P] [US1] Implement stream cleanup on navigation to prevent stale subscriptions
- [ ] T102 [P] [US1] Create toast notification component for streaming errors in `frontend/src/components/common/StreamingErrorToast.tsx`
- [ ] T103 [P] [US1] Implement "Try Again" button in chat message area for manual stream retry after all automatic retries exhausted
- [ ] T104 [P] [US1] Add logic to show toast notification only after all 10 automatic retries fail (not during retries)
- [ ] T105 [P] [US1] Ensure animations remain consistent and continuous during all retry attempts - no flicker or animation reset. **Verification Criteria**: (1) Pulsing dots visible continuously from first retry through 10th retry attempt, (2) No animation interruption when status changes between 'streaming' and 'connecting', (3) Dots maintain consistent opacity/brightness throughout (no sudden dimming/brightening), (4) Staggered timing preserved (dots pulse in sequence, not synchronized)
- [ ] T106 [US1] Manual test Phase 5: Simulate 15 second network silence, verify pulsing animation continues uninterrupted
- [ ] T107 [US1] Manual test Phase 5: Verify toast notification appears only after all retries exhausted
- [ ] T108 [US1] Manual test Phase 5: Verify "Try Again" button works and retriggers stream
- [ ] T109 [US1] Manual test Phase 5: Simulate network disconnection, verify reconnection succeeds
- [ ] T110 [US1] Manual test Phase 5: Verify UI maintains pulsing appearance during throttle without interruption
- [ ] T111 [US1] Verify Phase 5 changes: Timeouts correct, retries work, reconnection succeeds, animations stable

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

- [ ] T112 [US1] Manual test: Basic streaming - Start conversation, verify tokens stream smoothly
- [ ] T113 [US1] Manual test: Tool call rendering - Trigger tool call, verify display without errors
- [ ] T114 [US1] Manual test: Rapid input - Send multiple prompts quickly, verify UI responsive
- [ ] T115 [US1] Manual test: Long tool output - Trigger tool with large output, verify no performance degradation
- [ ] T116 [US1] Manual test: Network resilience - Simulate disconnect/reconnect, verify recovery
- [ ] T117 [US1] Manual test: Malformed response - Trigger malformed tool call, verify graceful handling
- [ ] T118 [US1] Manual test: Concurrent streams - Double-click submit, verify no overlapping renders
- [ ] T119 [US1] Manual test: Error boundary - Trigger tool rendering error, verify fallback UI
- [ ] T120 [US1] Manual test: Throttle scenario - Simulate backend throttle, verify UI maintains pulsing
- [ ] T121 [US1] Performance verification: Render counts reduced by 50%+ for critical components
- [ ] T122 [US1] Performance verification: Streaming latency <100ms
- [ ] T123 [US1] Performance verification: Zero "Maximum update depth exceeded" errors
- [ ] T124 [US2] Manual test: Feature parity - Verify cherry-picked features work correctly
- [ ] T125 [US2] Manual test: Smoke test - Run through basic workflows, verify no regressions
- [ ] T126 [US3] Verify logging: Check debug endpoints capture metrics and events
- [ ] T127 [US3] Verify observability: Logs describe failures without overwhelming volume
- [ ] T128 [US3] Verify observability: Confirm debug endpoints capture all required metrics and events without overwhelming volume

---

## Phase 7: Polish & Cross-Cutting Concerns

**Goal**: Final cleanup, documentation, and performance tuning

**Independent Test Criteria**:
- All code follows Suna conventions
- Documentation is complete and accurate
- Performance targets met
- Ready for production deployment

### Phase 7 Tasks

- [ ] T129 [P] Review all code changes for Suna conventions and style consistency
- [ ] T130 [P] Update CHERRY_PICK_LOG.md with final summary and lessons learned
- [ ] T131 [P] Document all Phase 0-6 changes in feature branch commit messages
- [ ] T132 [P] Create performance baseline comparison (before/after metrics)
- [ ] T133 [P] Verify all files have proper imports and dependencies
- [ ] T134 [P] Run linter on all modified files: `npm run lint` (frontend), `pylint` (backend)
- [ ] T135 [P] Test Windows compatibility: Verify asyncio and file paths work on Windows
- [ ] T136 Update `.docs/guidelines/Rendering_React_Best_Practices.md` with learnings from this feature
- [ ] T137 Create rollback plan documentation in feature branch
- [ ] T138 Final validation: Run full manual test checklist one more time
- [ ] T139 Prepare PR description with summary of changes and testing results

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

**Phase 1** (Week 1 Cherry-Picks - HUMAN-IN-THE-LOOP):
- T009-T011: Preparation (sequential, must complete first)
- T012-T022: Commit 1 (sequential, human review → cherry-pick → test)
- T023-T033: Commit 2 (sequential, human review → cherry-pick → test)
- T034-T044: Commit 3 (sequential, human review → cherry-pick → test)
- T045-T055: Commit 4 (sequential, human review → cherry-pick → test)
- T056-T063: Testing & Documentation (sequential, dependent on all commits)
- **Note**: Each commit's human review can start in parallel, but cherry-pick must wait for approval

**Phase 2** (Week 2 Evaluation):
- T064-T067: Evaluation (sequential, must complete before decisions)
- T068-T069: Additional cherry-picks (parallel if proceeding with Track 1)
- T070-T072: Testing & Documentation (sequential, dependent on cherry-picks)

**Phase 3** (Error Boundaries):
- T073-T078: Component creation (can run in parallel, different files)
- T079-T081: Testing (sequential, dependent on T073-T078)

**Phase 4** (Debug Endpoints):
- T082-T087: Backend endpoints (can run in parallel, different endpoints)
- T088-T089: Frontend reporting (can run in parallel, independent of backend)
- T090-T092: Testing (sequential, dependent on all)

**Phase 5** (Network Resilience):
- T093-T105: Configuration & implementation (can run in parallel, different aspects)
- T106-T111: Testing (sequential, dependent on T093-T105)

**Phase 6** (Testing & Validation):
- T112-T120: Manual tests (can run in parallel, independent scenarios)
- T121-T123: Performance verification (can run in parallel)
- T124-T128: Feature & observability tests (can run in parallel)

**Phase 7** (Polish & Cross-Cutting):
- T129-T135: Code review & documentation (can run in parallel, different concerns)
- T136-T139: Final validation (sequential, dependent on all)

### Suggested MVP Scope

**Minimum Viable Product** (Phase 0 + Phase 1):
- ✅ Phase 0: Establish clean baseline (COMPLETE)
- 🚀 Phase 1: Cherry-pick 4 production-tested commits (READY)
- **Expected Result**: 60-80% of streaming issues resolved
- **Effort**: 2-3 days
- **Risk**: Low (production-tested commits)
- **Timeline**: Week 1

This MVP addresses the core streaming failures with proven production fixes and establishes the foundation for subsequent optimization phases.

**Phase 1.5 (Optional)**: If Phase 1 achieves 60-80% resolution, proceed directly to Phase 6 (Testing & Validation) to validate improvements before continuing with Phases 3-5.

### Recommended Execution Plan

**Week 1 (Phase 1 - MVP)**:
- T009-T011: Preparation (0.5 day)
- T012-T022: Commit 1 cherry-pick + test (0.5 day)
- T023-T033: Commit 2 cherry-pick + test (0.5 day)
- T034-T044: Commit 3 cherry-pick + test (0.5 day)
- T045-T055: Commit 4 cherry-pick + test (0.5 day)
- T056-T063: Comprehensive testing + documentation (1 day)

**Week 2 (Phase 2 - Evaluation)**:
- T064-T072: Evaluate results and decide on additional cherry-picks (2-3 days)
- If 60-80% resolved: Proceed to Phase 6 (Testing & Validation)
- If 30-60% resolved: Cherry-pick additional commits + Phase 6
- If <30% resolved: Escalate to Track 2 or from-scratch implementation

**Week 3+ (Phases 3-7 - Optimization & Polish)**:
- Phase 3: Error Boundaries (1-2 days)
- Phase 4: Debug Endpoints (1-2 days)
- Phase 5: Network Resilience (2-3 days)
- Phase 6: Testing & Validation (2-3 days)
- Phase 7: Polish & Cross-Cutting (1-2 days)

Each phase includes manual testing to validate improvements before proceeding.

---

## Implementation Strategy

### Key Principles

1. **Upstream Parity**: No API changes, no new message types, internal optimizations only
2. **Incremental Validation**: Test after each phase before proceeding
3. **Manual Testing**: Complex streaming behavior requires human validation
4. **Careful Review**: Core rendering components reviewed with extreme caution
5. **Documentation**: All decisions and cherry-picks documented

### Functional Requirements to Task Mapping

| Requirement | Description | Task IDs | Phase |
|-------------|-------------|----------|-------|
| **FR-001** | Render response streaming tokens in append-only list | T012-T063, T112-T120 | 1, 6 |
| **FR-002** | Handle backend throttle/malformed errors without React max depth | T012-T055, T073-T081 | 1, 3 |
| **FR-003** | Engineers can cherry-pick stable code selectively | T009-T063 | 1 |
| **FR-004** | Logging/Metrics capture stream lifecycle events | T056a-T056e, T082-T092 | 1, 4 |
| **FR-006** | UI state cleanup cancels stale subscriptions | T101, T106-T111 | 5 |
| **FR-007** | Frontend maintains live animations during throttle | T100, T106-T111 | 5 |
| **FR-008** | Frontend batches streaming payloads | Phase 2 evaluation | 2 |
| **FR-009** | Error boundaries on tool call displays | T073-T081 | 3 |
| **FR-010** | Handle complex tool calls without degradation | T012-T055, T112-T120 | 1, 6 |
| **FR-011** | Network disconnection/reconnection recovery | T093-T111 | 5 |
| **FR-012** | Prevent concurrent stream conflicts | T118, T120 | 6 |

### Success Criteria

- ✅ Zero "Maximum update depth exceeded" errors
- ✅ Streaming latency <100ms
- ✅ Render count reduced 50%+ for critical components
- ✅ Graceful handling of network failures and malformed responses
- ✅ Upstream sync-safe implementation
- ✅ All user stories independently testable and completable
- ✅ All 12 functional requirements mapped to executable tasks

### Rollback Strategy

If issues arise:
1. Revert to `dev` branch
2. Disable specific optimizations via feature flags
3. Enable verbose logging to identify issues
4. Use browser dev tools to compare before/after

---

## Task Summary

**Total Tasks**: 139 (comprehensive human-in-the-loop cherry-pick + optimization workflow)

### Task Breakdown by Phase

| Phase | Name | Tasks | Status | Duration |
|-------|------|-------|--------|----------|
| 0 | Baseline Analysis | T001-T008 (8) | ✅ COMPLETE | Done |
| 0.5 | Upstream Research | Research Complete | ✅ COMPLETE | Done |
| 1 | Week 1 Cherry-Picks | T009-T063 (55) | 🚀 READY | 2-3 days |
| 2 | Week 2 Evaluation | T064-T072 (9) | 📊 PENDING | 2-3 days |
| 3 | Error Boundaries | T073-T081 (9) | ⏳ BLOCKED | 1-2 days |
| 4 | Debug Endpoints | T082-T092 (11) | ⏳ BLOCKED | 1-2 days |
| 5 | Network Resilience | T093-T111 (19) | ⏳ BLOCKED | 2-3 days |
| 6 | Testing & Validation | T112-T128 (17) | ⏳ BLOCKED | 2-3 days |
| 7 | Polish & Cross-Cutting | T129-T139 (11) | ⏳ BLOCKED | 1-2 days |

### Key Metrics

**Strategy**: Pivoted from "implement from scratch" to "cherry-pick production-tested fixes"
- **Lower Risk**: Commits tested in production deployments
- **Faster Timeline**: Week 1 cherry-picks vs weeks of research + implementation
- **High Coverage**: 6 of 7 problem areas addressed (86%)
- **Clear Escalation**: Track 1 → Track 2 → Track 3 if needed

**Week 1 Focus**: Apply 4 high-priority commits from `upstream/PRODUCTION`
- `abadd6a6` - Cancellation event + graceful stoppage (Problem #2, #3)
- `8b6b16f5` - 5-second drain timeout (Problem #6)
- `e56c2873` - Don't save cancelled responses (Problem #3)
- `26baa2ee` - Frontend cleanup and refactoring (Problem #4, #7)

**Week 2 Focus**: Evaluate results and cherry-pick additional commits if needed
- If 60-80% resolved: Continue with additional Track 1 commits
- If 30-60% resolved: Cherry-pick more + identify patterns
- If <30% resolved: Escalate to Track 2 or from-scratch implementation

**Expected Outcome**: 60-80% of streaming issues potentially resolved with Week 1-2 cherry-picks

### Phase 1 Task Details (55 tasks)

**Preparation** (T009-T011): 3 tasks
- Create implementation branch
- Verify upstream remote
- Fetch all upstream branches

**Per Commit** (4 commits × 11 tasks = 44 tasks):
- HUMAN REVIEW: View file diffs
- HUMAN ANALYSIS: Identify modified files and dependencies
- HUMAN DECISION: Approve changes
- DEPENDENCY CHECK: Identify new imports/packages
- FILE PULL: Pull new files from upstream
- DEPENDENCY PULL: Update requirements.txt/package.json
- Cherry-pick: Apply commit
- CONFLICT RESOLUTION: Manually resolve conflicts
- HUMAN VERIFICATION: Verify changes match expected diffs
- Testing: Run tests and manual verification

**Comprehensive Testing & Documentation** (T056-T063): 8 tasks
- Run comprehensive backend/frontend tests
- Manual testing (streaming, tool calls, console errors)
- Human analysis of test results
- Document all results in CHERRY_PICK_RESULTS.md

### Estimated Timeline

- **Phase 1 (Week 1)**: 2-3 days (cherry-pick 4 commits + testing)
- **Phase 2 (Week 2)**: 2-3 days (evaluate + additional cherry-picks if needed)
- **Phases 3-7**: 2-3 weeks (based on Phase 1-2 outcomes)
- **Total**: 3-4 weeks to complete all phases

### MVP Scope

**Minimum Viable Product**: Phase 0 + Phase 1 (Week 1 cherry-picks)
- **Expected Result**: 60-80% of streaming issues resolved
- **Effort**: 2-3 days
- **Risk**: Low (production-tested commits)
- **Next Steps**: Evaluate Phase 2 based on Phase 1 results

### Parallelization Opportunities

**Phase 1**: Human-in-the-loop tasks are sequential (each commit must be reviewed before cherry-picking)
**Phase 3-7**: Can run in parallel with Phase 1-2 if additional team members available
**Testing**: Manual tests can be parallelized across different scenarios

### Success Criteria

✅ All 4 commits reviewed and analyzed by human
✅ All conflicts manually resolved
✅ All dependencies identified and pulled
✅ All new files integrated
✅ All 4 commits applied successfully (or documented as skipped with reason)
✅ No new console errors
✅ Streaming works without abrupt termination
✅ Tool calls display correctly
✅ No performance regressions
✅ 60-80% of streaming issues resolved
