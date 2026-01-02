from typing import Dict, Type, List, Optional, ClassVar
from core.skills.base_skill import BaseSkill
from core.utils.logger import logger

class SkillRegistry:
    """
    Registry for managing available Agent Skills.
    """
    _skills: ClassVar[Dict[str, Type[BaseSkill]]] = {}

    @classmethod
    def register(cls, skill_class: Type[BaseSkill]):
        """Register a new skill class."""
        try:
            # Attempt to get name from class attribute or instantiate if property
            name = getattr(skill_class, "name", None)
            if not isinstance(name, str):
                instance = skill_class()
                name = instance.name
            
            if not name:
                raise ValueError("Skill name is empty or invalid")
                
            cls._skills[name] = skill_class
            logger.info(f"Registered skill: {name}")
        except (TypeError, ValueError, AttributeError) as e:
            logger.error(f"Failed to register skill {skill_class}: {e}")

    @classmethod
    def get_skill(cls, name: str) -> Optional[BaseSkill]:
        """Get a specific skill instance by name"""
        skill_cls = cls._skills.get(name)
        if skill_cls:
            return skill_cls()
        return None

    @classmethod
    def get_all_skills(cls) -> List[BaseSkill]:
        """Get all registered skills"""
        return [cls.get_skill(name) for name in cls._skills.keys()]

    @classmethod
    def available_skill_names(cls) -> List[str]:
        return list(cls._skills.keys())
