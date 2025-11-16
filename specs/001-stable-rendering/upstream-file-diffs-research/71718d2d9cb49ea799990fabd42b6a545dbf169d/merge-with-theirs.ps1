# Merge strategy: Accept all production changes, then revert manual review files
# This uses git checkout to overwrite files with production versions

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

Write-Host "Merge with Theirs Strategy"
Write-Host "="x60
Write-Host "Production Commit: $ProductionCommit"
Write-Host "Dry Run Mode: $DryRun"
Write-Host ""

# Verify production commit exists
$commitExists = git cat-file -e "$ProductionCommit^{commit}" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Cannot resolve commit $ProductionCommit"
    exit 1
}

# Files that NEED MANUAL REVIEW (will be reverted after merge)
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

# Get all modified files in backend and frontend only
Write-Host "Step 1: Finding modified files in backend/ and frontend/..."
$allModifiedFiles = @(git diff HEAD $ProductionCommit --name-only --diff-filter=M | Where-Object { 
    $_ -match "^backend/" -or $_ -match "^frontend/" 
})

Write-Host "Found $($allModifiedFiles.Count) modified files in backend/frontend"
Write-Host ""

# Separate into safe and manual review
$safeFiles = @()
$manualFiles = @()

foreach ($file in $allModifiedFiles) {
    if ($file -in $manualReviewFiles) {
        $manualFiles += $file
    } else {
        $safeFiles += $file
    }
}

Write-Host "Files to merge from production: $($safeFiles.Count)"
Write-Host "Files to keep local (manual review): $($manualFiles.Count)"
Write-Host ""

if ($safeFiles.Count -eq 0) {
    Write-Host "No files to merge. Exiting."
    exit 0
}

if ($DryRun) {
    Write-Host "DRY RUN - No changes will be made"
    Write-Host ""
    Write-Host "Would merge these files from production:"
    foreach ($file in $safeFiles | Select-Object -First 20) {
        Write-Host "  $file"
    }
    if ($safeFiles.Count -gt 20) {
        Write-Host "  ... and $($safeFiles.Count - 20) more files"
    }
    Write-Host ""
    Write-Host "Would keep local versions of:"
    foreach ($file in $manualFiles) {
        Write-Host "  $file"
    }
    Write-Host ""
    Write-Host "To execute, run:"
    Write-Host "  .\merge-with-theirs.ps1 -DryRun:`$false"
    exit 0
}

# Execute merge
Write-Host "Step 2: Checking out production versions of safe files..."
Write-Host ""

$successCount = 0
$failureCount = 0
$failedFiles = @()

foreach ($file in $safeFiles) {
    try {
        # Check if file exists in production
        $checkFile = git cat-file -e "${ProductionCommit}:$file" 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  SKIP: $file (not in production)"
            continue
        }
        
        # Checkout file from production commit
        git checkout $ProductionCommit -- $file 2>$null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  MERGED: $file"
            $successCount++
        } else {
            Write-Host "  ERROR: $file"
            $failureCount++
            $failedFiles += $file
        }
    }
    catch {
        Write-Host "  ERROR: $file - $_"
        $failureCount++
        $failedFiles += $file
    }
}

Write-Host ""
Write-Host "="x60
Write-Host "MERGE SUMMARY"
Write-Host "="x60
Write-Host "Successfully merged: $successCount files"
Write-Host "Failed: $failureCount files"
Write-Host "Kept local (manual review): $($manualFiles.Count) files"

if ($failedFiles.Count -gt 0) {
    Write-Host ""
    Write-Host "Failed files:"
    $failedFiles | ForEach-Object { Write-Host "  - $_" }
}

Write-Host ""
Write-Host "Next steps:"
Write-Host "1. Review changes: git status"
Write-Host "2. Stage changes: git add backend/ frontend/"
Write-Host "3. Commit: git commit -m 'merge safe files from production $ProductionCommit'"
Write-Host "4. Run check-diffs.ps1 to verify"
Write-Host ""
