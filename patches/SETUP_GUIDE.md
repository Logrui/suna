# Universal Patch System - Setup Guide for Suna

## 🎯 Overview

This system allows you to maintain a `patches/` directory with numbered transformations that are automatically applied during Docker builds. It supports:

- ✅ **`.patch` files** - Traditional git patches (any language)
- ✅ **`.yml/.yaml` files** - ast-grep pattern transformations (TypeScript, Python, etc.)
- ✅ **`.js` files** - jscodeshift codemods (TypeScript/JavaScript)
- ✅ **`.py` files** - libcst codemods (Python)

All patches are applied in **numeric order** (001, 002, 003, etc.) regardless of type.

**Supports:** Frontend (Next.js/TypeScript) + Backend (FastAPI/Python)

---

## 📋 Quick Setup (5 minutes)

### Step 1: Verify Patch System Files

```bash
cd d:/Homelab/suna

# Verify directories exist
ls patches/
# Should contain: 000-apply-patches.js, README.md, etc.

# Verify Dockerfile.railway is updated
head -80 frontend/Dockerfile.railway
# Should contain patch application step
```

### Step 2: Update package.json

Add these scripts to `frontend/package.json`:

```json
{
  "scripts": {
    "patches:apply": "node ../scripts/apply-patches.js",
    "patches:check": "node ../scripts/apply-patches.js --dry-run --verbose"
  }
}
```

### Step 3: Dockerfile.railway Already Configured!

✅ **The `frontend/Dockerfile.railway` is already set up** with:

```dockerfile
# Install git (required for git apply patches)
RUN apt-get update && apt-get install -y --no-install-recommends git

# Copy patches directory from parent context
COPY patches ../patches

# Apply patches before build
RUN echo "🔧 Applying patches and transformations..." && \
    if [ -d "../patches" ] && [ -f "../patches/000-apply-patches.js" ]; then \
      git init && git add -A && \
      git config user.email "builder@docker.local" && \
      git config user.name "Docker Builder" && \
      git commit -m "Initial commit before patches" --allow-empty && \
      node ../patches/000-apply-patches.js --verbose && \
      echo "✅ Patches applied successfully"; \
    else \
      echo "⚠️ No patches directory or apply script found, skipping..."; \
    fi
```

### Step 4: Test Locally

```bash
cd d:/Homelab/suna

# Apply a patch manually
git apply patches/001-auth-redirects.patch

# Or run the full patch script
node patches/000-apply-patches.js --verbose
```

### Step 5: Test Docker Build

```bash
cd d:/Homelab/suna

# Build with patches
docker compose up -d --build frontend

# Check logs to see patches being applied
docker compose logs frontend | Select-String "patch"
```

---

## 🔄 Workflow: Adding a New Patch

### Creating Your First Patch

Let's create the API URL replacement patch as an example:

```bash
cd d:/Homelab/suna

# Create ast-grep rule
cat > patches/001-replace-api-url.yml << 'EOF'
rules:
  - id: replace-api-url
    language: TypeScript
    pattern: |
      const $VAR = process.env.$ENV || $DEFAULT
    constraints:
      VAR:
        regex: '^(API_URL|SUPABASE_URL)$'
    fix: |
      const $VAR = getApiUrl()
EOF

# Test it
cd frontend
npm run patches:check

# Apply it
npm run patches:apply

# Verify changes
git diff
```

### Converting Manual Changes to a Patch

If you've already modified files manually:

```bash
# For traditional patch
git diff > patches/002-my-changes.patch

# Or from staged changes
git diff --cached > patches/002-my-changes.patch
```

---

## 📊 Recommended Patch Organization

### For Suna's Use Case

```
patches/
├── 000-apply-patches.js             # 🚀 Universal patch application script
├── 001-auth-redirects.patch         # 🔐 OAuth redirect fix for Railway
├── 010-frontend-api-urls.yml        # Frontend: API URL helper
├── 011-backend-db-urls.yml          # Backend: Database connections
├── 020-add-analytics.patch          # Mixed: Analytics tracking
├── 030-frontend-imports.js          # Frontend: Import updates
├── 040-backend-async.py             # Backend: Async transformations
└── README.md                        # Documentation
```

**Note:** Use gaps (001, 010, 020) to allow inserting patches later without renumbering.

---

## 🎨 Example Patches for Suna

### Example 1: API URL Transformation (ast-grep)

**File:** `patches/001-replace-api-url.yml`

See `.docs/examples/suna-patch-system/001-replace-api-url.yml`

**What it does:**
- Finds all `const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || ''`
- Replaces with `const API_URL = getApiUrl()`
- Works across ALL files automatically
- Resilient to upstream changes

### Example 2: API URL + Import (jscodeshift)

**File:** `patches/002-api-url-with-import.js`

See `.docs/examples/suna-patch-system/002-api-url-with-import.js`

**What it does:**
- Same as above, but also adds the import statement
- Handles 'use client' directives correctly
- Skips files that already have the import

### Example 3: Layout Modification (traditional patch)

**File:** `patches/003-add-analytics.patch`

See `.docs/examples/suna-patch-system/003-add-analytics.patch`

**What it does:**
- Adds analytics component to layout
- Simple single-file change
- Good for stable, targeted modifications

---

## 🔧 Maintenance

### After Upstream Merge

```bash
# 1. Pull upstream
git pull upstream main

# 2. Check if patches still apply
cd frontend
npm run patches:check

# 3. If patches fail:
#    - .patch files: May need manual update
#    - .yml/.js files: Usually still work!

# 4. Apply patches
npm run patches:apply

# 5. Test in Docker
cd ..
docker compose up -d --build frontend
```

### Updating a Patch

```bash
# 1. Remove old changes
git reset --hard HEAD

# 2. Apply all patches except the one you're updating
# (temporarily rename it to skip)
mv patches/002-my-patch.patch patches/002-my-patch.patch.skip

# 3. Apply remaining patches
npm run patches:apply

# 4. Make your changes manually

# 5. Create new patch
git diff > patches/002-my-patch-updated.patch

# 6. Replace old patch
mv patches/002-my-patch-updated.patch patches/002-my-patch.patch
rm patches/002-my-patch.patch.skip
```

---

## 🚀 Python Backend Patches

The system fully supports Python backend transformations!

### Option 1: ast-grep (Recommended for patterns)

```yaml
# patches/020-update-db-connections.yml
rules:
  - id: modernize-db-url
    language: Python
    pattern: |
      $VAR = os.getenv($ENV, $DEFAULT)
    constraints:
      VAR:
        regex: '^(DATABASE_URL|REDIS_URL)$'
    fix: |
      $VAR = get_connection_url("$ENV")
    message: Replace hardcoded connection strings
```

### Option 2: libcst Codemods (For complex transformations)

```python
# patches/021-async-database.py
"""Convert synchronous database calls to async/await"""

import libcst as cst
from pathlib import Path
import sys

class AsyncDBTransformer(cst.CSTTransformer):
    def leave_Call(self, original_node, updated_node):
        # Match: db.query(...) or db.execute(...)
        if isinstance(updated_node.func, cst.Attribute):
            if (updated_node.func.value.value == "db" and 
                updated_node.func.attr.value in ["query", "execute", "fetch"]):
                return cst.Await(expression=updated_node)
        return updated_node

def transform_file(file_path):
    with open(file_path, "r") as f:
        source = f.read()
    
    tree = cst.parse_module(source)
    modified = tree.visit(AsyncDBTransformer())
    
    with open(file_path, "w") as f:
        f.write(modified.code)
    print(f"✓ Transformed {file_path}")

if __name__ == "__main__":
    backend_dir = sys.argv[1] if len(sys.argv) > 1 else "backend"
    for py_file in Path(backend_dir).rglob("*.py"):
        if not py_file.name.startswith("test_"):
            transform_file(py_file)
```

### Option 3: Traditional Patches

```bash
# For targeted Python changes
git diff backend/core/api/agents.py > patches/022-add-rate-limiting.patch
```

### Backend Dockerfile Integration

```dockerfile
# In backend/Dockerfile
COPY patches ../patches
COPY scripts ../scripts

# Install git and Python dependencies
RUN apt-get update && apt-get install -y git && \
    pip install libcst>=1.1.0

# Apply patches
RUN git init && \
    git add -A && \
    git config user.email "builder@docker.local" && \
    git config user.name "Docker Builder" && \
    git commit -m "Initial" --allow-empty && \
    python ../scripts/apply-patches.py --target backend --verbose
```

### Dependencies

Add to `backend/requirements.txt`:
```
libcst>=1.1.0  # For Python codemods
```

---

## 📚 Further Reading

- **Full Documentation:** `.docs/examples/suna-patch-system/README.md`
- **Comparison Guide:** `.docs/guides/code-transformations-vs-patches.md`
- **ast-grep Docs:** https://ast-grep.github.io/
- **jscodeshift Docs:** https://github.com/facebook/jscodeshift

---

## ✅ Verification Checklist

- [x] `patches/` directory created
- [x] `patches/000-apply-patches.js` exists
- [x] `frontend/Dockerfile.railway` updated with patch application
- [ ] Create your first patch!
- [ ] Test Docker build: push to Railway or run locally
- [ ] Verify in logs: patches are applied before build

---

## 💡 Pro Tips

1. **Start with ast-grep** for your API URL changes - most resilient
2. **Use gaps in numbering** (001, 010, 020) for flexibility
3. **Test in Docker first** after creating patches
4. **Keep patches atomic** - one logical change per patch
5. **Document dependencies** in patch file comments

Ready to maintain your fork with confidence! 🎉
