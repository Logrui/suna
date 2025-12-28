# Pack Context - Latency Optimization Tool
# Purpose: Concatenates files into optimized Markdown block.
import sys
import os
import argparse
from pathlib import Path

def main():
    parser = argparse.ArgumentParser(description="Pack multiple files into a single context block.")
    parser.add_argument("files", nargs='*', help="List of file paths to pack")
    parser.add_argument("--file-list", help="Path to a text file containing list of files to pack (one per line)")
    parser.add_argument("--root", default=".", help="Root directory for relative paths")
    args = parser.parse_args()

    files_to_read = []
    
    # Add command line args
    files_to_read.extend(args.files)

    # Add from list file
    if args.file_list:
        try:
            with open(args.file_list, 'r', encoding='utf-8') as f:
                lines = [l.strip() for l in f.readlines() if l.strip() and not l.startswith('#')]
                files_to_read.extend(lines)
        except Exception as e:
            print(f"Error reading file list: {e}")
            sys.exit(1)

    # Deduplicate
    files_to_read = sorted(list(set(files_to_read)))
    
    # Output Header
    print(f"# Pack Context Output ({len(files_to_read)} files)\n")
    
    root_path = Path(args.root).resolve()

    for file_path_str in files_to_read:
        try:
            # Resolve path
            path = Path(file_path_str)
            if not path.is_absolute():
                path = root_path / path
            
            # Display path (relative to root if possible)
            try:
                display_path = path.resolve().relative_to(root_path).as_posix()
            except ValueError:
                display_path = path.as_posix() # Fallback for outside root

            if not path.exists():
                print(f"## File: {display_path} (NOT FOUND)\n")
                continue
                
            if path.is_dir():
                print(f"## Directory: {display_path} (SKIPPED)\n")
                continue

            # Read Content
            with open(path, 'r', encoding='utf-8', errors='replace') as f:
                content = f.read()
                
            # Determine Language hint
            ext = path.suffix.lower().replace('.', '')
            lang = ext if ext in ['ts', 'tsx', 'js', 'py', 'json', 'md', 'css', 'html'] else ''

            print(f"## File: {display_path}")
            print(f"```{lang}")
            print(content)
            print("```\n")

        except Exception as e:
            print(f"## File: {file_path_str} (ERROR: {e})\n")

if __name__ == "__main__":
    main()
