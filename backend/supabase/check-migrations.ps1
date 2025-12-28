# Check for pending migrations
# Usage: .\check-migrations.ps1
#        .\check-migrations.ps1 -Filter "billing"

param(
    [string]$Filter = ""
)

Write-Host "`nChecking migration status..." -ForegroundColor Cyan

# Get applied migrations from database
Write-Host "Fetching applied migrations from database..." -ForegroundColor Gray
$appliedOutput = .\sb.ps1 migration list 2>&1 | Out-String
$applied = $appliedOutput -split "`n" | 
    Select-String -Pattern '^\s+\d{14}' | 
    ForEach-Object { $_.ToString().Trim().Split()[0] }

# Get local migration files
Write-Host "Scanning local migration files..." -ForegroundColor Gray
$localFiles = Get-ChildItem migrations\*.sql | Sort-Object Name

# Filter if requested
if ($Filter) {
    $localFiles = $localFiles | Where-Object { $_.Name -like "*$Filter*" }
    Write-Host "Filtering migrations matching: '$Filter'" -ForegroundColor Yellow
}

# Separate into applied and pending
$appliedMigrations = @()
$pendingMigrations = @()

foreach ($file in $localFiles) {
    $timestamp = $file.BaseName.Split('_')[0]
    if ($applied -contains $timestamp) {
        $appliedMigrations += $file
    } else {
        $pendingMigrations += $file
    }
}

# Display results
Write-Host ""
Write-Host "=" -ForegroundColor Gray
Write-Host "Migration Status Report" -ForegroundColor Cyan
Write-Host "=" -ForegroundColor Gray
Write-Host ""

if ($pendingMigrations.Count -gt 0) {
    Write-Host "PENDING MIGRATIONS ($($pendingMigrations.Count)):" -ForegroundColor Yellow
    Write-Host "=" -ForegroundColor Gray
    foreach ($file in $pendingMigrations) {
        $timestamp = $file.BaseName.Split('_')[0]
        $name = $file.BaseName.Substring(15) # Remove timestamp and underscore
        Write-Host "  $timestamp" -NoNewline -ForegroundColor Red
        Write-Host " - $name" -ForegroundColor Gray
    }
    Write-Host ""
    Write-Host "To apply these migrations, run:" -ForegroundColor Yellow
    Write-Host "  .\sb.ps1 db push" -ForegroundColor Cyan
    Write-Host ""
} else {
    Write-Host "No pending migrations found." -ForegroundColor Green
    Write-Host ""
}

if ($appliedMigrations.Count -gt 0) {
    Write-Host "APPLIED MIGRATIONS ($($appliedMigrations.Count)):" -ForegroundColor Green
    if ($Filter) {
        Write-Host "=" -ForegroundColor Gray
        foreach ($file in $appliedMigrations) {
            $timestamp = $file.BaseName.Split('_')[0]
            $name = $file.BaseName.Substring(15)
            Write-Host "  $timestamp" -NoNewline -ForegroundColor Green
            Write-Host " - $name" -ForegroundColor Gray
        }
    } else {
        Write-Host "(Showing last 5, use -Filter to see specific migrations)" -ForegroundColor Gray
        Write-Host "=" -ForegroundColor Gray
        foreach ($file in ($appliedMigrations | Select-Object -Last 5)) {
            $timestamp = $file.BaseName.Split('_')[0]
            $name = $file.BaseName.Substring(15)
            Write-Host "  $timestamp" -NoNewline -ForegroundColor Green
            Write-Host " - $name" -ForegroundColor Gray
        }
    }
    Write-Host ""
}

Write-Host "Total local migrations: $($localFiles.Count)" -ForegroundColor Cyan
Write-Host "  Applied: $($appliedMigrations.Count)" -ForegroundColor Green
Write-Host "  Pending: $($pendingMigrations.Count)" -ForegroundColor $(if ($pendingMigrations.Count -gt 0) { "Red" } else { "Green" })
Write-Host ""
