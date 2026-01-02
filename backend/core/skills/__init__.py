from core.skills.base_skill import BaseSkill
from core.skills.registry import SkillRegistry
from core.skills.implementations.coding_skill import CodingSkill
from core.skills.implementations.research_skill import ResearchSkill

def initialize_skills():
    """Register all available skills"""
    SkillRegistry.register(CodingSkill)
    SkillRegistry.register(ResearchSkill)
    
# Initialize on import
initialize_skills()
