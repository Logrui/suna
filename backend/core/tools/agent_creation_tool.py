import json
from typing import Optional, Dict, Any, List
from uuid import uuid4
from core.agentpress.tool import Tool, ToolResult, openapi_schema, tool_metadata
from core.agentpress.thread_manager import ThreadManager
from core.utils.logger import logger
from core.utils.core_tools_helper import ensure_core_tools_enabled
from core.utils.config import config

@tool_metadata(
    display_name="Agent Builder",
    description="Create and configure new AI agents with custom capabilities",
    icon="Bot",
    color="bg-purple-100 dark:bg-purple-800/50",
    weight=190,
    visible=True,
)
class AgentCreationTool(Tool):
    def __init__(self, thread_manager: ThreadManager, db_connection, account_id: str):
        super().__init__()
        self.thread_manager = thread_manager
        self.db = db_connection
        self.account_id = account_id

    async def _get_current_account_id(self) -> str:
        """Get account_id (already provided in constructor)."""
        if not self.account_id:
            raise ValueError("No account_id available")
        return self.account_id

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "create_new_agent",
            "description": "Create a completely new AI agent with custom configuration. CRITICAL: This tool requires explicit user permission before creating any agent. Always ask the user for confirmation first using the 'ask' tool, providing details about the agent you plan to create. Only proceed after the user explicitly approves. Use this when users want to create specialized agents for specific tasks or domains.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "The name of the new agent. Should be descriptive and indicate the agent's purpose (e.g., 'Research Assistant', 'Code Reviewer', 'Marketing Manager')."
                    },
                    "system_prompt": {
                        "type": "string",
                        "description": "Detailed system prompt that defines the agent's behavior, expertise, and approach. Should include specific instructions, personality, and domain expertise. Use imperative verbs and include 'Act as [role]' statement."
                    },
                    "icon_name": {
                        "type": "string",
                        "description": "Icon name from the available list. Choose from popular options: bot, brain, sparkles, zap, rocket, briefcase, code, database, globe, heart, lightbulb, message-circle, shield, star, user, cpu, terminal, settings, wand-2, layers, chart-bar, folder, search, mail, phone, camera, music, video, image, file-text, bookmark, calendar, clock, map, users, trending-up, trending-down, activity, pie-chart, bar-chart, line-chart, target, award, flag, tag, paperclip, link, external-link, download, upload, refresh, power, wifi, bluetooth, battery, volume-2, mic, headphones, monitor, smartphone, tablet, laptop, server, hard-drive, cloud, package, truck, shopping-cart, credit-card, dollar-sign, percent, calculator, scissors, pen-tool, edit-3, trash-2, archive, eye, eye-off, lock, unlock, key, fingerprint, shield-check, alert-triangle, alert-circle, info, help-circle, question-mark, plus, minus, x, check, arrow-right, arrow-left, arrow-up, arrow-down, chevron-right, chevron-left, chevron-up, chevron-down, play, pause, stop, skip-forward, skip-back, volume-x, maximize, minimize, copy, move, rotate-cw, zoom-in, zoom-out"
                    },
                    "icon_color": {
                        "type": "string",
                        "description": "Hex color code for the icon (e.g., '#000000', '#FFFFFF', '#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#F97316')"
                    },
                    "icon_background": {
                        "type": "string",
                        "description": "Hex color code for the icon background (e.g., '#F3F4F6', '#E5E7EB', '#DBEAFE', '#D1FAE5', '#FEF3C7', '#FEE2E2', '#EDE9FE', '#FED7AA')"
                    },
                    "agentpress_tools": {
                        "type": "object",
                        "description": "Configuration for AgentPress tools. Each key is a tool name, value is boolean for enabled/disabled. Available tools: sb_shell_tool, sb_files_tool, web_search_tool, browser_tool, sb_vision_tool, etc.",
                        "additionalProperties": {
                            "type": "boolean"
                        }
                    },
                    "configured_mcps": {
                        "type": "array",
                        "description": "List of configured MCP servers for external integrations (e.g., Gmail, Slack, GitHub). Leave empty if none needed initially.",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string"},
                                "qualifiedName": {"type": "string"},
                                "config": {"type": "object"},
                                "enabledTools": {
                                    "type": "array",
                                    "items": {"type": "string"}
                                }
                            }
                        },
                        "default": []
                    },
                    "is_default": {
                        "type": "boolean",
                        "description": "Whether this agent should become the user's default agent. Only set to true if explicitly requested by the user.",
                        "default": False
                    }
                },
                "required": ["name", "system_prompt", "icon_name", "icon_color", "icon_background"]
            }
        }
    })
    async def create_new_agent(
        self,
        name: str,
        system_prompt: str,
        icon_name: str,
        icon_color: str,
        icon_background: str,
        agentpress_tools: Optional[Dict[str, bool]] = None,
        configured_mcps: Optional[List[Dict[str, Any]]] = None,
        is_default: bool = False
    ) -> ToolResult:
        try:
            account_id = await self._get_current_account_id()
            client = await self.db.get_client()
            
            # Check agent limit
            from core.core_utils import check_agent_count_limit
            limit_check = await check_agent_count_limit(client, account_id)
            
            if not limit_check["can_create"]:
                return self.fail_response(
                    f"Maximum of {limit_check['limit']} agents allowed for your plan. "
                    f"You have {limit_check['current_count']} agents."
                )
            
            # If setting as default, unset other defaults first
            if is_default:
                await client.table("agents").update({"is_default": False}).eq("account_id", account_id).eq("is_default", True).execute()
            
            # Create the agent
            insert_data = {
                "account_id": account_id,
                "name": name,
                "icon_name": icon_name or "bot",
                "icon_color": icon_color or "#000000",
                "icon_background": icon_background or "#F3F4F6",
                "is_default": is_default,
                "version_count": 1
            }
            
            new_agent = await client.table("agents").insert(insert_data).execute()
            
            if not new_agent.data:
                return self.fail_response("Failed to create agent in database")
            
            agent = new_agent.data[0]
            agent_id = agent["agent_id"]
            
            # Create initial version with config
            try:
                from core.versioning.version_service import get_version_service
                from core.config_helper import _get_default_agentpress_tools
                from core.ai_models import model_manager
                
                version_service = await get_version_service()
                
                # Use provided tools or defaults
                tools_config = agentpress_tools if agentpress_tools else _get_default_agentpress_tools()
                tools_config = ensure_core_tools_enabled(tools_config)
                
                # Get default model
                default_model = await model_manager.get_default_model_for_user(client, account_id)
                
                version = await version_service.create_version(
                    agent_id=agent_id,
                    user_id=account_id,
                    system_prompt=system_prompt,
                    model=default_model,
                    configured_mcps=configured_mcps or [],
                    custom_mcps=[],
                    agentpress_tools=tools_config,
                    version_name="v1",
                    change_description="Initial version"
                )
                
                # Update agent with version info
                await client.table("agents").update({
                    "current_version_id": version.version_id,
                    "version_count": 1
                }).eq("agent_id", agent_id).execute()
                
                # Invalidate cache
                try:
                    from core.utils.cache import Cache
                    await Cache.invalidate(f"agent_count_limit:{account_id}")
                except Exception as e:
                    logger.warning(f"Cache invalidation failed: {e}")
                
                logger.info(f"Created new agent {agent_id} with name {name} for account {account_id}")
                
                return self.success_response({
                    "message": f"Successfully created agent {name}",
                    "agent_id": agent_id,
                    "name": name,
                    "icon_name": icon_name,
                    "icon_color": icon_color,
                    "icon_background": icon_background,
                    "is_default": is_default,
                    "version_id": version.version_id,
                    "tools_enabled": [k for k, v in tools_config.items() if v]
                })
                
            except Exception as e:
                # Cleanup: delete the agent if version creation failed
                logger.error(f"Failed to create version for agent {agent_id}: {e!r}")
                await client.table("agents").delete().eq("agent_id", agent_id).execute()
                return self.fail_response(f"Failed to create agent version: {e!s}")
                
        except Exception as e:
            logger.error(f"Error creating agent: {e}")
            return self.fail_response(f"Failed to create agent: {str(e)}")
