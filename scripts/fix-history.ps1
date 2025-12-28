# Script to remove oauth-networking-codemap.md from commit 4633181a3

# First, let's create a backup branch
git branch backup-before-history-rewrite -f

# Reset to the parent of the problematic commit
git reset --hard 99444aacc

# Cherry-pick the problematic commit
git cherry-pick 4633181a3

# Remove the sensitive file from this commit
git rm --cached .docs/oauth-networking-codemap.md -f 2>$null
git commit --amend --no-edit

# Now cherry-pick the remaining commits
git cherry-pick 2b0828504

Write-Host "Git history has been rewritten. The sensitive file has been removed from commit 4633181a3"
Write-Host "A backup branch 'backup-before-history-rewrite' has been created"
