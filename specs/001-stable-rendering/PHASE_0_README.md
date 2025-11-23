# Phase 0: Analysis Complete

**Status**: ✅ COMPLETE  
**Date**: 2025-11-14  
**Baseline**: `22a36feb` from `feature/workflows-restoration`

---

## Quick Start

**Read these 3 documents in order**:

1. **PHASE_0_CHERRY_PICK_DECISIONS.md** - Executive summary and final decisions
2. **PHASE_0_IMPLEMENTATION_GUIDE.md** - Step-by-step implementation instructions
3. **PHASE_0_RATIONALE.md** - Detailed reasoning and alternatives considered

---

## Summary

### The Problem
React error 185 (maximum update depth exceeded) caused by 20+ renders/second during streaming.

### The Solution
- **Backend batching** in `response_processor.py` (PRIMARY)
- **Frontend optimizations** (COMPLEMENTARY): deep equality checks, cleanup, error handling
- **NOT** frontend batching (redundant with backend)

### Final Decision
**Cherry-pick 7 files**:
1. response_processor.py (backend batching)
2. useAgentStream.ts (deep equality, cleanup, buffer monitoring)
3. ThreadComponent.tsx (memoized callbacks)
4. MalformedToolCallView.tsx (error display)
5. ToolViewRegistry.tsx (registry entry)
6. react-error-boundary.tsx (safety net)
7. ThreadContent.tsx (error display + system parsing only)

---

## Document Structure

```
specs/001-stable-rendering/
├── PHASE_0_README.md                    ← You are here
├── PHASE_0_CHERRY_PICK_DECISIONS.md     ← Start here
├── PHASE_0_IMPLEMENTATION_GUIDE.md      ← Then here
├── PHASE_0_RATIONALE.md                 ← Then here
└── file-diffs/
    ├── README.md
    ├── MalformedToolCallView_ANALYSIS.md
    ├── react-error-boundary_ANALYSIS.md
    ├── response_processor_ANALYSIS.md
    ├── run_ANALYSIS.md
    ├── ThreadComponent_ANALYSIS.md
    ├── ThreadContent_ANALYSIS.md
    ├── ToolViewRegistry_ANALYSIS.md
    └── useAgentStream_ANALYSIS.md
```

---

## Key Findings

### Root Cause
- Streaming sends 20+ updates/second
- Each update triggers re-render → state change → useEffect → new update
- Infinite loop detected by React → error #185

### Failed Approaches
- ❌ Circuit breaker (breaks UI)
- ❌ Removed streaming dependencies (stale closures)
- ❌ Frontend batching (redundant with backend)

### Winning Strategy
- ✅ Backend batching (50ms intervals)
- ✅ Deep equality checks (prevent duplicate renders)
- ✅ Proper cleanup (graceful lifecycle)
- ✅ Error handling (graceful degradation)

---

## Next Steps

1. Read PHASE_0_CHERRY_PICK_DECISIONS.md
2. Follow PHASE_0_IMPLEMENTATION_GUIDE.md
3. Cherry-pick the 7 files
4. Test and verify
5. Proceed to Phase 1 (if needed)

---

## Individual File Analysis

For detailed analysis of each file, see `file-diffs/*_ANALYSIS.md`:
- `MalformedToolCallView_ANALYSIS.md` - Error display component
- `react-error-boundary_ANALYSIS.md` - Error boundary safety net
- `response_processor_ANALYSIS.md` - Backend batching logic
- `run_ANALYSIS.md` - Why we skip run.py changes
- `ThreadComponent_ANALYSIS.md` - Memoized callbacks
- `ThreadContent_ANALYSIS.md` - What to accept/skip
- `ToolViewRegistry_ANALYSIS.md` - Registry entry
- `useAgentStream_ANALYSIS.md` - Frontend optimizations

