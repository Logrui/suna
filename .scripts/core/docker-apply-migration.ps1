<#
.SYNOPSIS
    Apply a SQL migration to the Supabase database.

.DESCRIPTION
    Takes a .sql migration file and applies it to the Supabase database container.
    Uses 'docker exec -i' to pipe the SQL directly to psql.
    Robust approach that doesn't require docker-compose.yml location.

.PARAMETER MigrationFile
    Path to the .sql migration file.

.PARAMETER ContainerName
    Name of the Supabase database container.
    Default: 'supabase-db'

.EXAMPLE
    .\docker-apply-migration.ps1 .\migrations\new_table.sql
    Applies migration to default 'supabase-db' container

.EXAMPLE
    .\docker-apply-migration.ps1 .\migrations\new_table.sql -ContainerName my-custom-db
    Applies migration to 'my-custom-db' container
#>

param(
    [Parameter(Mandatory=$true, Position=0)]
    [string]$MigrationFile,

    [Parameter(Position=1)]
    [string]$ContainerName = "supabase-db"
)

# Resolve absolute path
try {
    $MigrationFile = Resolve-Path $MigrationFile -ErrorAction Stop
} catch {
    Write-Host "Error: Migration file not found: $MigrationFile" -ForegroundColor Red
    exit 1
}

# Check if container is running
$containerExists = docker ps --filter "name=^/${ContainerName}$" --format "{{.Names}}" 2>$null

# Fallback check (loose match) if exact match fails
if (-not $containerExists) {
    $containerExists = docker ps --filter "name=${ContainerName}" --format "{{.Names}}" | Select-Object -First 1
}

if (-not $containerExists) {
    Write-Host "Error: Container '$ContainerName' is not running!" -ForegroundColor Red
    Write-Host "Please ensure Supabase is running or specify correct container name." -ForegroundColor Yellow
    exit 1
}

Write-Host "Applying migration: $(Split-Path $MigrationFile -Leaf)" -ForegroundColor Cyan
Write-Host "Target Container: $ContainerName" -ForegroundColor DarkGray

# Execute migration
# Uses docker exec -i to pipe file content to psql stdin
# -i: Keep STDIN open even if not attached
Get-Content $MigrationFile -Raw | docker exec -i $ContainerName psql -U postgres -d postgres

if ($LASTEXITCODE -eq 0) {
    Write-Host "Migration applied successfully!" -ForegroundColor Green
} else {
    Write-Host "Migration failed!" -ForegroundColor Red
    exit $LASTEXITCODE
}