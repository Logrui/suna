# Main Branch vs Merge Base Diff Analysis Script
# Purpose: Compare main branch to its merge base with dev to identify divergence
# Usage: .\main-merge-base-diff.ps1
# Output: Creates timestamped reports comparing main -> merge-base

param(
    [string]$BranchA = "main",
    [string]$BranchB = "dev",
    [string]$OutputDir = ".",
    [switch]$Detailed,
    [switch]$MarkdownOnly,
    [switch]$ExcludeMarkdown = $true,
    [switch]$IgnoreDocs = $true,
    [switch]$IgnoreMobile = $true,
    [switch]$IncludeMarkdown,
    [switch]$IncludeDocs,
    [switch]$IncludeMobile
)

# Handle override flags
if ($IncludeMarkdown) { $ExcludeMarkdown = $false }
if ($IncludeDocs) { $IgnoreDocs = $false }
if ($IncludeMobile) { $IgnoreMobile = $false }

# Colors for console output
$colors = @{
    Added    = "Green"
    Modified = "Yellow"
    Deleted  = "Red"
    Renamed  = "Cyan"
    Header   = "Magenta"
    Summary  = "Blue"
    Info     = "Cyan"
}

function Write-ColorOutput {
    param($Message, $Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

function Get-MergeBase {
    param([string]$Branch1, [string]$Branch2)
    
    try {
        $mergeBase = git merge-base $Branch1 $Branch2
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to find merge base"
        }
        return $mergeBase.Trim()
    }
    catch {
        Write-ColorOutput "Error finding merge base: $_" -Color Red
        exit 1
    }
}

function Get-CommitInfo {
    param([string]$CommitHash)
    
    try {
        $info = git show --quiet --format="%H|%an|%ae|%ad|%s" --date=short $CommitHash
        $parts = $info -split '\|'
        return @{
            Hash      = $parts[0]
            Author    = $parts[1]
            Email     = $parts[2]
            Date      = $parts[3]
            Subject   = $parts[4]
        }
    }
    catch {
        Write-ColorOutput "Error retrieving commit info: $_" -Color Red
        return $null
    }
}

function Filter-FilesList {
    param(
        [array]$Files,
        [switch]$MarkdownOnly,
        [switch]$ExcludeMarkdown,
        [switch]$IgnoreDocs,
        [switch]$IgnoreMobile
    )
    
    $filtered = $Files
    
    if ($IgnoreDocs) {
        $filtered = $filtered | Where-Object { $_ -notlike ".docs/*" }
    }
    
    if ($IgnoreMobile) {
        $filtered = $filtered | Where-Object { $_ -notlike "apps/mobile/*" }
    }
    
    if ($MarkdownOnly) {
        $filtered = $filtered | Where-Object { $_ -like "*.md" }
    }
    elseif ($ExcludeMarkdown) {
        $filtered = $filtered | Where-Object { $_ -notlike "*.md" }
    }
    
    return $filtered
}

function Get-DiffSummary {
    param([string]$Branch, [string]$CommitHash)
    
    $diff = git diff $CommitHash $Branch --name-status
    
    $summary = @{
        Added    = 0
        Modified = 0
        Deleted  = 0
        Renamed  = 0
        Total    = 0
    }
    
    foreach ($line in $diff) {
        switch -Regex ($line.Substring(0,1)) {
            '^A$' { $summary.Added++ }
            '^M$' { $summary.Modified++ }
            '^D$' { $summary.Deleted++ }
            '^R' { $summary.Renamed++ }
        }
        $summary.Total++
    }
    
    return @{
        Summary = $summary
        RawDiff = $diff
    }
}

function Get-FilesByType {
    param($RawDiff)
    
    $files = @{
        Added    = @()
        Modified = @()
        Deleted  = @()
        Renamed  = @()
    }
    
    foreach ($line in $RawDiff) {
        $status = $line.Substring(0,1)
        
        switch ($status) {
            'A' { 
                $files.Added += $line.Substring(2).Trim()
            }
            'M' { 
                $files.Modified += $line.Substring(2).Trim()
            }
            'D' { 
                $files.Deleted += $line.Substring(2).Trim()
            }
            'R' { 
                # Handle renamed files (format: "R100    old_path    new_path")
                $parts = $line -split '\s+' | Where-Object { $_ }
                if ($parts.Count -ge 3) {
                    $files.Renamed += @{
                        Old = $parts[1]
                        New = $parts[2]
                        Score = $parts[0].Substring(1)
                    }
                }
            }
        }
    }
    
    return $files
}

function Apply-Filters {
    param($Files, [switch]$MarkdownOnly, [switch]$ExcludeMarkdown, [switch]$IgnoreDocs, [switch]$IgnoreMobile)
    
    $filtered = @{
        Added    = @()
        Modified = @()
        Deleted  = @()
        Renamed  = @()
    }
    
    # Filter Added
    $filtered.Added = Filter-FilesList -Files $Files.Added -MarkdownOnly:$MarkdownOnly -ExcludeMarkdown:$ExcludeMarkdown -IgnoreDocs:$IgnoreDocs -IgnoreMobile:$IgnoreMobile
    
    # Filter Modified
    $filtered.Modified = Filter-FilesList -Files $Files.Modified -MarkdownOnly:$MarkdownOnly -ExcludeMarkdown:$ExcludeMarkdown -IgnoreDocs:$IgnoreDocs -IgnoreMobile:$IgnoreMobile
    
    # Filter Deleted
    $filtered.Deleted = Filter-FilesList -Files $Files.Deleted -MarkdownOnly:$MarkdownOnly -ExcludeMarkdown:$ExcludeMarkdown -IgnoreDocs:$IgnoreDocs -IgnoreMobile:$IgnoreMobile
    
    # Filter Renamed
    $renamedList = $Files.Renamed
    if ($IgnoreDocs) {
        $renamedList = $renamedList | Where-Object { $_.New -notlike ".docs/*" }
    }
    if ($IgnoreMobile) {
        $renamedList = $renamedList | Where-Object { $_.New -notlike "apps/mobile/*" }
    }
    if ($MarkdownOnly) {
        $filtered.Renamed = $renamedList | Where-Object { $_.New -like "*.md" }
    }
    elseif ($ExcludeMarkdown) {
        $filtered.Renamed = $renamedList | Where-Object { $_.New -notlike "*.md" }
    }
    else {
        $filtered.Renamed = $renamedList
    }
    
    return $filtered
}

function Export-DiffReport {
    param($MergeBaseInfo, $MainInfo, $Files, $OutputPath)
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $report = @()
    
    $report += "# Main Branch vs Merge Base Diff Analysis"
    $report += ""
    $report += "**Generated:** $timestamp"
    $report += ""
    
    # Merge base info
    $report += "## Merge Base Information"
    $report += ""
    $report += "- Hash: ``$($MergeBaseInfo.Hash)``"
    $report += "- Author: $($MergeBaseInfo.Author) `<$($MergeBaseInfo.Email)`>"
    $report += "- Date: $($MergeBaseInfo.Date)"
    $report += "- Subject: $($MergeBaseInfo.Subject)"
    $report += ""
    
    # Main info
    $report += "## Current Main Branch"
    $report += ""
    $report += "- Hash: ``$($MainInfo.Hash)``"
    $report += "- Author: $($MainInfo.Author) `<$($MainInfo.Email)`>"
    $report += "- Date: $($MainInfo.Date)"
    $report += "- Subject: $($MainInfo.Subject)"
    $report += ""
    
    # Divergence explanation
    $report += "## What These Changes Mean"
    $report += ""
    $report += "This report shows **all changes made to the Main branch since it diverged from Dev**."
    $report += ""
    $report += "The merge base is the last commit where Main and Dev were at the same point. All files listed below were:"
    $report += ""
    $report += "- **Added:** Files that exist on Main but don't exist at the merge base (new upstream features)"
    $report += "- **Modified:** Files that were changed on Main compared to the merge base (upstream updates)"
    $report += "- **Deleted:** Files that were removed from Main (upstream removals)"
    $report += "- **Renamed:** Files that were renamed on Main (refactoring)"
    $report += ""
    
    # Summary section
    $report += "## Summary of Changes"
    $report += ""
    $report += "| Type | Count |"
    $report += "|------|-------|"
    $report += "| Added | $($Files.Added.Count) |"
    $report += "| Modified | $($Files.Modified.Count) |"
    $report += "| Deleted | $($Files.Deleted.Count) |"
    $report += "| Renamed | $($Files.Renamed.Count) |"
    
    $totalFiles = $Files.Added.Count + $Files.Modified.Count + $Files.Deleted.Count + $Files.Renamed.Count
    $report += "| **Total** | **$totalFiles** |"
    $report += ""
    
    # Added files
    if ($Files.Added.Count -gt 0) {
        $report += "## Added Files ($($Files.Added.Count))"
        $report += ""
        $report += "New files added to Main since divergence (upstream additions)."
        $report += ""
        foreach ($file in $Files.Added | Sort-Object) {
            $report += "- $file"
        }
        $report += ""
    }
    
    # Modified files
    if ($Files.Modified.Count -gt 0) {
        $report += "## Modified Files ($($Files.Modified.Count))"
        $report += ""
        $report += "Files changed on Main since divergence (upstream updates). Review for conflicts with local changes on Dev."
        $report += ""
        foreach ($file in $Files.Modified | Sort-Object) {
            $report += "- $file"
        }
        $report += ""
    }
    
    # Deleted files
    if ($Files.Deleted.Count -gt 0) {
        $report += "## Deleted Files ($($Files.Deleted.Count))"
        $report += ""
        $report += "Files removed from Main since divergence (upstream removals)."
        $report += ""
        foreach ($file in $Files.Deleted | Sort-Object) {
            $report += "- $file"
        }
        $report += ""
    }
    
    # Renamed files
    if ($Files.Renamed.Count -gt 0) {
        $report += "## Renamed Files ($($Files.Renamed.Count))"
        $report += ""
        foreach ($rename in $Files.Renamed) {
            $report += "- `$($rename.Old)` → `$($rename.New)` (Similarity: $($rename.Score)%)"
        }
        $report += ""
    }
    
    $report | Out-File -FilePath $OutputPath -Encoding UTF8
    return $OutputPath
}

function Export-CSVReport {
    param($Files, $OutputPath)
    
    $csvData = @()
    
    foreach ($file in $Files.Added) {
        $csvData += [PSCustomObject]@{
            Type    = "Added"
            Path    = $file
            OldPath = ""
        }
    }
    
    foreach ($file in $Files.Modified) {
        $csvData += [PSCustomObject]@{
            Type    = "Modified"
            Path    = $file
            OldPath = ""
        }
    }
    
    foreach ($file in $Files.Deleted) {
        $csvData += [PSCustomObject]@{
            Type    = "Deleted"
            Path    = $file
            OldPath = ""
        }
    }
    
    foreach ($rename in $Files.Renamed) {
        $csvData += [PSCustomObject]@{
            Type    = "Renamed"
            Path    = $rename.New
            OldPath = $rename.Old
        }
    }
    
    $csvData | Export-Csv -Path $OutputPath -NoTypeInformation -Encoding UTF8
    return $OutputPath
}

# Main execution
try {
    Write-ColorOutput "`n=== Main Branch vs Merge Base Analysis ===" -Color $colors.Header
    Write-ColorOutput "Branches: $BranchA and $BranchB`n" -Color $colors.Header
    
    # Find merge base
    Write-ColorOutput "Finding merge base between $BranchA and $BranchB..." -Color $colors.Summary
    $mergeBase = Get-MergeBase -Branch1 $BranchA -Branch2 $BranchB
    Write-ColorOutput "Merge base commit: $mergeBase`n" -Color $colors.Info
    
    # Get commit info
    Write-ColorOutput "Retrieving commit information..." -Color $colors.Summary
    $mergeBaseInfo = Get-CommitInfo -CommitHash $mergeBase
    $mainHeadInfo = Get-CommitInfo -CommitHash $BranchA
    
    Write-ColorOutput "Merge base: $($mergeBaseInfo.Subject) ($($mergeBaseInfo.Date))" -Color $colors.Info
    Write-ColorOutput "Main HEAD: $($mainHeadInfo.Subject) ($($mainHeadInfo.Date))`n" -Color $colors.Info
    
    # Get diff data
    Write-ColorOutput "Analyzing differences..." -Color $colors.Summary
    $diffData = Get-DiffSummary -Branch $BranchA -CommitHash $mergeBase
    $files = Get-FilesByType -RawDiff $diffData.RawDiff
    
    # Apply filters if specified
    $displayFiles = $files
    $filterNote = ""
    if ($MarkdownOnly) {
        $displayFiles = Apply-Filters -Files $files -MarkdownOnly -IgnoreDocs:$IgnoreDocs -IgnoreMobile:$IgnoreMobile
        $filterNote = " (Markdown files only)"
    }
    elseif ($ExcludeMarkdown) {
        $displayFiles = Apply-Filters -Files $files -ExcludeMarkdown -IgnoreDocs:$IgnoreDocs -IgnoreMobile:$IgnoreMobile
        $filterNote = " (Excluding Markdown files)"
    }
    elseif ($IgnoreDocs -or $IgnoreMobile) {
        $displayFiles = Apply-Filters -Files $files -IgnoreDocs:$IgnoreDocs -IgnoreMobile:$IgnoreMobile
        $filterParts = @()
        if ($IgnoreDocs) { $filterParts += ".docs/" }
        if ($IgnoreMobile) { $filterParts += "apps/mobile/" }
        $filterNote = " (Excluding: $($filterParts -join ', '))"
    }
    
    # Display summary to console
    Write-ColorOutput "`n--- SUMMARY ---$filterNote" -Color $colors.Header
    Write-ColorOutput "Added:    $($displayFiles.Added.Count)" -Color $colors.Added
    Write-ColorOutput "Modified: $($displayFiles.Modified.Count)" -Color $colors.Modified
    Write-ColorOutput "Deleted:  $($displayFiles.Deleted.Count)" -Color $colors.Deleted
    Write-ColorOutput "Renamed:  $($displayFiles.Renamed.Count)" -Color $colors.Renamed
    Write-ColorOutput "Total:    $($displayFiles.Added.Count + $displayFiles.Modified.Count + $displayFiles.Deleted.Count + $displayFiles.Renamed.Count)`n" -Color $colors.Summary
    
    # Create timestamped output files
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $reportFolder = Join-Path $OutputDir "main-merge-base-diff_$timestamp"
    
    # Create the output folder
    if (-not (Test-Path $reportFolder)) {
        New-Item -ItemType Directory -Path $reportFolder | Out-Null
    }
    
    $markdownReport = Join-Path $reportFolder "analyze-diff-main-merge-base.md"
    $csvReport = Join-Path $reportFolder "analyze-diff-main-merge-base.csv"
    
    # Export reports
    Write-ColorOutput "Exporting Markdown report..." -Color $colors.Summary
    $mdPath = Export-DiffReport -MergeBaseInfo $mergeBaseInfo -MainInfo $mainHeadInfo -Files $displayFiles -OutputPath $markdownReport
    Write-ColorOutput "Saved to: $mdPath`n" -Color $colors.Added
    
    Write-ColorOutput "Exporting CSV report..." -Color $colors.Summary
    $csvPath = Export-CSVReport -Files $displayFiles -OutputPath $csvReport
    Write-ColorOutput "Saved to: $csvPath`n" -Color $colors.Added
    
    Write-ColorOutput "Output folder: $reportFolder`n" -Color $colors.Summary
    
    # Show sample of modified files if detailed mode
    if ($Detailed) {
        Write-ColorOutput "--- MODIFIED FILES (Sample) ---" -Color $colors.Header
        $displayFiles.Modified | Select-Object -First 10 | ForEach-Object {
            Write-ColorOutput "  $_" -Color $colors.Modified
        }
        if ($displayFiles.Modified.Count -gt 10) {
            Write-ColorOutput "  ... and $($displayFiles.Modified.Count - 10) more" -Color $colors.Modified
        }
        Write-ColorOutput ""
    }
    
    Write-ColorOutput "Analysis complete!" -Color $colors.Added
}
catch {
    Write-ColorOutput "Error: $_" -Color Red
    exit 1
}
