<#
.SYNOPSIS
    Build and restart Docker Compose services.

.DESCRIPTION
    Runs 'docker compose up -d --build' for specified services.
    Supports building all services or specific ones (backend, frontend, worker).

.PARAMETER Service
    Service to build: 'all', 'backend', 'frontend', or 'worker'
    Default: 'all'

.EXAMPLE
    .\docker-compose-build.ps1
    Builds and restarts all services

.EXAMPLE
    .\docker-compose-build.ps1 backend
    Builds and restarts only backend

.EXAMPLE
    .\docker-compose-build.ps1 frontend
    Builds and restarts only frontend
#>

param(
    [Parameter(Position=0)]
    [ValidateSet('all', 'backend', 'frontend', 'worker')]
    [string]$Service = 'all'
)

if ($Service -eq 'all') {
    Write-Host "Building and restarting all services..." -ForegroundColor Cyan
    docker compose up -d --build
} else {
    Write-Host "Building and restarting $Service..." -ForegroundColor Cyan
    docker compose up -d --build $Service
}

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nDone! Services are running." -ForegroundColor Green
    Write-Host "Check status with: docker compose ps" -ForegroundColor DarkGray
} else {
    Write-Host "`nBuild failed!" -ForegroundColor Red
    exit $LASTEXITCODE
}