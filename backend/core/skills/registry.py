from typing import Dict, Type, List, Optional
from core.skills.base_skill import BaseSkill
from core.utils.logger import logger

class SkillRegistry:
    """
    Registry for managing available Agent Skills.
    """
    _instance = None
    _skills: Dict[str, Type[BaseSkill]] = {}

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(SkillRegistry, cls).__new__(cls)
        return cls._instance

    @classmethod
    def register(cls, skill_class: Type[BaseSkill]):
        """Register a new skill class"""
        try:
            # Instantiate to validate abstract methods implemented
            # Note: We rely on the class having a no-arg constructor or handling it here
            # Ideally we register the class and instantiate on demand, or expect instances.
            # For simplicity, let's assume stateless skills that can be instantiated cheaply
            # or we just inspect the class properties if they are static.
            # But BaseSkill defined them as properties. Let's instantiate a temporary one
            # to get the name, or change BaseSkill to use class attributes.
            # For now, let's assume we instantiaite it later.
            # Wait, to register by name we need to know the name. 
            # Let's verify we can get the name without full instantiation or instantiate once.
            
            # Simple approach: Instantiate singleton
            instance = skill_class()
            cls._skills[instance.name] = skill_class
            logger.info(f"Registered skill: {instance.name}")
        except Exception as e:
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
