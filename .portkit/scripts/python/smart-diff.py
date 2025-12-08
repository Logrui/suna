import argparse
import difflib
import sys
from pathlib import Path

def read_clean(file_path):
    """Read file, strip whitespace, ignore comments (basic)."""
    lines = []
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            for line in f:
                stripped = line.strip()
                if not stripped:
                    continue
                # Very basic comment ignore
                if stripped.startswith('//') or stripped.startswith('#'):
                    continue
                lines.append(stripped)
    except FileNotFoundError:
        return []
    return lines

def main():
    parser = argparse.ArgumentParser(description="Smart Diff ignoring whitespace/comments.")
    parser.add_argument("upstream", help="Path to upstream file")
    parser.add_argument("local", help="Path to local file")
    args = parser.parse_args()

    up_path = Path(args.upstream)
    loc_path = Path(args.local)

    if not up_path.exists():
        print(f"Error: Upstream file {up_path} not found.")
        sys.exit(1)
    
    # If local doesn't exist, it's a new file
    if not loc_path.exists():
        print(f"NEW FILE: {loc_path.name}")
        print(f"Content: {len(read_clean(up_path))} lines")
        return

    up_lines = read_clean(up_path)
    loc_lines = read_clean(loc_path)

    diff = difflib.unified_diff(up_lines, loc_lines, fromfile="upstream", tofile="local", lineterm="")
    
    diff_lines = list(diff)
    if not diff_lines:
        print("MATCH: Files are semantically identical (ignoring whitespace/comments).")
    else:
        print(f"DIFF DETECTED: {len(diff_lines)} changes.")
        for line in diff_lines[:20]: # Show first 20 lines
            print(line)
        if len(diff_lines) > 20:
            print("... (truncated)")

if __name__ == "__main__":
    main()
