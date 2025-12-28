<#
.SYNOPSIS
    Sync data between Local Docker Supabase and Railway Supabase

.DESCRIPTION
    This script exports data from local Supabase and imports to Railway,
    or vice versa. Useful for keeping dev and production in sync.

.PARAMETER Direction
    "local-to-railway" - Export from local, import to Railway (default)
    "railway-to-local" - Export from Railway, import to local

.PARAMETER TablesOnly
    If specified, only sync specific tables (not full database)

.EXAMPLE
    .\sync-supabase.ps1 -Direction "local-to-railway"
    .\sync-supabase.ps1 -Direction "railway-to-local" -TablesOnly
#>

param(
    [ValidateSet("local-to-railway", "railway-to-local")]
    [string]$Direction = "local-to-railway",
    
    [switch]$TablesOnly,
    [switch]$SchemaOnly,
    [switch]$DryRun
)

# ============================================
# Configuration - Update these values!
# ============================================

# Local Supabase (Docker)
$LOCAL_CONTAINER = "supabase-db"
$LOCAL_DB = "postgres"
$LOCAL_USER = "postgres"

# Railway Supabase - Actual Railway Postgres proxy address
# Get from Railway Dashboard > Postgres service > Variables
$RAILWAY_HOST = $env:RAILWAY_PG_HOST ?? "switchyard.proxy.rlwy.net"
$RAILWAY_PORT = $env:RAILWAY_PG_PORT ?? "13956"
$RAILWAY_PASSWORD = $env:RAILWAY_PG_PASSWORD ?? "your-railway-postgres-password"
$RAILWAY_DB = "postgres"
$RAILWAY_USER = "postgres"

# Backup settings
$BACKUP_DIR = "D:\Homelab\suna\backups"
$KEEP_BACKUPS_DAYS = 7

# Tables to sync (if using -TablesOnly)
$SYNC_TABLES = @(
    "public.accounts",
    "public.threads",
    "public.messages",
    "public.projects",
    "public.agent_runs",
    "public.agents",
    "public.api_keys",
    "public.mcp_connections",
    "public.basejump.accounts",
    "public.basejump.account_user"
    # Add more tables as needed
)

# Schemas to include
$SYNC_SCHEMAS = @("public", "basejump")

# ============================================
# Functions
# ============================================

function Write-Log {
    param(
        [string]$Message,
        [string]$Level = "INFO"
    )
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $color = switch ($Level) {
        "ERROR" { "Red" }
        "WARN"  { "Yellow" }
        "SUCCESS" { "Green" }
        default { "White" }
    }
    Write-Host "[$timestamp] [$Level] $Message" -ForegroundColor $color
    
    if ($script:LogFile) {
        Add-Content -Path $script:LogFile -Value "[$timestamp] [$Level] $Message"
    }
}

function Test-Prerequisites {
    # Check Docker is running
    try {
        docker ps | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Docker not responding" }
    } catch {
        Write-Log "Docker is not running or not installed" "ERROR"
        return $false
    }
    
    # Check local Supabase container exists
    $container = docker ps --filter "name=$LOCAL_CONTAINER" --format "{{.Names}}"
    if (-not $container) {
        Write-Log "Local Supabase container '$LOCAL_CONTAINER' not found" "ERROR"
        Write-Log "Available containers:" "INFO"
        docker ps --format "{{.Names}}"
        return $false
    }
    
    # Check psql is available (for Railway import)
    try {
        $psqlVersion = psql --version 2>&1
        Write-Log "Found psql: $psqlVersion" "INFO"
    } catch {
        Write-Log "psql not found. Install PostgreSQL client tools." "ERROR"
        return $false
    }
    
    return $true
}

function Export-LocalSupabase {
    param([string]$OutputFile)
    
    $schemaArgs = ($SYNC_SCHEMAS | ForEach-Object { "--schema=$_" }) -join " "
    
    if ($TablesOnly) {
        $tableArgs = ($SYNC_TABLES | ForEach-Object { "--table=$_" }) -join " "
        $cmd = "pg_dump -U $LOCAL_USER -d $LOCAL_DB $tableArgs --data-only --disable-triggers"
    } elseif ($SchemaOnly) {
        $cmd = "pg_dump -U $LOCAL_USER -d $LOCAL_DB $schemaArgs --schema-only"
    } else {
        $cmd = "pg_dump -U $LOCAL_USER -d $LOCAL_DB $schemaArgs --clean --if-exists"
    }
    
    Write-Log "Exporting from local Supabase..."
    Write-Log "Command: docker exec -t $LOCAL_CONTAINER $cmd" "INFO"
    
    if ($DryRun) {
        Write-Log "[DRY RUN] Would export to: $OutputFile" "WARN"
        return $true
    }
    
    $output = docker exec -t $LOCAL_CONTAINER sh -c $cmd 2>&1
    $output | Out-File -FilePath $OutputFile -Encoding UTF8
    
    if ($LASTEXITCODE -eq 0 -and (Test-Path $OutputFile) -and (Get-Item $OutputFile).Length -gt 0) {
        $size = (Get-Item $OutputFile).Length / 1KB
        Write-Log "Export successful: $OutputFile (${size:N2} KB)" "SUCCESS"
        return $true
    } else {
        Write-Log "Export failed" "ERROR"
        return $false
    }
}

function Import-ToRailway {
    param([string]$InputFile)
    
    Write-Log "Importing to Railway Supabase..."
    Write-Log "Host: $RAILWAY_HOST, Port: $RAILWAY_PORT" "INFO"
    
    if ($DryRun) {
        Write-Log "[DRY RUN] Would import from: $InputFile" "WARN"
        return $true
    }
    
    $env:PGPASSWORD = $RAILWAY_PASSWORD
    
    # Test connection first
    $testResult = psql -h $RAILWAY_HOST -p $RAILWAY_PORT -U $RAILWAY_USER -d $RAILWAY_DB -c "SELECT 1;" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Log "Cannot connect to Railway PostgreSQL: $testResult" "ERROR"
        return $false
    }
    
    # Import
    $result = psql -h $RAILWAY_HOST -p $RAILWAY_PORT -U $RAILWAY_USER -d $RAILWAY_DB -f $InputFile 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Log "Import successful!" "SUCCESS"
        return $true
    } else {
        Write-Log "Import had issues: $result" "WARN"
        return $false
    }
}

function Export-Railway {
    param([string]$OutputFile)
    
    Write-Log "Exporting from Railway Supabase..."
    
    if ($DryRun) {
        Write-Log "[DRY RUN] Would export to: $OutputFile" "WARN"
        return $true
    }
    
    $env:PGPASSWORD = $RAILWAY_PASSWORD
    
    $schemaArgs = ($SYNC_SCHEMAS | ForEach-Object { "--schema=$_" }) -join " "
    
    if ($TablesOnly) {
        $tableArgs = ($SYNC_TABLES | ForEach-Object { "--table=$_" }) -join " "
        $cmd = "pg_dump -h $RAILWAY_HOST -p $RAILWAY_PORT -U $RAILWAY_USER -d $RAILWAY_DB $tableArgs --data-only --disable-triggers"
    } else {
        $cmd = "pg_dump -h $RAILWAY_HOST -p $RAILWAY_PORT -U $RAILWAY_USER -d $RAILWAY_DB $schemaArgs --clean --if-exists"
    }
    
    Invoke-Expression $cmd | Out-File -FilePath $OutputFile -Encoding UTF8
    
    if ($LASTEXITCODE -eq 0 -and (Test-Path $OutputFile) -and (Get-Item $OutputFile).Length -gt 0) {
        $size = (Get-Item $OutputFile).Length / 1KB
        Write-Log "Export successful: $OutputFile (${size:N2} KB)" "SUCCESS"
        return $true
    } else {
        Write-Log "Export failed" "ERROR"
        return $false
    }
}

function Import-ToLocal {
    param([string]$InputFile)
    
    Write-Log "Importing to local Supabase..."
    
    if ($DryRun) {
        Write-Log "[DRY RUN] Would import from: $InputFile" "WARN"
        return $true
    }
    
    # Copy file to container and import
    docker cp $InputFile "${LOCAL_CONTAINER}:/tmp/import.sql"
    docker exec -t $LOCAL_CONTAINER psql -U $LOCAL_USER -d $LOCAL_DB -f /tmp/import.sql
    
    if ($LASTEXITCODE -eq 0) {
        Write-Log "Import successful!" "SUCCESS"
        return $true
    } else {
        Write-Log "Import failed" "ERROR"
        return $false
    }
}

function Cleanup-OldBackups {
    $cutoffDate = (Get-Date).AddDays(-$KEEP_BACKUPS_DAYS)
    $oldFiles = Get-ChildItem -Path $BACKUP_DIR -Filter "*.sql" | 
                Where-Object { $_.LastWriteTime -lt $cutoffDate }
    
    if ($oldFiles) {
        Write-Log "Cleaning up $($oldFiles.Count) old backup files..." "INFO"
        $oldFiles | Remove-Item -Force
    }
}

# ============================================
# Main Execution
# ============================================

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"

# Create backup directory
if (!(Test-Path $BACKUP_DIR)) {
    New-Item -ItemType Directory -Path $BACKUP_DIR | Out-Null
}

# Set up logging
$script:LogFile = Join-Path $BACKUP_DIR "sync_$timestamp.log"

Write-Log "========================================" "INFO"
Write-Log "Supabase Sync Script Started" "INFO"
Write-Log "Direction: $Direction" "INFO"
Write-Log "Tables Only: $TablesOnly" "INFO"
Write-Log "Schema Only: $SchemaOnly" "INFO"
Write-Log "Dry Run: $DryRun" "INFO"
Write-Log "========================================" "INFO"

# Check prerequisites
if (-not (Test-Prerequisites)) {
    Write-Log "Prerequisites check failed. Exiting." "ERROR"
    exit 1
}

$backupFile = Join-Path $BACKUP_DIR "backup_${Direction}_$timestamp.sql"

try {
    switch ($Direction) {
        "local-to-railway" {
            if (Export-LocalSupabase -OutputFile $backupFile) {
                Import-ToRailway -InputFile $backupFile
            }
        }
        "railway-to-local" {
            if (Export-Railway -OutputFile $backupFile) {
                Import-ToLocal -InputFile $backupFile
            }
        }
    }
    
    # Cleanup old backups
    Cleanup-OldBackups
    
    Write-Log "========================================" "INFO"
    Write-Log "Sync completed successfully!" "SUCCESS"
    Write-Log "========================================" "INFO"
    
} catch {
    Write-Log "Unexpected error: $_" "ERROR"
    Write-Log $_.ScriptStackTrace "ERROR"
    exit 1
}
