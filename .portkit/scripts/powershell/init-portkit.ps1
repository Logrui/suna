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

$EcosystemPath = ".portkit/ecosystem-rules.json"

# Ecosystem Rules Skeleton (Agnostic)
$EcosystemSkeleton = @{
    "metadata" = @{
        "version" = "1.0"
        "doc" = "Defines the Laws of Adaptation for Portkit. Agents must enforce these rules."
    }
    "denied_dependencies" = @(
        # Example:
        # @{
        #     "package" = "example-lib"
        #     "action" = "strip"
        #     "replacement" = "mock"
        #     "reason" = "Incompatible with local environment"
        # }
    )
    "forced_adapters" = @(
        # Example:
        # @{
        #     "upstream_pattern" = "utils.auth"
        #     "local_replacement" = "services.auth"
        #     "description" = "Use local auth service"
        # }
    )
    "architectural_invariants" = @(
        # "Must use local database connector"
    )
}

# --- Registry Logic ---
# Ensure directory exists
if (-not (Test-Path -Path $RegistryDir)) {
    New-Item -ItemType Directory -Path $RegistryDir -Force | Out-Null
    Write-Host "Created directory: $RegistryDir" -ForegroundColor Green
}

# Check existence
if ((Test-Path -Path $RegistryPath) -and (-not $Force)) {
    Write-Host "Registry already exists at $RegistryPath." -ForegroundColor Yellow
    Write-Host "Use -Force to overwrite (WARNING: This wipes existing registry data)." -ForegroundColor Gray
} else {
    # Write (Initialize or Overwrite)
    $JsonContent = $Skeleton | ConvertTo-Json -Depth 5
    Set-Content -Path $RegistryPath -Value $JsonContent -Encoding utf8
    Write-Host "Registry initialized successfully at $RegistryPath." -ForegroundColor Green
}

# --- Ecosystem Logic ---
if (-not (Test-Path -Path $EcosystemPath)) {
    $EcosystemContent = $EcosystemSkeleton | ConvertTo-Json -Depth 5
    Set-Content -Path $EcosystemPath -Value $EcosystemContent -Encoding utf8
    Write-Host "Created ecosystem-rules.json with defaults." -ForegroundColor Green
} else {
    Write-Host "Ecosystem rules already exist at $EcosystemPath." -ForegroundColor Yellow
}

