<#
.SYNOPSIS
    Tail most recent backend logs from the Suna Docker container.

.DESCRIPTION
    Displays the most recent logs from the suna-backend-1 container.
    Default shows last 250 lines and exits. Use -Follow to stream new output.

.PARAMETER Lines
    Number of log lines to show (default: 250).
    Can be passed as a positional argument (e.g., .\script.ps1 500).

.PARAMETER Follow
    Follow log output (stream new logs)

.EXAMPLE
    .\docker-backend-tail-logs.ps1
    Shows last 250 lines and exits

.EXAMPLE
    .\docker-backend-tail-logs.ps1 500
    Shows last 500 lines and exits

.EXAMPLE
    .\docker-backend-tail-logs.ps1 -Follow
    Shows last 250 lines and follows new output

.EXAMPLE
    .\docker-backend-tail-logs.ps1 100 -Follow
    Shows last 100 lines and follows new output
#>

param(
    [Parameter(Position=0)]
    [int]$Lines = 250,
    
    [switch]$Follow
)

if ($Follow) {
    Write-Host "Showing backend logs (last $Lines lines) and following..." -ForegroundColor Cyan
    docker compose logs backend --tail=$Lines --follow
} else {
    Write-Host "Showing backend logs (last $Lines lines)..." -ForegroundColor Cyan
    docker compose logs backend --tail=$Lines
}