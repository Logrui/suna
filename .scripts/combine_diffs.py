import os

backend_diff = "backend_diff.txt"
frontend_diff = "frontend_diff.txt"
output_file = "MISSING_FILES.md"

def read_file_safe(path):
    if not os.path.exists(path):
        return "File not found."
    
    # Try UTF-16LE (PowerShell default)
    try:
        with open(path, "r", encoding="utf-16-le") as f:
            return f.read()
    except:
        pass
        
    # Try UTF-8
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except:
        pass
        
    # Try CP1252/Default
    try:
        with open(path, "r") as f:
            return f.read()
    except Exception as e:
        return f"Error reading file: {e}"

with open(output_file, "w", encoding="utf-8") as out:
    out.write("# Missing Files Report\n\n")
    
    out.write("## Backend Missing Files\n")
    out.write("(Files present in PRODUCTION but missing in local)\n\n")
    content = read_file_safe(backend_diff)
    out.write("```\n")
    out.write(content)
    out.write("\n```\n\n")
    
    out.write("## Frontend Missing Files\n")
    out.write("(Files present in PRODUCTION but missing in local)\n\n")
    content = read_file_safe(frontend_diff)
    out.write("```\n")
    out.write(content)
    out.write("\n```\n")

print("Done")
