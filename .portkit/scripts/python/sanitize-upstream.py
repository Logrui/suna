import argparse
import re
import sys
from pathlib import Path

# Hardcoded Poison Patterns (in lieu of config for V1)
POISON_PATTERNS = [
    (r"import\s+.*?from\s+['\"]next-intl['\"];?", ""), # Remove next-intl imports
    (r"useTranslations\(.*?\);?", "() => (key: string) => key; // Shimmed"), # Shim hooks
    (r"import\s+.*?from\s+['\"]@/hooks/billing['\"];?", ""), # Remove billing
]

def sanitize(content):
    modified = content
    for pattern, replacement in POISON_PATTERNS:
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
