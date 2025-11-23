#!/bin/bash
# Phase 3: Detailed Analysis - Generate detailed commit analysis for priority files
# Usage: ./phase3-detailed-analysis.sh [file1] [file2] ...
# If no files specified, will use HIGH PRIORITY files from phase2-comparison.md

echo "=== PHASE 3: DETAILED COMMIT ANALYSIS ===" > raw-data/phase3-detailed-analysis.md
echo "Generated: $(date)" >> raw-data/phase3-detailed-analysis.md
echo "" >> raw-data/phase3-detailed-analysis.md

# Get target files from command line args or phase 2 results
TARGET_FILES=()

if [ $# -gt 0 ]; then
  # Files specified as command line arguments
  TARGET_FILES=("$@")
  echo "Analyzing specified files: $*" >&2
else
  # Extract HIGH PRIORITY files from phase2-comparison.md
  if [ -f "raw-data/phase2-comparison.md" ]; then
    echo "Extracting HIGH PRIORITY files from phase2-comparison.md..." >&2
    
    # Find files marked as BEHIND in the table
    while IFS= read -r line; do
      if [[ $line =~ ^\|[[:space:]]*\`([^`]+)\`[[:space:]]*\|[[:space:]]*🔄[[:space:]]*\*\*BEHIND\*\* ]]; then
        file="${BASH_REMATCH[1]}"
        TARGET_FILES+=("$file")
        echo "Found HIGH PRIORITY file: $file" >&2
      fi
    done < raw-data/phase2-comparison.md
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
fi

echo "## Target Files for Analysis" >> raw-data/phase3-detailed-analysis.md
echo "" >> raw-data/phase3-detailed-analysis.md
echo "Files selected for detailed commit analysis:" >> raw-data/phase3-detailed-analysis.md

for file in "${TARGET_FILES[@]}"; do
  echo "- \`$file\`" >> raw-data/phase3-detailed-analysis.md
done

echo "" >> raw-data/phase3-detailed-analysis.md
echo "---" >> raw-data/phase3-detailed-analysis.md
echo "" >> raw-data/phase3-detailed-analysis.md

# Analyze each file
for file in "${TARGET_FILES[@]}"; do
  echo "Analyzing $file..." >&2
  
  echo "# \`$file\`" >> raw-data/phase3-detailed-analysis.md
  echo "" >> raw-data/phase3-detailed-analysis.md
  
  # Get problem areas for this file
  problem_areas=""
  case "$file" in
    *response_processor.py) problem_areas="#1 Silent Exception Swallowing in Tool Execution" ;;
    *run_agent_background.py) problem_areas="#2 Missing Error Propagation, #5 Redis Pub/Sub Message Loss" ;;
    *agent_runs.py) problem_areas="#3 Race Condition in Stream Finalization, #5 Redis Pub/Sub Message Loss" ;;
    *useAgentStream.ts) problem_areas="#3 Race Condition, #4 Dependency Arrays, #6 Buffer Overflow, #7 startTransition Delays" ;;
    *ThreadContent.tsx) problem_areas="#3 Race Condition, #4 Dependency Arrays" ;;
    *run.py) problem_areas="#1 Tool Exceptions, #2 Error Propagation" ;;
    *api.ts) problem_areas="#3 Race Condition, #4 Dependency Arrays" ;;
    *thread_manager.py) problem_areas="#1 Tool Exceptions, #3 Race Condition" ;;
    *) problem_areas="Supporting file for streaming/tool functionality" ;;
  esac
  
  echo "**Problem Areas**: $problem_areas" >> raw-data/phase3-detailed-analysis.md
  echo "" >> raw-data/phase3-detailed-analysis.md
  
  # Get current vs upstream status
  current_hash=$(git log -1 --format="%h %s" HEAD -- "$file" 2>/dev/null)
  upstream_hash=$(git log -1 --format="%h %s" --all --remotes=upstream/* -- "$file" 2>/dev/null)
  
  echo "**Current Branch**: $current_hash" >> raw-data/phase3-detailed-analysis.md
  echo "**Latest Upstream**: $upstream_hash" >> raw-data/phase3-detailed-analysis.md
  echo "" >> raw-data/phase3-detailed-analysis.md
  
  # Get recent upstream commits (last 3 months)
  echo "## Recent Upstream Commits" >> raw-data/phase3-detailed-analysis.md
  echo "" >> raw-data/phase3-detailed-analysis.md
  
  upstream_commits=$(git log --all --since="3 months ago" --oneline --remotes=upstream/* -- "$file" 2>/dev/null)
  
  if [ -n "$upstream_commits" ]; then
    echo '```' >> raw-data/phase3-detailed-analysis.md
    echo "$upstream_commits" >> raw-data/phase3-detailed-analysis.md
    echo '```' >> raw-data/phase3-detailed-analysis.md
    
    # Detailed analysis of each commit
    echo "" >> raw-data/phase3-detailed-analysis.md
    echo "## Commit Analysis" >> raw-data/phase3-detailed-analysis.md
    echo "" >> raw-data/phase3-detailed-analysis.md
    
    commit_count=0
    while IFS= read -r commit_line; do
      if [ -n "$commit_line" ]; then
        commit_hash=$(echo "$commit_line" | cut -d' ' -f1)
        commit_subject=$(echo "$commit_line" | cut -d' ' -f2-)
        
        echo "### Commit $commit_hash" >> raw-data/phase3-detailed-analysis.md
        echo "**Subject**: $commit_subject" >> raw-data/phase3-detailed-analysis.md
        echo "" >> raw-data/phase3-detailed-analysis.md
        
        # Get commit details
        commit_author=$(git show --format="%an <%ae>" -s "$commit_hash" 2>/dev/null)
        commit_date=$(git show --format="%cd" --date=format:'%Y-%m-%d %H:%M' -s "$commit_hash" 2>/dev/null)
        
        echo "**Author**: $commit_author" >> raw-data/phase3-detailed-analysis.md
        echo "**Date**: $commit_date" >> raw-data/phase3-detailed-analysis.md
        echo "" >> raw-data/phase3-detailed-analysis.md
        
        # Get file-specific changes
        echo "**Changes to this file**:" >> raw-data/phase3-detailed-analysis.md
        echo '```diff' >> raw-data/phase3-detailed-analysis.md
        git show --format="" "$commit_hash" -- "$file" 2>/dev/null | head -50 >> raw-data/phase3-detailed-analysis.md
        echo '```' >> raw-data/phase3-detailed-analysis.md
        
        # Relevance analysis
        echo "" >> raw-data/phase3-detailed-analysis.md
        echo "**Relevance to Problem Areas**:" >> raw-data/phase3-detailed-analysis.md
        
        # Check if commit message contains relevant keywords
        relevant_keywords=()
        lower_subject=$(echo "$commit_subject" | tr '[:upper:]' '[:lower:]')
        
        if [[ $lower_subject =~ (stream|streaming) ]]; then relevant_keywords+=("streaming"); fi
        if [[ $lower_subject =~ (tool|tools) ]]; then relevant_keywords+=("tools"); fi
        if [[ $lower_subject =~ (error|exception|fail) ]]; then relevant_keywords+=("error handling"); fi
        if [[ $lower_subject =~ (race|condition|timing) ]]; then relevant_keywords+=("race conditions"); fi
        if [[ $lower_subject =~ (redis|pub.*sub) ]]; then relevant_keywords+=("Redis pub/sub"); fi
        if [[ $lower_subject =~ (react|render|component) ]]; then relevant_keywords+=("React rendering"); fi
        if [[ $lower_subject =~ (buffer|throttle) ]]; then relevant_keywords+=("buffering/throttling"); fi
        if [[ $lower_subject =~ (dependency|callback|hook) ]]; then relevant_keywords+=("React hooks/dependencies"); fi
        
        if [ ${#relevant_keywords[@]} -gt 0 ]; then
          echo "- 🎯 **HIGHLY RELEVANT** - Contains: $(IFS=', '; echo "${relevant_keywords[*]}")" >> raw-data/phase3-detailed-analysis.md
        else
          echo "- 📝 **POTENTIALLY RELEVANT** - Review changes for applicability" >> raw-data/phase3-detailed-analysis.md
        fi
        
        echo "" >> raw-data/phase3-detailed-analysis.md
        echo "---" >> raw-data/phase3-detailed-analysis.md
        echo "" >> raw-data/phase3-detailed-analysis.md
        
        commit_count=$((commit_count + 1))
        if [ $commit_count -ge 5 ]; then
          echo "**Note**: Showing first 5 commits. Run \`git log --all --since=\"3 months ago\" --remotes=upstream/* -- $file\` for complete list." >> raw-data/phase3-detailed-analysis.md
          echo "" >> raw-data/phase3-detailed-analysis.md
          break
        fi
      fi
    done <<< "$upstream_commits"
    
  else
    echo "No upstream commits found in last 3 months." >> raw-data/phase3-detailed-analysis.md
  fi
  
  echo "" >> raw-data/phase3-detailed-analysis.md
  echo "=======================================" >> raw-data/phase3-detailed-analysis.md
  echo "" >> raw-data/phase3-detailed-analysis.md
done

# Generate summary
echo "## Analysis Summary" >> raw-data/phase3-detailed-analysis.md
echo "" >> raw-data/phase3-detailed-analysis.md
echo "### Files Analyzed: ${#TARGET_FILES[@]}" >> raw-data/phase3-detailed-analysis.md
echo "" >> raw-data/phase3-detailed-analysis.md

for file in "${TARGET_FILES[@]}"; do
  commit_count=$(git log --all --since="3 months ago" --oneline --remotes=upstream/* -- "$file" 2>/dev/null | wc -l)
  echo "- \`$file\`: $commit_count upstream commits" >> raw-data/phase3-detailed-analysis.md
done

echo "" >> raw-data/phase3-detailed-analysis.md
echo "### Recommended Next Actions" >> raw-data/phase3-detailed-analysis.md
echo "" >> raw-data/phase3-detailed-analysis.md
echo "1. **Review commits marked as 🎯 HIGHLY RELEVANT**" >> raw-data/phase3-detailed-analysis.md
echo "2. **Focus on commits that address your 7 problem areas**" >> raw-data/phase3-detailed-analysis.md
echo "3. **Consider cherry-picking or adapting relevant fixes**" >> raw-data/phase3-detailed-analysis.md
echo "4. **Test any upstream changes in isolated branch first**" >> raw-data/phase3-detailed-analysis.md

echo "✅ Phase 3 complete! Detailed analysis saved to raw-data/phase3-detailed-analysis.md"
echo "📋 Analyzed ${#TARGET_FILES[@]} files with upstream commits"
