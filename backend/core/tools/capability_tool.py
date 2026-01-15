"""
Capability Request Tool

Allows the agent to request additional tool capabilities at runtime.
This enables lazy loading of tools - start with minimal set and expand as needed.
"""

from typing import Any
from core.agentpress.tool import Tool, ToolResult, tool_metadata, method_metadata, openapi_schema
from core.tools.tool_categories import ALL_CATEGORIES, get_tools_for_categories

@tool_metadata(
    display_name="Capability Manager",
    description="Request additional capabilities when needed",
    icon="Puzzle",
    color="bg-purple-100 dark:bg-purple-800/50"
)
class CapabilityTool(Tool):
    """Tool for requesting additional capabilities at runtime"""
    
    def __init__(self, **kwargs) -> None:
        super().__init__(**kwargs)
        self._loaded_categories: set[str] = {"core"}
    
    @method_metadata(
        display_name="Request Capability",
        description="Request additional tools/capabilities to be loaded"
    )
    @openapi_schema({
        "type": "function",
        "function": {
            "name": "request_capability",
            "description": """Request additional capabilities when you need tools that are not currently available.
            
Available capabilities:
- task_management: Task list and project management (create_tasks, update_tasks, view_tasks, etc.)
- files: File system operations (create_file, edit_file, delete_file, etc.)
- shell: Command line operations (execute_command, check_command_output, etc.)
- web_search: Web search and scraping (web_search, scrape_webpage)
- browser: Browser automation (browser_navigate_to, browser_act, browser_extract_content)
- images: Image viewing and generation (load_image, image_edit_or_generate)
- design: Professional design creation (designer_create_or_edit)
- presentations: Slide presentations (create_slide, list_slides, export_to_pptx, etc.)
- documents: Document creation (create_document, convert_to_pdf, etc.)
- knowledge_base: Knowledge base and semantic search (search_files, init_kb, etc.)
- agent_builder: Agent configuration and creation (update_agent, create_new_agent, etc.)
- network: Network and port exposure (expose_port)

Use this tool when:
1. You need to perform an action but don't have the required tool
2. The user asks for something that requires a specific capability
3. You want to expand your current toolset for a complex task""",
            "parameters": {
                "type": "object",
                "properties": {
                    "capability": {
                        "type": "string",
                        "description": "The capability category to request (e.g., 'files', 'browser', 'web_search')",
                        "enum": ["task_management", "files", "shell", "web_search", "browser", 
                                "images", "design", "presentations", "documents", 
                                "knowledge_base", "agent_builder", "network"]
                    },
                    "reason": {
                        "type": "string",
                        "description": "Brief explanation of why you need this capability"
                    }
                },
                "required": ["capability", "reason"]
            }
        }
    })
    def request_capability(self, capability: str, reason: str) -> ToolResult:
        """
        Request a capability to be loaded.
        
        Note: This tool signals the intent to use certain capabilities.
        The actual tool loading happens at the system level.
        """
        valid_capabilities = [cat.name for cat in ALL_CATEGORIES if cat.name != "core"]
        
        if capability not in valid_capabilities:
            return self.fail_response(
                f"Unknown capability: {capability}. Valid options: {', '.join(valid_capabilities)}"
            )
        
        if capability in self._loaded_categories:
            # Get tools in this category
            tools = get_tools_for_categories([capability])
            return self.success_response(
                f"Capability '{capability}' is already loaded. Available tools: {', '.join(tools)}"
            )
        
        # Mark as loaded (the actual loading is done by the runtime)
        self._loaded_categories.add(capability)
        
        # Get tools that will be available
        tools = get_tools_for_categories([capability])
        
        return self.success_response(
            f"Capability '{capability}' requested for: {reason}. "
            f"The following tools are now conceptually available: {', '.join(tools)}. "
            f"Note: In the current implementation, tools are pre-loaded based on intent detection. "
            f"If you need a tool that's not available, please ask the user to rephrase their request "
            f"with clearer intent, or proceed with the tools you have."
        )
    
    @method_metadata(
        display_name="List Available Capabilities",
        description="List all available capability categories"
    )
    @openapi_schema({
        "type": "function",
        "function": {
            "name": "list_capabilities",
            "description": "List all available capability categories and their descriptions",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    })
    def list_capabilities(self) -> ToolResult:
        """List all available capabilities"""
        lines = ["Available capabilities:\n"]
        for cat in ALL_CATEGORIES:
            if cat.name != "core":
                tools_preview = ", ".join(cat.tools[:3])
                if len(cat.tools) > 3:
                    tools_preview += f" (+{len(cat.tools) - 3} more)"
                lines.append(f"- **{cat.name}**: {cat.description}")
                lines.append(f"  Tools: {tools_preview}\n")
        
        return self.success_response("\n".join(lines))
