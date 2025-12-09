"""
Syntax and indentation validation tests.

These tests ensure all Python files in the codebase have valid syntax
and proper indentation. They run fast and catch issues before runtime.
"""
import os
import subprocess
from pathlib import Path
from typing import List, Tuple

import pytest


# Directories to check for Python files
PYTHON_DIRS = [
    "core",
    "api.py",
    "worker_health.py",
    "run_agent_background.py",
]

# Directories to exclude from checks
EXCLUDE_DIRS = [
    "__pycache__",
    ".pytest_cache",
    "node_modules",
    ".venv",
    "venv",
    ".git",
]


def get_python_files() -> List[Path]:
    """Get all Python files in the project."""
    backend_dir = Path(__file__).parent.parent
    python_files = []
    
    for item in PYTHON_DIRS:
        item_path = backend_dir / item
        
        if item_path.is_file() and item.endswith(".py"):
            python_files.append(item_path)
        elif item_path.is_dir():
            for py_file in item_path.rglob("*.py"):
                # Skip excluded directories
                if any(excluded in py_file.parts for excluded in EXCLUDE_DIRS):
                    continue
                python_files.append(py_file)
    
    return sorted(python_files)


def compile_python_file(file_path: Path) -> Tuple[bool, str]:
    """
    Check if a Python file has valid syntax using AST parsing.
    
    This only checks syntax and indentation, not imports or runtime issues.
    
    Returns:
        Tuple of (success: bool, error_message: str)
    """
    import ast
    
    try:
        # Read and parse the file using AST
        # This only checks syntax, not imports or other runtime issues
        content = file_path.read_text(encoding='utf-8')
        ast.parse(content, filename=str(file_path))
        return True, ""
    except SyntaxError as e:
        # Format syntax error nicely
        error_msg = f"SyntaxError at line {e.lineno}: {e.msg}"
        if e.text:
            error_msg += f"\n  {e.text.rstrip()}"
            if e.offset:
                error_msg += f"\n  {' ' * (e.offset - 1)}^"
        return False, error_msg
    except IndentationError as e:
        # Format indentation error nicely  
        error_msg = f"IndentationError at line {e.lineno}: {e.msg}"
        if e.text:
            error_msg += f"\n  {e.text.rstrip()}"
            if e.offset:
                error_msg += f"\n  {' ' * (e.offset - 1)}^"
        return False, error_msg
    except Exception as e:
        return False, f"Unexpected error: {str(e)}"


class TestPythonSyntax:
    """Test suite for Python syntax validation."""
    
    def test_all_python_files_have_valid_syntax(self):
        """Test that all Python files compile without syntax errors."""
        python_files = get_python_files()
        
        assert len(python_files) > 0, "No Python files found to test"
        
        errors = []
        
        for file_path in python_files:
            success, error_msg = compile_python_file(file_path)
            if not success:
                relative_path = file_path.relative_to(Path(__file__).parent.parent)
                errors.append(f"\n{relative_path}:\n  {error_msg}")
        
        if errors:
            error_summary = f"Found {len(errors)} file(s) with syntax errors:" + "".join(errors)
            pytest.fail(error_summary)
    
    @pytest.mark.parametrize("py_file", get_python_files(), ids=lambda p: str(p.relative_to(Path(__file__).parent.parent)))
    def test_individual_file_syntax(self, py_file: Path):
        """Test each Python file individually for better error reporting."""
        success, error_msg = compile_python_file(py_file)
        
        if not success:
            relative_path = py_file.relative_to(Path(__file__).parent.parent)
            pytest.fail(f"Syntax error in {relative_path}:\n{error_msg}")


class TestRuffSyntaxCheck:
    """Test suite using ruff for syntax validation."""
    
    def test_ruff_syntax_check(self):
        """
        Test that ruff finds no syntax errors.
        
        This uses the ruff.toml configuration which only checks for:
        - E9: Runtime errors (syntax, indentation)
        - F63: Invalid syntax  
        - F7: Syntax errors
        """
        backend_dir = Path(__file__).parent.parent
        
        try:
            # Run ruff check
            result = subprocess.run(
                ["uv", "run", "ruff", "check"],
                cwd=backend_dir,
                capture_output=True,
                text=True,
                timeout=30
            )
            
            # Ruff returns exit code 1 if it finds errors
            if result.returncode != 0:
                pytest.fail(
                    f"Ruff found syntax errors:\n\n"
                    f"STDOUT:\n{result.stdout}\n\n"
                    f"STDERR:\n{result.stderr}"
                )
                
        except subprocess.TimeoutExpired:
            pytest.fail("Ruff check timed out after 30 seconds")
        except FileNotFoundError:
            pytest.skip("uv or ruff not available - skipping ruff syntax check")
    
    def test_ruff_config_exists(self):
        """Ensure ruff.toml configuration file exists."""
        backend_dir = Path(__file__).parent.parent
        ruff_config = backend_dir / "ruff.toml"
        
        assert ruff_config.exists(), (
            "ruff.toml configuration file not found. "
            "This file is required for syntax checking."
        )
        
        # Verify it contains the expected syntax check rules
        config_content = ruff_config.read_text()
        assert 'select = ["E9", "F63", "F7"]' in config_content, (
            "ruff.toml should be configured to check syntax errors only. "
            "Expected: select = [\"E9\", \"F63\", \"F7\"]"
        )


class TestCommonIndentationIssues:
    """Test for common indentation patterns that cause issues."""
    
    def test_no_mixed_tabs_and_spaces(self):
        """Ensure no files mix tabs and spaces for indentation."""
        python_files = get_python_files()
        files_with_mixed_indentation = []
        
        for file_path in python_files:
            content = file_path.read_text(encoding='utf-8', errors='ignore')
            lines = content.split('\n')
            
            # Check if file has both tab-indented and space-indented lines
            has_tab_indent = any(line.startswith('\t') for line in lines)
            has_space_indent = any(line.startswith('    ') or line.startswith('  ') for line in lines if line)
            
            if has_tab_indent and has_space_indent:
                relative_path = file_path.relative_to(Path(__file__).parent.parent)
                files_with_mixed_indentation.append(str(relative_path))
        
        if files_with_mixed_indentation:
            pytest.fail(
                f"Found {len(files_with_mixed_indentation)} file(s) with mixed tabs and spaces:\n" +
                "\n".join(f"  - {f}" for f in files_with_mixed_indentation)
            )
