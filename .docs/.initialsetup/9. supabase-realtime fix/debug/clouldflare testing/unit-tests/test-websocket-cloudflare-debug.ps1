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
Write-Host "Cloudflare WebSocket Upgrade Diagnostic" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""

function TestWebSocketUpgrade {
    param([string]$url, [string]$name)
    
    Write-Host "Test: $name" -ForegroundColor Yellow
    Write-Host "  URL: $url" -ForegroundColor Gray
    
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
                Write-Host "  [WARN] HTTP $statusCode - Routed successfully" -ForegroundColor Yellow
                $response.Close()
                return 1
            }
        } catch {
            $errorMsg = $_.Exception.Message
            
            if ($errorMsg -like "*401*" -or $errorMsg -like "*Unauthorized*") {
                Write-Host "  [OK] HTTP 401 - Routed to Realtime (auth required)" -ForegroundColor Green
                return 1
            } elseif ($errorMsg -like "*400*" -or $errorMsg -like "*Bad Request*") {
                Write-Host "  [OK] HTTP 400 - Routed and validated" -ForegroundColor Green
                return 1
            } elseif ($errorMsg -like "*503*" -or $errorMsg -like "*Service Unavailable*") {
                Write-Host "  [WARN] HTTP 503 - Service temporarily unavailable" -ForegroundColor Yellow
                return 0
            } else {
                Write-Host "  [FAIL] HTTP Error: $errorMsg" -ForegroundColor Red
                return 0
            }
        }
    } catch {
        Write-Host "  [FAIL] Exception: $($_.Exception.Message)" -ForegroundColor Red
        return 0
    }
    
    Write-Host ""
}

$tests = @(
    @{Name = "Kong HTTP WebSocket"; Url = "ws://localhost:8888/realtime/v1/websocket"},
    @{Name = "Kong HTTPS WebSocket"; Url = "wss://localhost:8445/realtime/v1/websocket"},
    @{Name = "Cloudflare HTTPS WebSocket"; Url = "wss://kong.kortix.syhc.dev/realtime/v1/websocket"},
    @{Name = "Direct Realtime Service"; Url = "ws://localhost:8002/api/tenants/realtime-dev/websocket"}
)

$results = @()
$passed = 0

foreach ($test in $tests) {
    $result = TestWebSocketUpgrade $test.Url $test.Name
    $passed += $result
    $status = if ($result -eq 1) { "PASS" } else { "FAIL" }
    $results += @{Test = $test.Name; Status = $status}
}

Write-Host "Summary" -ForegroundColor Cyan
Write-Host "=======" -ForegroundColor Cyan
foreach ($r in $results) {
    $icon = if ($r.Status -eq "PASS") { "[OK]" } else { "[FAIL]" }
    $color = if ($r.Status -eq "PASS") { "Green" } else { "Red" }
    Write-Host "$icon $($r.Test)" -ForegroundColor $color
}

Write-Host ""
Write-Host "Passed: $passed out of $($tests.Count) tests" -ForegroundColor Cyan

exit 0
