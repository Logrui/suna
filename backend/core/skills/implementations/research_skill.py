from core.skills.base_skill import BaseSkill


class ResearchSkill(BaseSkill):
    @property
    def name(self) -> str:
        return "research"

    @property
    def description(self) -> str:
        return "Internet research capabilities including web search and browser automation."

    @property
    def required_tools(self) -> list[str]:
        return [
            'web_search_tool',
            'browser_tool',
            'image_search_tool'
        ]

    def get_system_prompt_section(self) -> str:
        return """### ONLINE RESEARCH PROTOCOL
- **Source Diversity**: Always verify information across multiple sources.
- **Citations**: Provide URLs for all factual claims.
- **Date Awareness**: Check the publication date of information (using current date as reference).
- **Depth**: If a web search returns superficial results, use the `browser_tool` to visit specific promising pages for deep extraction."""
