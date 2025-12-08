# Smart Diff Feature - Scope Analysis
# Purpose: Generates Blast Radius for entire folders/feature sets.
# Outputs POSIX relative paths of files that reference the input feature.
import sys
import os
import argparse
import subprocess
from pathlib import Path
import json

def main():
    parser = argparse.ArgumentParser(description="Find files that depend on a feature/path (Blast Radius).")
    parser.add_argument("query", help="The feature name, component name, or path segment to search for references to")
    parser.add_argument("--format", choices=['json', 'text'], default='json', help="Output format")
    args = parser.parse_args()

    query = args.query
    
    # Heuristic: If it looks like a file path "src/components/Button.tsx", search for "Button".
    # If it's "user-auth", search for "user-auth".
    search_term = query
    if '/' in query or '\\' in query:
        # It's a path, try to extract the filename without extension
        p = Path(query)
        search_term = p.stem # 'Button' from 'src/components/Button.tsx'

    results = []
    
    try:
        # Use git grep for speed
        # Search for the term in all tracked files
        # -l: files with matches
        # -I: ignore binary
        cmd = ['git', 'grep', '-l', '-I', search_term]
        
        # Exclude common noise
        cmd.extend(['--source', ':/']) # From root
        cmd.extend(['--', ':!package-lock.json', ':!yarn.lock', ':!.portkit/'])

        res = subprocess.run(cmd, capture_output=True, text=True)
        
        if res.returncode == 0:
            files = res.stdout.splitlines()
            # Normalize to POSIX
            results = [f.replace('\\', '/') for f in files]
            
            # Remove the input file itself if it was found (we want dependents)
            if query.replace('\\', '/') in results:
                results.remove(query.replace('\\', '/'))

    except Exception as e:
        if args.format == 'json':
            print(json.dumps({"error": str(e)}))
        else:
            print(f"Error: {e}")
        sys.exit(1)

    if args.format == 'json':
        print(json.dumps({
            "query": query,
            "search_term": search_term,
            "blast_radius_files": results,
            "count": len(results)
        }, indent=2))
    else:
        print(f"Search Term: {search_term}")
        print(f"Found {len(results)} dependent files:")
        for r in results:
            print(f"- {r}")

if __name__ == "__main__":
    main()
