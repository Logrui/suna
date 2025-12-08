import os
import shutil

backend_diff = "backend_diff.txt"
frontend_diff = "frontend_diff.txt"

SOURCE_BACKEND_BASE = r"D:\Homelab\suna-PRODUCTION\suna\backend"
TARGET_BACKEND_BASE = r"D:\Homelab\suna\backend"

SOURCE_FRONTEND_BASE = r"D:\Homelab\suna-PRODUCTION\suna\frontend"
TARGET_FRONTEND_BASE = r"D:\Homelab\suna\frontend"

def read_file_lines(path):
    if not os.path.exists(path):
        print(f"Diff file not found: {path}")
        return []
    
    content = ""
    # Try UTF-16LE
    try:
        with open(path, "r", encoding="utf-16-le") as f:
            content = f.read()
    except:
        # Try UTF-8
        try:
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
        except:
            # Try Default
            try:
                with open(path, "r") as f:
                    content = f.read()
            except Exception as e:
                print(f"Error reading {path}: {e}")
                return []
    
    return [line.strip() for line in content.splitlines() if line.strip()]

def copy_files(file_list, source_base, target_base):
    count = 0
    for rel_path in file_list:
        source_path = os.path.join(source_base, rel_path)
        target_path = os.path.join(target_base, rel_path)
        
        if not os.path.exists(source_path):
            print(f"Warning: Source file not found: {source_path}")
            continue
            
        # Create target directory if it doesn't exist
        os.makedirs(os.path.dirname(target_path), exist_ok=True)
        
        try:
            shutil.copy2(source_path, target_path)
            print(f"Copied: {rel_path}")
            count += 1
        except Exception as e:
            print(f"Error copying {rel_path}: {e}")
            
    return count

def main():
    print("--- Copying Backend Files ---")
    backend_files = read_file_lines(backend_diff)
    b_count = copy_files(backend_files, SOURCE_BACKEND_BASE, TARGET_BACKEND_BASE)
    print(f"Backend: Copied {b_count} files.")
    
    print("\n--- Copying Frontend Files ---")
    frontend_files = read_file_lines(frontend_diff)
    f_count = copy_files(frontend_files, SOURCE_FRONTEND_BASE, TARGET_FRONTEND_BASE)
    print(f"Frontend: Copied {f_count} files.")
    
    print(f"\nTotal copied: {b_count + f_count}")

if __name__ == "__main__":
    main()
