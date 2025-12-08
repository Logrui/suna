# Pre-Deployment Error Detection Guide

**Purpose:** Catch parameter mismatches and other errors BEFORE running `docker compose up -d --build`

---

## Quick Pre-Deployment Checklist

Run these commands before any Docker rebuild:

```powershell
# 1. Syntax check critical files
cd backend
uv run python -m py_compile core/run.py core/agentpress/thread_manager.py core/services/llm.py

# 2. Run unit tests (fast, no external dependencies)
uv run pytest -m unit --tb=short -v

# 3. Check for common parameter issues
Select-String -Path "core/**/*.py" -Pattern "await.*\(" | Select-String "=" | Select-Object -First 20

# 4. Grep for recently changed function calls
git diff HEAD~1 --name-only | Select-String ".py$" | ForEach-Object { Select-String -Path $_ -Pattern "def |async def " }
```

---

## Strategy 1: Static Analysis Tools

### Python Syntax Check
Catches basic syntax errors and import issues:

```powershell
cd backend
uv run python -m py_compile core/**/*.py
```

### Pylint (if installed)
More comprehensive static analysis:

```powershell
cd backend
uv run pylint core/run.py core/agentpress/thread_manager.py --disable=all --enable=E0602,E1120,E1121
```

**Key error codes:**
- `E1120` - Missing required argument
- `E1121` - Too many positional arguments
- `E0602` - Undefined variable

### MyPy Type Checking
Catches type mismatches and parameter errors:

```powershell
cd backend
uv run mypy core/run.py core/agentpress/thread_manager.py --no-error-summary
```

---

## Strategy 2: Targeted Grep Searches

### Find All Function Calls with Parameters
```powershell
# Find function calls in recently changed files
git diff HEAD~5 --name-only | Select-String ".py$" | ForEach-Object {
    Write-Host "`n=== $_ ===" -ForegroundColor Cyan
    Select-String -Path $_ -Pattern "\w+\([^)]*=" -Context 0,2
}
```

### Find Specific Function Calls
```powershell
# Search for calls to specific functions
Select-String -Path "backend/core/**/*.py" -Pattern "make_llm_api_call\(|run_thread\(|ProcessorConfig\(" -Context 2,2
```

### Find Parameter Assignments
```powershell
# Look for parameter assignments that might be wrong
Select-String -Path "backend/core/**/*.py" -Pattern "^\s+\w+\s*=\s*" | Select-Object -First 50
```

---

## Strategy 3: Function Signature Comparison

### Extract Function Signatures
Create a script to extract and compare function signatures:

```python
# backend/scripts/check_signatures.py
import ast
import sys

def extract_signatures(filepath):
    with open(filepath, 'r') as f:
        tree = ast.parse(f.read())
    
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef) or isinstance(node, ast.AsyncFunctionDef):
            args = [arg.arg for arg in node.args.args]
            print(f"{node.name}({', '.join(args)})")

if __name__ == "__main__":
    extract_signatures(sys.argv[1])
```

**Usage:**
```powershell
cd backend
uv run python scripts/check_signatures.py core/services/llm.py
uv run python scripts/check_signatures.py core/agentpress/thread_manager.py
```

---

## Strategy 4: Run Backend Tests

### Unit Tests Only (Fast)
```powershell
cd backend
uv run pytest -m unit --tb=short -x
```

**Flags:**
- `-m unit` - Only unit tests (no external dependencies)
- `--tb=short` - Short traceback format
- `-x` - Stop on first failure

### Import Tests
Create a simple import test:

```python
# backend/test_imports.py
def test_imports():
    """Test that all critical modules can be imported."""
    from core.run import run_agent
    from core.agentpress.thread_manager import ThreadManager
    from core.services.llm import make_llm_api_call
    from core.agentpress.response_processor import ProcessorConfig
    print("✅ All imports successful")

if __name__ == "__main__":
    test_imports()
```

**Run:**
```powershell
cd backend
uv run python test_imports.py
```

---

## Strategy 5: Git Diff Analysis

### Review Changed Function Calls
```powershell
# Show all function calls that changed in recent commits
git diff HEAD~3 --unified=3 | Select-String -Pattern "^\+.*\(" -Context 1,1
```

### Compare with Upstream
```powershell
# See what changed in the merge
git diff origin/advanced-workflows HEAD -- backend/core/run.py
git diff origin/advanced-workflows HEAD -- backend/core/agentpress/thread_manager.py
```

---

## Strategy 6: Manual Code Review Checklist

Before merging upstream changes, review:

### ✅ Function Signatures
- [ ] Check all modified function definitions
- [ ] Compare parameter lists with function calls
- [ ] Verify default values match expectations

### ✅ Parameter Passing
- [ ] Look for new parameters in function calls
- [ ] Verify parameters exist in function signatures
- [ ] Check if parameters should be in config objects

### ✅ Config Objects
- [ ] Verify ProcessorConfig fields
- [ ] Check if new fields need to be added
- [ ] Ensure config objects are properly initialized

### ✅ Import Statements
- [ ] Verify all imports are valid
- [ ] Check for circular dependencies
- [ ] Ensure new modules exist

---

## Strategy 7: Automated Pre-Commit Hook

Create `.git/hooks/pre-commit`:

```bash
#!/bin/sh
# Pre-commit hook to catch common errors

echo "Running pre-commit checks..."

# Check Python syntax
cd backend
if ! uv run python -m py_compile core/run.py core/agentpress/thread_manager.py; then
    echo "❌ Syntax check failed"
    exit 1
fi

# Run quick unit tests
if ! uv run pytest -m unit --tb=short -x -q; then
    echo "❌ Unit tests failed"
    exit 1
fi

echo "✅ Pre-commit checks passed"
exit 0
```

**Make executable:**
```powershell
# On Windows, Git Bash handles this automatically
```

---

## Strategy 8: Specific Error Patterns to Search For

### Parameter Mismatch Patterns
```powershell
# Find potential parameter mismatches
Select-String -Path "backend/core/**/*.py" -Pattern "unexpected keyword argument" -Context 3,3
Select-String -Path "backend/core/**/*.py" -Pattern "got an unexpected" -Context 3,3
```

### Common Upstream Merge Issues
```powershell
# Check for common parameter names from upstream
Select-String -Path "backend/core/**/*.py" -Pattern "max_xml_tool_calls|stop_sequences|stop=" -Context 2,2
```

---

## Recommended Workflow

### Before Merging Upstream

1. **Backup current images:**
   ```powershell
   docker tag suna-backend:local suna-backend:pre-merge-$(Get-Date -Format "yyyy-MM-dd")
   docker tag suna-frontend:latest suna-frontend:pre-merge-$(Get-Date -Format "yyyy-MM-dd")
   ```

2. **Review upstream changes:**
   ```powershell
   git fetch upstream
   git diff HEAD upstream/PRODUCTION -- backend/core/
   ```

3. **Identify modified functions:**
   ```powershell
   git diff HEAD upstream/PRODUCTION -- backend/core/ | Select-String "^[-+].*def " -Context 2,5
   ```

### After Merging, Before Building

1. **Run syntax check:**
   ```powershell
   cd backend
   uv run python -m py_compile core/**/*.py
   ```

2. **Run unit tests:**
   ```powershell
   uv run pytest -m unit --tb=short -x
   ```

3. **Manual review of key files:**
   - `backend/core/run.py`
   - `backend/core/agentpress/thread_manager.py`
   - `backend/core/agentpress/response_processor.py`
   - `backend/core/services/llm.py`

4. **Search for new parameters:**
   ```powershell
   git diff HEAD~1 | Select-String "^\+.*=" | Select-String -Pattern "await|def "
   ```

### If Issues Found

1. **Don't build yet** - fix issues first
2. **Re-run checks** after each fix
3. **Only build when all checks pass**

---

## Quick Reference: Common Error Patterns

| Error Message | Likely Cause | Where to Look |
|--------------|--------------|---------------|
| `unexpected keyword argument 'X'` | Parameter passed but not in signature | Function definition vs call site |
| `missing required positional argument` | Required param not passed | Function call missing parameter |
| `got multiple values for argument` | Positional + keyword conflict | Function call parameter order |
| `object has no attribute 'X'` | Config object missing field | Config class definition |

---

## Tools to Install (Optional)

```powershell
cd backend

# Install development tools
uv add --dev pylint mypy pytest-xdist

# Run enhanced checks
uv run pylint core/run.py
uv run mypy core/agentpress/
```

---

## Summary

**Minimum checks before `docker compose up -d --build`:**

1. ✅ Syntax check: `uv run python -m py_compile core/**/*.py`
2. ✅ Unit tests: `uv run pytest -m unit --tb=short -x`
3. ✅ Manual review of modified files
4. ✅ Search for new parameters: `git diff HEAD~1 | Select-String "^\+.*="`

**Time investment:** 2-5 minutes  
**Saves:** 10-30 minutes of debugging + rebuild cycles
