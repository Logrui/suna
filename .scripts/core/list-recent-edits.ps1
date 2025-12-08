<#
.SYNOPSIS
    List most recently edited files in the repository.

.DESCRIPTION
    Scans the current directory (recursively) for files and lists them sorted by last write time.
    Excludes common build/dependency directories (.git, node_modules, .next, etc.).
    Outputs relative paths.

.PARAMETER Count
    Number of files to list (default: 10).
    Can be passed as a positional argument.

.EXAMPLE
    .\list-recent-edits.ps1
    Lists top 10 recently edited files.

.EXAMPLE
    .\list-recent-edits.ps1 20
    Lists top 20 recently edited files.
#>

param(
    [Parameter(Position=0)]
    [int]$Count = 10
)

$ExcludeDirs = @('.git', 'node_modules', '.next', '__pycache__', 'dist', 'build', 'coverage', '.venv', 'venv')

Write-Host "Scanning for recently edited files (Top $Count)..." -ForegroundColor Cyan

# Get files recursively, filtering out common junk directories for performance
# Note: -Directory and -File switches with -Recurse can be slow if not filtering early.
# We'll use a slightly more optimized approach by getting top-level items and recursing only if not in exclude list.
# But for simplicity and robustness in PowerShell 5.1+, standard Get-ChildItem with exclusions is usually fine for medium repos.

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
        if ($_.Extension -eq '.md') {
            $shouldExclude = $true
        }
        -not $shouldExclude
    } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First $Count

# Output formatted table
$files | Select-Object @{Name="LastWriteTime"; Expression={$_.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")}}, @{Name="Path"; Expression={Resolve-Path $_.FullName -Relative}} | Format-Table -AutoSize
