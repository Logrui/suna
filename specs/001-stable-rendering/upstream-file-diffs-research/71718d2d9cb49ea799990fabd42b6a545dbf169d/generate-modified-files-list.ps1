# Script to verify which files still differ from production after merge
# Usage: .\generate-modified-files-list.ps1

$commit = "71718d2d9cb49ea799990fabd42b6a545dbf169d"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$outputFile = Join-Path $scriptDir "REMAINING_DIFFS.md"

# Files that NEED MANUAL REVIEW (should be the only ones differing)
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

# Get all files that differ from production
$allDiffFiles = git diff HEAD $commit --name-only --diff-filter=M | Sort-Object

# Separate by category
$backendFiles = @()
$frontendFiles = @()
$otherFiles = @()
$unexpectedFiles = @()

foreach ($file in $allDiffFiles) {
    if ($file -in $manualReviewFiles) {
        # Expected - these should differ
        if ($file -match "^backend/") {
            $backendFiles += $file
        } elseif ($file -match "^frontend/") {
            $frontendFiles += $file
        } else {
            $otherFiles += $file
        }
    } else {
        # Unexpected - these should have been merged
        $unexpectedFiles += $file
    }
}

# Start building markdown
$markdown = "# Files Still Differing from Production Commit`n`n"
$markdown += "**Production Commit**: ``$commit``  `n"
$markdown += "**Status**: Post auto-merge verification`n`n"
$markdown += "**Total Differing Files**: $($allDiffFiles.Count)`n"
$markdown += "- Expected (Manual Review): $($manualReviewFiles.Count)`n"
$markdown += "- Unexpected (Should be merged): $($unexpectedFiles.Count)`n`n"

if ($unexpectedFiles.Count -gt 0) {
    $markdown += "## ⚠️ UNEXPECTED DIFFERENCES (Should have been merged!)`n`n"
    foreach ($file in $unexpectedFiles) {
        $markdown += "- ``$file``  `n"
    }
    $markdown += "`n---`n`n"
}

$markdown += "## Expected Differences (Manual Review Required)`n`n"
$markdown += "### Backend Files ($($backendFiles.Count))`n`n"
foreach ($file in $backendFiles) {
    $markdown += "- ``$file``  `n"
}

$markdown += "`n### Frontend Files ($($frontendFiles.Count))`n`n"
foreach ($file in $frontendFiles) {
    $markdown += "- ``$file``  `n"
}

if ($otherFiles.Count -gt 0) {
    $markdown += "`n### Other Files ($($otherFiles.Count))`n`n"
    foreach ($file in $otherFiles) {
        $markdown += "- ``$file``  `n"
    }
}

# Write to file
$markdown | Out-File -FilePath $outputFile -Encoding UTF8

Write-Host "Generated $outputFile"
Write-Host ""
Write-Host "Summary:"
Write-Host "  Total files differing: $($allDiffFiles.Count)"
Write-Host "  Expected (Manual Review): $($manualReviewFiles.Count)"
Write-Host "  Unexpected: $($unexpectedFiles.Count)"
Write-Host ""

if ($unexpectedFiles.Count -gt 0) {
    Write-Host "⚠️  WARNING: Found $($unexpectedFiles.Count) unexpected differences!"
    Write-Host "These files should have been merged but still differ from production."
} else {
    Write-Host "✅ All differences are expected (manual review files only)"
}
