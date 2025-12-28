# Suna Patch System - Complete Setup

## ✅ System Overview

Your `patches/` directory now has a **unified patch management system** that supports a **Hybrid Workflow** where changes can exist in both source code and patch files simultaneously.

## How It Works

The system relies on a **"Smart Detection"** engine (`apply-patches.js`) that runs during Docker builds.

### The "Receipt" Philosophy
 We treat the `patches/` directory as a **manifest of deviations** from upstream.
- **Local Dev:** You apply changes directly to the source code (better DX, IDE support).
- **Upstream Sync:** The patch file serves as a "receipt" of exactly what changed.
- **Deployment:** The build system ensures the patch is present.

### Architecture: Smart Detection Logic

The `apply-patches.js` script is not a simple runner. It implements robust logic to prevent build failures:

1.  **Already-Applied Detection**:
    - Before applying, it attempts `git apply --check --reverse`.
    - If this *succeeds*, it means the code matches the *result* of the patch.
    - **Action:** Logs "⏭️ Already applied, skipping" and continues.

2.  **Context Awareness (Frontend vs Backend)**:
    - Docker builds often isolate directories (`/app` might contain only frontend code).
    - If a patch targets `backend/api.py` but runs in the Frontend build, `git` throws "No such file".
    - **Action:** Detects "No such file", logs "⏭️ Skipped context", and continues.

3.  **Whitespace/Line-Ending Resilience**:
    - Windows/Linux Git configuration often causes false negatives (`CRLF` vs `LF`).
    - **Action:** Retries checks with `--ignore-space-change` and `--ignore-whitespace`.

### Supported Patch Types

1.  **Git Patches** (`.patch`): Standard diffs. Good for simple text/config changes.
    *   *Tool:* `git apply`
2.  **AST Rules** (`.yml`): Structural search/replace using `ast-grep`. Best for logic changes that must survive upstream refactors.
    *   *Tool:* `ast-grep`
3.  **Codemods** (`.js`, `.py`): Full AST transformation scripts.
    *   *Tool:* `jscodeshift` (JS/TS), `libcst` (Python)

### Language Support

**Frontend (TypeScript/JavaScript)**
- ✅ `.patch` files - Git patches
- ✅ `.yml` files - ast-grep (language: TypeScript/JavaScript)
- ✅ `.js` files - jscodeshift codemods

**Backend (Python)**
- ✅ `.patch` files - Git patches
- ✅ `.yml` files - ast-grep (language: Python)
- ✅ `.py` files - libcst codemods

---

## 📚 Updated Documentation

### 1. **README.md** - Complete Reference
- All 4 patch types with examples
- Frontend AND backend examples
- TypeScript and Python code samples
- ast-grep rules for both languages
- Dependencies for each type

### 2. **SETUP_GUIDE.md** - Quick Start
- Step-by-step setup instructions
- Frontend and backend Dockerfile integration
- Python backend patch examples
- libcst codemod templates
- Comprehensive dependencies section

---

## 🔄 Typical Patch Structure

```
suna/patches/
├── 001-frontend-api-urls.yml       # 🎯 TypeScript (ast-grep)
├── 002-backend-db-urls.yml         # 🎯 Python (ast-grep)
├── 003-add-analytics.patch         # 📝 Mixed (git patch)
├── 010-frontend-imports.js         # 🔧 TypeScript (jscodeshift)
├── 011-backend-async.py            # 🐍 Python (libcst)
├── 020-custom-auth.patch           # 📝 Mixed (git patch)
├── README.md                       # 📖 Documentation
├── SETUP_GUIDE.md                  # 📖 Quick start
└── apply-patches.js                # 🚀 Application script
```

---

## 🚀 Quick Start Examples

### Frontend: Replace API URLs (ast-grep)

```yaml
# patches/001-frontend-api-urls.yml
rules:
  - id: replace-api-url
    language: TypeScript
    pattern: const $VAR = process.env.$ENV || $DEFAULT
    fix: const $VAR = getApiUrl()
```

### Backend: Replace Database URLs (ast-grep)

```yaml
# patches/002-backend-db-urls.yml
rules:
  - id: replace-db-url
    language: Python
    pattern: $VAR = os.getenv($ENV, $DEFAULT)
    fix: $VAR = get_connection_url("$ENV")
```

### Backend: Async Transformation (Python codemod)

```python
# patches/011-backend-async.py
import libcst as cst

class AsyncDBTransformer(cst.CSTTransformer):
    def leave_Call(self, original_node, updated_node):
        # Transform db.query() → await db.query()
        if isinstance(updated_node.func, cst.Attribute):
            if updated_node.func.attr.value in ["query", "execute"]:
                return cst.Await(expression=updated_node)
        return updated_node
```

---

## 💡 Key Advantages

### 1. **Language Agnostic**
- Same system for TypeScript AND Python
- No need for separate patch management

### 2. **Resilient to Changes**
- ast-grep patterns survive upstream changes
- Codemods work across code structure changes
- Only git patches break on line number shifts

### 3. **Unified Management**
- Single `patches/` directory
- Numeric ordering (001, 002, 003)
- Applied automatically during Docker builds

### 4. **Full Stack Coverage**
```
Frontend (TypeScript)  ──┐
                         ├──> patches/ ──> Docker Build
Backend (Python)       ──┘
```

---

## 🎓 When to Use Which Type

| Scenario | Best Choice | Why |
|----------|-------------|-----|
| Replace API URL pattern across 50+ files | `.yml` (ast-grep) | Pattern matching, any language |
| Add imports + transform code | `.js` or `.py` (codemods) | Full AST control |
| Single file, specific line change | `.patch` (git patch) | Targeted, precise |
| Database connection URLs (Python) | `.yml` (ast-grep) | Works for Python too! |
| Complex logic transformation | `.js` or `.py` (codemods) | Custom transformation logic |

---

## 📦 Dependencies Summary

### Frontend
```bash
npm install -D jscodeshift @ast-grep/cli
```

### Backend  
```
# requirements.txt
libcst>=1.1.0
```

---

## ✨ Railway Integration

The `frontend/Dockerfile.railway` is configured to:
1. Copy the `patches/` directory during build
2. Initialize a git repository (required for `.patch` files)
3. Run `node ../patches/000-apply-patches.js --verbose`
4. Continue with Next.js build

Patches are applied automatically on every Railway deployment!

---
