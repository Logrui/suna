from core.skills.base_skill import BaseSkill


class CodingSkill(BaseSkill):
    @property
    def name(self) -> str:
        return "coding"

    @property
    def description(self) -> str:
        return "Software engineering capabilities including file management, shell execution, and code analysis."

    @property
    def required_tools(self) -> list[str]:
        return [
            'sb_files_tool',
            'sb_shell_tool', 
            'sb_upload_file_tool',
            'sb_expose_tool'  # Often needed for viewing running apps
        ]

    def get_system_prompt_section(self) -> str:
        return """
## SOFTWARE ENGINEERING STANDARDS
- Write modular, documentation-rich code.
- Always use type hints (typing module).
- Follow PEP 8 style guidelines.
- Handle exceptions broadly but report specific errors.

## SUNA SYSTEM EXTENSION
If asked to create a new **Agent Skill** or capability:
1. Create a new file in `backend/core/skills/implementations/`.
2. Define a class inheriting from `backend.core.skills.base_skill.BaseSkill`.
3. Implement `name`, `required_tools`, and `get_system_prompt_section`.
4. Register the new skill in `backend/core/skills/__init__.py`.
"""
