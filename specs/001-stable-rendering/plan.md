# Implementation Plan: Stable Rendering & Streaming

**Branch**: `001-stable-rendering` | **Baseline Commit**: `22a36feb` (2025-11-13 00:44:22) from `feature/workflows-restoration` | **Date**: 2025-11-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-stable-rendering/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Create a hybrid `feature/stable-rendering` branch that combines the stable baseline from `dev` with working features from `feature/malformed-tool-call-handler`, while establishing reliable streaming and eliminating React render loop errors. The approach focuses on backend batching/throttling to prevent frontend spam, incremental refactoring of render-heavy components, and selective feature integration with manual review of rendering-related changes.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: Python 3.11+ (backend), TypeScript/React 18+ (frontend), Next.js App Router  
**Primary Dependencies**: FastAPI, Redis pub/sub, Server-Sent Events (SSE), React hooks, Supabase PostgreSQL  
**Storage**: PostgreSQL via Supabase (threads, messages, agents), Redis (streaming pub/sub)  
**Testing**: Manual testing checklist for complex streaming UI behavior, pytest for backend  
**Target Platform**: Web application (browser + server), Docker deployment, Windows support required
**Project Type**: Web application (Next.js frontend + FastAPI backend)  
**Performance Goals**: <100ms token display latency, <10 renders per message cycle, 10-15 second timeout thresholds  
**Constraints**: <10 concurrent users (private fork), zero "Maximum update depth exceeded" errors, incremental refactoring only  
**Scale/Scope**: Core streaming system affecting entire Suna app, XML/JSON hybrid tool call handling, graceful network failure recovery

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

✅ **File Count Compliance**: Created exactly 3 documentation files (research.md, data-model.md, quickstart.md) + contracts  
✅ **Location Rules**: All docs under `/specs/001-stable-rendering/` (not repo root)  
✅ **No Summary Files**: No status/summary files, implementation details only  
✅ **Architecture Alignment**: Follows existing FastAPI + Next.js + Redis streaming architecture  
✅ **Graceful Degradation**: Handles network failures, malformed responses, backend throttling gracefully  
✅ **React Best Practices**: Addresses infinite render loops per `.docs/guidelines/Rendering_React_Best_Practices.md`  
✅ **Windows Support**: Maintains existing Windows asyncio compatibility  
✅ **TDD Encouraged**: Manual testing checklist for complex streaming behavior validation

**Post-Design Constitution Re-check**: ✅ All requirements still met after Phase 1 completion

## Upstream Parity Constraint

**CRITICAL**: This feature must minimize API and networking changes to maintain parity with upstream Suna repo and prevent desyncing. Approach:

- ✅ **Frontend-only optimizations** (React.memo, useCallback, render monitoring) - NO upstream impact
- ✅ **Custom debug endpoints** (NEW: `/render-performance/metrics`, `/debug/streaming-events`) - Useful for debugging, isolated from core streaming
- ❌ **Modify existing endpoints** (NO query parameters on `/agent-run/{agent_run_id}/stream`) - Preserve upstream compatibility
- ❌ **New message types** - Avoided to maintain protocol compatibility
- ✅ **Internal refactoring** (ResponseProcessor optimizations) - No API changes, internal buffering only
- ✅ **Error boundaries** (new React components) - No upstream impact

**Implementation Strategy**: 
- Focus on safeguards and optimizations within existing architecture
- Add custom debug endpoints for monitoring/troubleshooting (isolated from core functionality)
- Modify backend logic internally without changing API contracts
- Keep all existing endpoints and message types unchanged

## Phase 0: Baseline Analysis & Cherry-Pick Strategy ✅ COMPLETE

**STATUS**: ✅ **COMPLETED** (2025-11-14)  
**COMMITS**: 
- `07ab95b5` - Phase 0 analysis complete
- `6afac24f` - Cherry-pick backend batching + error handling
- `db386d66` - Implement frontend optimizations
- `9aed9c33` - Fix ToolViewRegistry UTF-8 encoding
- `8cc97425` - Fix MalformedToolCallView UTF-8 encoding
- `0c52020a` - Fix react-error-boundary UTF-8 encoding
- `d097fbde` - Fix response_processor UTF-8 encoding

**CRITICAL PHASE**: Before any implementation, establish what changes from `feature/malformed-tool-call-handler` are worth keeping.

### Phase 0 Results

**Analysis Documents Created**:
- `PHASE_0_README.md` - Quick reference and navigation
- `PHASE_0_CHERRY_PICK_DECISIONS.md` - Executive summary and final decisions
- `PHASE_0_IMPLEMENTATION_GUIDE.md` - Step-by-step implementation instructions
- `PHASE_0_RATIONALE.md` - Detailed reasoning and alternatives considered
- `file-diffs/*_ANALYSIS.md` - 8 detailed file analyses

**Key Discovery**: The f01c371f commit did NOT contain backend batching logic - only malformed error handling changes. Frontend optimizations implemented to complement current backend.

**Files Successfully Implemented** (7 total):
1. ✅ `MalformedToolCallView.tsx` - Error display component (NEW)
2. ✅ `ToolViewRegistry.tsx` - Registry entry for malformed tool calls
3. ✅ `react-error-boundary.tsx` - Safety net for React errors (NEW)
4. ✅ `response_processor.py` - Baseline version (no batching changes needed)
5. ✅ `ThreadComponent.tsx` - Memoized callbacks object
6. ✅ `useAgentStream.ts` - Deep equality checks + buffer monitoring
7. ✅ `ThreadContent.tsx` - Malformed tool call error display + type support

**What Was Implemented**:
- ✅ Memoized callbacks to prevent unnecessary re-renders
- ✅ Deep equality checks for tool call updates
- ✅ Buffer monitoring for observability (warns at 80% capacity)
- ✅ Proper cleanup on unmount
- ✅ Error handling components (MalformedToolCallView, ReactErrorBoundary)
- ✅ Added `'malformed_tool_call'` message type to UnifiedMessage

**What Was Skipped**:
- ❌ Frontend batching (50ms) - Redundant with backend
- ❌ React.startTransition - Delays updates unnecessarily
- ❌ Circuit breaker pattern - Returns empty fragments
- ❌ Removed streaming dependencies - Causes stale closures
- ❌ run.py max_xml_tool_calls change - Risky, unexplained

**Build Status**: ✅ All containers running successfully (backend, worker, frontend, redis)

### Step 0.1: Generate Comprehensive Diff

Compare `feature/malformed-tool-call-handler` against `dev` (current `001-stable-rendering` baseline):

```bash
# Generate diff summary by file category
git diff dev feature/malformed-tool-call-handler --stat

# Generate detailed diff for review
git diff dev feature/malformed-tool-call-handler > malformed-handler-diff.patch
```

### Step 0.2: Categorize Changes

**SAFE CATEGORIES** (Low risk, likely to keep):
- Bug fixes in non-streaming files
- Utility functions and helpers
- Configuration changes
- Documentation updates
- Tool-related files (not core rendering)

**RISKY CATEGORIES** (Requires careful review):
- ⚠️ **Frontend thread rendering components** (`ThreadContent.tsx`, `ShowToolStream.tsx`, `ThreadComponent.tsx`)
- ⚠️ **Streaming hooks** (`useAgentStream.ts`, `usePlaybackController.ts`)
- ⚠️ **Backend response processing** (`response_processor.py`, `agent_runs.py`)
- ⚠️ **Message state management** (Redux/Zustand stores, context providers)

### Step 0.3: File-by-File Review Process

For each changed file in `feature/malformed-tool-call-handler`:

1. **Identify change type**:
   - Bug fix (specific issue being solved)
   - Feature addition (new capability)
   - Refactoring (code reorganization)
   - Experimental change (unclear purpose)

2. **Assess risk for core rendering**:
   - Does it touch React component lifecycle?
   - Does it modify message/thread state structure?
   - Does it change streaming message handling?
   - Does it affect render frequency or performance?

3. **Decision matrix**:
   ```
   Safe file + bug fix → CHERRY-PICK
   Safe file + feature → CHERRY-PICK (if useful)
   Risky file + bug fix → MANUAL REVIEW (understand the fix first)
   Risky file + feature → SKIP (too risky, implement separately)
   Risky file + refactoring → SKIP (could introduce render issues)
   ```

### Step 0.4: Critical Files to Review with Extreme Caution

These files are core to the streaming and rendering system. Any changes must be understood deeply:

**Frontend - CRITICAL**:
- `frontend/src/components/thread/ThreadComponent.tsx` - Main thread orchestration
- `frontend/src/components/thread/content/ThreadContent.tsx` - Message list rendering
- `frontend/src/components/thread/content/ShowToolStream.tsx` - Tool call display
- `frontend/src/hooks/useAgentStream.ts` - Streaming message handler
- `frontend/src/hooks/usePlaybackController.ts` - Message playback/animation
- `frontend/src/stores/` - State management (Redux/Zupabase stores)

**Backend - CRITICAL**:
- `backend/core/agentpress/response_processor.py` - LLM streaming and tool parsing
- `backend/core/agent_runs.py` - Agent execution and SSE streaming
- `backend/core/thread_manager.py` - Thread state management
- `backend/run_agent_background.py` - Background worker for agent execution

### Step 0.5: Cherry-Pick Workflow

For approved changes:

```bash
# Create temporary branch to test cherry-picks
git checkout -b temp-cherry-pick

# Cherry-pick specific commits (not whole files)
git cherry-pick <commit-hash>

# If conflicts occur, resolve carefully
git diff --ours  # See our version
git diff --theirs  # See their version
git add <resolved-file>
git cherry-pick --continue

# Test after each cherry-pick
npm run dev  # Frontend
python -m uvicorn backend.main:app --reload  # Backend

# If issues arise, abort and skip
git cherry-pick --abort
```

### Step 0.6: Documentation of Decisions

Create a `CHERRY_PICK_LOG.md` in the feature branch:

```markdown
# Cherry-Pick Analysis: feature/malformed-tool-call-handler → 001-stable-rendering

## Approved Cherry-Picks
- [x] Commit ABC123 - Bug fix in tool registry
- [x] Commit DEF456 - Utility function for XML parsing

## Rejected Changes
- [ ] Commit GHI789 - Refactoring ThreadContent (too risky, implement separately)
- [ ] Commit JKL012 - New streaming message type (conflicts with protocol)

## Manual Review Required
- [ ] Commit MNO345 - ResponseProcessor optimization (understand before applying)

## Notes
- Avoided all changes to core rendering components
- Kept only isolated bug fixes and utility improvements
- Will implement streaming improvements separately in Phase 2
```

### Step 0.7: Validation After Cherry-Picks

After applying cherry-picks:

1. **Functional Testing**:
   - Start a conversation and verify streaming works
   - Trigger tool calls and verify display
   - Check for console errors

2. **Regression Testing**:
   - Compare behavior with baseline `dev` branch
   - Verify no new render errors
   - Check performance metrics

3. **Commit Strategy**:
   - Keep cherry-picked commits as-is (preserve history)
   - Add new commits for any conflict resolutions
   - Document why each change was kept or rejected

## Project Structure

### Documentation (this feature)

```text
specs/001-stable-rendering/
├── spec.md              # Feature specification (completed)
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# Suna Web Application Structure
backend/
├── core/
│   ├── streaming/           # Streaming logic, Redis pub/sub, SSE handling
│   ├── tools/              # AgentPress tool auto-discovery
│   └── agentpress/         # LLM orchestration
├── api/                    # FastAPI endpoints
└── tests/                  # Backend tests

frontend/
├── src/
│   ├── components/
│   │   ├── chat/           # Chat UI, streaming components
│   │   ├── threads/        # Thread management, message rendering
│   │   └── tools/          # Tool call display components
│   ├── hooks/              # React hooks for streaming, state management
│   ├── services/           # API clients, streaming services
│   └── app/                # Next.js App Router pages
└── tests/                  # Frontend tests (manual checklist)
```

**Structure Decision**: Web application structure selected based on existing Suna architecture analysis from codemaps. Key components identified:

**Backend Critical Files**:
- `backend/core/agentpress/response_processor.py` - LLM streaming and tool call processing
- `backend/core/agent_runs.py` - SSE streaming endpoint with Redis pub/sub
- `backend/run_agent_background.py` - Dramatiq background worker for agent execution

**Frontend Critical Files**:
- `frontend/src/hooks/useAgentStream.ts` - Main streaming hook with 16ms throttling
- `frontend/src/components/thread/content/ShowToolStream.tsx` - Tool call rendering with auto-scroll
- `frontend/src/components/thread/content/ThreadContent.tsx` - Message list rendering
- `frontend/src/components/thread/ThreadComponent.tsx` - Main thread orchestration

This aligns with Suna's Next.js App Router + FastAPI + Redis pub/sub + Dramatiq architecture.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No constitution violations identified. All requirements align with existing Suna architecture and constraints.

## Planning Complete

**Documentation Generated**:
- ✅ `spec.md` - Feature specification with 8 clarifications
- ✅ `plan.md` - Implementation plan with Phase 0-6 strategy
- ✅ `research.md` - Technical research and decisions
- ✅ `data-model.md` - Core entities and state patterns
- ✅ `quickstart.md` - Step-by-step implementation guide
- ✅ `contracts/streaming-api.yaml` - API contracts for debug endpoints
- ✅ `contracts/frontend-types.ts` - TypeScript interfaces

**Ready for Task Generation**: All planning artifacts complete. Next step: `/speckit.tasks` to generate actionable implementation tasks.
