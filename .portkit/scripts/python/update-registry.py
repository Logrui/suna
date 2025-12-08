import os
import re
import json
import argparse
from pathlib import Path

REGISTRY_PATH = Path(".portkit/addon-features-registry/feature-registry.json")

def scan_file(path, feature_map):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
    except:
        return

    # Find all feature-start tags
    matches = re.findall(r"//\s*feature-start:\s*([\w-]+)", content)
    # Also support python hash comments
    matches += re.findall(r"#\s*feature-start:\s*([\w-]+)", content)
    
    for feature in matches:
        if feature not in feature_map:
            feature_map[feature] = []
        if str(path) not in feature_map[feature]:
            feature_map[feature].append(str(path))

def get_changed_files():
    """Get list of modified and new files from git."""
    files = set()
    try:
        # 1. Modified tracked files (diff against HEAD)
        res = subprocess.run(['git', 'diff', '--name-only', 'HEAD'], capture_output=True, text=True)
        if res.returncode == 0:
            files.update(res.stdout.splitlines())

        # 2. Untracked (new) files
        res = subprocess.run(['git', 'ls-files', '--others', '--exclude-standard'], capture_output=True, text=True)
        if res.returncode == 0:
            files.update(res.stdout.splitlines())
    except Exception as e:
        print(f"Warning: Could not get git status for audit: {e}")
    
    # Filter for relevant extensions
    return [Path(f) for f in files if f.endswith(('.ts', '.tsx', '.js', '.py', '.md'))]

def main():
    parser = argparse.ArgumentParser(description="Scan codebase for feature tags.")
    parser.add_argument("--update", action="store_true", help="Update registry file")
    parser.add_argument("--audit", action="store_true", help="Check for changed files missing feature tags")
    parser.add_argument("--folder", help="Limit scan to specific folder")
    args = parser.parse_args()

    feature_map = {}
    
    import subprocess
    feature_map = {}
    
    try:
        # OPTIMIZATION: Use git grep to find ONLY files that contain our tags.
        # This avoids opening thousands of files that have no tags.
        # -I: Ignore binary
        # -l: Print filename only
        # "feature-start:" matches both // and # styles
        
        # Determine search path from args
        search_path = args.folder if args.folder else '.'
        
        cmd = ['git', 'grep', '-I', '-l', 'feature-start:', '--', search_path]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode == 0:
            files = result.stdout.splitlines()
            # Normalize paths to handle potential OS differences in git output (though usually forward slash)
            files = [f.strip() for f in files if f.strip()]
            
            for file_path in files:
                path = Path(file_path)
                if path.exists():
                    scan_file(path, feature_map)
        else:
            # git grep returns 1 if no matches found, which is fine
            if result.returncode != 1:
                print(f"git grep returned code {result.returncode}")

    except Exception as e:
        print(f"Error running git grep optimization: {e}. Falling back to slow walk.")
        # Fallback to os.walk if git isn't available
        for root, dirs, files in os.walk("."):
            if ".git" in dirs: dirs.remove(".git")
            if "node_modules" in dirs: dirs.remove("node_modules")
            if ".portkit-cache" in dirs: dirs.remove(".portkit-cache")
            
            for file in files:
                if file.endswith(('.ts', '.tsx', '.js', '.py', '.md')):
                    path = Path(root) / file
                    scan_file(path, feature_map)

    # Output or Update
    if args.update:
        if REGISTRY_PATH.exists():
            with open(REGISTRY_PATH, 'r') as f:
                registry = json.load(f)
        else:
            registry = {"features": {}, "metadata": {"version": "1.0"}}
        
        # Merge scan results
        for feature, files in feature_map.items():
            if feature not in registry["features"]:
                registry["features"][feature] = {"status": "active", "version": "0.1.0", "files": [], "dependencies": []}
            
            # Simple merge: add new files to the list
            current_files = set([f["path"] if isinstance(f, dict) else f for f in registry["features"][feature].get("files", [])])
            for file_path in files:
                current_files.add(file_path)
            
            # Reconstruct detailed file objects (simplified for now)
            registry["features"][feature]["files"] = sorted(list(current_files))
            registry["features"][feature]["last_synced"] = "manual_scan_timestamp"

        with open(REGISTRY_PATH, 'w') as f:
            json.dump(registry, f, indent=2)
        print("Registry Updated.")
    elif args.audit:
        changed_files = get_changed_files()
        
        # Flatten feature_map to get set of all currently tagged files
        all_tagged_files = set()
        for file_list in feature_map.values():
            all_tagged_files.update(file_list) # file_list contains string paths
            
        untracked = []
        for cf in changed_files:
            # Normalize path separators
            cf_str = str(cf).replace(os.sep, '/')
            # Check if this changed file appears in ANY feature list
            # We use loose matching because file_list might be relative differently? 
            # Actually scan_file uses relative paths so exact match should work if normalized.
            
            # Simple check: Is this file in the set of all feature-tagged files?
            # Windows path normalization is key here. scan_file uses Path(file_path) which might use backslashes.
            # feature_map stores str(path).
            
            # Use Path object comparison for robustness
            is_tagged = False
            for tagged_path in all_tagged_files:
                if Path(tagged_path).resolve() == cf.resolve():
                    is_tagged = True
                    break
            
            if not is_tagged:
                untracked.append(str(cf))
                
        if untracked:
            print(json.dumps({
                "status": "warning",
                "message": "Found modified/new files without Feature Tags.",
                "untracked_files": untracked
            }, indent=2))
            exit(1) # Signal failure to the agent
        else:
            print(json.dumps({"status": "success", "message": "All modified files are properly tagged."}, indent=2))
    else:
        print(json.dumps(feature_map, indent=2))

if __name__ == "__main__":
    main()
