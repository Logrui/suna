"""
Tool Categories for Lazy Injection System

This module defines tool categories and provides functions to determine
which tools should be injected based on user intent.

Token Savings Target: 74 tools (~21k tokens) -> ~5-10 tools (~3k tokens)
"""

from typing import List, Set, Dict
from dataclasses import dataclass

@dataclass
class ToolCategory:
    name: str
    description: str
    tools: List[str]
    keywords: List[str]  # Keywords that trigger this category

# =============================================================================
# TOOL CATEGORIES DEFINITION
# =============================================================================

CORE_TOOLS = ToolCategory(
    name="core",
    description="Essential tools always available",
    tools=[
        "ask",           # Ask user for clarification
        "complete",      # Mark task as complete
        "expand_message", # Expand truncated messages
    ],
    keywords=[]  # Always included, no keywords needed
)

TASK_MANAGEMENT_TOOLS = ToolCategory(
    name="task_management",
    description="Task list and project management",
    tools=[
        "create_tasks",
        "delete_tasks",
        "update_tasks",
        "view_tasks",
        "clear_all",
    ],
    keywords=["task", "todo", "lista", "tarefa", "projeto", "plan", "organiz"]
)

FILE_TOOLS = ToolCategory(
    name="files",
    description="File system operations",
    tools=[
        "create_file",
        "delete_file",
        "edit_file",
        "full_file_rewrite",
        "str_replace",
        "upload_file",
    ],
    keywords=["file", "arquivo", "create", "criar", "edit", "editar", "write", "escrever", "code", "codigo", "script", "save", "salvar", "python", "javascript", "html", "css"]
)

SHELL_TOOLS = ToolCategory(
    name="shell",
    description="Command line operations",
    tools=[
        "execute_command",
        "check_command_output",
        "list_commands",
        "terminate_command",
    ],
    keywords=["run", "execute", "command", "comando", "terminal", "shell", "bash", "install", "instalar", "pip", "npm", "apt", "git", "docker"]
)

WEB_SEARCH_TOOLS = ToolCategory(
    name="web_search",
    description="Web search and scraping",
    tools=[
        "web_search",
        "scrape_webpage",
    ],
    keywords=["search", "buscar", "pesquisar", "pesquise", "google", "find", "encontrar", "web", "internet", "site", "url", "link", "news", "noticia", "informacao", "information"]
)

BROWSER_TOOLS = ToolCategory(
    name="browser",
    description="Browser automation",
    tools=[
        "browser_navigate_to",
        "browser_act",
        "browser_extract_content",
        "browser_screenshot",
    ],
    keywords=["browser", "navegador", "click", "clicar", "navigate", "navegar", "page", "pagina", "website", "login", "form", "formulario", "screenshot", "automat"]
)

IMAGE_TOOLS = ToolCategory(
    name="images",
    description="Image viewing and generation",
    tools=[
        "load_image",
        "clear_images_from_context",
        "image_edit_or_generate",
    ],
    keywords=["image", "imagem", "photo", "foto", "picture", "visual", "see", "ver", "look", "olhar", "generate", "gerar", "draw", "desenhar", "png", "jpg", "jpeg"]
)

DESIGN_TOOLS = ToolCategory(
    name="design",
    description="Professional design creation",
    tools=[
        "designer_create_or_edit",
    ],
    keywords=["design", "poster", "banner", "ad", "anuncio", "flyer", "marketing", "social media", "instagram", "facebook", "linkedin"]
)

PRESENTATION_TOOLS = ToolCategory(
    name="presentations",
    description="Slide presentations",
    tools=[
        "create_slide",
        "delete_slide",
        "delete_presentation",
        "export_to_pdf",
        "export_to_pptx",
        "list_presentations",
        "list_slides",
        "list_templates",
        "load_template_design",
        "present_presentation",
        "validate_slide",
    ],
    keywords=["slide", "presentation", "apresentacao", "apresente", "apresentacao", "powerpoint", "pptx", "slides"]
)

DOCUMENT_TOOLS = ToolCategory(
    name="documents",
    description="Document creation and editing",
    tools=[
        "create_document",
        "delete_document",
        "read_document",
        "list_documents",
        "convert_to_pdf",
        "get_format_guide",
    ],
    keywords=["document", "documento", "doc", "pdf", "word", "report", "relatorio", "write", "escrever", "docx"]
)

KNOWLEDGE_BASE_TOOLS = ToolCategory(
    name="knowledge_base",
    description="Knowledge base and semantic search",
    tools=[
        "init_kb",
        "search_files",
        "ls_kb",
        "cleanup_kb",
        "global_kb_create_folder",
        "global_kb_delete_item",
        "global_kb_enable_item",
        "global_kb_list_contents",
        "global_kb_sync",
        "global_kb_upload_file",
    ],
    keywords=["knowledge", "conhecimento", "kb", "search files", "semantic", "find in", "procurar em", "base de conhecimento"]
)

AGENT_BUILDER_TOOLS = ToolCategory(
    name="agent_builder",
    description="Agent configuration and creation",
    tools=[
        "get_current_agent_config",
        "update_agent",
        "create_new_agent",
        "discover_user_mcp_servers",
        "get_app_details",
        "search_mcp_servers",
        "configure_profile_for_agent",
        "create_credential_profile",
        "delete_credential_profile",
        "get_credential_profiles",
        "create_event_trigger",
        "create_scheduled_trigger",
        "delete_scheduled_trigger",
        "get_scheduled_triggers",
        "list_app_event_triggers",
        "list_event_trigger_apps",
        "toggle_scheduled_trigger",
    ],
    keywords=["agent", "agente", "create agent", "criar agente", "configure", "configurar", "mcp", "trigger", "schedule", "agendar", "credential", "automation"]
)

NETWORK_TOOLS = ToolCategory(
    name="network",
    description="Network and port exposure",
    tools=[
        "expose_port",
    ],
    keywords=["port", "porta", "expose", "expor", "server", "servidor", "localhost", "network", "rede", "http", "api"]
)

# =============================================================================
# ALL CATEGORIES
# =============================================================================

ALL_CATEGORIES: List[ToolCategory] = [
    CORE_TOOLS,
    TASK_MANAGEMENT_TOOLS,
    FILE_TOOLS,
    SHELL_TOOLS,
    WEB_SEARCH_TOOLS,
    BROWSER_TOOLS,
    IMAGE_TOOLS,
    DESIGN_TOOLS,
    PRESENTATION_TOOLS,
    DOCUMENT_TOOLS,
    KNOWLEDGE_BASE_TOOLS,
    AGENT_BUILDER_TOOLS,
    NETWORK_TOOLS,
]

# Quick lookup: tool_name -> category_name
TOOL_TO_CATEGORY: Dict[str, str] = {}
for cat in ALL_CATEGORIES:
    for tool in cat.tools:
        TOOL_TO_CATEGORY[tool] = cat.name

# =============================================================================
# FUNCTIONS
# =============================================================================

def get_core_tools() -> List[str]:
    """Returns tools that are ALWAYS included"""
    return CORE_TOOLS.tools.copy()

def get_tools_for_categories(category_names: List[str]) -> List[str]:
    """Returns all tools for given category names"""
    tools = set(get_core_tools())
    for cat in ALL_CATEGORIES:
        if cat.name in category_names:
            tools.update(cat.tools)
    return list(tools)

def get_all_keywords() -> Dict[str, List[str]]:
    """Returns mapping of category -> keywords"""
    return {cat.name: cat.keywords for cat in ALL_CATEGORIES if cat.keywords}

def get_category_for_tool(tool_name: str) -> str:
    """Returns category name for a tool"""
    return TOOL_TO_CATEGORY.get(tool_name, "unknown")

def get_available_capabilities_description() -> str:
    """Returns a description of available capabilities for the system prompt"""
    lines = []
    for cat in ALL_CATEGORIES:
        if cat.name != "core":
            lines.append(f"- {cat.name}: {cat.description}")
    return "\n".join(lines)
