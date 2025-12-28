import argparse
import re
import sys
import json
from pathlib import Path

def load_patterns():
    patterns = []
    rules_path = Path('.portkit/ecosystem-rules.json')
    if rules_path.exists():
        try:
            with open(rules_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                for dep in data.get('denied_dependencies', []):
                    pkg = dep.get('package')
                    action = dep.get('action')
                    
                    if action == 'strip':
                        # Generalized Import Removal
                        # import ... from "pkg"
                        # import "pkg"
                        pat = rf"import\s+.*?from\s+['\"]{pkg}['\"];?"
                        patterns.append((pat, ""))
                        pat_side_effect = rf"import\s+['\"]{pkg}['\"];?"
                        patterns.append((pat_side_effect, ""))
                        
        except Exception as e:
            print(f"Warning: Failed to load ecosystem rules: {e}")
    return patterns

def sanitize(content):
    modified = content
    patterns = load_patterns()
    
    for pattern, replacement in patterns:
        modified = re.sub(pattern, replacement, modified, flags=re.MULTILINE)
    
    return modified

def main():
    parser = argparse.ArgumentParser(description="Sanitize upstream code.")
    parser.add_argument("file", help="File to sanitize (edits in place)")
    args = parser.parse_args()

    target = Path(args.file)
    if not target.exists():
        print("File not found.")
        sys.exit(1)

    with open(target, 'r', encoding='utf-8') as f:
        content = f.read()

    new_content = sanitize(content)

    if new_content != content:
        with open(target, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Sanitized: {target}")
    else:
        print(f"Clean: {target}")

if __name__ == "__main__":
    main()
