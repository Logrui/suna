# Cloudflare API Inspector Script
# This script checks all Cloudflare settings related to WebSocket connectivity

# Load environment variables
$env_file = Get-Content ".\.env" | ConvertFrom-StringData
$ACCOUNT_ID = $env_file.CLOUDFLARE_ACCOUNT_ID
$API_TOKEN = $env_file.CLOUDFLARE_API_TOKEN

Write-Host "Cloudflare Settings Inspector" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Account ID: $ACCOUNT_ID" -ForegroundColor Gray
Write-Host "API Token loaded: $(if ($API_TOKEN) { 'YES' } else { 'NO' })" -ForegroundColor Gray
Write-Host ""

# Set up headers for API calls
$headers = @{
    "Authorization" = "Bearer $API_TOKEN"
    "Content-Type"  = "application/json"
}

# 1. Get all zones (domains)
Write-Host "1. Fetching all zones..." -ForegroundColor Yellow
try {
    $zones_response = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/zones" `
        -Headers $headers -Method Get -ErrorAction Stop
    $zones = $zones_response.result
    
    if ($zones_response.success) {
        Write-Host "Success: Found $($zones.Count) zones" -ForegroundColor Green
    } else {
        Write-Host "API Error: $($zones_response.errors)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Response: $($_ | ConvertTo-Json)" -ForegroundColor Red
    exit 1
}

Write-Host ""
foreach ($zone in $zones) {
    Write-Host "  + $($zone.name) (ID: $($zone.id))" -ForegroundColor Green
}
Write-Host ""

# Find syhc.dev zone
$syhc_zone = $zones | Where-Object { $_.name -eq "syhc.dev" }
if (-not $syhc_zone) {
    Write-Host "ERROR: Could not find syhc.dev zone!" -ForegroundColor Red
    $zone_names = $zones | ForEach-Object { $_.name }
    Write-Host "Available zones: $($zone_names -join ', ')" -ForegroundColor Yellow
    exit 1
}

$ZONE_ID = $syhc_zone.id
Write-Host "Using zone: syhc.dev (ID: $ZONE_ID)" -ForegroundColor Green
Write-Host ""

# 2. Get DNS Records
Write-Host "2. Fetching DNS Records..." -ForegroundColor Yellow
$dns_response = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" `
    -Headers $headers -Method Get
$dns_records = $dns_response.result

Write-Host "DNS Records:" -ForegroundColor Green
foreach ($record in $dns_records | Where-Object { $_.type -in @("CNAME", "A", "AAAA") }) {
    Write-Host "  Type: $($record.type) | Name: $($record.name) | Content: $($record.content)" -ForegroundColor Green
}
Write-Host ""

# Check for kong.kortix.syhc.dev
$kong_record = $dns_records | Where-Object { $_.name -eq "kong.kortix.syhc.dev" }
if ($kong_record) {
    Write-Host "  FOUND: kong.kortix.syhc.dev DNS record: $($kong_record.content)" -ForegroundColor Green
} else {
    Write-Host "  WARNING: NO DNS record found for kong.kortix.syhc.dev!" -ForegroundColor Red
}
Write-Host ""

# 3. Get SSL/TLS Settings
Write-Host "3. Fetching SSL/TLS Settings..." -ForegroundColor Yellow
try {
    $ssl_response = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/settings/ssl" `
        -Headers $headers -Method Get
    $ssl_setting = $ssl_response.result
    Write-Host "  SSL/TLS Encryption Mode: $($ssl_setting.value)" -ForegroundColor Green
} catch {
    Write-Host "  Error fetching SSL settings: $($_.Exception.Message)" -ForegroundColor Yellow
}
Write-Host ""

# 4. Get WebSocket Setting
Write-Host "4. Fetching WebSocket Setting..." -ForegroundColor Yellow
try {
    $websocket_response = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/settings/websockets" `
        -Headers $headers -Method Get
    $websocket_setting = $websocket_response.result
    Write-Host "  WebSockets Enabled: $($websocket_setting.value)" -ForegroundColor Green
} catch {
    Write-Host "  Error fetching WebSocket settings: $($_.Exception.Message)" -ForegroundColor Yellow
}
Write-Host ""

# 5. Get Bot Fight Mode Settings
Write-Host "5. Fetching Bot Fight Mode Settings..." -ForegroundColor Yellow
try {
    $bfm_response = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/settings/bot_fight_mode" `
        -Headers $headers -Method Get
    
    if ($bfm_response.success) {
        Write-Host "  Bot Fight Mode: $($bfm_response.result.value)" -ForegroundColor Green
    } else {
        Write-Host "  Bot Fight Mode: Not available or not applicable" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  Error fetching Bot Fight Mode: $($_.Exception.Message)" -ForegroundColor Yellow
}
Write-Host ""

# 6. Get Security Level
Write-Host "6. Fetching Security Level..." -ForegroundColor Yellow
try {
    $sec_level_response = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/settings/security_level" `
        -Headers $headers -Method Get
    $sec_level = $sec_level_response.result
    Write-Host "  Security Level: $($sec_level.value)" -ForegroundColor Green
} catch {
    Write-Host "  Error fetching Security Level: $($_.Exception.Message)" -ForegroundColor Yellow
}
Write-Host ""

# 7. Get Challenge Passage
Write-Host "7. Fetching Challenge Passage (Challenge TTL)..." -ForegroundColor Yellow
try {
    $challenge_response = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/settings/challenge_ttl" `
        -Headers $headers -Method Get
    $challenge_setting = $challenge_response.result
    Write-Host "  Challenge Passage: $($challenge_setting.value) seconds" -ForegroundColor Green
} catch {
    Write-Host "  Error fetching Challenge Passage: $($_.Exception.Message)" -ForegroundColor Yellow
}
Write-Host ""

# 8. Get Page Rules (if any)
Write-Host "8. Fetching Page Rules..." -ForegroundColor Yellow
try {
    $pagerules_response = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/pagerules" `
        -Headers $headers -Method Get
    
    if ($pagerules_response.result.Count -gt 0) {
        Write-Host "  Found $($pagerules_response.result.Count) page rules:" -ForegroundColor Green
        foreach ($rule in $pagerules_response.result) {
            Write-Host "    - Target: $($rule.targets[0].constraint.value)" -ForegroundColor Green
            foreach ($action in $rule.actions) {
                Write-Host "      Action: $($action.id) = $($action.value)" -ForegroundColor Green
            }
        }
    } else {
        Write-Host "  No page rules configured" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  Error fetching Page Rules: $($_.Exception.Message)" -ForegroundColor Yellow
}
Write-Host ""

# 9. Get Firewall Rules
Write-Host "9. Fetching Firewall Rules..." -ForegroundColor Yellow
try {
    $firewall_response = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/firewall/rules" `
        -Headers $headers -Method Get
    
    if ($firewall_response.result.Count -gt 0) {
        Write-Host "  Found $($firewall_response.result.Count) firewall rules:" -ForegroundColor Green
        foreach ($rule in $firewall_response.result) {
            Write-Host "    - $($rule.description): $($rule.action)" -ForegroundColor Green
        }
    } else {
        Write-Host "  No firewall rules configured" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  Error fetching Firewall Rules: $($_.Exception.Message)" -ForegroundColor Yellow
}
Write-Host ""

# 10. Check Tunnel Configuration via Cloudflare API
Write-Host "10. Fetching Cloudflare Tunnel Configuration..." -ForegroundColor Yellow
try {
    $tunnel_response = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/cfd_tunnel" `
        -Headers $headers -Method Get
    
    if ($tunnel_response.result.Count -gt 0) {
        Write-Host "  Found $($tunnel_response.result.Count) tunnel(s):" -ForegroundColor Green
        foreach ($tunnel in $tunnel_response.result) {
            Write-Host "    Name: $($tunnel.name)" -ForegroundColor Green
            Write-Host "    ID: $($tunnel.id)" -ForegroundColor Green
            Write-Host "    Status: $($tunnel.status)" -ForegroundColor Green
            
            # Get tunnel routes
            $routes_response = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/cfd_tunnel/$($tunnel.id)/routes" `
                -Headers $headers -Method Get
            
            if ($routes_response.result) {
                Write-Host "    Routes:" -ForegroundColor Green
                foreach ($route in $routes_response.result) {
                    Write-Host "      - Hostname: $($route.public_hostname.name) -> Service: $($route.config.service)" -ForegroundColor Green
                }
            }
        }
    } else {
        Write-Host "  No tunnels found" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  Error fetching tunnel data: $($_.Exception.Message)" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "Inspection Complete!" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
