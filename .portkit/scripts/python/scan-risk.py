import argparse
import json
import sys
import re
from pathlib import Path

# Configuration
PORTKIT_ROOT = Path(__file__).resolve().parent.parent.parent
RULES_FILE = PORTKIT_ROOT / "ecosystem-rules.json"

def load_rules():
    if not RULES_FILE.exists():
        print(f"Error: Rules file not found at {RULES_FILE}")
        sys.exit(1)
    with open(RULES_FILE, "r") as f:
        return json.load(f)

def scan_file(file_path, denied_pkgs, keywords):
    """
    Scan a single file for denied dependencies and risky keywords.
    """
    risks = []
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
            
        for i, line in enumerate(lines, 1):
            # Check Denied Dependencies (import statements)
            for pkg in denied_pkgs:
                pkg_name = pkg['package']
                # Basic heuristic for imports in JS/TS/Py
                # JS: import ... from 'pkg' | require('pkg')
                # Py: import pkg | from pkg import ...
                if f"'{pkg_name}'" in line or f'"{pkg_name}"' in line or f" {pkg_name} " in line:
                    # Refine detection to avoid false positives in comments/text
                    if "import" in line or "require" in line or "from" in line:
                         risks.append({
                            "type": "Denied Dependency",
                            "term": pkg_name,
                            "file": str(file_path),
                            "line": i,
                            "content": line.strip(),
                            "action": pkg['action'],
                            "reason": pkg['reason']
                        })

            # Check Keywords
            for kw in keywords:
                if kw.lower() in line.lower():
                     risks.append({
                        "type": "Risk Keyword",
                        "term": kw,
                        "file": str(file_path),
                        "line": i,
                        "content": line.strip(),
                        "action": "Review",
                        "reason": "Potential sensitive logic detected."
                    })
                    
    except Exception as e:
        print(f"Warning: Failed to scan {file_path}: {e}")
        
    return risks

def main():
    parser = argparse.ArgumentParser(description="Scan for ecosystem risks and denied dependencies.")
    parser.add_argument("--target", help="File or Directory to scan", required=True)
    parser.add_argument("--keywords", help="Comma-separated list of additional risk keywords", default="")
    args = parser.parse_args()

    target_path = Path(args.target)
    if not target_path.exists():
        print(f"Error: Target {target_path} not found.")
        sys.exit(1)

    # Load Rules
    rules = load_rules()
    denied_deps = rules.get("denied_dependencies", [])
    
    # Prepare Keywords
    extra_keywords = [k.strip() for k in args.keywords.split(",") if k.strip()]
    
    results = []

    if target_path.is_file():
        results.extend(scan_file(target_path, denied_deps, extra_keywords))
    else:
        for p in target_path.rglob("*"):
            if p.is_file() and not p.name.startswith("."):
                # Skip some common binary/ignore extensions
                if p.suffix in ['.png', '.jpg', '.pyc', '.git']:
                    continue
                results.extend(scan_file(p, denied_deps, extra_keywords))

    # Output Report
    if not results:
        print("✅ No risks detected.")
        sys.exit(0)
    
    print(f"⚠️  RISKS DETECTED: {len(results)}")
    print("="*60)
    
    # Group by File
    details = {}
    for r in results:
        f = r['file']
        if f not in details: details[f] = []
        details[f].append(r)
        
    for f, items in details.items():
        print(f"\n📂 {f}")
        for item in items:
            print(f"   L{item['line']}: [{item['type']}] {item['term']}")
            print(f"      Context: {item['content']}")
            print(f"      Action:  {item['action']} ({item['reason']})")
    
    # Exit with failure if risks found (to alert agent)
    sys.exit(1)

if __name__ == "__main__":
    main()
