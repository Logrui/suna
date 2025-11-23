#!/bin/bash
# Phase 2: State Comparison - Compare current branch vs upstream commits
# Input: phase1-results.md (list of files with upstream activity)  
# Output: phase2-comparison.md

OUTPUT_DIR="specs/001-stable-rendering/upstream-file-diffs-research/raw-data"
OUTPUT_FILE="$OUTPUT_DIR/phase2-comparison.md"

echo "=== PHASE 2: STATE COMPARISON RESULTS ===" > "$OUTPUT_FILE"
echo "Generated: $(date)" >> "$OUTPUT_FILE"
echo "Current Branch: $(git branch --show-current)" >> "$OUTPUT_FILE"
echo "**Scope**: Upstream remote only (kortix-ai/suna)" >> "$OUTPUT_FILE"
echo "**Filter**: Excludes origin remote and local branches" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Get files with upstream activity from Phase 1
# Extract only files that had commit_count > 0
FILES_WITH_ACTIVITY=()

# Parse phase1-results.md to get active files
if [ -f "$OUTPUT_DIR/phase1-results.md" ]; then
  while IFS= read -r line; do
    # Look for lines that start with | `filename` | number |
    if [[ $line =~ ^\|[[:space:]]*\`([^\`]+)\`[[:space:]]*\|[[:space:]]*([0-9]+)[[:space:]]*\| ]]; then
      file="${BASH_REMATCH[1]}"
      count="${BASH_REMATCH[2]}"
      if [ "$count" -gt 0 ]; then
        FILES_WITH_ACTIVITY+=("$file")
      fi
    fi
  done < "$OUTPUT_DIR/phase1-results.md"
fi

# If no phase1 results, fall back to high-priority files
if [ ${#FILES_WITH_ACTIVITY[@]} -eq 0 ]; then
  echo "⚠️  No phase1-results.md found. Using high-priority files for comparison." >> "$OUTPUT_FILE"
  FILES_WITH_ACTIVITY=(
    "backend/core/agentpress/response_processor.py"
    "backend/run_agent_background.py"
    "frontend/src/hooks/useAgentStream.ts"
    "backend/core/agent_runs.py"
    "backend/core/run.py"
    "frontend/src/lib/api.ts"
  )
fi

echo "## Comparison Categories" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Arrays to store results
CURRENT_MATCHES=()
CURRENT_BEHIND=()
NO_CURRENT_FILE=()

echo "| File | Status | Current Hash | Latest Upstream Hash | Upstream Date | Behind By |" >> "$OUTPUT_FILE"
echo "|------|--------|--------------|--------------------|---------------|-----------|" >> "$OUTPUT_FILE"

for file in "${FILES_WITH_ACTIVITY[@]}"; do
  echo "Analyzing $file..." >&2
  
  # Check if file exists on current branch
  if ! git show HEAD:"$file" >/dev/null 2>&1; then
    NO_CURRENT_FILE+=("$file")
    echo "| \`$file\` | ❌ **NOT ON CURRENT BRANCH** | - | - | - | - |" >> "$OUTPUT_FILE"
    continue
  fi
  
  # Get current branch file hash with date
  current_hash=$(git log -1 --format="%h" HEAD -- "$file" 2>/dev/null)
  current_date=$(git log -1 --format="%cd" --date=short HEAD -- "$file" 2>/dev/null)
  if [ -z "$current_hash" ]; then
    current_hash="unknown"
    current_date="unknown"
  fi
  
  # Get most recent upstream commit hash and date for this file (upstream remote only)
  upstream_info=$(git log -1 --format="%h %cd" --date=short --remotes=upstream/* -- "$file" 2>/dev/null)
  upstream_hash=$(echo "$upstream_info" | cut -d' ' -f1)
  upstream_date=$(echo "$upstream_info" | cut -d' ' -f2)
  if [ -z "$upstream_hash" ]; then
    upstream_hash="unknown"
    upstream_date="unknown"
  fi
  
  # Count commits between current and upstream
  if [ "$current_hash" != "unknown" ] && [ "$upstream_hash" != "unknown" ]; then
    # Check if current commit contains the upstream changes
    if git merge-base --is-ancestor "$upstream_hash" HEAD 2>/dev/null; then
      # Current branch includes upstream changes
      CURRENT_MATCHES+=("$file")
      echo "| \`$file\` | ✅ **CURRENT** | $current_hash | $upstream_hash | $upstream_date | 0 (up to date) |" >> "$OUTPUT_FILE"
    else
      # Current branch is behind upstream
      commits_behind=$(git rev-list --count "$current_hash..$upstream_hash" 2>/dev/null || echo "unknown")
      CURRENT_BEHIND+=("$file")
      echo "| \`$file\` | 🔄 **BEHIND** | $current_hash | $upstream_hash | $upstream_date | $commits_behind commits |" >> "$OUTPUT_FILE"
    fi
  else
    CURRENT_BEHIND+=("$file")
    echo "| \`$file\` | ❓ **UNCLEAR** | $current_hash | $upstream_hash | $upstream_date | ? |" >> "$OUTPUT_FILE"
  fi
done

echo "" >> "$OUTPUT_FILE"
echo "## Detailed Analysis" >> "$OUTPUT_FILE"

# Section 1: Files that match upstream
echo "" >> "$OUTPUT_FILE"
echo "### ✅ Files Matching Most Recent Upstream (${#CURRENT_MATCHES[@]} files)" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "These files are already up-to-date with upstream changes. Lower priority for research." >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

if [ ${#CURRENT_MATCHES[@]} -eq 0 ]; then
  echo "- None" >> "$OUTPUT_FILE"
else
  for file in "${CURRENT_MATCHES[@]}"; do
    echo "- \`$file\`" >> "$OUTPUT_FILE"
  done
fi

# Section 2: Files behind upstream
echo "" >> "$OUTPUT_FILE"
echo "### 🔄 Files Behind Upstream (${#CURRENT_BEHIND[@]} files)" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "These files have newer upstream changes that could contain fixes for our problem areas. **HIGH PRIORITY** for research." >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

if [ ${#CURRENT_BEHIND[@]} -eq 0 ]; then
  echo "- None" >> "$OUTPUT_FILE"
else
  for file in "${CURRENT_BEHIND[@]}"; do
    echo "- \`$file\` - **Research this file**" >> "$OUTPUT_FILE"
  done
fi

# Section 3: Files not on current branch
echo "" >> "$OUTPUT_FILE"
echo "### ❌ Files Not on Current Branch (${#NO_CURRENT_FILE[@]} files)" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "These files exist upstream but not on current branch. May be new files worth investigating." >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

if [ ${#NO_CURRENT_FILE[@]} -eq 0 ]; then
  echo "- None" >> "$OUTPUT_FILE"
else
  for file in "${NO_CURRENT_FILE[@]}"; do
    echo "- \`$file\` - **Could be new file**" >> "$OUTPUT_FILE"
  done
fi

# Generate research priorities
echo "" >> "$OUTPUT_FILE"
echo "## Research Priority Ranking" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "### 🎯 HIGH PRIORITY (Files Behind Upstream)" >> "$OUTPUT_FILE"

priority_count=1
for file in "${CURRENT_BEHIND[@]}"; do
  echo "$priority_count. \`$file\`" >> "$OUTPUT_FILE"
  priority_count=$((priority_count + 1))
done

echo "" >> "$OUTPUT_FILE"
echo "### 🔍 MEDIUM PRIORITY (New Files)" >> "$OUTPUT_FILE"

for file in "${NO_CURRENT_FILE[@]}"; do
  echo "$priority_count. \`$file\`" >> "$OUTPUT_FILE"
  priority_count=$((priority_count + 1))
done

echo "" >> "$OUTPUT_FILE"
echo "### ⬇️ LOW PRIORITY (Already Current)" >> "$OUTPUT_FILE"

for file in "${CURRENT_MATCHES[@]}"; do
  echo "$priority_count. \`$file\` (already up-to-date)" >> "$OUTPUT_FILE"
  priority_count=$((priority_count + 1))
done

# Summary
echo "" >> "$OUTPUT_FILE"
echo "## Summary" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "- **Files to Research**: ${#CURRENT_BEHIND[@]} (behind upstream)" >> "$OUTPUT_FILE"
echo "- **Files Already Current**: ${#CURRENT_MATCHES[@]} (matches upstream)" >> "$OUTPUT_FILE"
echo "- **New Files**: ${#NO_CURRENT_FILE[@]} (not on current branch)" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "**Next Step**: Review results and proceed to Phase 3 for detailed commit analysis on high-priority files." >> "$OUTPUT_FILE"

echo "✅ Phase 2 complete! Results saved to $OUTPUT_FILE"
echo "🎯 Research priority: ${#CURRENT_BEHIND[@]} files behind upstream"
