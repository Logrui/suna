from core.skills.base_skill import BaseSkill
from core.skills.registry import SkillRegistry
from core.skills.implementations.coding_skill import CodingSkill
from core.skills.implementations.research_skill import ResearchSkill

__all__ = ["BaseSkill", "SkillRegistry", "initialize_skills"]

_initialized = False

def initialize_skills():
    """Register all available skills (idempotent - safe to call multiple times)"""
    global _initialized
    if _initialized:
        return
    SkillRegistry.register(CodingSkill)
    SkillRegistry.register(ResearchSkill)
    _initialized = True
    
# Initialize on import
initialize_skills()
