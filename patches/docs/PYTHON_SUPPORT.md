# Python Backend Support - No 4th Type Needed!

The Universal Patch System already fully supports Python through the **existing 3 types**:

## ✅ Type 1: Traditional `.patch` Files

**Works perfectly for Python!** Git patches are language-agnostic.

### Example: Python API Endpoint Patch

```diff
diff --git a/backend/core/api/agents.py b/backend/core/api/agents.py
index 1111111..2222222 100644
--- a/backend/core/api/agents.py
+++ b/backend/core/api/agents.py
@@ -15,6 +15,7 @@ from core.services.supabase import get_supabase_client
 from core.utils.auth import get_current_user
+from core.middleware.rate_limit import rate_limit
 
 router = APIRouter()
 
 @router.get("/agents")
+@rate_limit(max_calls=100, period=60)
 async def list_agents(
     user: User = Depends(get_current_user),
     db: AsyncClient = Depends(get_supabase_client)
```

**Usage:** Same as before
```bash
# Create patch
git diff > patches/010-add-rate-limiting.patch

# Applied automatically during Docker build
```

---

## ✅ Type 2: ast-grep with Python Language Support

**ast-grep natively supports Python!** You can use the same `.yml` files.

### Example: Replace Database URL Pattern

```yaml
# patches/011-replace-db-url.yml
rules:
  - id: replace-hardcoded-db-url
    language: Python  # ← Python support!
    
    # Pattern: DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://...")
    pattern: |
      $VAR = os.getenv($ENV, $DEFAULT)
    
    constraints:
      VAR:
        regex: '^(DATABASE_URL|REDIS_URL|SUPABASE_URL)$'
    
    # Replace with helper function
    fix: |
      $VAR = get_connection_url("$ENV")
    
    message: Replace hardcoded connection string with helper function
```

### Example: Update Import Paths

```yaml
# patches/012-update-imports.yml
rules:
  - id: modernize-imports
    language: Python
    
    # Old: from core.utils import helper
    pattern: from core.utils import $FUNC
    
    # New: from core.lib.helpers import helper
    fix: from core.lib.helpers import $FUNC
    
    message: Update import paths to new structure
```

### Example: Add Type Hints

```yaml
# patches/013-add-type-hints.yml
rules:
  - id: add-return-types
    language: Python
    
    pattern: |
      def $FUNC($$$PARAMS):
          return $$$BODY
    
    # This is more of a detection - manual fix recommended
    message: |
      Function $FUNC should have return type annotation.
      Consider: def $FUNC($$$PARAMS) -> ReturnType:
```

**Usage:** Identical to TypeScript
```bash
# Automatically applied during build
# Or manually: ast-grep scan --rule patches/011-*.yml
```

---

## ✅ Type 3: Python Codemods with libcst

**Instead of jscodeshift (JavaScript), use libcst (Python)!**

libcst is Meta's AST transformation library for Python - exactly like jscodeshift for JS.

### Example: Python Codemod

```python
# patches/014-modernize-async.py
"""
Replace synchronous database calls with async/await
Changes: db.query() → await db.query()
"""

import libcst as cst
from libcst import matchers as m


class AsyncDBTransformer(cst.CSTTransformer):
    def leave_Call(self, original_node, updated_node):
        # Match: db.query(...) or db.execute(...)
        if m.matches(
            updated_node,
            m.Call(
                func=m.Attribute(
                    value=m.Name("db"),
                    attr=m.Name(m.OneOf("query", "execute", "fetch"))
                )
            )
        ):
            # Wrap in await
            return cst.Await(expression=updated_node)
        
        return updated_node


def transform_file(source_code):
    """Transform a single file"""
    tree = cst.parse_module(source_code)
    transformer = AsyncDBTransformer()
    modified_tree = tree.visit(transformer)
    return modified_tree.code


if __name__ == "__main__":
    import sys
    import os
    from pathlib import Path
    
    # Get target directory (backend by default)
    target_dir = sys.argv[1] if len(sys.argv) > 1 else "backend"
    
    # Process all Python files
    for py_file in Path(target_dir).rglob("*.py"):
        with open(py_file, "r", encoding="utf-8") as f:
            original_code = f.read()
        
        try:
            transformed_code = transform_file(original_code)
            
            if transformed_code != original_code:
                print(f"✓ Transformed {py_file}")
                with open(py_file, "w", encoding="utf-8") as f:
                    f.write(transformed_code)
        except Exception as e:
            print(f"✗ Failed to transform {py_file}: {e}")
```

**Usage:**
```bash
# Run during Docker build via apply-patches.js
python patches/014-modernize-async.py backend/
```

---

## 🔧 Updated apply-patches.js for Python

Let me show you the modification to support `.py` codemod files:

```javascript
// Add to getPatchFiles() filter:
.filter(file => {
    const ext = path.extname(file);
    return ['.patch', '.js', '.py', '.yml', '.yaml'].includes(ext);
})

// Add to getPatchType():
function getPatchType(filename) {
    const ext = path.extname(filename);
    if (ext === '.patch') return 'patch';
    if (ext === '.js') return 'codemod-js';
    if (ext === '.py') return 'codemod-py';  // ← New!
    if (ext === '.yml' || ext === '.yaml') return 'astgrep';
    return 'unknown';
}

// Add new function:
function applyPythonCodemod(codemodPath, target = BACKEND_DIR) {
    try {
        const cmd = `python "${codemodPath}" "${target}"`;
        if (isVerbose) log(`  Running: ${cmd}`, 'blue');
        
        execSync(cmd, { 
            stdio: 'inherit',
            cwd: path.join(__dirname, '..')
        });
        
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Add to main() switch:
case 'codemod-py':
    result = applyPythonCodemod(patch.fullPath);
    break;
```

---

## 📊 Python Backend Patch Examples

### Common Use Cases for Suna Backend

```
patches/
├── 010-add-rate-limiting.patch      # Add rate limiting decorators
├── 011-replace-db-url.yml           # Update connection strings
├── 012-update-imports.yml           # Modernize import paths
├── 013-async-db-calls.py            # Convert sync → async
├── 014-add-logging.patch            # Add structured logging
└── 015-update-schemas.yml           # Pydantic model updates
```

---

## 🎯 Which Type to Use for Python?

| Use Case | Best Choice | Why |
|----------|-------------|-----|
| **Add imports, decorators** | `.patch` | Small, targeted changes |
| **Replace patterns everywhere** | `.yml` (ast-grep) | Pattern matching across files |
| **Complex AST transformations** | `.py` (libcst) | Full Python AST control |
| **Type hint additions** | `.py` (libcst) | Requires code analysis |
| **Config file updates** | `.patch` | Simple diffs work fine |

---

## 💡 Python-Specific Tips

### 1. **Installing libcst for Python Codemods**

Add to `backend/requirements.txt`:
```
libcst>=1.1.0
```

Or in Dockerfile:
```dockerfile
RUN pip install libcst
```

### 2. **ast-grep Python Examples**

```yaml
# Find all print statements (debugging leftovers)
- id: no-print-statements
  language: Python
  pattern: print($$$ARGS)
  message: Remove debug print statement
  
# Replace old logging
- id: modernize-logging
  language: Python
  pattern: logging.warn($MSG)
  fix: logging.warning($MSG)
  message: Use logging.warning() instead of deprecated warn()
```

### 3. **Python Codemod Checklist**

When creating `.py` codemod files:
- ✅ Make executable: `chmod +x patches/XXX-*.py` (Linux/Mac)
- ✅ Add shebang: `#!/usr/bin/env python3`
- ✅ Test standalone: `python patches/XXX-*.py backend/`
- ✅ Handle errors gracefully
- ✅ Print progress for debugging

---

## 🚀 Example: Complete Python Patch Workflow

### Scenario: Update All Database URL References

```yaml
# patches/020-standardize-db-urls.yml
rules:
  - id: replace-db-env-vars
    language: Python
    
    pattern: os.environ.get("$ENV_VAR", $DEFAULT)
    
    constraints:
      ENV_VAR:
        regex: '(DATABASE_URL|POSTGRES_URL|DB_CONNECTION)'
    
    fix: settings.database_url
    
    message: Use centralized settings for database URL
```

**Result:** All Python files with database URL patterns get updated automatically!

---

## ✅ Conclusion: No 4th Type Needed!

The **3 existing types perfectly handle Python**:

1. **`.patch`** - Works for any language (Python, JavaScript, YAML, etc.)
2. **`.yml`** - ast-grep supports Python natively
3. **`.js`/`.py`** - Language-specific codemods (jscodeshift for JS, libcst for Python)

**Your patches/ folder can now contain:**
```
patches/
├── 001-frontend-api-urls.yml        # TypeScript (ast-grep)
├── 002-backend-db-urls.yml          # Python (ast-grep)
├── 003-add-analytics.patch          # Mixed (git patch)
├── 010-frontend-imports.js          # TypeScript (jscodeshift)
├── 011-backend-async.py             # Python (libcst)
└── README.md
```

All applied automatically in numeric order during Docker build! 🎉
