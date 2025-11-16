# Fresh script to check actual differences from upstream/PRODUCTION HEAD
# Simple and direct - no assumptions

# Ensure we're in git root
$gitRoot = git rev-parse --show-toplevel 2>$null
if (-not $gitRoot) {
    Write-Host "Error: Not in a git repository"
    exit 1
}
Set-Location $gitRoot

Write-Host "Checking differences from upstream/PRODUCTION HEAD..."
Write-Host ""

# Get upstream/PRODUCTION HEAD
$productionHead = git rev-parse upstream/PRODUCTION 2>$null
if (-not $productionHead) {
    Write-Host "Error: Cannot resolve upstream/PRODUCTION"
    exit 1
}

Write-Host "Production HEAD: $productionHead"
Write-Host "Current HEAD: $(git rev-parse HEAD)"
Write-Host ""

# Get all files that differ (any type of change)
Write-Host "Files that differ from upstream/PRODUCTION:"
Write-Host "============================================"
Write-Host ""

$diffFiles = @(git diff HEAD upstream/PRODUCTION --name-only)

if ($diffFiles.Count -eq 0) {
    Write-Host "✅ No differences found!"
} else {
    Write-Host "Total files differing: $($diffFiles.Count)"
    Write-Host ""
    
    foreach ($file in $diffFiles) {
        Write-Host "  $file"
    }
}

Write-Host ""
Write-Host "============================================"
Write-Host "Summary: $($diffFiles.Count) files differ from upstream/PRODUCTION"
