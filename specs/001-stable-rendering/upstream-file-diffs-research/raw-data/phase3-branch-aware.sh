#!/bin/bash
# Phase 3 Branch-Aware: Analyze upstream branches separately for targeted comparison
# 
# Purpose: Generate separate analyses for each upstream branch to enable informed
#          cherry-pick decisions without mixing production-tested and experimental commits
#
# Usage: bash phase3-branch-aware.sh
#
# Outputs:
#   - phase-3-diffs/track1-PRODUCTION.md
#   - phase-3-diffs/track2-native_tool_calling.md
#   - phase-3-diffs/track3-parallel_tool.md
#   - phase-3-diffs/comparison-summary.md

# Configuration
OUTPUT_DIR="specs/001-stable-rendering/upstream-file-diffs-research/raw-data/phase-3-diffs"
OUTPUT_TRACK1="$OUTPUT_DIR/track1-PRODUCTION.md"
OUTPUT_TRACK2="$OUTPUT_DIR/track2-native_tool_calling.md"
OUTPUT_TRACK3="$OUTPUT_DIR/track3-parallel_tool.md"
OUTPUT_SUMMARY="$OUTPUT_DIR/comparison-summary.md"

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo "=== PHASE 3: BRANCH-AWARE ANALYSIS ===" >&2
echo "Output directory: $OUTPUT_DIR" >&2
echo "" >&2

# Get target files from Phase 2 results
TARGET_FILES=()

if [ -f "specs/001-stable-rendering/upstream-file-diffs-research/raw-data/phase2-comparison.md" ]; then
  echo "Extracting HIGH PRIORITY files from phase2-comparison.md..." >&2
  
  while IFS= read -r line; do
    if [[ $line =~ ^\|[[:space:]]*\`([^\`]+)\`[[:space:]]*\|[[:space:]]*🔄[[:space:]]*\*\*BEHIND\*\* ]]; then
      file="${BASH_REMATCH[1]}"
      TARGET_FILES+=("$file")
      echo "  Found: $file" >&2
    fi
  done < "specs/001-stable-rendering/upstream-file-diffs-research/raw-data/phase2-comparison.md"
fi

# Fallback if no files found
if [ ${#TARGET_FILES[@]} -eq 0 ]; then
  echo "⚠️  No HIGH PRIORITY files found. Using critical files." >&2
  TARGET_FILES=(
    "backend/core/agentpress/response_processor.py"
    "backend/run_agent_background.py"
    "frontend/src/hooks/useAgentStream.ts"
    "backend/core/agent_runs.py"
  )
fi

echo "" >&2
echo "📋 Analyzing ${#TARGET_FILES[@]} files across 3 upstream branches..." >&2
echo "" >&2

# Function to get problem areas for a file
get_problem_areas() {
  local file="$1"
  case "$file" in
    *response_processor.py) echo "#1 Silent Exception Swallowing in Tool Execution" ;;
    *run_agent_background.py) echo "#2 Missing Error Propagation, #5 Redis Pub/Sub Message Loss" ;;
    *agent_runs.py) echo "#3 Race Condition in Stream Finalization, #5 Redis Pub/Sub Message Loss" ;;
    *useAgentStream.ts) echo "#3 Race Condition, #4 Dependency Arrays, #6 Buffer Overflow, #7 startTransition Delays" ;;
    *ThreadContent.tsx) echo "#3 Race Condition, #4 Dependency Arrays" ;;
    *ShowToolStream.tsx) echo "Supporting - Tool stream display" ;;
    *run.py) echo "#1 Tool Exceptions, #2 Error Propagation" ;;
    *api.ts) echo "#3 Race Condition, #4 Dependency Arrays" ;;
    *thread_manager.py) echo "#1 Tool Exceptions, #3 Race Condition" ;;
    *threads.py) echo "Supporting - Thread management" ;;
    *tool_registry.py) echo "Supporting - Tool registration" ;;
    *xml_tool_parser.py) echo "Supporting - XML parsing" ;;
    *llm.py) echo "Supporting - LLM integration" ;;
    *ThreadComponent.tsx) echo "#3 Race Condition, #4 Dependency Arrays" ;;
    *ToolViewRegistry.tsx) echo "Supporting - Tool view registry" ;;
    *usePlaybackController.tsx) echo "Supporting - Playback control" ;;
    *PlaybackControls.tsx) echo "Supporting - Playback UI" ;;
    *react-error-boundary.tsx) echo "#2 Error Propagation" ;;
    *) echo "Supporting file for streaming/tool functionality" ;;
  esac
}

# Function to analyze relevance
analyze_relevance() {
  local commit_subject="$1"
  local lower_subject=$(echo "$commit_subject" | tr '[:upper:]' '[:lower:]')
  local relevant_keywords=()
  
  if [[ $lower_subject =~ (stream|streaming) ]]; then relevant_keywords+=("streaming"); fi
  if [[ $lower_subject =~ (tool|tools) ]]; then relevant_keywords+=("tools"); fi
  if [[ $lower_subject =~ (error|exception|fail) ]]; then relevant_keywords+=("error handling"); fi
  if [[ $lower_subject =~ (race|condition|timing) ]]; then relevant_keywords+=("race conditions"); fi
  if [[ $lower_subject =~ (redis|pub.*sub) ]]; then relevant_keywords+=("Redis pub/sub"); fi
  if [[ $lower_subject =~ (react|render|component) ]]; then relevant_keywords+=("React rendering"); fi
  if [[ $lower_subject =~ (buffer|throttle) ]]; then relevant_keywords+=("buffering/throttling"); fi
  if [[ $lower_subject =~ (dependency|callback|hook) ]]; then relevant_keywords+=("React hooks/dependencies"); fi
  
  if [ ${#relevant_keywords[@]} -gt 0 ]; then
    echo "🎯 **HIGHLY RELEVANT** - Contains: $(IFS=', '; echo "${relevant_keywords[*]}")"
  else
    echo "📝 **POTENTIALLY RELEVANT** - Review changes for applicability"
  fi
}

# Function to analyze a single file for a specific branch
analyze_file_for_branch() {
  local file="$1"
  local branch="$2"
  local output_file="$3"
  local branch_filter="$4"
  local max_commits=5
  
  echo "### \`$file\`" >> "$output_file"
  echo "" >> "$output_file"
  
  # Get problem areas
  problem_areas=$(get_problem_areas "$file")
  echo "**Problem Areas**: $problem_areas" >> "$output_file"
  echo "" >> "$output_file"
  
  # Get commits for this branch
  local commits=""
  if [ -n "$branch_filter" ]; then
    # Exclude commits from other branches
    commits=$(git log "$branch" $branch_filter --oneline --format="%h %cd %s" --date=short -- "$file" 2>/dev/null)
  else
    # Just get commits from this branch
    commits=$(git log "$branch" --oneline --format="%h %cd %s" --date=short -- "$file" 2>/dev/null)
  fi
  
  local commit_count=$(echo "$commits" | grep -c "^" 2>/dev/null || echo "0")
  
  if [ -z "$commits" ] || [ "$commit_count" -eq 0 ]; then
    echo "**No commits found in this branch for this file.**" >> "$output_file"
    echo "" >> "$output_file"
    echo "---" >> "$output_file"
    echo "" >> "$output_file"
    return
  fi
  
  echo "**Commits in this branch**: $commit_count" >> "$output_file"
  echo "" >> "$output_file"
  
  # Show commit list
  echo "#### Commit List" >> "$output_file"
  echo '```' >> "$output_file"
  echo "$commits" | head -10 >> "$output_file"
  echo '```' >> "$output_file"
  echo "" >> "$output_file"
  
  # Detailed analysis of first N commits
  echo "#### Detailed Analysis (First $max_commits commits)" >> "$output_file"
  echo "" >> "$output_file"
  
  local count=0
  while IFS= read -r commit_line; do
    if [ -z "$commit_line" ]; then
      continue
    fi
    
    local commit_hash=$(echo "$commit_line" | cut -d' ' -f1)
    local commit_date=$(echo "$commit_line" | cut -d' ' -f2)
    local commit_subject=$(echo "$commit_line" | cut -d' ' -f3-)
    
    echo "##### Commit \`$commit_hash\` ($commit_date)" >> "$output_file"
    echo "**Subject**: $commit_subject" >> "$output_file"
    echo "" >> "$output_file"
    
    # Get commit author
    local commit_author=$(git show --format="%an <%ae>" -s "$commit_hash" 2>/dev/null)
    echo "**Author**: $commit_author" >> "$output_file"
    echo "" >> "$output_file"
    
    # Relevance analysis
    local relevance=$(analyze_relevance "$commit_subject")
    echo "**Relevance**: $relevance" >> "$output_file"
    echo "" >> "$output_file"
    
    # Show diff (first 50 lines)
    echo "**Changes to this file**:" >> "$output_file"
    echo '```diff' >> "$output_file"
    git show --format="" "$commit_hash" -- "$file" 2>/dev/null | head -50 >> "$output_file"
    local diff_lines=$(git show --format="" "$commit_hash" -- "$file" 2>/dev/null | wc -l)
    if [ "$diff_lines" -gt 50 ]; then
      echo "... (showing first 50 of $diff_lines lines)" >> "$output_file"
    fi
    echo '```' >> "$output_file"
    echo "" >> "$output_file"
    echo "---" >> "$output_file"
    echo "" >> "$output_file"
    
    count=$((count + 1))
    if [ $count -ge $max_commits ]; then
      if [ $commit_count -gt $max_commits ]; then
        echo "**Note**: Showing first $max_commits of $commit_count commits. Run \`git log $branch -- $file\` for complete list." >> "$output_file"
        echo "" >> "$output_file"
      fi
      break
    fi
  done <<< "$commits"
  
  echo "" >> "$output_file"
  echo "=======================================" >> "$output_file"
  echo "" >> "$output_file"
}

# Initialize output files
echo "=== TRACK 1: upstream/PRODUCTION ===" > "$OUTPUT_TRACK1"
echo "Generated: $(date)" >> "$OUTPUT_TRACK1"
echo "" >> "$OUTPUT_TRACK1"
echo "**Branch**: upstream/PRODUCTION" >> "$OUTPUT_TRACK1"
echo "**Status**: ✅ Production branch - Tested and deployed" >> "$OUTPUT_TRACK1"
echo "**Risk Level**: LOW - These commits are already in production" >> "$OUTPUT_TRACK1"
echo "**Recommendation**: Start here for quick wins with minimal risk" >> "$OUTPUT_TRACK1"
echo "" >> "$OUTPUT_TRACK1"
echo "---" >> "$OUTPUT_TRACK1"
echo "" >> "$OUTPUT_TRACK1"

echo "=== TRACK 2: upstream/native_tool_calling ===" > "$OUTPUT_TRACK2"
echo "Generated: $(date)" >> "$OUTPUT_TRACK2"
echo "" >> "$OUTPUT_TRACK2"
echo "**Branch**: upstream/native_tool_calling" >> "$OUTPUT_TRACK2"
echo "**Status**: ⚠️ Feature branch - NOT merged to PRODUCTION" >> "$OUTPUT_TRACK2"
echo "**Risk Level**: MEDIUM - Comprehensive tool system rewrite" >> "$OUTPUT_TRACK2"
echo "**Key Commits**: 1501694d (2025-11-10), db946f16 (2025-11-07)" >> "$OUTPUT_TRACK2"
echo "**Recommendation**: Evaluate if PRODUCTION fixes are insufficient" >> "$OUTPUT_TRACK2"
echo "" >> "$OUTPUT_TRACK2"
echo "---" >> "$OUTPUT_TRACK2"
echo "" >> "$OUTPUT_TRACK2"

echo "=== TRACK 3: upstream/parallel_tool_calling_and_flow_execution ===" > "$OUTPUT_TRACK3"
echo "Generated: $(date)" >> "$OUTPUT_TRACK3"
echo "" >> "$OUTPUT_TRACK3"
echo "**Branch**: upstream/parallel_tool_calling_and_flow_execution" >> "$OUTPUT_TRACK3"
echo "**Status**: ⚠️ Feature branch - NOT merged to PRODUCTION" >> "$OUTPUT_TRACK3"
echo "**Risk Level**: MEDIUM-HIGH - XML structure changes, may conflict with native_tool_calling" >> "$OUTPUT_TRACK3"
echo "**Key Commits**: ebabf896 (2025-11-02)" >> "$OUTPUT_TRACK3"
echo "**Recommendation**: Consider only if both Track 1 and 2 are insufficient" >> "$OUTPUT_TRACK3"
echo "" >> "$OUTPUT_TRACK3"
echo "---" >> "$OUTPUT_TRACK3"
echo "" >> "$OUTPUT_TRACK3"

# Initialize comparison summary
echo "=== PHASE 3: BRANCH COMPARISON SUMMARY ===" > "$OUTPUT_SUMMARY"
echo "Generated: $(date)" >> "$OUTPUT_SUMMARY"
echo "" >> "$OUTPUT_SUMMARY"
echo "Quick reference comparing commits across all 3 upstream branches for the ${#TARGET_FILES[@]} HIGH PRIORITY files." >> "$OUTPUT_SUMMARY"
echo "" >> "$OUTPUT_SUMMARY"
echo "## Branch Overview" >> "$OUTPUT_SUMMARY"
echo "" >> "$OUTPUT_SUMMARY"
echo "| Track | Branch | Status | Risk | Recommendation |" >> "$OUTPUT_SUMMARY"
echo "|-------|--------|--------|------|----------------|" >> "$OUTPUT_SUMMARY"
echo "| 1 | upstream/PRODUCTION | ✅ Production | LOW | Start here |" >> "$OUTPUT_SUMMARY"
echo "| 2 | upstream/native_tool_calling | ⚠️ Feature | MEDIUM | If Track 1 insufficient |" >> "$OUTPUT_SUMMARY"
echo "| 3 | upstream/parallel_tool_calling_and_flow_execution | ⚠️ Feature | MEDIUM-HIGH | Last resort |" >> "$OUTPUT_SUMMARY"
echo "" >> "$OUTPUT_SUMMARY"
echo "---" >> "$OUTPUT_SUMMARY"
echo "" >> "$OUTPUT_SUMMARY"
echo "## File-by-File Comparison" >> "$OUTPUT_SUMMARY"
echo "" >> "$OUTPUT_SUMMARY"

# Process each file
for file in "${TARGET_FILES[@]}"; do
  echo "Processing: $file" >&2
  
  # Track 1: PRODUCTION
  echo "  Track 1 (PRODUCTION)..." >&2
  analyze_file_for_branch "$file" "upstream/PRODUCTION" "$OUTPUT_TRACK1" ""
  
  # Track 2: native_tool_calling (exclude commits already in PRODUCTION)
  echo "  Track 2 (native_tool_calling)..." >&2
  analyze_file_for_branch "$file" "upstream/native_tool_calling" "$OUTPUT_TRACK2" "--not upstream/PRODUCTION"
  
  # Track 3: parallel_tool_calling_and_flow_execution (exclude commits already in PRODUCTION)
  echo "  Track 3 (parallel_tool)..." >&2
  analyze_file_for_branch "$file" "upstream/parallel_tool_calling_and_flow_execution" "$OUTPUT_TRACK3" "--not upstream/PRODUCTION"
  
  # Add to comparison summary
  echo "### \`$file\`" >> "$OUTPUT_SUMMARY"
  echo "" >> "$OUTPUT_SUMMARY"
  
  problem_areas=$(get_problem_areas "$file")
  echo "**Problem Areas**: $problem_areas" >> "$OUTPUT_SUMMARY"
  echo "" >> "$OUTPUT_SUMMARY"
  
  # Count commits per track
  track1_count=$(git log upstream/PRODUCTION --oneline -- "$file" 2>/dev/null | wc -l)
  track2_count=$(git log upstream/native_tool_calling --not upstream/PRODUCTION --oneline -- "$file" 2>/dev/null | wc -l)
  track3_count=$(git log upstream/parallel_tool_calling_and_flow_execution --not upstream/PRODUCTION --oneline -- "$file" 2>/dev/null | wc -l)
  
  echo "| Track | Commits | Latest Commit |" >> "$OUTPUT_SUMMARY"
  echo "|-------|---------|---------------|" >> "$OUTPUT_SUMMARY"
  
  # Track 1
  if [ "$track1_count" -gt 0 ]; then
    track1_latest=$(git log upstream/PRODUCTION --oneline --format="%h %cd %s" --date=short -- "$file" 2>/dev/null | head -1)
    echo "| Track 1 (PRODUCTION) | $track1_count | \`$track1_latest\` |" >> "$OUTPUT_SUMMARY"
  else
    echo "| Track 1 (PRODUCTION) | 0 | No commits |" >> "$OUTPUT_SUMMARY"
  fi
  
  # Track 2
  if [ "$track2_count" -gt 0 ]; then
    track2_latest=$(git log upstream/native_tool_calling --not upstream/PRODUCTION --oneline --format="%h %cd %s" --date=short -- "$file" 2>/dev/null | head -1)
    echo "| Track 2 (native_tool_calling) | $track2_count | \`$track2_latest\` |" >> "$OUTPUT_SUMMARY"
  else
    echo "| Track 2 (native_tool_calling) | 0 | No unique commits |" >> "$OUTPUT_SUMMARY"
  fi
  
  # Track 3
  if [ "$track3_count" -gt 0 ]; then
    track3_latest=$(git log upstream/parallel_tool_calling_and_flow_execution --not upstream/PRODUCTION --oneline --format="%h %cd %s" --date=short -- "$file" 2>/dev/null | head -1)
    echo "| Track 3 (parallel_tool) | $track3_count | \`$track3_latest\` |" >> "$OUTPUT_SUMMARY"
  else
    echo "| Track 3 (parallel_tool) | 0 | No unique commits |" >> "$OUTPUT_SUMMARY"
  fi
  
  echo "" >> "$OUTPUT_SUMMARY"
  
  # Recommendation
  if [ "$track1_count" -gt 0 ]; then
    echo "**Recommendation**: Start with Track 1 (PRODUCTION) - $track1_count production-tested commits available" >> "$OUTPUT_SUMMARY"
  elif [ "$track2_count" -gt 0 ]; then
    echo "**Recommendation**: Consider Track 2 (native_tool_calling) - $track2_count commits with tool system improvements" >> "$OUTPUT_SUMMARY"
  elif [ "$track3_count" -gt 0 ]; then
    echo "**Recommendation**: Review Track 3 (parallel_tool) - $track3_count commits with XML structure changes" >> "$OUTPUT_SUMMARY"
  else
    echo "**Recommendation**: No upstream commits found for this file" >> "$OUTPUT_SUMMARY"
  fi
  
  echo "" >> "$OUTPUT_SUMMARY"
  echo "---" >> "$OUTPUT_SUMMARY"
  echo "" >> "$OUTPUT_SUMMARY"
done

# Add final summary to all files
for output in "$OUTPUT_TRACK1" "$OUTPUT_TRACK2" "$OUTPUT_TRACK3"; do
  echo "## Analysis Complete" >> "$output"
  echo "" >> "$output"
  echo "**Files Analyzed**: ${#TARGET_FILES[@]}" >> "$output"
  echo "**Generated**: $(date)" >> "$output"
  echo "" >> "$output"
  echo "### Next Steps" >> "$output"
  echo "" >> "$output"
  echo "1. Review commits marked as 🎯 **HIGHLY RELEVANT**" >> "$output"
  echo "2. Focus on commits addressing your 7 problem areas" >> "$output"
  echo "3. Check \`comparison-summary.md\` for cross-branch comparison" >> "$output"
  echo "4. Consider cherry-picking or adapting relevant fixes" >> "$output"
  echo "5. Test changes in isolated branch before merging" >> "$output"
done

# Final summary statistics
echo "## Overall Statistics" >> "$OUTPUT_SUMMARY"
echo "" >> "$OUTPUT_SUMMARY"
echo "**Total Files Analyzed**: ${#TARGET_FILES[@]}" >> "$OUTPUT_SUMMARY"
echo "" >> "$OUTPUT_SUMMARY"

total_track1=0
total_track2=0
total_track3=0

for file in "${TARGET_FILES[@]}"; do
  count1=$(git log upstream/PRODUCTION --oneline -- "$file" 2>/dev/null | wc -l)
  count2=$(git log upstream/native_tool_calling --not upstream/PRODUCTION --oneline -- "$file" 2>/dev/null | wc -l)
  count3=$(git log upstream/parallel_tool_calling_and_flow_execution --not upstream/PRODUCTION --oneline -- "$file" 2>/dev/null | wc -l)
  total_track1=$((total_track1 + count1))
  total_track2=$((total_track2 + count2))
  total_track3=$((total_track3 + count3))
done

echo "**Total Commits by Track**:" >> "$OUTPUT_SUMMARY"
echo "- Track 1 (PRODUCTION): $total_track1 commits" >> "$OUTPUT_SUMMARY"
echo "- Track 2 (native_tool_calling): $total_track2 unique commits" >> "$OUTPUT_SUMMARY"
echo "- Track 3 (parallel_tool): $total_track3 unique commits" >> "$OUTPUT_SUMMARY"
echo "" >> "$OUTPUT_SUMMARY"
echo "### Recommended Workflow" >> "$OUTPUT_SUMMARY"
echo "" >> "$OUTPUT_SUMMARY"
echo "1. **Week 1**: Review Track 1 (PRODUCTION) - Focus on low-risk, production-tested fixes" >> "$OUTPUT_SUMMARY"
echo "2. **Week 2**: Evaluate results - If 80%+ problems solved, done. Otherwise proceed to Track 2" >> "$OUTPUT_SUMMARY"
echo "3. **Week 3**: Deep dive Track 2 (native_tool_calling) - Consider comprehensive rewrite approach" >> "$OUTPUT_SUMMARY"
echo "4. **Week 4**: Track 3 only if needed - XML structure changes as last resort" >> "$OUTPUT_SUMMARY"

echo "" >&2
echo "✅ Phase 3 Branch-Aware Analysis Complete!" >&2
echo "" >&2
echo "📁 Output files generated:" >&2
echo "   - $OUTPUT_TRACK1" >&2
echo "   - $OUTPUT_TRACK2" >&2
echo "   - $OUTPUT_TRACK3" >&2
echo "   - $OUTPUT_SUMMARY" >&2
echo "" >&2
echo "📋 Statistics:" >&2
echo "   - Files analyzed: ${#TARGET_FILES[@]}" >&2
echo "   - Track 1 commits: $total_track1" >&2
echo "   - Track 2 commits: $total_track2" >&2
echo "   - Track 3 commits: $total_track3" >&2
echo "" >&2
echo "🎯 Next: Review comparison-summary.md for quick overview" >&2
