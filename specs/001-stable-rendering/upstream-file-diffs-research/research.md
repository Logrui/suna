# Upstream File Diffs Research

**Feature**: 001-stable-rendering | **Date**: 2025-11-14  
**Purpose**: Research recent upstream changes to core streaming/rendering files for potential fixes to our 7 identified problem areas

## Research Objective

Investigate if recent upstream commits (last 3 months) contain fixes or improvements for the streaming failure issues we've identified in Phase 0.5. Rather than solving these problems from scratch, we may find existing solutions in recent branches.

## Process Overview

1. **Identify Core Files**: List frontend/backend files related to our 7 problem areas
2. **Branch Discovery**: Find remote branches that touched these files in last 3 months
3. **Commit Analysis**: Extract newest commit per branch for each file (excluding origin/main)
4. **Change Review**: Analyze what fixes/improvements each commit contains
5. **Applicability Assessment**: Determine if changes address our specific problem areas

## Problem Areas Mapping

Our 7 identified issues and their likely file locations:

1. **Silent Exception Swallowing** → `response_processor.py`
2. **Missing Error Propagation** → `run_agent_background.py`
3. **Race Condition in Stream Finalization** → `agent_runs.py`, `useAgentStream.ts`
4. **Frontend Dependency Array Issues** → `useAgentStream.ts`
5. **Redis Pub/Sub Message Loss** → `run_agent_background.py`, `agent_runs.py`
6. **Throttling Buffer Overflow** → `useAgentStream.ts`
7. **React.startTransition Delaying Updates** → `useAgentStream.ts`

## Discovery Commands

```bash
# Find branches that touched specific files in last 3 months
git for-each-ref --format='%(refname:short) %(committerdate)' refs/remotes/origin | \
  awk '$2 >= "'$(date -d '3 months ago' +%Y-%m-%d)'"' | \
  while read branch date; do
    echo "Checking $branch..."
    git log --since="3 months ago" --oneline --name-only $branch -- backend/core/agentpress/response_processor.py
  done

# Alternative: Find recent commits across all branches for specific file
git log --all --since="3 months ago" --oneline --name-only -- backend/core/agentpress/response_processor.py
```

## Research Log

### Session 2025-11-14

**Status**: Setup phase - creating file list and analysis templates

**Next Steps**:
1. Complete file list with priority ranking
2. Run branch discovery commands
3. Create analysis templates for priority files
4. Begin commit review process

**Notes**:
- Focus on branches that aren't origin/main or local development branches OR any origin remote branches. We are purely focusing on upstream remote branches with newer commits on these files within the past 3 months
- Look for error handling improvements, race condition fixes, streaming stability
- Pay attention to commit messages mentioning: streaming, tool calls, exceptions, Redis, React rendering

## Discoveries

*This section will be updated as research progresses*

### Potential Fixes Found

*To be populated during analysis*

### Dead Ends

*To be populated during analysis*

### Integration Candidates

*Files/commits that could be cherry-picked or adapted for our branch*
