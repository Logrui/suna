import argparse
import subprocess
import sys
from pathlib import Path

def run_cmd(cmd, cwd=None):
    print(f"Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=cwd, text=True, capture_output=True)
    if result.returncode != 0:
        print(f"FAIL: {result.stderr}")
        return False
    print("PASS")
    return True

def verify_frontend():
    print("Verifying Frontend...")
    frontend_dir = Path("frontend") # Assume root execution
    if not frontend_dir.exists():
        print("Frontend dir not found")
        return False
    
    # Try Lint
    if not run_cmd(["npm", "run", "lint"], cwd=frontend_dir):
        return False
    
    # Try Build (Optional, slow)
    # if not run_cmd(["npm", "run", "build"], cwd=frontend_dir):
    #     return False
    
    return True

def verify_backend():
    print("Verifying Backend...")
    # Assume python/uv
    if not run_cmd(["uv", "run", "ruff", "check", "."]): # Example lint
        return False
    return True

def main():
    parser = argparse.ArgumentParser(description="Verify project health.")
    parser.add_argument("--scope", choices=["all", "frontend", "backend"], default="all")
    args = parser.parse_args()

    success = True
    if args.scope in ["all", "frontend"]:
        if not verify_frontend():
            success = False
    
    if args.scope in ["all", "backend"]:
        if not verify_backend():
            success = False

    if not success:
        sys.exit(1)
    print("VERIFICATION SUCCESSFUL")

if __name__ == "__main__":
    main()
