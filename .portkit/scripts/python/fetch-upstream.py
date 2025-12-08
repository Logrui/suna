import os
import subprocess
import argparse
import json
import sys
from pathlib import Path

# Configuration
PORTKIT_ROOT = Path(__file__).resolve().parent.parent.parent
CONFIG_FILE = PORTKIT_ROOT / "config.json"
CACHE_DIR = PORTKIT_ROOT.parent / ".portkit-cache"

def load_config():
    if not CONFIG_FILE.exists():
        print(f"Error: Config file not found at {CONFIG_FILE}")
        sys.exit(1)
    with open(CONFIG_FILE, "r") as f:
        return json.load(f)

def run_git(args, cwd):
    try:
        subprocess.run(["git"] + args, cwd=cwd, check=True, capture_output=True, text=True)
    except subprocess.CalledProcessError as e:
        print(f"Git Error: {e.stderr}")
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="Fetch and cache upstream repository.")
    parser.add_argument("--ref", help="Target git reference (tag/branch/commit)", default="main")
    args = parser.parse_args()

    config = load_config()
    upstream_url = config.get("upstream_url")
    
    if not upstream_url:
        print("Error: 'upstream_url' not defined in config.json")
        sys.exit(1)

    # Ensure cache directory exists
    if not CACHE_DIR.exists():
        print(f"Cloning upstream from {upstream_url}...")
        # Clone straight into .portkit-cache
        # We need to create the parent dir context if .portkit-cache doesn't exist?
        # git clone creates the dir.
        try:
            subprocess.run(["git", "clone", upstream_url, str(CACHE_DIR)], check=True, capture_output=False)
        except subprocess.CalledProcessError as e:
            print(f"Clone Failed: {e}")
            sys.exit(1)
    else:
        print("Fetching latest from upstream...")
        run_git(["fetch", "--all"], cwd=CACHE_DIR)

    # Checkout Target
    print(f"Checking out {args.ref}...")
    run_git(["checkout", args.ref], cwd=CACHE_DIR)
    
    # Enable pulling if it's a branch
    try:
        run_git(["pull"], cwd=CACHE_DIR)
    except:
        pass # Detached head or tag

    print(f"Success. Upstream available at: {CACHE_DIR}")

if __name__ == "__main__":
    main()
