# Script to generate MODIFIED_FILES.md from production commit
# Usage: .\generate-modified-files-list.ps1

$commit = "71718d2d9cb49ea799990fabd42b6a545dbf169d"
$outputFile = "MODIFIED_FILES.md"

# Get all modified files
$modifiedFiles = git diff HEAD $commit --name-only --diff-filter=M | Sort-Object

# Separate by category
$backendFiles = @()
$frontendFiles = @()
$otherFiles = @()

foreach ($file in $modifiedFiles) {
    if ($file -match "^backend/") {
        $backendFiles += $file
    } elseif ($file -match "^frontend/") {
        $frontendFiles += $file
    } else {
        $otherFiles += $file
    }
}

# Start building markdown
$markdown = "# Modified Files in Production Commit $commit`n`n"
$markdown += "**Commit**: ``$commit``  `n"
$markdown += "**Author**: Saumya  `n"
$markdown += "**Date**: Sat Nov 15 20:08:02 2025 +0530  `n"
$markdown += "**Message**: revamp app`n`n"
$markdown += "**Total Modified Files**: $($modifiedFiles.Count)`n"
$markdown += "- Backend: $($backendFiles.Count)`n"
$markdown += "- Frontend: $($frontendFiles.Count)`n"
$markdown += "- Other: $($otherFiles.Count)`n`n"
$markdown += "---`n`n"
$markdown += "## Backend Files ($($backendFiles.Count)) - PRIORITY FOR STREAMING FIXES`n`n"
$markdown += "These are the critical files for chat completions and streaming:`n`n"

foreach ($file in $backendFiles) {
    $markdown += "- ``$file``  `n"
}

$markdown += "`n---`n`n"
$markdown += "## Frontend Files ($($frontendFiles.Count)) - UI/BILLING/COMPONENTS`n`n"

foreach ($file in $frontendFiles) {
    $markdown += "- ``$file``  `n"
}

if ($otherFiles.Count -gt 0) {
    $markdown += "`n---`n`n"
    $markdown += "## Other Files ($($otherFiles.Count))`n`n"
    foreach ($file in $otherFiles) {
        $markdown += "- ``$file``  `n"
    }
}

# Write to file
$markdown | Out-File -FilePath $outputFile -Encoding UTF8

Write-Host "Generated $outputFile with $($modifiedFiles.Count) modified files"
Write-Host "   Backend: $($backendFiles.Count) files"
Write-Host "   Frontend: $($frontendFiles.Count) files"
Write-Host "   Other: $($otherFiles.Count) files"
