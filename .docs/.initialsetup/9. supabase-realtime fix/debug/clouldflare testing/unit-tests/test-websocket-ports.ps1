param()

# Load env
$envPath = Join-Path (Split-Path $PSScriptRoot -Parent) ".env"
if (Test-Path $envPath) {
    Get-Content $envPath | ForEach-Object {
        if ($_ -match '^([^=]+)=(.+)$') {
            [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim())
        }
    }
}

$key = $env:TEST_API_KEY
if (-not $key) {
    Write-Host "ERROR: TEST_API_KEY not found" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Port Connectivity Test" -ForegroundColor Cyan
Write-Host "======================" -ForegroundColor Cyan
Write-Host ""

function TestPort {
    param([string]$name, [string]$hostname, [int]$port)
    
    Write-Host "Testing: $name (port $port)" -ForegroundColor Yellow
    
    $result = Test-NetConnection -ComputerName $hostname -Port $port -WarningAction SilentlyContinue
    
    if ($result.TcpTestSucceeded) {
        Write-Host "  [OK] Port reachable" -ForegroundColor Green
        return 1
    } else {
        Write-Host "  [FAIL] Port not reachable" -ForegroundColor Red
        return 0
    }
}

$r1 = TestPort "Cloudflare Kong (HTTPS)" "kong.kortix.syhc.dev" 443
$r2 = TestPort "Localhost Kong (HTTP via 8888)" "127.0.0.1" 8888
$r3 = TestPort "Direct Realtime Service" "127.0.0.1" 8002

Write-Host ""
$total = $r1 + $r2 + $r3
Write-Host "Results: $total out of 3 ports accessible" -ForegroundColor Cyan

exit 0
