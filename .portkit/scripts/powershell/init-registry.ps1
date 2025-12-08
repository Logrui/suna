param (
    [switch]$Force = $false
)

$RegistryPath = ".portkit/addon-features-registry/feature-registry.json"
$RegistryDir = ".portkit/addon-features-registry"

# Valid Skeleton
$Skeleton = @{
    "metadata" = @{
        "version" = "1.0"
        "last_updated" = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssZ")
    }
    "features" = @{}
}

# Ensure directory exists
if (-not (Test-Path -Path $RegistryDir)) {
    New-Item -ItemType Directory -Path $RegistryDir -Force | Out-Null
    Write-Host "Created directory: $RegistryDir" -ForegroundColor Green
}

# Check existence
if ((Test-Path -Path $RegistryPath) -and (-not $Force)) {
    Write-Host "Registry already exists at $RegistryPath." -ForegroundColor Yellow
    Write-Host "Use -Force to overwrite (WARNING: This wipes existing registry data)." -ForegroundColor Gray
    exit 0
}

# Write (Initialize or Overwrite)
$JsonContent = $Skeleton | ConvertTo-Json -Depth 5
Set-Content -Path $RegistryPath -Value $JsonContent -Encoding utf8

if ($Force) {
    Write-Host "Registry forcibly re-initialized at $RegistryPath." -ForegroundColor Red
} else {
    Write-Host "Registry initialized successfully at $RegistryPath." -ForegroundColor Green
}
