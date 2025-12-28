import os
import argparse
import json
import re
import ast
from pathlib import Path

def parse_python_imports(file_path):
    deps = []
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            tree = ast.parse(f.read())
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    deps.append(alias.name)
            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    deps.append(node.module)
    except Exception as e:
        print(f"Error parsing {file_path}: {e}")
    return deps

def parse_ts_imports(file_path):
    deps = []
    # Basic Regex for imports
    import_pattern = re.compile(r'import\s+.*?from\s+[\'"](.*?)[\'"]')
    dyn_import_pattern = re.compile(r'import\s*\(([\'"](.*?)[\'"])\)')
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            deps.extend(import_pattern.findall(content))
            deps.extend([m[1] for m in dyn_import_pattern.findall(content)])
    except Exception as e:
        print(f"Error parsing {file_path}: {e}")
    return deps

def main():
    parser = argparse.ArgumentParser(description="Map internal and external dependencies.")
    parser.add_argument("--target", help="Target file to analyze", required=True)
    args = parser.parse_args()

    target = Path(args.target)
    if not target.exists():
        print(json.dumps({"error": "File not found"}))
        return

    deps = []
    if target.suffix == '.py':
        deps = parse_python_imports(target)
    elif target.suffix in ['.ts', '.tsx', '.js', '.jsx']:
        deps = parse_ts_imports(target)
    else:
        # Fallback regex
        deps = parse_ts_imports(target)

    # Load Ecosystem Rules
    rules_path = Path('.portkit/ecosystem-rules.json')
    denied_rules = []
    if rules_path.exists():
        try:
            with open(rules_path, 'r', encoding='utf-8') as f:
                config = json.load(f)
                denied_rules = config.get('denied_dependencies', [])
        except Exception as e:
            print(f"Warning: Could not load ecosystem rules: {e}")

    # Classify dependencies (Internal vs External)
    internal = sorted(list(set([d for d in deps if d.startswith('.') or d.startswith('@/')])))
    external_candidates = sorted(list(set([d for d in deps if d not in internal])))
    
    external = []
    denied = []
    
    for dep in external_candidates:
        is_denied = False
        for rule in denied_rules:
            # Simple substring match or exact match
            if rule['package'] in dep:
                denied.append({"dependency": dep, "rule": rule})
                is_denied = True
                break
        if not is_denied:
            external.append(dep)

    report = {
        "file": str(target),
        "dependencies": {
            "internal": internal,
            "external": external,
            "denied": denied
        }
    }
    
    print(json.dumps(report, indent=2))

if __name__ == "__main__":
    main()
