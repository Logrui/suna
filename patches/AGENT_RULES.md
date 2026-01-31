# Suna Patch System - Agent Rules & Guidelines

## 🚨 CRITICAL RULES

### 1. NEVER Manually Create .patch Files
**ALWAYS use `git diff` to generate patch files:**

```powershell
# For FRONTEND patches (applied in /app which is frontend content):
# Use --relative from the frontend directory to get correct paths
git -C frontend diff HEAD~1 --relative -- src/path/to/file.ts | Set-Content -Path patches/NNN-name.patch -Encoding ASCII

# For BACKEND patches (applied in /app which is backend content):
git -C backend diff HEAD~1 --relative -- path/to/file.py | Set-Content -Path patches/NNN-name.patch -Encoding ASCII

# For REPO-ROOT patches (if applying from repo root context):
git diff HEAD~1 -- path/to/file > patches/NNN-name.patch
```

**Why:**
1. Manually written patches have format issues (wrong line counts, encoding problems) that cause `git apply` to fail with "corrupt patch" errors.
2. Docker builds have different working directories - frontend Dockerfile `/app` = frontend content, so paths must be relative (no `frontend/` prefix).
3. Use ASCII encoding to avoid BOM issues that cause "No valid patches in input" errors.

---

### 2. Patch Naming Convention
```
<3-digit-number>-<descriptive-name>.<extension>

Examples:
  001-auth-redirects.patch
  002-api-url-helper.yml
  010-database-connections.py
  020-frontend-imports.js
```

- **Numbers must be 3 digits** with leading zeros (001, 002, 010)
- **Use gaps** (001, 010, 020) to allow inserting patches later
- **Files without numbered prefix are ignored** by the patch system

---

### 3. Workflow: Adding a New Patch

1. **Make the change** directly in source code
2. **Commit the change** with a descriptive message
3. **Generate the patch** using `git diff HEAD~1 > patches/NNN-name.patch`
4. **Commit the patch file** - this is for upstream sync documentation

The change is now:
- Applied directly in source code ✅
- Documented as a patch for future upstream merges ✅
- Smart-skipped during builds (already applied) ✅

---

### 4. Supported Patch Types

| Extension | Type | Tool | Use Case |
|-----------|------|------|----------|
| `.patch` | Git Patch | `git apply` | Targeted file changes |
| `.yml/.yaml` | ast-grep | `ast-grep` | Pattern transformations (any language) |
| `.js` | JS Codemod | `jscodeshift` | TypeScript/JavaScript AST transforms |
| `.py` | Python Codemod | `libcst` | Python AST transforms |

---

### 5. The Patch System is for UPSTREAM SYNC

**Purpose:** Keep track of our customizations so when we merge from upstream, we know:
- What we've changed
- Where conflicts might occur
- How to reapply our changes

**During builds:** Patches are checked but already-applied patches are **skipped gracefully**.

---

### 6. Key Files

| File | Purpose |
|------|---------|
| `patches/apply-patches.js` | Universal patch application script |
| `patches/*.patch` | Git patches for our customizations |
| `patches/examples/` | Reference examples (not applied) |
| `frontend/Dockerfile.railway` | Applies patches at build time |
| `backend/Dockerfile.railway` | Applies patches at build time |

---

### 7. Detection Logic

The system uses `git apply --check --reverse` to detect already-applied patches:
- **Patch not applied** → Apply it
- **Patch already applied** → Skip gracefully (shows "⏭️ Already applied, skipping")
- **Patch conflicts** → Fail with error

---

### 8. Railway Build Configuration

- **Root Directory:** Must be empty (repo root) for patches to be accessible
- **Dockerfiles:** Use `COPY patches ./patches` to include patches in build context
- **Git Init:** Required in Docker for `git apply` to work

---

## 🔄 Common Commands

```powershell
# Generate patch from last commit
git diff HEAD~1 -- path/to/file > patches/NNN-name.patch

# Generate patch from specific files
git diff HEAD~1 -- frontend/src/lib/*.ts > patches/NNN-name.patch

# Test if patch can be applied
git apply --check patches/NNN-name.patch

# Check if patch is already applied
git apply --check --reverse patches/NNN-name.patch

# Apply a patch
git apply patches/NNN-name.patch
```

---

## ⚠️ Common Mistakes to Avoid

1. ❌ **Don't manually write patch content** - Use `git diff`
2. ❌ **Don't use PowerShell `>` with complex diffs** - May cause encoding issues, use Git Bash if needed
3. ❌ **Don't number patches without gaps** - Use 001, 010, 020 for flexibility
4. ❌ **Don't forget to commit the source change first** - Patch is generated from committed diff
5. ❌ **Don't name files without numbered prefix** - They won't be processed

---

## 🎯 Quick Reference

```powershell
# Full workflow for adding a patch:
# 1. Make your change to source files
# 2. Commit it
git add . && git commit -m "feat: description of change"

# 3. Generate the patch
git diff HEAD~1 -- path/to/changed/files > patches/NNN-descriptive-name.patch

# 4. Commit the patch file
git add patches/NNN-descriptive-name.patch
git commit -m "docs(patches): Add NNN-descriptive-name for upstream sync"

# 5. Push
git push
```
