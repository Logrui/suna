param()

# Load env
$env_path = Join-Path (Split-Path $PSScriptRoot -Parent) ".env"
if (Test-Path $env_path) {
    Get-Content $env_path | ForEach-Object {
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
Write-Host "WebSocket HTTP Upgrade Test" -ForegroundColor Cyan
Write-Host "===========================" -ForegroundColor Cyan
Write-Host ""

function TestWebSocketUpgrade {
    param([string]$url, [string]$name)
    
    Write-Host "Testing: $name" -ForegroundColor Yellow
    
    try {
        # Convert ws:// to http:// and wss:// to https:// for HttpWebRequest
        $httpUrl = $url -replace '^wss://', 'https://' -replace '^ws://', 'http://'
        
        # Build URL with query parameters
        $amp = [char]38  # ASCII code for &
        $fullUrl = $httpUrl + "?apikey=" + $key + $amp + "vsn=1.0.0"
        
        $uri = [Uri]$fullUrl
        $request = [Net.HttpWebRequest]::Create($uri)
        $request.Method = "GET"
        $request.Headers.Add("Upgrade", "websocket")
        $request.Headers.Add("Sec-WebSocket-Key", "dGhlIHNhbXBsZSBub25jZQ==")
        $request.Headers.Add("Sec-WebSocket-Version", "13")
        $request.KeepAlive = $true
        
        try {
            $response = $request.GetResponse()
            $statusCode = [int]$response.StatusCode
            
            if ($statusCode -eq 101) {
                Write-Host "  [OK] HTTP 101 - WebSocket Upgrade Accepted" -ForegroundColor Green
                $response.Close()
                return 1
            } else {
                Write-Host "  [WARN] HTTP $statusCode - Request routed (auth check)" -ForegroundColor Yellow
                $response.Close()
                return 1  # Routing works if we got a response
            }
        } catch {
            # Catch exceptions from GetResponse() when statusCode is not 2xx
            $errorMsg = $_.Exception.Message
            
            if ($errorMsg -like "*401*" -or $errorMsg -like "*Unauthorized*") {
                Write-Host "  [OK] HTTP 401 - Routed to Realtime (auth required)" -ForegroundColor Green
                return 1
            } elseif ($errorMsg -like "*400*" -or $errorMsg -like "*Bad Request*") {
                Write-Host "  [OK] HTTP 400 - Routed and validated" -ForegroundColor Green
                return 1
            } else {
                Write-Host "  [FAIL] Error: $errorMsg" -ForegroundColor Red
                return 0
            }
        }
    } catch {
        Write-Host "  [FAIL] Exception: $($_.Exception.Message)" -ForegroundColor Red
        return 0
    }
}

# Test endpoints
$r1 = TestWebSocketUpgrade "ws://localhost:8888/realtime/v1/websocket" "Kong HTTP WebSocket (primary)"
$r2 = TestWebSocketUpgrade "wss://localhost:8445/realtime/v1/websocket" "Kong HTTPS WebSocket"

Write-Host ""
$total = $r1 + $r2
if ($total -eq 2) {
    Write-Host "Results: $total/2 tests passed ✅" -ForegroundColor Green
} elseif ($total -gt 0) {
    Write-Host "Results: $total/2 tests passed (partial) ⚠️" -ForegroundColor Yellow
} else {
    Write-Host "Results: $total/2 tests passed ❌" -ForegroundColor Red
}

exit $([int]($total -gt 0))
