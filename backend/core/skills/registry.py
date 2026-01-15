from typing import ClassVar, Optional
from core.skills.base_skill import BaseSkill
from core.utils.logger import logger


class SkillRegistry:
    """
    Registry for managing available Agent Skills.
    """
    _skills: ClassVar[dict[str, type[BaseSkill]]] = {}

    @classmethod
    def register(cls, skill_class: type[BaseSkill]) -> None:
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
            logger.error(f"Failed to register skill {skill_class.__name__}: {e}")

    @classmethod
    def get_skill(cls, name: str) -> Optional[BaseSkill]:
        """Get a specific skill instance by name."""
        skill_cls = cls._skills.get(name)
        if skill_cls:
            return skill_cls()
        return None

    @classmethod
    def get_all_skills(cls) -> list[BaseSkill]:
        """Get all registered skill instances."""
        skills = []
        for skill_cls in cls._skills.values():
            try:
                skills.append(skill_cls())
            except Exception as e:
                logger.warning(f"Failed to instantiate skill {skill_cls.__name__}: {e}")
        return skills

    @classmethod
    def available_skill_names(cls) -> list[str]:
        """Returns list of all registered skill names."""
        return list(cls._skills.keys())
