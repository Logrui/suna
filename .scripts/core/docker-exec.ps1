<#
.SYNOPSIS
    Execute commands inside Docker containers.

.DESCRIPTION
    Runs commands inside Suna Docker containers (backend, frontend, worker, redis).
    If no command is provided, opens an interactive bash shell.

.PARAMETER Container
    Container to execute in: 'backend', 'frontend', 'worker', or 'redis'

.PARAMETER Command
    Command to execute (optional). If not provided, opens interactive shell.

.EXAMPLE
    .\docker-exec.ps1 backend
    Opens interactive bash shell in backend container

.EXAMPLE
    .\docker-exec.ps1 backend env
    Shows environment variables in backend container

.EXAMPLE
    .\docker-exec.ps1 backend uv run pytest --version
    Runs pytest version command in backend
#>

param(
    [Parameter(Mandatory=$true, Position=0)]
    [ValidateSet('backend', 'frontend', 'worker', 'redis')]
    [string]$Container,
    
    [Parameter(Mandatory=$false, ValueFromRemainingArguments=$true)]
    [string[]]$Command
)

$containerName = "suna-$Container-1"

# Check if container exists and is running
$containerExists = docker ps --filter "name=$containerName" --format "{{.Names}}" 2>$null

if (-not $containerExists) {
    Write-Host "Error: Container '$containerName' is not running!" -ForegroundColor Red
    Write-Host "Start it with: docker compose up -d $Container" -ForegroundColor Yellow
    exit 1
}

if ($Command.Count -eq 0) {
    # No command provided, open interactive shell
    Write-Host "Opening interactive shell in $containerName..." -ForegroundColor Cyan
    Write-Host "(Type 'exit' to leave the container)" -ForegroundColor DarkGray
    docker exec -it $containerName /bin/bash
} else {
    # Execute provided command
    Write-Host "Executing in $containerName`: $($Command -join ' ')" -ForegroundColor Cyan
    docker exec -it $containerName $Command
}