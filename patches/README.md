# Universal Patch Management System for Suna

This directory contains numbered patches and code transformations that are automatically applied during Docker builds.

**Supports:** Frontend (TypeScript/JavaScript) + Backend (Python)

## 📁 Directory Structure

```
patches/
├── 000-apply-patches.js             # 🚀 Universal patch application script
├── 001-auth-redirects.patch         # 🔐 OAuth redirect fix for Railway
├── examples/                        # Example patches for reference
│   ├── 001-replace-api-url.yml
│   ├── 002-api-url-with-import.js
│   └── 003-add-analytics.patch
├── README.md
├── SETUP_GUIDE.md
└── SYSTEM_OVERVIEW.md
```

## ✅ Active Patches

| Patch | Description |
|-------|-------------|
| `001-auth-redirects.patch` | Fixes OAuth redirects using forwarded headers instead of container's internal address (0.0.0.0:8080) |
| `002-allow-railway-networking.patch` | Enables FRONTEND_URL env var and allows all Railway/Internal URLs in CORS regex |


## 🔢 Numbering System

Patches are applied in **strictly sequential order** based on their numeric prefix:

- `001-*` - First patch/transformation
- `002-*` - Second patch/transformation  
- `003-*` - Third patch/transformation
- etc.

**Naming Convention:**
```
<number>-<descriptive-name>.<extension>

Examples:
  001-replace-api-urls.yml        # Frontend
  002-modernize-db-calls.py       # Backend
  003-fix-docker-networking.patch # Mixed
```

## 📝 Supported Patch Types

### 1. Traditional Git Patches (`.patch`)

**Use for:** Single-file or multi-file changes with stable line numbers  
**Works for:** ANY language (Python, TypeScript, JavaScript, YAML, etc.)

```bash
# Create a patch
git diff > patches/005-fix-login-page.patch

# Or from staged changes
git diff --cached > patches/006-update-styles.patch
```

**Example:**
```diff
diff --git a/frontend/src/app/layout.tsx b/frontend/src/app/layout.tsx
index 1111111..2222222 100644
--- a/frontend/src/app/layout.tsx
+++ b/frontend/src/app/layout.tsx
@@ -10,6 +10,7 @@
 import { Toaster } from '@/components/ui/toaster';
+import { Analytics } from '@/components/analytics';
 
 export default function RootLayout({
```

### 2. ast-grep Rules (`.yml` or `.yaml`)

**Use for:** Pattern-based transformations across multiple files  
**Supports:** TypeScript, JavaScript, **Python**, Go, Rust, Java, C++, and more!

**Frontend Example (TypeScript):**
```yaml
# 001-replace-api-urls.yml
rules:
  - id: replace-hardcoded-api-url
    language: TypeScript
    pattern: |
      const $VAR = process.env.$ENV || $DEFAULT
    constraints:
      VAR:
        regex: '^(API_URL|SUPABASE_URL)$'
    fix: |
      const $VAR = getApiUrl()
    message: Replace hardcoded env with getApiUrl()
```

**Backend Example (Python):**
```yaml
# 002-replace-db-url.yml
rules:
  - id: replace-db-connection
    language: Python
    pattern: |
      $VAR = os.getenv($ENV, $DEFAULT)
    constraints:
      VAR:
        regex: '^(DATABASE_URL|REDIS_URL)$'
    fix: |
      $VAR = get_connection_url("$ENV")
    message: Replace hardcoded connection string
```

### 3. JavaScript Codemods (`.js`)

**Use for:** Complex TypeScript/JavaScript AST transformations  
**Tool:** jscodeshift

```javascript
// 010-update-imports.js
module.exports = function transformer(fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);
  
  // Find and replace import paths
  root.find(j.ImportDeclaration, {
    source: { value: '@/lib/old-api' }
  }).forEach(path => {
    path.value.source.value = '@/lib/new-api';
  });
  
  return root.toSource();
};
```

### 4. Python Codemods (`.py`)

**Use for:** Complex Python AST transformations  
**Tool:** libcst

```python
# 011-modernize-async.py
"""Transform sync database calls to async/await"""

import libcst as cst
from pathlib import Path
import sys

class AsyncDBTransformer(cst.CSTTransformer):
    def leave_Call(self, original_node, updated_node):
        # Match: db.query(...) or db.execute(...)
        if isinstance(updated_node.func, cst.Attribute):
            if (updated_node.func.value.value == "db" and 
                updated_node.func.attr.value in ["query", "execute"]):
                # Wrap in await
                return cst.Await(expression=updated_node)
        return updated_node

def transform_file(file_path):
    with open(file_path, "r") as f:
        source = f.read()
    
    tree = cst.parse_module(source)
    transformer = AsyncDBTransformer()
    modified = tree.visit(transformer)
    
    with open(file_path, "w") as f:
        f.write(modified.code)
    print(f"✓ Transformed {file_path}")

if __name__ == "__main__":
    target_dir = sys.argv[1] if len(sys.argv) > 1 else "backend"
    for py_file in Path(target_dir).rglob("*.py"):
        transform_file(py_file)
```
```

## 🚀 Usage

### Automatic (Docker Build)

✅ **Patches are automatically applied** during `docker compose up -d --build`

The Dockerfile includes a build step that:
1. Initializes git (required for `.patch` files)
2. Runs `node scripts/apply-patches.js`
3. Applies all patches in numeric order
4. Continues with the build process

### Manual (Local Development)

```bash
# Apply all patches
npm run patches:apply

# Dry run (see what would change)
npm run patches:apply -- --dry-run

# Verbose output
npm run patches:apply -- --verbose
```

Add to `package.json`:
```json
{
  "scripts": {
    "patches:apply": "node scripts/apply-patches.js",
    "patches:check": "node scripts/apply-patches.js --dry-run --verbose"
  }
}
```

## 📋 Creating New Patches

### Step 1: Make Your Changes

Edit files locally as needed.

### Step 2: Choose Patch Type

**Decision Tree:**

```
Is this a systematic pattern across many files?
├── YES → Use ast-grep (.yml) if simple pattern
│         Use jscodeshift (.js) if complex logic
│
└── NO → Does it involve exact code replacement?
          ├── YES → Use traditional patch (.patch)
          └── NO → Use jscodeshift (.js)
```

### Step 3: Create the Patch File

**For `.patch` files:**
```bash
# Get next available number
ls patches/ | grep -E '^\d+' | sort -n | tail -1
# Let's say it's 003, so next is 004

# Create patch from uncommitted changes
git diff > patches/004-my-feature.patch

# Or from staged changes
git diff --cached > patches/004-my-feature.patch
```

**For `.yml` files:**
```bash
# Create new ast-grep rule
cat > patches/005-replace-pattern.yml << 'EOF'
rules:
  - id: my-transformation
    language: TypeScript
    pattern: <OLD_PATTERN>
    fix: <NEW_PATTERN>
EOF
```

**For `.js` files:**
```bash
# Create new codemod
cat > patches/006-my-codemod.js << 'EOF'
module.exports = function transformer(fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);
  // Your transformation logic
  return root.toSource();
};
EOF
```

### Step 4: Test the Patch

```bash
# Test locally
npm run patches:apply -- --dry-run --verbose

# If looks good, apply
npm run patches:apply
```

### Step 5: Commit the Patch

```bash
git add patches/00X-my-patch.*
git commit -m "Add patch 00X: description"
```

## 🔄 Workflow After Upstream Merge

```bash
# 1. Merge upstream changes
git pull upstream main

# 2. Check if patches still apply
npm run patches:check

# 3. If patches fail, update them:
#    - For .patch files: Recreate manually
#    - For .yml/.js files: Usually still work!

# 4. Apply patches
npm run patches:apply

# 5. Build and test
docker compose up -d --build

# 6. If successful, commit
git add -A
git commit -m "Merge upstream + apply patches"
```

## 📊 Patch Dependencies

Track which patches depend on each other in comments:

```yaml
# 005-update-api-types.yml
# Depends on: 001-replace-api-urls.yml
# Must run after API URLs are updated

rules:
  - id: update-types
    # ...
```

## 🛠️ Troubleshooting

### Patch Fails to Apply

**For `.patch` files:**
```bash
# Check what would change
git apply --check patches/XXX-name.patch

# See conflicts
git apply --reject patches/XXX-name.patch

# Manually resolve *.rej files
```

**For `.yml`/`.js` files:**
- These are more resilient to upstream changes
- Usually still work even if context changes
- Check verbose output for errors

### Dependencies Not Installed

The patch application script will auto-install via `npx`:
- `jscodeshift` for `.js` codemods (TypeScript/JavaScript)
- `@ast-grep/cli` for `.yml` rules (any language)
- Python codemods (`.py`) require `libcst`

For faster builds, install them:
```bash
# Frontend dependencies
npm install -D jscodeshift @ast-grep/cli

# Backend dependencies (add to requirements.txt)
libcst>=1.1.0
```

## 📚 Examples

See `.docs/examples/suna-patch-system/` for:
- `001-replace-api-url.yml` - ast-grep example
- `002-add-analytics.patch` - git patch example  
- `003-update-imports.js` - jscodeshift example

## 🎯 Best Practices

1. **Keep patches atomic** - One logical change per patch
2. **Document dependencies** - Note if patch requires another
3. **Test thoroughly** - Always test in Docker build
4. **Use semantic numbering** - Leave gaps (001, 010, 020) for future insertions
5. **Prefer transformations** - Use `.yml`/`.js` over `.patch` when possible for resilience

## 📖 Related Documentation

- [Code Transformations vs Patches](../../guides/code-transformations-vs-patches.md) - Detailed comparison
- [jscodeshift Docs](https://github.com/facebook/jscodeshift) - Codemod creation guide
- [ast-grep Docs](https://ast-grep.github.io/) - AST pattern matching guide
