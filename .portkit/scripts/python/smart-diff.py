import argparse
import difflib
import sys
from pathlib import Path

def read_clean(file_path):
    """Read file, strip whitespace, ignore comments (basic)."""
    lines = []
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
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

def diff_file(up_path, loc_path, verbose=False):
    """
    Diff two files and return (status, diff_lines)
    status: "MATCH", "NEW", "MISSING", "DIFF"
    """
    if not up_path.exists():
        # Should not happen if walking upstream, but possible if checking local->upstream
        return "MISSING_UPSTREAM", []
        
    if not loc_path.exists():
        return "NEW_UPSTREAM", []

    up_lines = read_clean(up_path)
    loc_lines = read_clean(loc_path)

    diff = difflib.unified_diff(up_lines, loc_lines, fromfile="upstream", tofile="local", lineterm="")
    diff_lines = list(diff)
    
    if not diff_lines:
        return "MATCH", []
    
    return "DIFF", diff_lines

def main():
    parser = argparse.ArgumentParser(description="Smart Diff ignoring whitespace/comments.")
    parser.add_argument("upstream", help="Path to upstream file/directory")
    parser.add_argument("local", help="Path to local file/directory")
    parser.add_argument("-r", "--recursive", action="store_true", help="Enable recursive directory comparison")
    parser.add_argument("--full", action="store_true", help="Show full diff output")
    args = parser.parse_args()

    up_path = Path(args.upstream)
    loc_path = Path(args.local)

    if not up_path.exists():
        print(f"Error: Upstream {up_path} not found.")
        sys.exit(1)

    # 1. Directory Mode
    if up_path.is_dir():
        if not args.recursive:
            print("Error: Upstream is a directory. Use -r/--recursive to compare directories.")
            sys.exit(1)
        if not loc_path.exists():
             print(f"Local directory {loc_path} does not exist.")
             # We could list all upstream as NEW here
             sys.exit(1)
             
        print(f"Scanning directories recursively:\n  Upstream: {up_path}\n  Local:    {loc_path}\n")
        
        # Walk Upstream
        stats = {"MATCH": 0, "DIFF": 0, "NEW_UPSTREAM": 0}
        
        # Collect all extensions to skip (e.g., .pyc, .git)
        SKIP_EXTs = ['.pyc', '.git', '.png', '.jpg', '.ico']
        
        for p in up_path.rglob("*"):
            if not p.is_file(): continue
            if p.suffix in SKIP_EXTs: continue
            
            # Calculate input relative path
            rel_path = p.relative_to(up_path)
            target_loc = loc_path / rel_path
            
            status, lines = diff_file(p, target_loc)
            stats[status] = stats.get(status, 0) + 1
            
            if status == "DIFF":
                print(f"[DIFF] {rel_path} ({len(lines)} lines)")
            elif status == "NEW_UPSTREAM":
                print(f"[NEW]  {rel_path} (Missing locally)")
            # elif status == "MATCH":
            #    print(f"[OK]   {rel_path}")

        print("\nSummary:")
        print(f"  Matches: {stats.get('MATCH', 0)}")
        print(f"  Diffs:   {stats.get('DIFF', 0)}")
        print(f"  New:     {stats.get('NEW_UPSTREAM', 0)}")
        
    # 2. File Mode
    else:
        status, lines = diff_file(up_path, loc_path)
        if status == "NEW_UPSTREAM":
            print(f"NEW FILE: {loc_path.name} (Does not exist locally)")
            print(f"Ref content: {len(read_clean(up_path))} lines")
        elif status == "MATCH":
             print("MATCH: Files are semantically identical.")
        elif status == "DIFF":
            print(f"DIFF DETECTED: {len(lines)} changes.")
            if args.full:
                for line in lines:
                    print(line)
            else:
                for line in lines[:50]:
                    print(line)
                if len(lines) > 50:
                    print("... (truncated)")

if __name__ == "__main__":
    main()
