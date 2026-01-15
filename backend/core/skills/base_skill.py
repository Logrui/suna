from abc import ABC, abstractmethod


class BaseSkill(ABC):
    """
    Abstract base class representing a Skill.
    A Skill is a collection of:
    1. Required Tools (capabilities)
    2. Prompt Section (specialized knowledge/behavior)
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Unique identifier for the skill (e.g., 'coding', 'research')"""
        pass

    @property
    @abstractmethod
    def description(self) -> str:
        """Human-readable description of what this skill enables"""
        pass

    @property
    @abstractmethod
    def required_tools(self) -> list[str]:
        """List of tool keys that this skill requires to function"""
        pass

    @abstractmethod
    def get_system_prompt_section(self) -> str:
        """
        Returns the specific system prompt instructions for this skill.
        This will be injected into the dynamic system prompt.
        """
        pass
