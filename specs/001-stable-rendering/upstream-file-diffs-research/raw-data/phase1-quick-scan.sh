#!/bin/bash
# Phase 1: Quick Scan - Fixed version for running from root directory
# Output: specs/001-stable-rendering/upstream-file-diffs-research/raw-data/phase1-results.md

OUTPUT_DIR="specs/001-stable-rendering/upstream-file-diffs-research/raw-data"
OUTPUT_FILE="$OUTPUT_DIR/phase1-results.md"

echo "=== PHASE 1: QUICK SCAN RESULTS ===" > "$OUTPUT_FILE"
echo "Generated: $(date)" >> "$OUTPUT_FILE"
echo "**Scope**: Upstream remote only (kortix-ai/suna)" >> "$OUTPUT_FILE"
echo "**Filter**: Excludes origin remote and local branches" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Define all files from File-List.md
FILES=(
  # Critical Backend Files (P1-P2)
  "backend/core/agentpress/response_processor.py"
  "backend/run_agent_background.py"
  "backend/core/agent_runs.py"
  
  # Critical Frontend Files (P1-P3)  
  "frontend/src/hooks/useAgentStream.ts"
  "frontend/src/components/thread/content/ThreadContent.tsx"
  "frontend/src/components/thread/content/ShowToolStream.tsx"
  
  # Supporting Backend Files (P2-P4)
  "backend/core/run.py"
  "backend/core/agentpress/thread_manager.py"
  "backend/core/threads.py"
  "backend/core/agentpress/tool_registry.py"
  "backend/core/agentpress/llm.py"
  "backend/core/agentpress/xml_tool_parser.py"
  "backend/api/agent_runs.py"
  
  # Supporting Frontend Files (P2-P5)
  "frontend/src/lib/api.ts"
  "frontend/src/components/thread/ThreadComponent.tsx"
  "frontend/src/components/thread/tool-views/wrapper/ToolViewRegistry.tsx"
  "frontend/src/utils/react-error-boundary.tsx"
  "frontend/src/hooks/usePlaybackController.tsx"
  "frontend/src/components/thread/content/PlaybackControls.tsx"
  
  # Infrastructure (P4)
  "backend/core/redis_client.py"
)

echo "## Summary" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "| File | Upstream Commits | Priority | Problem Areas | Latest Upstream Branch |" >> "$OUTPUT_FILE"
echo "|------|------------------|----------|---------------|------------------------|" >> "$OUTPUT_FILE"

total_files=0
active_files=0

echo "" >> "$OUTPUT_FILE"
echo "## Detailed Results" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

for file in "${FILES[@]}"; do
  total_files=$((total_files + 1))
  
  echo "Processing $file..." >&2
  
  # Count commits ONLY on upstream branches (exclude origin/local)
  commit_count=$(git log --remotes=upstream/* --oneline -- "$file" 2>/dev/null | wc -l)
  
  # Get most recent upstream commit with date and branch if any
  recent_commit=""
  recent_branch=""
  if [ $commit_count -gt 0 ]; then
    # Get the most recent upstream commit with date
    recent_commit=$(git log --remotes=upstream/* --oneline --date=short --format="%h %cd %s" -- "$file" 2>/dev/null | head -1)
    
    # Find which upstream branch has the most recent commit
    commit_hash=$(echo "$recent_commit" | cut -d' ' -f1)
    recent_branch=$(git branch -r --contains "$commit_hash" 2>/dev/null | grep "upstream/" | grep -v "upstream/HEAD" | head -1 | sed 's/^[ ]*//')
    
    active_files=$((active_files + 1))
  fi
  
  # Determine priority and problem areas
  priority="P4"
  problem_areas=""
  
  case "$file" in
    *response_processor.py) priority="P1"; problem_areas="#1 Tool Exceptions" ;;
    *run_agent_background.py) priority="P1"; problem_areas="#2 Error Propagation, #5 Redis" ;;
    *agent_runs.py) priority="P2"; problem_areas="#3 Race Condition, #5 Redis" ;;
    *useAgentStream.ts) priority="P1"; problem_areas="#3,#4,#6,#7 Multiple Frontend Issues" ;;
    *ThreadContent.tsx) priority="P2"; problem_areas="#3 Race Condition, #4 Dependency Arrays" ;;
    *run.py) priority="P2"; problem_areas="#1,#2 Tool/Error Issues" ;;
    *api.ts) priority="P2"; problem_areas="#3,#4 Race/Dependency Issues" ;;
    *thread_manager.py) priority="P3"; problem_areas="#1,#3 Tool/Race Issues" ;;
    *) priority="P3-P5"; problem_areas="Supporting" ;;
  esac
  
  # Add to summary table
  echo "| \`$file\` | $commit_count | $priority | $problem_areas | $recent_branch |" >> "$OUTPUT_FILE"
  
  # Add detailed section
  echo "### \`$file\`" >> "$OUTPUT_FILE"
  echo "**Priority**: $priority | **Commits**: $commit_count | **Problem Areas**: $problem_areas" >> "$OUTPUT_FILE"
  echo "" >> "$OUTPUT_FILE"
  
  if [ $commit_count -gt 0 ]; then
    echo "**✅ HAS UPSTREAM ACTIVITY**" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    echo "Most recent commit:" >> "$OUTPUT_FILE"
    echo '```' >> "$OUTPUT_FILE"
    echo "$recent_commit" >> "$OUTPUT_FILE"
    echo '```' >> "$OUTPUT_FILE"
    
    # Show branch with most recent activity
    if [ -n "$recent_branch" ]; then
      echo "**Latest Branch**: $recent_branch" >> "$OUTPUT_FILE"
    fi
    
    # Get last 5 upstream commits with dates and branches
    echo "" >> "$OUTPUT_FILE"
    echo "Last 5 upstream commits (upstream remote only):" >> "$OUTPUT_FILE"
    echo '```' >> "$OUTPUT_FILE"
    git log --remotes=upstream/* --oneline --date=short --format="%h %cd %s" -- "$file" 2>/dev/null | head -5 >> "$OUTPUT_FILE"
    echo '```' >> "$OUTPUT_FILE"
    
    # Show relevant upstream branches for this file (exclude main/HEAD)
    echo "" >> "$OUTPUT_FILE"
    echo "**Relevant Upstream Branches:**" >> "$OUTPUT_FILE"
    upstream_branches=$(git log --remotes=upstream/* --oneline --format="%h" -- "$file" 2>/dev/null | head -10 | while read commit_hash; do
      git branch -r --contains "$commit_hash" 2>/dev/null | grep "upstream/" | grep -v "upstream/main" | grep -v "upstream/HEAD" | head -2
    done | sort -u | head -5)
    
    if [ -n "$upstream_branches" ]; then
      echo '```' >> "$OUTPUT_FILE"
      echo "$upstream_branches" >> "$OUTPUT_FILE"
      echo '```' >> "$OUTPUT_FILE"
    else
      echo "- upstream/main (primary activity)" >> "$OUTPUT_FILE"
    fi
    
  else
    echo "**❌ NO UPSTREAM ACTIVITY**" >> "$OUTPUT_FILE"
  fi
  
  echo "" >> "$OUTPUT_FILE"
  echo "---" >> "$OUTPUT_FILE"
  echo "" >> "$OUTPUT_FILE"
done

# Add final summary
echo "" >> "$OUTPUT_FILE"
echo "## Final Summary" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "- **Total Files Scanned**: $total_files" >> "$OUTPUT_FILE"
echo "- **Files with Upstream Activity**: $active_files" >> "$OUTPUT_FILE"
echo "- **Files with No Activity**: $((total_files - active_files))" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Add key findings
echo "## 🎯 Key Findings" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "**High-Value Upstream Branches Identified:**" >> "$OUTPUT_FILE"
echo "- \`upstream/parallel_tool_calling_and_flow_execution\` - Tool execution improvements" >> "$OUTPUT_FILE"
echo "- \`upstream/native_tool_calling\` - Native tool calling implementation" >> "$OUTPUT_FILE"
echo "- \`upstream/ffrankan-fix/redis-connection-optimization\` - Redis optimization fixes" >> "$OUTPUT_FILE"
echo "- \`upstream/refactor-caching-n-ctxt\` - Context and caching improvements" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "**Next Step**: Run Phase 2 to compare current branch state vs upstream commits" >> "$OUTPUT_FILE"

echo "✅ Phase 1 complete! Results saved to $OUTPUT_FILE"
echo "📊 Summary: $active_files/$total_files files have upstream activity"
