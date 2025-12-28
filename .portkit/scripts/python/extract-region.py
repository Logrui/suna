import argparse
import re
import json
import sys
from pathlib import Path

def extract_regions(content):
    # Pattern: // feature-start: name ... // feature-end: name
    pattern = re.compile(r"//\s*feature-start:\s*([\w-]+)(.*?)//\s*feature-end:\s*\1", re.DOTALL)
    matches = {}
    for match in pattern.finditer(content):
        name = match.group(1).strip()
        code = match.group(0).strip() # Capture full block including tags?
        # Or just the inner content? Usually we want the inner content to re-inject.
        # But for Morphing, we might want to keep tags. 
        # distinct choice: Capture Inner Content.
        inner = match.group(2).strip()
        matches[name] = inner
    return matches

def main():
    parser = argparse.ArgumentParser(description="Extract feature regions.")
    parser.add_argument("file", help="Input file")
    parser.add_argument("--output", help="Output JSON file", default=None)
    args = parser.parse_args()

    target = Path(args.file)
    if not target.exists():
        sys.exit(1)

    with open(target, 'r', encoding='utf-8') as f:
        content = f.read()

    regions = extract_regions(content)

    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(regions, f, indent=2)
        print(f"Extracted {len(regions)} regions to {args.output}")
    else:
        print(json.dumps(regions, indent=2))

if __name__ == "__main__":
    main()
