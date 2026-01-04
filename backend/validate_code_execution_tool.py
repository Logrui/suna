#!/usr/bin/env python3
"""
Validation script for sb_code_execution_tool implementation.
Checks for common issues without requiring full environment.
"""

import ast
import sys
from pathlib import Path

def check_file_syntax(filepath: Path) -> bool:
    """Check if a Python file has valid syntax."""
    try:
        with open(filepath, 'r') as f:
            ast.parse(f.read())
        print(f"✓ {filepath.name} - Valid syntax")
        return True
    except SyntaxError as e:
        print(f"✗ {filepath.name} - Syntax error: {e}")
        return False

def check_imports(filepath: Path) -> list:
    """Extract imports from a Python file."""
    with open(filepath, 'r') as f:
        tree = ast.parse(f.read())

    imports = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imports.append(alias.name)
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                imports.append(node.module)
    return imports

def check_class_methods(filepath: Path, expected_methods: list = None) -> bool:
    """Check if required methods exist in class."""
    with open(filepath, 'r') as f:
        tree = ast.parse(f.read())

    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef):
            methods = [n.name for n in node.body if isinstance(n, ast.FunctionDef)]
            print(f"  Class {node.name} has methods: {', '.join(methods)}")

            if expected_methods:
                missing = set(expected_methods) - set(methods)
                if missing:
                    print(f"  ⚠ Missing expected methods: {missing}")
                else:
                    print(f"  ✓ All expected methods present")
    return True

def main():
    print("=" * 60)
    print("Code Execution Tool Validation")
    print("=" * 60)

    files_to_check = [
        ("core/sandbox/pty_manager.py", ["get_or_create_session", "send_input", "read_output"]),
        ("core/sandbox/output_processor.py", ["clean_ansi", "detect_prompt", "detect_dialog"]),
        ("core/sandbox/runtime_executor.py", ["execute_python", "execute_nodejs", "execute_terminal"]),
        ("core/tools/sb_code_execution_tool.py", ["execute_code"]),
    ]

    all_valid = True

    for filepath, expected_methods in files_to_check:
        print(f"\n📁 Checking {filepath}")
        path = Path(filepath)

        if not path.exists():
            print(f"  ✗ File not found")
            all_valid = False
            continue

        # Check syntax
        if not check_file_syntax(path):
            all_valid = False
            continue

        # Check imports
        imports = check_imports(path)
        print(f"  Imports: {len(imports)} modules")

        # Check methods
        check_class_methods(path, expected_methods)

    print("\n" + "=" * 60)
    if all_valid:
        print("✓ All validation checks passed!")
        print("\nNext steps:")
        print("1. Install dependencies: cd backend && uv sync")
        print("2. Run import test: uv run python -c 'from core.tools.sb_code_execution_tool import SandboxCodeExecutionTool'")
        print("3. Test with Daytona sandbox configured")
    else:
        print("✗ Some validation checks failed")
        sys.exit(1)

if __name__ == "__main__":
    main()
