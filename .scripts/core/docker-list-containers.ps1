# List Suna Docker containers
param([switch]$All)

Write-Host "`n=== Suna Docker Containers ===`n" -ForegroundColor Cyan

if ($All) {
    docker ps -a --filter name=suna --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
} else {
    docker ps --filter name=suna --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
}

Write-Host ""
$running = @(docker ps --filter name=suna --format '{{.Names}}').Count
Write-Host "Running containers: $running" -ForegroundColor DarkGray
if (-not $All) {
    Write-Host '(Use -All to see stopped containers)' -ForegroundColor DarkGray
}
Write-Host ""
