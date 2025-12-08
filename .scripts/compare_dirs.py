import os
import sys

def get_relative_files(base_path):
    files_set = set()
    for root, _, files in os.walk(base_path):
        if 'node_modules' in root or '.venv' in root or '__pycache__' in root or '.git' in root or '.next' in root:
            continue
        for file in files:
            if file.endswith('.pyc') or file == '.DS_Store':
                continue
            full_path = os.path.join(root, file)
            rel_path = os.path.relpath(full_path, base_path)
            files_set.add(rel_path)
    return files_set

def main():
    if len(sys.argv) != 3:
        print("Usage: python compare_files.py <source_dir> <target_dir>")
        sys.exit(1)

    source_dir = sys.argv[1]
    target_dir = sys.argv[2]

    if not os.path.exists(source_dir):
        print(f"Source dir {source_dir} does not exist")
        sys.exit(1)
    if not os.path.exists(target_dir):
        print(f"Target dir {target_dir} does not exist")
        sys.exit(1)

    source_files = get_relative_files(source_dir)
    target_files = get_relative_files(target_dir)

    missing_files = sorted(list(source_files - target_files))

    print(f"--- Missing Files ({len(missing_files)}) ---")
    for f in missing_files:
        print(f)

if __name__ == "__main__":
    main()
