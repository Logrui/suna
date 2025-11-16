# Check differences between local branch and production commit
# Compares against 71718d2d9cb49ea799990fabd42b6a545dbf169d

param(
    [string]$ProductionCommit = "71718d2d9cb49ea799990fabd42b6a545dbf169d",
    [switch]$Verbose = $false
)

# Ensure we're in git root
$gitRoot = git rev-parse --show-toplevel 2>$null
if (-not $gitRoot) {
    Write-Host "Error: Not in a git repository"
    exit 1
}
Set-Location $gitRoot

Write-Host "Checking differences from production commit..."
Write-Host "="x60
Write-Host ""

# Verify production commit exists
$commitExists = git cat-file -e "$ProductionCommit^{commit}" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Cannot resolve commit $ProductionCommit"
    exit 1
}

Write-Host "Production Commit: $ProductionCommit"
Write-Host "Current HEAD: $(git rev-parse HEAD)"
Write-Host ""

# Files that NEED MANUAL REVIEW (expected to differ)
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

# Get all modified files (files that exist in both and differ)
Write-Host "Analyzing differences..."
$modifiedFiles = @(git diff HEAD $ProductionCommit --name-only --diff-filter=M)

# Get files only in local (added locally, not in production)
$localOnlyFiles = @(git diff HEAD $ProductionCommit --name-only --diff-filter=A)

# Get files only in production (deleted locally, exist in production)
$productionOnlyFiles = @(git diff HEAD $ProductionCommit --name-only --diff-filter=D)

Write-Host ""
Write-Host "="x60
Write-Host "SUMMARY"
Write-Host "="x60
Write-Host ""
Write-Host "Modified files (exist in both, content differs): $($modifiedFiles.Count)"
Write-Host "Files only in local branch: $($localOnlyFiles.Count)"
Write-Host "Files only in production: $($productionOnlyFiles.Count)"
Write-Host ""

# Categorize modified files
$expectedDiffs = @()
$unexpectedDiffs = @()

foreach ($file in $modifiedFiles) {
    if ($file -in $manualReviewFiles) {
        $expectedDiffs += $file
    } else {
        $unexpectedDiffs += $file
    }
}

Write-Host "="x60
Write-Host "MODIFIED FILES ANALYSIS"
Write-Host "="x60
Write-Host ""
Write-Host "Expected differences (manual review files): $($expectedDiffs.Count)"
Write-Host "Unexpected differences (should be merged): $($unexpectedDiffs.Count)"
Write-Host ""

if ($unexpectedDiffs.Count -gt 0) {
    Write-Host " UNEXPECTED DIFFERENCES (should match production):"
    Write-Host ""
    foreach ($file in $unexpectedDiffs | Select-Object -First 20) {
        Write-Host "  - $file"
    }
    if ($unexpectedDiffs.Count -gt 20) {
        Write-Host "  ... and $($unexpectedDiffs.Count - 20) more files"
    }
    Write-Host ""
}

if ($expectedDiffs.Count -gt 0) {
    Write-Host " Expected differences (manual review required):"
    Write-Host ""
    foreach ($file in $expectedDiffs) {
        Write-Host "  - $file"
    }
    Write-Host ""
}

if ($Verbose -and $localOnlyFiles.Count -gt 0) {
    Write-Host "="x60
    Write-Host "FILES ONLY IN LOCAL BRANCH"
    Write-Host "="x60
    Write-Host ""
    foreach ($file in $localOnlyFiles | Select-Object -First 30) {
        Write-Host "  + $file"
    }
    if ($localOnlyFiles.Count -gt 30) {
        Write-Host "  ... and $($localOnlyFiles.Count - 30) more files"
    }
    Write-Host ""
}

if ($Verbose -and $productionOnlyFiles.Count -gt 0) {
    Write-Host "="x60
    Write-Host "FILES ONLY IN PRODUCTION"
    Write-Host "="x60
    Write-Host ""
    foreach ($file in $productionOnlyFiles | Select-Object -First 30) {
        Write-Host "  - $file"
    }
    if ($productionOnlyFiles.Count -gt 30) {
        Write-Host "  ... and $($productionOnlyFiles.Count - 30) more files"
    }
    Write-Host ""
}

Write-Host "="x60
Write-Host "FINAL VERDICT"
Write-Host "="x60
Write-Host ""

if ($unexpectedDiffs.Count -eq 0) {
    Write-Host " SUCCESS: All safe files match production!"
    Write-Host " Only expected differences remain (manual review files)"
    Write-Host ""
    Write-Host "Next step: Manually review and merge the $($expectedDiffs.Count) manual review files"
} else {
    Write-Host "  WARNING: $($unexpectedDiffs.Count) files still differ from production"
    Write-Host ""
    Write-Host "These files should have been auto-merged but still differ."
    Write-Host "Run the auto-merge script again or investigate why they differ."
}

Write-Host ""
Write-Host "To see detailed diffs for a specific file, run:"
Write-Host "  git diff HEAD $ProductionCommit -- <filepath>"
Write-Host ""
Write-Host "To see verbose output (all local/production-only files), run:"
Write-Host "  .\check-diffs.ps1 -Verbose"
Write-Host ""
