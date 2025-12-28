# Supabase Docker Helper Script
# This script provides shortcuts for common Supabase CLI commands
# that work with your Docker Supabase instance instead of requiring cloud authentication

# Usage: 
#   To source this file in PowerShell: . .\supabase-helpers.ps1
#   Or add it to your PowerShell profile

$DOCKER_DB_URL = "postgresql://postgres:your-super-secret-and-long-postgres-password@localhost:5434/postgres?sslmode=disable"

# Migration commands
function sb-migration-list {
    Write-Host "Listing migrations from Docker Supabase..." -ForegroundColor Cyan
    supabase migration list --db-url $DOCKER_DB_URL
}

function sb-migration-new {
    param([string]$Name)
    if (-not $Name) {
        Write-Host "Please provide a migration name" -ForegroundColor Red
        Write-Host "Usage: sb-migration-new your_migration_name" -ForegroundColor Yellow
        return
    }
    Write-Host "Creating new migration: $Name" -ForegroundColor Cyan
    supabase migration new $Name
}

function sb-db-diff {
    param([string]$Name)
    Write-Host "Generating diff from Docker Supabase..." -ForegroundColor Cyan
    if ($Name) {
        supabase db diff --db-url $DOCKER_DB_URL -f $Name
    } else {
        supabase db diff --db-url $DOCKER_DB_URL
    }
}

function sb-db-push {
    Write-Host "Pushing migrations to Docker Supabase..." -ForegroundColor Cyan
    Write-Host "This will apply all pending migrations" -ForegroundColor Yellow
    $confirm = Read-Host "Continue? (y/n)"
    if ($confirm -eq 'y') {
        supabase db push --db-url $DOCKER_DB_URL
    }
}

function sb-db-pull {
    Write-Host "Pulling schema from Docker Supabase..." -ForegroundColor Cyan
    supabase db pull --db-url $DOCKER_DB_URL
}

function sb-db-reset {
    Write-Host "WARNING: This will reset your Docker database!" -ForegroundColor Red
    Write-Host "All data will be lost and migrations will be re-applied" -ForegroundColor Yellow
    $confirm = Read-Host "Are you sure? (y/n)"
    if ($confirm -eq 'y') {
        supabase db reset --db-url $DOCKER_DB_URL
    }
}

function sb-status {
    Write-Host ""
    Write-Host "Docker Supabase Status" -ForegroundColor Cyan
    Write-Host "=" -ForegroundColor Gray
    Write-Host "Database:       localhost:5434" -ForegroundColor Green
    Write-Host "API Gateway:    http://localhost:8888" -ForegroundColor Green
    Write-Host "Studio:         http://localhost:6005" -ForegroundColor Green
    Write-Host "Project ID:     agentpress" -ForegroundColor Green
    Write-Host "=" -ForegroundColor Gray
    Write-Host ""
}

function sb-help {
    Write-Host ""
    Write-Host "Supabase Docker Helper Commands" -ForegroundColor Cyan
    Write-Host "=" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Migration Commands:" -ForegroundColor Yellow
    Write-Host "  sb-migration-list         List all migrations"
    Write-Host "  sb-migration-new name     Create a new migration"
    Write-Host "  sb-db-diff [name]         Generate diff from database"
    Write-Host ""
    Write-Host "Database Commands:" -ForegroundColor Yellow
    Write-Host "  sb-db-push                Push migrations to database"
    Write-Host "  sb-db-pull                Pull schema from database"
    Write-Host "  sb-db-reset               Reset database (destructive)"
    Write-Host ""
    Write-Host "Utility Commands:" -ForegroundColor Yellow
    Write-Host "  sb-status                 Show connection info"
    Write-Host "  sb-help                   Show this help"
    Write-Host ""
    Write-Host "=" -ForegroundColor Gray
    Write-Host ""
}

# Show welcome message
Write-Host "Supabase Docker helpers loaded!" -ForegroundColor Green
Write-Host "Type sb-help to see available commands" -ForegroundColor Gray
