# Auto-merge script with DEBUG output
# Test on just a few files first

param(
    [switch]$DryRun = $true
)

# Ensure we're in git root
$gitRoot = git rev-parse --show-toplevel 2>$null
if (-not $gitRoot) {
    Write-Host "Error: Not in a git repository"
    exit 1
}
Set-Location $gitRoot

Write-Host "Auto-Merge Script - DEBUG MODE"
Write-Host "==============================="
Write-Host ""

# Get production HEAD
$productionHead = git rev-parse upstream/PRODUCTION 2>$null
if (-not $productionHead) {
    Write-Host "Error: Cannot resolve upstream/PRODUCTION"
    exit 1
}

Write-Host "Production HEAD: $productionHead"
Write-Host "Current HEAD: $(git rev-parse HEAD)"
Write-Host ""

# Get first 5 files that differ
Write-Host "Getting first 5 files that differ..."
$testFiles = @(git diff HEAD upstream/PRODUCTION --name-only | Select-Object -First 5)

Write-Host "Test files: $($testFiles.Count)"
Write-Host ""

foreach ($file in $testFiles) {
    Write-Host "Testing file: $file"
    
    # Try to get file from production
    Write-Host "  Running: git show upstream/PRODUCTION:$file"
    $content = git show "upstream/PRODUCTION:$file" 2>&1
    $exitCode = $LASTEXITCODE
    
    Write-Host "  Exit code: $exitCode"
    Write-Host "  Content length: $($content.Length) bytes"
    
    if ($exitCode -ne 0) {
        Write-Host "  ERROR: Failed to get file from production"
        Write-Host "  Error message: $content"
        continue
    }
    
    # Create directory if needed
    $dir = Split-Path $file
    if ($dir) {
        Write-Host "  Creating directory: $dir"
        if (-not (Test-Path -LiteralPath $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
            Write-Host "  Directory created"
        } else {
            Write-Host "  Directory already exists"
        }
    }
    
    # Write file
    Write-Host "  Writing file to: $file"
    try {
        $content | Out-File -LiteralPath $file -Encoding UTF8 -Force
        Write-Host "  ✅ File written successfully"
        
        # Verify file exists
        if (Test-Path -LiteralPath $file) {
            $fileSize = (Get-Item -LiteralPath $file).Length
            Write-Host "  ✅ File verified - size: $fileSize bytes"
        } else {
            Write-Host "  ❌ File NOT found after writing!"
        }
    }
    catch {
        Write-Host "  ❌ ERROR writing file: $_"
    }
    
    Write-Host ""
}

Write-Host "Debug test complete"
