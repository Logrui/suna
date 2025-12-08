import os
import re
import json
import argparse
from pathlib import Path

REGISTRY_PATH = Path(".portkit/addon-features-registry/addon-features-registry.json")

def scan_file(path, feature_map):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
    except:
        return

    # Find all feature-start tags
    matches = re.findall(r"//\s*feature-start:\s*([\w-]+)", content)
    for feature in matches:
        if feature not in feature_map:
            feature_map[feature] = []
        if str(path) not in feature_map[feature]:
            feature_map[feature].append(str(path))

def main():
    parser = argparse.ArgumentParser(description="Scan codebase for feature tags.")
    parser.add_argument("--update", action="store_true", help="Update registry file")
    args = parser.parse_args()

    feature_map = {}
    
    # Walk all files (ignoring node_modules, .git, etc)
    for root, dirs, files in os.walk("."):
        if ".git" in dirs: dirs.remove(".git")
        if "node_modules" in dirs: dirs.remove("node_modules")
        if ".upstream-cache" in dirs: dirs.remove(".upstream-cache")
        
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
            registry = {}
        
        # Merge scan results
        for feature, files in feature_map.items():
            if feature not in registry:
                registry[feature] = {"files": [], "status": "active"}
            registry[feature]["files"] = sorted(list(set(registry[feature].get("files", []) + files)))
            registry[feature]["last_sync"] = "manual_scan_timestamp" # simplified
        
        with open(REGISTRY_PATH, 'w') as f:
            json.dump(registry, f, indent=2)
        print("Registry Updated.")
    else:
        print(json.dumps(feature_map, indent=2))

if __name__ == "__main__":
    main()
