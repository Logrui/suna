# Auto-merge script - overwrites safe files with specific production commit
# Compares against 71718d2d9cb49ea799990fabd42b6a545dbf169d (the target production state)

param(
    [string]$ProductionCommit = "71718d2d9cb49ea799990fabd42b6a545dbf169d",
    [switch]$DryRun = $true
)

# Ensure we're in git root
$gitRoot = git rev-parse --show-toplevel 2>$null
if (-not $gitRoot) {
    Write-Host "Error: Not in a git repository"
    exit 1
}
Set-Location $gitRoot

Write-Host "Auto-Merge Script - Safe Files from Production Commit"
Write-Host "======================================================"
Write-Host "Production Commit: $ProductionCommit"
Write-Host "Dry Run Mode: $DryRun"
Write-Host ""

# Verify production commit exists
$commitExists = git cat-file -e "$ProductionCommit^{commit}" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Cannot resolve commit $ProductionCommit"
    exit 1
}

Write-Host "Current HEAD: $(git rev-parse HEAD)"
Write-Host ""

# Files that NEED MANUAL REVIEW (DO NOT AUTO-MERGE)
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

# Get all files that differ from production commit
Write-Host "Fetching all files that differ from production commit..."
$allDiffFiles = @(git diff HEAD $ProductionCommit --name-only --diff-filter=M)

Write-Host "Total files differing: $($allDiffFiles.Count)"
Write-Host ""

# Separate into safe and manual review
$safeFiles = @()
$manualFiles = @()

foreach ($file in $allDiffFiles) {
    if ($file -in $manualReviewFiles) {
        $manualFiles += $file
    } else {
        $safeFiles += $file
    }
}

Write-Host "Files safe to auto-merge: $($safeFiles.Count)"
Write-Host "Files requiring manual review: $($manualFiles.Count)"
Write-Host ""

if ($safeFiles.Count -eq 0) {
    Write-Host "No safe files to merge. Exiting."
    exit 0
}

if ($DryRun) {
    Write-Host "DRY RUN - No changes will be made"
    Write-Host ""
    Write-Host "Files that WOULD be merged:"
    foreach ($file in $safeFiles | Select-Object -First 20) {
        Write-Host "  $file"
    }
    if ($safeFiles.Count -gt 20) {
        Write-Host "  ... and $($safeFiles.Count - 20) more files"
    }
    exit 0
}

# Execute auto-merge
Write-Host "Starting auto-merge of $($safeFiles.Count) safe files..."
Write-Host ""

$successCount = 0
$skipCount = 0
$failureCount = 0
$failedFiles = @()
$skippedFiles = @()

foreach ($file in $safeFiles) {
    try {
        # Check if file exists in production commit first
        $checkFile = git cat-file -e "${ProductionCommit}:$file" 2>$null
        if ($LASTEXITCODE -ne 0) {
            # File doesn't exist in production commit, skip it silently
            $skipCount++
            $skippedFiles += $file
            continue
        }
        
        # Create directory if needed
        $dir = Split-Path $file
        if ($dir) {
            if (-not (Test-Path -LiteralPath $dir)) {
                New-Item -ItemType Directory -Path $dir -Force | Out-Null
            }
        }
        
        # Get file content from production commit
        $content = git show "${ProductionCommit}:$file" 2>$null
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  ERROR: $file (failed to read from production)"
            $failureCount++
            $failedFiles += $file
            continue
        }
        
        # Write file using -LiteralPath to avoid wildcard expansion with brackets
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
Write-Host "Skipped (not in production): $skipCount files"
Write-Host "Failed: $failureCount files"

if ($failedFiles.Count -gt 0) {
    Write-Host ""
    Write-Host "Failed files:"
    $failedFiles | ForEach-Object { Write-Host "  - $_" }
}

if ($skipCount -gt 0 -and $skipCount -lt 20) {
    Write-Host ""
    Write-Host "Skipped files (don't exist in production commit):"
    $skippedFiles | ForEach-Object { Write-Host "  - $_" }
}

Write-Host ""
Write-Host "Next steps:"
Write-Host "1. Review merged files: git status"
Write-Host "2. Stage and commit: git add . && git commit -m 'auto-merge safe files from production commit $ProductionCommit'"
Write-Host "3. Run tests to verify functionality"
Write-Host "4. Manually review and merge the $($manualFiles.Count) files marked as NEEDS MANUAL REVIEW"
