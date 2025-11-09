# Fork Syncing Operating Procedure
## Lessons Learned from Oct 31, 2025 Sync

---

## Executive Summary

Syncing a fork with upstream while preserving self-hosted modifications is complex. This document captures what worked, what didn't, and the optimal procedure for future syncs.

**Current Status:** Successfully synced `dev` branch with upstream `main` while preserving 58 critical self-hosted files.

---

## What We Tried & Results

### ❌ FAILED APPROACHES

#### 1. **Initial Merge with `-X ours`**
- **What We Did:** `git merge main -X ours`
- **Problem:** Kept ALL dev files as-is, but didn't give us visibility into what changed upstream
- **Result:** 273 modified files, unclear which needed review
- **Lesson:** This works for initial preservation but creates cleanup work later

#### 2. **`.gitattributes` Merge Strategy**
- **What We Tried:** Setting `merge=ours` for specific files in `.gitattributes`
- **Problem:** Works globally across ALL branches, can't distinguish between merging upstream vs syncing between branches
- **Result:** Abandoned - too inflexible
- **Lesson:** Git merge strategies are one-size-fits-all; need manual approach

#### 3. **PowerShell `Get-FileHash` Piping**
- **What We Tried:** Comparing files via piped `Get-FileHash`
- **Problem:** PowerShell pipeline doesn't work with git show output for file hashing
- **Result:** Massive error spam, abandoned
- **Lesson:** Use simpler git commands; avoid complex PowerShell pipelines

#### 4. **`git show | Out-File` with Wildcards**
- **What We Tried:** Restoring files using `git show dev-backup:$file > $file`
- **Problem:** PowerShell treats `[` and `]` in filenames as wildcards, breaks on dynamic route files
- **Result:** Files with square brackets (Next.js dynamic routes) failed to restore
- **Lesson:** Always use `-FilePath` with `-Force` for Out-File, or use `git checkout` directly

#### 5. **Trying to Identify Fork Point Manually**
- **What We Did:** Ran `git log main..dev` to find the exact fork point
- **Problem:** Too many commits, confusing, not reliable
- **Result:** Wasted time; needed a better reference point
- **Lesson:** Use known reference points (timestamps, commit messages) instead

---

### ✅ WORKING APPROACHES

#### 1. **Create Backup Branch IMMEDIATELY**
```powershell
git checkout dev
git branch dev-backup
```
- **Why It Worked:** Gave us a safe reference point to restore from if things went wrong
- **When to Use:** Before ANY major merge operations
- **Result:** Saved us multiple times when restores failed

#### 2. **Reset to Known Commit Before Merge**
```powershell
git reset --hard a7de26e12  # "prior to merge with upstream main"
git merge main -X theirs
```
- **Why It Worked:** Gives clean state, clear starting point
- **When to Use:** When you need to redo a merge
- **Result:** Successfully merged all changes from main
- **Lesson:** Always have a clear "pre-merge" commit you can reference

#### 3. **Direct `git checkout` for File Restoration**
```powershell
git checkout dev-backup -- $file
git add $file
```
- **Why It Worked:** Git's native method, handles special characters properly, no PowerShell issues
- **When to Use:** For restoring specific files from another branch
- **Result:** Successfully restored 58 protected files
- **Lesson:** Use git commands directly; avoid shell piping when possible

#### 4. **Compare Commits, Not Branches**
```powershell
git diff f191eb6bf a7de26e12 --name-status
```
- **Why It Worked:** Clear, specific comparison between two known points in time
- **When to Use:** To identify what YOU changed (not what upstream changed)
- **Result:** Identified exactly 58 files we had modified
- **Lesson:** Use commits as anchors; branches are moving targets

#### 5. **Filtering by File Status**
```powershell
git diff main dev --name-status | Select-String '^M'
```
- **Why It Worked:** Shows only Modified files, ignores Added/Deleted noise
- **When to Use:** When you only care about what changed, not structural differences
- **Result:** Reduced 338 files to 58 modified files to review
- **Lesson:** Filter early; reduces review scope significantly

---

## The Optimal Path Forward

### Phase 1: Preparation (Before Any Merge)
```powershell
# 1. Create backup
git checkout dev
git branch dev-backup

# 2. Identify what YOU modified (if you haven't already)
git diff <upstream-fork-point> HEAD --name-status | Select-String '^M' > .docs/.fork-syncing-logs/protected-files.txt

# 3. Document the reference points
# Note: 
#   - Upstream fork point: <hash>
#   - Pre-merge dev state: <hash>
#   - Date: <date>
```

### Phase 2: Merge Upstream
```powershell
# 1. Fetch upstream
git fetch upstream

# 2. Sync main with upstream
git checkout main
git reset --hard upstream/main
git push origin main --force-with-lease

# 3. Create fresh dev from new main
git checkout main
git checkout -b dev
git push origin dev --force-with-lease
```

### Phase 3: Restore Self-Hosted Files
```powershell
# 1. Get protected file list
$protected = Get-Content 'protected-files.txt' | Where-Object { $_ -match '^M' } | ForEach-Object { $_.Substring(2).Trim() }

# 2. Restore from backup
foreach ($file in $protected) {
    git checkout dev-backup -- "$file"
}

# 3. Commit the restoration
git add .
git commit -m "Restore self-hosted modifications after upstream sync"
git push origin dev
```

### Phase 4: Selective Review (Optional but Recommended)
```powershell
# For each file you want to selectively update:
git checkout main -- <filename>
git add <filename>
git commit -m "Accept upstream changes for <filename>"
```

---

## Key Decision Points

### When to KEEP dev version:
- Self-hosted critical files (docker-compose.yaml, Dockerfile, config files)
- API keys or auth configurations
- Database migrations you created
- Custom infrastructure setup

### When to TAKE main version:
- UI component updates
- Bug fixes in shared utilities
- New features in components you don't override
- Dependency updates

### When to MANUALLY MERGE:
- Files that have both self-hosted modifications AND important upstream changes
- Complex files with multiple changes scattered throughout

---

## Critical Files to Always Protect

These files should almost never be auto-merged:

```
docker-compose.yaml          # Self-hosted infrastructure
docker-compose.yml           # Sandbox docker setup
backend/supabase/config.toml # Database configuration
backend/core/utils/config.py # Backend configuration
frontend/Dockerfile          # Frontend containerization
frontend/next.config.ts      # Frontend build config
setup.py                      # Project setup
```

---

## Workflow Commands Reference

```powershell
# Create backup
git branch <branch-name>-backup

# Identify protected files
git diff <old-commit> <new-commit> --name-status | Select-String '^M' > protected-files.txt

# Clean merge with one strategy
git reset --hard <commit-before-merge>
git merge <upstream-branch> -X theirs

# Restore specific files
git checkout <source-branch> -- <file1> <file2> ...

# Review diffs
git diff main dev -- <filename>

# Accept upstream changes
git checkout main -- <filename>
git add <filename>
git commit -m "Accept upstream changes for <filename>"

# Check what's different
git diff <branch1> <branch2> --name-only | Select-String '^M'
```

---

## Timeline of This Sync

| Time | Action | Status |
|------|--------|--------|
| Initial | Merge main with `-X ours` | Created 273 modified files |
| 1h | Filter to 58 protected files | Identified scope |
| 1.5h | Failed restore attempts (PowerShell issues) | Learned shell limitations |
| 2h | Reset and redo merge with `-X theirs` | Clean merge achieved |
| 2.5h | Direct file restoration from backup | All 58 files restored |
| 3h | Verify and push | Sync complete |

**Total Time:** ~3 hours for a well-executed sync with learning

**For Future Syncs:** Estimate 30-45 minutes using this optimized procedure

---

## Common Mistakes to Avoid

1. ❌ Don't use `git reset --hard HEAD~1` without knowing what that commit is
2. ❌ Don't rely on `grep` in PowerShell - use `Select-String` instead
3. ❌ Don't restore files using shell redirects (`>`) - use `git checkout` instead
4. ❌ Don't skip the backup branch creation
5. ❌ Don't try to identify fork point manually - use known references
6. ❌ Don't attempt to merge all 273 files at once - filter by status first
7. ❌ Don't forget to test after merging before pushing to origin

---

## Tools & Commands That Worked Best

| Command | Purpose | Why It Worked |
|---------|---------|---------------|
| `git branch <name>-backup` | Safety net | Simple, reliable, always available |
| `git reset --hard <hash>` | Clean state | Gives definitive starting point |
| `git checkout <branch> -- <file>` | File restoration | Handles special chars, native git |
| `git diff <c1> <c2> --name-status` | Compare commits | Specific, not branch-dependent |
| `Select-String '^M'` | Filter changes | PowerShell native, predictable |
| `git commit -m "..."` | Document decision | Clear audit trail |

---

## For Next Fork Sync (Template)

```markdown
# Fork Sync - [DATE]

## Preparation
- [ ] Create backup: `git branch dev-backup`
- [ ] Identify protected files
- [ ] Document reference points

## Execution
- [ ] Fetch upstream: `git fetch upstream`
- [ ] Sync main: `git reset --hard upstream/main`
- [ ] Merge strategy: `git merge upstream/main -X theirs`
- [ ] Restore protected files
- [ ] Verify: `git diff main dev --name-status | Select-String '^M'`

## Review
- [ ] Selective cherry-pick critical updates
- [ ] Test self-hosted deployment
- [ ] Push to origin

## Documentation
- [ ] Update this log
- [ ] Note any new protected files
- [ ] Record decision points
```

---

## Conclusion

The optimal path forward requires:
1. **Preparation:** Backup, identify, document
2. **Clean merge:** Reset to known point, use appropriate merge strategy
3. **Restoration:** Use git commands directly, not shell workarounds
4. **Selective updates:** Cherry-pick important changes file-by-file
5. **Documentation:** Keep records for future syncs

Future syncs should take **30-45 minutes** following this procedure, down from the **3 hours** this first sync took.
