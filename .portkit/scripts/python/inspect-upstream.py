import argparse
import sys
import os
from pathlib import Path

# Configuration
PORTKIT_ROOT = Path(__file__).resolve().parent.parent.parent
CACHE_DIR = PORTKIT_ROOT.parent / ".portkit-cache"

def safe_path(rel_path):
    """Ensure path is within CACHE_DIR"""
    if not CACHE_DIR.exists():
        print(f"Error: Cache not found at {CACHE_DIR}. Run fetch-upstream.py first.")
        sys.exit(1)
        
    p = (CACHE_DIR / rel_path).resolve()
    try:
        p.relative_to(CACHE_DIR)
    except ValueError:
        print(f"Error: Access denied. Path must be inside .portkit-cache.")
        sys.exit(1)
    
    return p

def print_tree(directory, prefix=""):
    try:
        # get all children
        items = list(directory.iterdir())
        # sort: dirs first, then files (case-insensitive)
        items.sort(key=lambda x: (not x.is_dir(), x.name.lower()))
        
        count = len(items)
        for i, item in enumerate(items):
            is_last = (i == count - 1)
            connector = "└── " if is_last else "├── "
            
            # Metadata
            if item.is_dir():
                meta = "/"
            else:
                size = item.stat().st_size
                if size < 1024:
                    meta = f"({size} B)"
                elif size < 1024 * 1024:
                    meta = f"({size/1024:.1f} KB)"
                else:
                    meta = f"({size/(1024*1024):.1f} MB)"
                
            print(f"{prefix}{connector}{item.name} {meta}")
            
            if item.is_dir():
                extension = "    " if is_last else "│   "
                print_tree(item, prefix + extension)
    except PermissionError:
        print(f"{prefix}└── [ACCESS DENIED]")

def do_ls(target, recursive=False):
    print(f"Directory: {target.relative_to(CACHE_DIR)}\n")
    if target.is_file():
        print(f"  {target.name} ({target.stat().st_size} bytes)")
        return

    if recursive:
        print_tree(target)
    else:
        # non-recursive list
        items = list(target.iterdir())
        items.sort(key=lambda x: (not x.is_dir(), x.name.lower()))
        print(f"{'Name':<35} {'Size/Type'}")
        print("-" * 50)
        for item in items:
             type_ = "<DIR>" if item.is_dir() else f"{item.stat().st_size} B"
             print(f"{item.name:<35} {type_}")
        print("-" * 50)
        print(f"Total: {len(items)} items.")

def do_cat(target):
    if not target.is_file():
        print(f"Error: {target} is not a file.")
        sys.exit(1)
        
    print(f"Reading: {target.relative_to(CACHE_DIR)}\n" + "="*60)
    try:
        with open(target, "r", encoding="utf-8", errors="replace") as f:
            print(f.read())
    except Exception as e:
        print(f"Error reading file: {e}")
    print("\n" + "="*60)

def do_search(target, keywords):
    """
    Search recursively for files containing any of the keywords (case-insensitive).
    """
    print(f"Searching for {keywords} in: {target.relative_to(CACHE_DIR)}\n")
    
    terms = [k.strip().lower() for k in keywords.split(",")]
    matches_found = 0
    
    # Always recursive for search
    files = [p for p in target.rglob("*") if p.is_file()]
    
    # Extensions to ignore during code search
    BLACKLIST_EXT = {
        '.pyc', '.git', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.pdf', 
        '.db', '.sqlite', '.log', '.lock', '.json', '.txt', '.md', '.yaml', '.yml',
        '.xml', '.css', '.scss', '.map', '.toml'
    }
    
    # Directories/Paths to ignore
    BLACKLIST_DIR_PARTS = {'translations', 'node_modules', '__pycache__', '.git', 'assets', 'public'}

    # Build tree structure of matches
    #{ "backend": { "core": { "file.py": [matches] } } }
    
    match_tree = {}

    for f in files:
        try:
            # Skip blacklisted extensions
            if f.suffix.lower() in BLACKLIST_EXT:
                continue
            # Skip blacklisted directories
            if any(part in f.parts for part in BLACKLIST_DIR_PARTS):
                continue
            if f.stat().st_size > 1024 * 1024: continue
                
            with open(f, 'r', encoding='utf-8', errors='ignore') as content_file:
                lines = content_file.readlines()
                
            file_matches = []
            for i, line in enumerate(lines, 1):
                line_lower = line.lower()
                for term in terms:
                    if term in line_lower:
                        file_matches.append((i, line.strip(), term))
                        break

            if file_matches:
                matches_found += 1
                # Add to tree
                rel = f.relative_to(target)
                current = match_tree
                for part in rel.parts[:-1]:
                    if part not in current:
                        current[part] = {}
                    current = current[part]
                current[rel.parts[-1]] = file_matches
                
        except Exception:
            continue
            
    if matches_found == 0:
        print("No matches found.")
        return
        
    print(f"Found matches in {matches_found} files.\n")
    
    # Recursive printer for matches
    def print_match_tree(node, prefix=""):
        # Sort keys: Directories (dicts) first, then Files (lists)
        # We distinguish by type: list is file matches, dict is directory
        items = list(node.items())
        items.sort(key=lambda x: (isinstance(x[1], list), x[0].lower()))
        
        count = len(items)
        for i, (name, data) in enumerate(items):
            is_last = (i == count - 1)
            connector = "└── " if is_last else "├── "
            
            if isinstance(data, dict):
                # Directory
                print(f"{prefix}{connector}{name}/")
                extension = "    " if is_last else "│   "
                print_match_tree(data, prefix + extension)
            else:
                # File with matches
                print(f"{prefix}{connector}{name}")
                extension = "    " if is_last else "│   "
                
                # Print contexts
                matches = data
                m_count = len(matches)
                for j, (ln, txt, term) in enumerate(matches):
                    # Limit context to first 3 matches to avoid spam
                    if j >= 3:
                        sub_conn = "└── " 
                        print(f"{prefix}{extension}{sub_conn}... ({m_count - 3} more)")
                        break
                        
                    is_last_match = (j == m_count - 1)
                    sub_conn = "└── " if is_last_match else "├── "
                    
                    if len(txt) > 80: txt = txt[:77] + "..."
                    print(f"{prefix}{extension}{sub_conn}L{ln:<4} {txt}")

    print_match_tree(match_tree)

def main():
    parser = argparse.ArgumentParser(description="Safely inspect upstream cache.")
    subparsers = parser.add_subparsers(dest="action", required=True)
    
    # ls
    ls_parser = subparsers.add_parser("ls", help="List directory contents")
    ls_parser.add_argument("path", nargs="?", default=".", help="Relative path")
    ls_parser.add_argument("-r", "--recursive", action="store_true", help="Recursive list")

    # cat
    cat_parser = subparsers.add_parser("cat", help="Read file content")
    cat_parser.add_argument("path", help="Relative path to file")

    # find (filenames)
    find_parser = subparsers.add_parser("find", help="Find files by name pattern")
    find_parser.add_argument("pattern", help="Glob pattern (e.g. *.py)")
    find_parser.add_argument("path", nargs="?", default=".", help="Base path to search from")

    # search (content)
    search_parser = subparsers.add_parser("search", help="Search file content for keywords")
    search_parser.add_argument("keywords", help="Comma-separated keywords")
    search_parser.add_argument("path", nargs="?", default=".", help="Base path to search from")
    
    args = parser.parse_args()
    
    # Resolve target
    rel = args.path if hasattr(args, 'path') else "."
    target = safe_path(rel)

    if args.action == "ls":
        do_ls(target, args.recursive)
    elif args.action == "cat":
        do_cat(target)
    elif args.action == "find":
        do_find(target, args.pattern)
    elif args.action == "search":
        do_search(target, args.keywords)

if __name__ == "__main__":
    main()
