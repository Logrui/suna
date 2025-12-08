<#
.SYNOPSIS
    List most recently edited documentation files (.md).

.DESCRIPTION
    Scans the current directory (recursively) for markdown files and lists them sorted by last write time.
    Excludes common build/dependency directories (.git, node_modules, .next, etc.).
    Outputs relative paths.

.PARAMETER Count
    Number of files to list (default: 10).
    Can be passed as a positional argument.

.EXAMPLE
    .\list-recent-docs.ps1
    Lists top 10 recently edited markdown files.

.EXAMPLE
    .\list-recent-docs.ps1 20
    Lists top 20 recently edited markdown files.
#>

param(
    [Parameter(Position=0)]
    [int]$Count = 10
)

$ExcludeDirs = @('.git', 'node_modules', '.next', '__pycache__', 'dist', 'build', 'coverage', '.venv', 'venv')

Write-Host "Scanning for recently edited documentation files (Top $Count)..." -ForegroundColor Cyan

$files = Get-ChildItem -Path . -Recurse -File | 
    Where-Object { 
        $path = $_.FullName
        # Check if any excluded dir is in the path
        $shouldExclude = $false
        foreach ($dir in $ExcludeDirs) {
            if ($path -match "[\\/]$dir[\\/]") { 
                $shouldExclude = $true
                break 
            }
        }
        
        # Include only markdown files
        if ($_.Extension -ne '.md') {
            $shouldExclude = $true
        }

        -not $shouldExclude
    } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First $Count

# Output formatted table
$files | Select-Object @{Name="LastWriteTime"; Expression={$_.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")}}, @{Name="Path"; Expression={Resolve-Path $_.FullName -Relative}} | Format-Table -AutoSize
