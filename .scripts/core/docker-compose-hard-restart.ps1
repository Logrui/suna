<#
.SYNOPSIS
    Perform a hard restart of Docker Compose services.

.DESCRIPTION
    Stops containers with 'docker compose down' then starts them with 'docker compose up -d'.
    This fully recreates containers (unlike 'docker compose restart').

.PARAMETER Service
    Service to restart: 'all', 'backend', 'frontend', or 'worker'
    Default: 'all'

.PARAMETER Build
    Rebuild images before starting (adds --build flag)

.EXAMPLE
    .\docker-compose-hard-restart.ps1
    Hard restart all services

.EXAMPLE
    .\docker-compose-hard-restart.ps1 backend
    Hard restart only backend service

.EXAMPLE
    .\docker-compose-hard-restart.ps1 -Build
    Hard restart all services with rebuild

.EXAMPLE
    .\docker-compose-hard-restart.ps1 frontend -Build
    Hard restart frontend with rebuild
#>

param(
    [Parameter(Position=0)]
    [ValidateSet('all', 'backend', 'frontend', 'worker')]
    [string]$Service = 'all',
    
    [switch]$Build
)

Write-Host "`n=== Docker Compose Hard Restart ===" -ForegroundColor Cyan

if ($Service -eq 'all') {
    Write-Host "`n[1/2] Stopping all services..." -ForegroundColor Yellow
    docker compose down
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to stop services!" -ForegroundColor Red
        exit $LASTEXITCODE
    }
    
    Write-Host "`n[2/2] Starting all services..." -ForegroundColor Green
    if ($Build) {
        Write-Host "(Rebuilding images...)" -ForegroundColor DarkGray
        docker compose up -d --build
    } else {
        docker compose up -d
    }
} else {
    Write-Host "`n[1/2] Stopping $Service..." -ForegroundColor Yellow
    docker compose stop $Service
    docker compose rm -f $Service
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to stop $Service!" -ForegroundColor Red
        exit $LASTEXITCODE
    }
    
    Write-Host "`n[2/2] Starting $Service..." -ForegroundColor Green
    if ($Build) {
        Write-Host "(Rebuilding image...)" -ForegroundColor DarkGray
        docker compose up -d --build $Service
    } else {
        docker compose up -d $Service
    }
}

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✓ Done! Services are running." -ForegroundColor Green
    Write-Host "Check status with: docker compose ps`n" -ForegroundColor DarkGray
} else {
    Write-Host "`n✗ Restart failed!" -ForegroundColor Red
    exit $LASTEXITCODE
}