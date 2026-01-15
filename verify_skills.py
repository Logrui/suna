
import asyncio
import os
import sys


from unittest.mock import MagicMock

# Mock logger dependencies before import
sys.modules["structlog"] = MagicMock()
sys.modules["core.utils"] = MagicMock()
sys.modules["core.utils.logger"] = MagicMock()


sys.path.append(os.path.abspath("backend"))

from core.skills import initialize_skills
from core.skills.registry import SkillRegistry
from core.prompts.dynamic_prompt import DynamicPromptBuilder

def verify():
    print("--- Verifying Agent Skills Architecture ---\n")
    
    # 1. Initialize
    initialize_skills()
    print(f"Available Skills: {SkillRegistry.available_skill_names()}")
    
    # 2. Test Coding Skill
    print("\n[Testing 'coding' skill]")
    coding_skill = SkillRegistry.get_skill("coding")
    if coding_skill:
        print(f"Name: {coding_skill.name}")
        print(f"Required Tools: {coding_skill.required_tools}")
        
        # Simulate Agent Config
        active_skills = [coding_skill]
        # Simulate tools enabled by the skill + some manual ones
        authorized_tools = [*coding_skill.required_tools, 'browser_tool']
        
        builder = DynamicPromptBuilder(authorized_tools, skills=active_skills)
        prompt = builder.build()
        
        # Checks
        has_prompt_section = "SOFTWARE ENGINEERING STANDARDS" in prompt
        has_tool_instruction = "sb_files_tool" in coding_skill.required_tools
        
        print(f"Prompt contains skill section: {'✅' if has_prompt_section else '❌'}")
        print(f"Tools list correct: {'✅' if has_tool_instruction else '❌'}")
    else:
        print("❌ Failed to load coding skill")

    # 3. Test Research Skill
    print("\n[Testing 'research' skill]")
    research_skill = SkillRegistry.get_skill("research")
    if research_skill:
        print(f"Name: {research_skill.name}")
        print(f"Required Tools: {research_skill.required_tools}")
    else:
        print("❌ Failed to load research skill")

if __name__ == "__main__":
    verify()
