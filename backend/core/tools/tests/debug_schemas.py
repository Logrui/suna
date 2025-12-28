
import json
import sys
import os

# Add backend to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../")))

from core.tools.web_search_tool import SandboxWebSearchTool
from core.tools.task_list_tool import TaskListTool
from core.tools.image_search_tool import SandboxImageSearchTool
from core.tools.expand_msg_tool import ExpandMessageTool
from core.tools.sb_image_edit_tool import SandboxImageEditTool

def check_schema(tool_cls, name):
    print(f"\n--- Checking Schema for {name} ---")
    # Hack to instantiate tools without full dependencies if possible, or just inspect decorator directly if accessible
    # But tools use decorators which register to instances.
    # We can inspect the class methods directly for 'tool_schemas' attribute
    
    found_issues = False
    
    for attr_name in dir(tool_cls):
        attr = getattr(tool_cls, attr_name)
        if hasattr(attr, 'tool_schemas'):
            schemas = attr.tool_schemas
            for schema_obj in schemas:
                schema = schema_obj.schema
                print(f"Method: {attr_name}")
                json_str = json.dumps(schema, indent=2)
                if "oneOf" in json_str:
                    print(f"❌ WARNING: 'oneOf' found in {attr_name}")
                    print(json_str)
                    found_issues = True
                elif "anyOf" in json_str:
                    print(f"❌ WARNING: 'anyOf' found in {attr_name}")
                    print(json_str)
                    found_issues = True
                else:
                    print(f"✅ Schema looks clean (no oneOf/anyOf)")
                    
    if not found_issues:
        print(f"✅✅ {name}: ALL CLEAR")
    else:
        print(f"❌❌ {name}: ISSUES FOUND")

def main():
    check_schema(SandboxWebSearchTool, "Web Search")
    check_schema(TaskListTool, "Task List")
    check_schema(SandboxImageSearchTool, "Image Search")
    check_schema(ExpandMessageTool, "Expand Message")
    check_schema(SandboxImageEditTool, "Image Edit")

if __name__ == "__main__":
    main()
