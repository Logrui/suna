# Backend Tests

## Syntax Validation Tests

The `test_syntax.py` module contains automated tests that catch syntax and indentation errors across the entire codebase.

### What It Checks

1. **Python Syntax Errors** - Using AST parsing to detect:
   - Indentation errors
   - Missing colons
   - Unclosed parentheses/brackets
   - Invalid Python syntax

2. **Ruff Syntax Check** - Using configured ruff rules (E9, F63, F7):
   - Runtime syntax errors
   - Invalid syntax patterns
   - Python grammar violations

3. **Mixed TIndentation** - Detects files mixing tabs and spaces

### Running the Tests

```powershell
# Run all syntax tests
uv run pytest tests/test_syntax.py -v

# Run only specific test class
uv run pytest tests/test_syntax.py::TestPythonSyntax -v
uv run pytest tests/test_syntax.py::TestRuffSyntaxCheck -v

# Run quick aggregate check (fastest)
uv run pytest tests/test_syntax.py::TestPythonSyntax::test_all_python_files_have_valid_syntax -v
```

### Test Classes

#### `TestPythonSyntax`
- **Purpose**: Validates Python syntax using AST parsing
- **Speed**: Fast (~2-3 seconds for 376 files)
- **Coverage**: All `.py` files in `core/` directory
- **Detects**: Syntax errors, indentation errors, invalid Python code
- **Does NOT check**: Imports, type hints, or runtime logic

#### `TestRuffSyntaxCheck`
- **Purpose**: Uses ruff linter for syntax validation
- **Configuration**: Uses `ruff.toml` with syntax-only rules
- **Requires**: `ruff` installed via `uv add --dev ruff`
- **Benefits**: Consistent with CI/CD, catches edge cases

#### `TestCommonIndentationIssues`
- **Purpose**: Detects common indentation problems
- **Checks**: Mixed tabs/spaces in the same file
- **Why**: Prevents hard-to-debug indentation errors

### Configuration

The tests use `ruff.toml` in the backend root:

```toml
[lint]
# Only syntax/indentation errors
select = ["E9", "F63", "F7"]
```

### Integration with CI/CD

Add to your CI pipeline:

```yaml
- name: Check Python Syntax
  run: uv run pytest tests/test_syntax.py -v
```

### Fixing Issues

**Indentation Errors:**
```powershell
# Auto-format with ruff
uv run ruff format file.py

# Or manually fix using IDE
```

**BOM Characters (U+FEFF):**
```powershell
# Remove BOM from specific file
python -c "import pathlib; f = pathlib.Path('file.py'); f.write_text(f.read_text(encoding='utf-8-sig'), encoding='utf-8')"
```

**Mixed Tabs/Spaces:**
- Convert all tabs to spaces in your IDE
- Use consistent editor settings (4 spaces per indent)

### Why These Tests Matter

1. **Catch errors before runtime** - Syntax errors fail fast in tests, not production
2. **Faster feedback** - No need to wait for Docker builds or manual testing
3. **Prevents bad commits** - Can be added to pre-commit hooks
4. **IDE-agnostic** - Catches issues even if your IDE doesn't report them
5. **Consistent standards** - Enforces syntax quality across the team

### Performance

- **376 files** tested in ~2-3 seconds
- **AST parsing** is faster than compilation
- **Parallel execution** via pytest-xdist if needed
