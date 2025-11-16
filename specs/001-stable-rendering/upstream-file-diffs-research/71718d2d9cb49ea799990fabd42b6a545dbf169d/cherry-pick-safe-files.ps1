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

# Execute cherry-pick
Write-Host "Starting cherry-pick of $($commitsToPickInOrder.Count) commits..."
Write-Host ""

$successCount = 0
$conflictCount = 0
$skipCount = 0
$conflictedCommits = @()

foreach ($commit in $commitsToPickInOrder) {
    Write-Host "Cherry-picking: $($commit.Hash) - $($commit.Message)"
    
    # Check if commit only touches manual review files
    $touchesManualReviewFiles = $false
    foreach ($file in $commit.Files) {
        if ($file -in $manualReviewFiles) {
            $touchesManualReviewFiles = $true
            break
        }
    }
    
    if ($touchesManualReviewFiles) {
        Write-Host "  ⚠️  SKIP: Commit touches manual review files"
        $skipCount++
        continue
    }
    
    # Attempt cherry-pick
    git cherry-pick $commit.Hash 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ SUCCESS"
        $successCount++
    } else {
        # Check if there's a conflict
        $status = git status --porcelain
        
        if ($status -match "^UU|^AA|^DD") {
            Write-Host "  ⚠️  CONFLICT DETECTED"
            $conflictCount++
            $conflictedCommits += $commit
            
            if ($SkipConflicts) {
                Write-Host "     Aborting cherry-pick and continuing..."
                git cherry-pick --abort 2>&1 | Out-Null
            } else {
                Write-Host ""
                Write-Host "CONFLICT RESOLUTION REQUIRED"
                Write-Host "=============================="
                Write-Host "Commit: $($commit.Hash)"
                Write-Host "Message: $($commit.Message)"
                Write-Host "Files in conflict:"
                git diff --name-only --diff-filter=U | ForEach-Object { Write-Host "  - $_" }
                Write-Host ""
                Write-Host "Options:"
                Write-Host "  1. Resolve conflicts manually, then run: git cherry-pick --continue"
                Write-Host "  2. Skip this commit: git cherry-pick --skip"
                Write-Host "  3. Abort and restart with -SkipConflicts flag"
                Write-Host ""
                Write-Host "Script paused. Resolve conflicts and press Enter to continue..."
                Read-Host
                
                # Check if user resolved
                $status = git status --porcelain
                if ($status -match "^UU|^AA|^DD") {
                    Write-Host "Conflicts still present. Aborting cherry-pick..."
                    git cherry-pick --abort 2>&1 | Out-Null
                } else {
                    Write-Host "Conflicts resolved. Continuing..."
                    $successCount++
                }
            }
        } else {
            Write-Host "  ❌ ERROR: Unknown issue"
            git cherry-pick --abort 2>&1 | Out-Null
        }
    }
}

Write-Host ""
Write-Host "=============================="
Write-Host "Cherry-Pick Summary"
Write-Host "=============================="
Write-Host "Successfully cherry-picked: $successCount commits"
Write-Host "Conflicts encountered: $conflictCount commits"
Write-Host "Skipped (manual review files): $skipCount commits"

if ($conflictedCommits.Count -gt 0) {
    Write-Host ""
    Write-Host "Conflicted commits:"
    foreach ($commit in $conflictedCommits) {
        Write-Host "  - $($commit.Hash): $($commit.Message)"
    }
}

Write-Host ""
Write-Host "Next steps:"
Write-Host "1. Review cherry-picked commits: git log --oneline -$successCount"
Write-Host "2. Run tests to verify functionality"
Write-Host "3. If conflicts remain, resolve them manually"
Write-Host "4. Manually review and merge the 28 files marked as NEEDS MANUAL REVIEW"
