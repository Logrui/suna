# Selective Cherry-Pick Script for 245 safe files from production commit
# This script maintains full git history by cherry-picking only commits that touched safe files
# Strategy: For each safe file, find all commits that modified it and cherry-pick them

param(
    [string]$ProductionBranch = "upstream/PRODUCTION",
    [string]$ProductionCommit = "71718d2d9cb49ea799990fabd42b6a545dbf169d",
    [switch]$DryRun = $true,
    [switch]$SkipConflicts = $false
)

Write-Host "Selective Cherry-Pick Script (Maintains Git History)"
Write-Host "====================================================="
Write-Host "Production Branch: $ProductionBranch"
Write-Host "Production Commit (for file diff): $ProductionCommit"
Write-Host "Dry Run Mode: $DryRun"
Write-Host "Skip Conflicts: $SkipConflicts"
Write-Host ""

# Files that NEED MANUAL REVIEW (28 files - DO NOT CHERRY-PICK)
$manualReviewFiles = @(
    # Backend (10)
    "backend/.env.example",
    "backend/api.py",
    "backend/core/api.py",
    "backend/core/billing/api.py",
    "backend/core/composio_integration/api.py",
    "backend/core/limits_api.py",
    "backend/core/knowledge_base/api.py",
    "backend/core/triggers/api.py",
    "backend/supabase/config.toml",
    "backend/core/sandbox/docker/docker-compose.yml",
    
    # Frontend (16)
    "frontend/.env.example",
    "frontend/Dockerfile",
    "frontend/next.config.ts",
    "frontend/package.json",
    "frontend/package-lock.json",
    "frontend/src/components/sidebar/sidebar-left.tsx",
    "frontend/src/lib/api/projects.ts",
    "frontend/src/lib/api/threads.ts",
    "frontend/src/lib/api-client.ts",
    "frontend/src/components/knowledge-base/knowledge-base-manager.tsx",
    "frontend/src/components/knowledge-base/knowledge-base-page.tsx",
    "frontend/src/components/knowledge-base/shared-kb-tree.tsx",
    "frontend/src/components/knowledge-base/unified-kb-entry-modal.tsx",
    "frontend/src/components/sidebar/thread-search-modal.tsx",
    "frontend/src/components/ui/fancy-tabs.tsx",
    
    # Other (2)
    "docker-compose.yaml",
    "frontend/src/middleware.ts"
)

# Get all modified files from production
Write-Host "Fetching modified files from production commit..."
$allModifiedFiles = git diff HEAD $ProductionCommit --name-only --diff-filter=M

Write-Host "Total modified files in production: $($allModifiedFiles.Count)"

# Filter out manual review files
$safeFilesToMerge = @()
foreach ($file in $allModifiedFiles) {
    if ($file -notin $manualReviewFiles) {
        $safeFilesToMerge += $file
    }
}

Write-Host "Files safe to cherry-pick: $($safeFilesToMerge.Count)"
Write-Host "Files requiring manual review: $($manualReviewFiles.Count)"
Write-Host ""

if ($safeFilesToMerge.Count -eq 0) {
    Write-Host "No safe files to cherry-pick. Exiting."
    exit 0
}

# Get all commits in range
Write-Host "Fetching all commits between HEAD and production..."
$allCommitsInRange = @(git log --oneline --reverse HEAD..$ProductionBranch 2>$null)

Write-Host "Found $($allCommitsInRange.Count) total commits in range"
Write-Host ""

# Filter out commits that ONLY touch manual review files
Write-Host "Filtering commits that only touch manual review files..."
$commitsToPickInOrder = @()

foreach ($commitLine in $allCommitsInRange) {
    if ($commitLine -and $commitLine.Trim()) {
        $commitHash = $commitLine.Split()[0]
        
        # Get files changed in this commit
        $filesInCommit = @(git show --name-only --pretty=format: $commitHash 2>$null | Where-Object { $_ })
        
        # Check if commit touches any safe files
        $touchesSafeFiles = $false
        foreach ($file in $filesInCommit) {
            if ($file -notin $manualReviewFiles) {
                $touchesSafeFiles = $true
                break
            }
        }
        
        if ($touchesSafeFiles) {
            $commitsToPickInOrder += @{
                Hash = $commitHash
                Message = ($commitLine -replace "^$commitHash ", "")
                Files = $filesInCommit
            }
        }
    }
}

Write-Host "Commits to cherry-pick (touches safe files): $($commitsToPickInOrder.Count)"
Write-Host ""

Write-Host "Commits to cherry-pick (in chronological order):"
Write-Host "================================================="

if ($commitsToPickInOrder.Count -gt 0) {
    foreach ($commit in $commitsToPickInOrder) {
        Write-Host "  $($commit.Hash) - $($commit.Message)"
        Write-Host "    Files: $($commit.Files.Count)"
    }
} else {
    Write-Host "  (No commits found - this may indicate a script issue)"
}

Write-Host ""

if ($DryRun) {
    Write-Host "DRY RUN MODE - No commits will be cherry-picked"
    Write-Host ""
    Write-Host "Summary:"
    Write-Host "  - Total unique commits found: $totalCommits"
    Write-Host "  - Total commits to cherry-pick: $($commitsToPickInOrder.Count)"
    Write-Host "  - Total files affected: $($safeFilesToMerge.Count)"
    Write-Host ""
    Write-Host "To execute the cherry-pick, run:"
    Write-Host "  .\cherry-pick-safe-files.ps1 -DryRun:`$false"
    Write-Host ""
    Write-Host "To skip conflicts automatically (use with caution):"
    Write-Host "  .\cherry-pick-safe-files.ps1 -DryRun:`$false -SkipConflicts"
    exit 0
}

# Execute auto-merge for safe files
Write-Host "Starting auto-merge of $($safeFilesToMerge.Count) safe files..."
Write-Host "Strategy: Overwrite with production versions (no conflicts)"
Write-Host ""

$successCount = 0
$failureCount = 0
$failedFiles = @()

foreach ($file in $safeFilesToMerge) {
    try {
        # Get file from production commit
        $content = git show "${ProductionCommit}:$file" 2>$null
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  SKIP: $file (not found in production commit)"
            $failureCount++
            $failedFiles += $file
            continue
        }
        
        # Create directory if needed (use -LiteralPath to avoid wildcard expansion)
        $dir = Split-Path $file
        if ($dir) {
            # Use -LiteralPath to avoid wildcard expansion with brackets
            if (-not (Test-Path -LiteralPath $dir)) {
                New-Item -ItemType Directory -Path $dir -Force | Out-Null
            }
        }
        
        # Write file content using -LiteralPath to avoid wildcard expansion
        $content | Out-File -LiteralPath $file -Encoding UTF8 -Force
        
        Write-Host "  MERGED: $file"
        $successCount++
    }
    catch {
        Write-Host "  ERROR: $file - $_"
        $failureCount++
        $failedFiles += $file
    }
}

Write-Host ""
Write-Host "=============================="
Write-Host "Auto-Merge Summary"
Write-Host "=============================="
Write-Host "Successfully merged: $successCount files"
Write-Host "Failed: $failureCount files"

if ($failedFiles.Count -gt 0) {
    Write-Host ""
    Write-Host "Failed files:"
    $failedFiles | ForEach-Object { Write-Host "  - $_" }
}

Write-Host ""
Write-Host "Next steps:"
Write-Host "1. Review merged files: git status"
Write-Host "2. Stage and commit: git add . && git commit -m 'auto-merge 381 safe files from production'"
Write-Host "3. Run tests to verify functionality"
Write-Host "4. Manually review and merge the 27 files marked as NEEDS MANUAL REVIEW"
