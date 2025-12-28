param(
    [string]$HostName = "switchyard.proxy.rlwy.net",
    [string]$Port = "13956",
    [string]$Database = "postgres",
    [string]$User = "postgres",
    [string]$Password = "tfhmdrnj5zhw44v5u1vtwbuz0htdlcs2"
)

$ErrorActionPreference = "Stop"
$MigrationsDir = Join-Path $PSScriptRoot "supabase\migrations"

# Set PGPASSWORD
$env:PGPASSWORD = $Password

# 1. Initialize Migration Tracking Table
Write-Host "Initializing migration table..." -ForegroundColor Cyan
$initSql = "
CREATE TABLE IF NOT EXISTS _migrations (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    applied_at TIMESTAMPTZ DEFAULT NOW()
);
"
$initCmd = "psql -h $HostName -p $Port -U $User -d $Database -c `"$initSql`""
Invoke-Expression $initCmd

# 2. Get Applied Migrations
$appliedMigrations = @()
try {
    $appliedCmd = "psql -h $HostName -p $Port -U $User -d $Database -t -c `"SELECT name FROM _migrations`""
    $appliedMigrations = (Invoke-Expression $appliedCmd) -split "`r`n" | Where-Object { $_ -match "\S" } | ForEach-Object { $_.Trim() }
} catch {
    Write-Host "Failed to fetch applied migrations." -ForegroundColor Red
    exit 1
}

# 3. Get Local Migrations
$localMigrations = Get-ChildItem -Path $MigrationsDir -Filter "*.sql" | Sort-Object Name

# 4. Apply Pending Migrations
foreach ($file in $localMigrations) {
    if ($appliedMigrations -contains $file.Name) {
        Write-Host "Skipping: $($file.Name) (Already applied)" -ForegroundColor Gray
        continue
    }

    Write-Host "Applying: $($file.Name)..." -ForegroundColor Yellow
    
    # Run the SQL file
    $psqlCmd = "psql -h $HostName -p $Port -U $User -d $Database -f `"$($file.FullName)`""
    Invoke-Expression $psqlCmd
    
    if ($LASTEXITCODE -eq 0) {
        # Record success
        $recordSql = "INSERT INTO _migrations (name) VALUES ('$($file.Name)');"
        $recordCmd = "psql -h $HostName -p $Port -U $User -d $Database -c `"$recordSql`""
        Invoke-Expression $recordCmd
        Write-Host "Success: $($file.Name)" -ForegroundColor Green
    } else {
        Write-Host "ERROR: Failed to apply $($file.Name). Stopping." -ForegroundColor Red
        exit 1
    }
}

Write-Host "Migration run complete!" -ForegroundColor Green
