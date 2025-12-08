# Pre-Deployment Check Script
# Run this before `docker compose up -d --build` to catch errors early

Write-Host "`n=== Pre-Deployment Checks ===" -ForegroundColor Cyan
Write-Host "Running automated checks to catch errors before Docker build...`n" -ForegroundColor Gray

$ErrorCount = 0
$WarningCount = 0

# Change to backend directory
Push-Location backend

# Check 1: Python Syntax
Write-Host "[1/4] Checking Python syntax..." -ForegroundColor Yellow
try {
    $result = uv run python -m py_compile core/run.py core/agentpress/thread_manager.py core/services/llm.py core/agentpress/response_processor.py 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  [OK] Syntax check passed" -ForegroundColor Green
    } else {
        Write-Host "  [ERROR] Syntax errors found:" -ForegroundColor Red
        Write-Host $result -ForegroundColor Red
        $ErrorCount++
    }
} catch {
    Write-Host "  [WARNING] Could not run syntax check: $_" -ForegroundColor Yellow
    $WarningCount++
}

# Check 2: Import Test
Write-Host "`n[2/4] Testing critical imports..." -ForegroundColor Yellow

# Create temporary Python script for import test
$tempScript = @"
from core.run import run_agent
from core.agentpress.thread_manager import ThreadManager
from core.services.llm import make_llm_api_call
from core.agentpress.response_processor import ProcessorConfig
print('All imports successful')
"@

$tempFile = "temp_import_test.py"
Set-Content -Path $tempFile -Value $tempScript

try {
    $result = uv run python $tempFile 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  OK Import test passed" -ForegroundColor Green
    } else {
        Write-Host "  ERROR Import errors found:" -ForegroundColor Red
        Write-Host $result -ForegroundColor Red
        $ErrorCount++
    }
} catch {
    Write-Host "  WARNING Could not run import test: $_" -ForegroundColor Yellow
    $WarningCount++
} finally {
    Remove-Item -Path $tempFile -ErrorAction SilentlyContinue
}

# Check 3: Search for common parameter issues
Write-Host "`n[3/4] Checking for common parameter patterns..." -ForegroundColor Yellow
$suspiciousPatterns = @(
    @{Pattern="max_xml_tool_calls="; File="core/run.py"; Context="Should be in ProcessorConfig"},
    @{Pattern="stop="; File="core/agentpress/thread_manager.py"; Context="Not supported in make_llm_api_call"},
    @{Pattern="processor_config=ProcessorConfig"; File="core/run.py"; Context="Check all ProcessorConfig fields"}
)

foreach ($check in $suspiciousPatterns) {
    $matches = Select-String -Path $check.File -Pattern $check.Pattern -Quiet
    if ($matches) {
        Write-Host "  [WARNING] Found pattern '$($check.Pattern)' in $($check.File)" -ForegroundColor Yellow
        Write-Host "     Context: $($check.Context)" -ForegroundColor Gray
        $WarningCount++
    }
}

if ($WarningCount -eq 0) {
    Write-Host "  [OK] No suspicious patterns found" -ForegroundColor Green
}

# Check 4: Recent changes review
Write-Host "`n[4/4] Reviewing recent changes..." -ForegroundColor Yellow
try {
    $recentChanges = git diff HEAD~1 --name-only -- "*.py" 2>&1
    if ($recentChanges) {
        Write-Host "  [FILES] Recently modified Python files:" -ForegroundColor Cyan
        $recentChanges | ForEach-Object { Write-Host "     - $_" -ForegroundColor Gray }
        
        # Check for new function parameters
        $newParams = git diff HEAD~1 -- "*.py" | Select-String "^\+.*=" | Select-String -Pattern "await|ProcessorConfig" | Select-Object -First 5
        if ($newParams) {
            Write-Host "`n  [WARNING] New parameter assignments detected:" -ForegroundColor Yellow
            $newParams | ForEach-Object { Write-Host "     $_" -ForegroundColor Gray }
            Write-Host "     -> Review these carefully for parameter mismatches" -ForegroundColor Gray
        }
    } else {
        Write-Host "  [INFO] No recent Python file changes" -ForegroundColor Gray
    }
} catch {
    Write-Host "  ⚠️  Could not check git history: $_" -ForegroundColor Yellow
}

Pop-Location

# Summary
Write-Host "`n=== Summary ===" -ForegroundColor Cyan
if ($ErrorCount -eq 0 -and $WarningCount -eq 0) {
    Write-Host "[OK] All checks passed! Safe to run docker compose up -d --build" -ForegroundColor Green
} elseif ($ErrorCount -eq 0) {
    Write-Host "[WARNING] $WarningCount warning(s) found. Review before building." -ForegroundColor Yellow
    Write-Host "   You can proceed with caution." -ForegroundColor Gray
} else {
    Write-Host "[ERROR] $ErrorCount error(s) found! Fix these before building." -ForegroundColor Red
    Write-Host "   Do NOT run docker compose up -d --build yet!" -ForegroundColor Red
    exit 1
}

Write-Host "`nFor more comprehensive checks, see: pre_deployment_checks.md`n" -ForegroundColor Gray
