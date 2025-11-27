
import re
from typing import Dict, Any, List, Optional
import json
import logging

# Mock logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class XMLToolParser:
    PARAMETER_START_PATTERN = re.compile(
        r'<parameter\s+name=["\']([^"\']+)["\']>',
        re.IGNORECASE
    )

    def _parse_parameter_value(self, value: str) -> Any:
        value = value.strip()
        if value.startswith(('{', '[')):
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                pass
        return value

    def _parse_invoke_block(self, invoke_content: str) -> Dict[str, Any]:
        parameters = {}
        
        current_pos = 0
        while current_pos < len(invoke_content):
            # Find the next parameter start
            param_start_match = self.PARAMETER_START_PATTERN.search(invoke_content, current_pos)
            if not param_start_match:
                break
            
            param_name = param_start_match.group(1)
            start_tag_end = param_start_match.end()
            
            # Find the matching closing tag using a stack
            depth = 1
            search_pos = start_tag_end
            content_end = -1
            
            while depth > 0 and search_pos < len(invoke_content):
                # Find next tag (open or close)
                next_tag_match = re.search(r'</?parameter\b[^>]*>', invoke_content[search_pos:], re.IGNORECASE)
                if not next_tag_match:
                    break
                
                tag = next_tag_match.group(0)
                if tag.lower().startswith('</parameter'):
                    depth -= 1
                    if depth == 0:
                        content_end = search_pos + next_tag_match.start()
                        current_pos = search_pos + next_tag_match.end()
                else:
                    if not tag.endswith('/>'):
                        depth += 1
                
                search_pos += next_tag_match.end()
            
            if content_end != -1:
                param_value = invoke_content[start_tag_end:content_end]
                param_value = param_value.strip()
                parsed_value = self._parse_parameter_value(param_value)
                parameters[param_name] = parsed_value
            else:
                print(f"Could not find closing tag for parameter '{param_name}'")
                break
            
        return parameters

def test_nested_parameters():
    parser = XMLToolParser()
    
    # Simulating the problematic XML output
    xml_content = """
    <parameter name="sections">
      <array>
        <object>
          <parameter name="title">Research & Setup</parameter>
          <parameter name="tasks">
            <array>
              <string>Task 1</string>
            </array>
          </parameter>
        </object>
      </array>
    </parameter>
    """
    
    print(f"Testing with XML content:\n{xml_content}")
    
    params = parser._parse_invoke_block(xml_content)
    
    print("\nParsed parameters:")
    print(json.dumps(params, indent=2))
    
    if "tasks" in params:
        print("\n❌ FAILURE: 'tasks' found as top-level parameter! (Parser failed to handle nesting)")
    elif "sections" in params and "tasks" in params["sections"]:
        print("\n✅ SUCCESS: 'tasks' correctly kept inside 'sections'")
    else:
        # Note: Since _parse_parameter_value returns string for XML content, 
        # we expect 'sections' to contain the inner XML string.
        print("\n✅ SUCCESS: 'tasks' NOT found as top-level parameter.")
        print("Sections content:", params.get("sections")[:100] + "...")

if __name__ == "__main__":
    test_nested_parameters()
