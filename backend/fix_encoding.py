import os

file_path = r'd:\Homelab\suna\backend\core\ai_models\aws_registry.py'

try:
    # Try reading as UTF-16
    with open(file_path, 'r', encoding='utf-16') as f:
        content = f.read()
    
    # Write back as UTF-8
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("Successfully converted to UTF-8")
except Exception as e:
    print(f"Error converting: {e}")
    # Fallback: try reading as binary and replacing nulls if it's not valid utf-16
    try:
        with open(file_path, 'rb') as f:
            content_bytes = f.read()
        
        # If it has null bytes but isn't valid utf-16, it might be weird. 
        # But let's assume the first attempt works if it's indeed utf-16.
        print("Binary read length:", len(content_bytes))
    except Exception as e2:
        print(f"Error reading binary: {e2}")
