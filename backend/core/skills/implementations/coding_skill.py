from typing import List
from core.skills.base_skill import BaseSkill

class CodingSkill(BaseSkill):
    @property
    def name(self) -> str:
        return "coding"

    @property
    def description(self) -> str:
        return "Software engineering capabilities including file management, shell execution, and code analysis."

    @property
    def required_tools(self) -> List[str]:
        return [
            'sb_files_tool',
            'sb_shell_tool', 
            'sb_upload_file_tool',
            'sb_expose_tool' # Often needed for viewing running apps
        ]

    def get_system_prompt_section(self) -> str:
        return """### SOFTWARE ENGINEERING STANDARDS
- **Code Quality**: Always write clean, modular, and properly typed code.
- **Path Handling**: Use relative paths from `/workspace`.
- **Validation**: Verify your changes using available tools (e.g., run the script, check syntax). (e.g., `python -m py_compile script.py`).
- **Safety**: Do not delete files without explicit confirmation unless you created them."""
