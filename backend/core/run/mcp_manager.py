from typing import Optional
from core.agentpress.thread_manager import ThreadManager
from core.tools.mcp_tool_wrapper import MCPToolWrapper
from core.agentpress.tool import SchemaType
from core.utils.logger import logger
from core.utils.mcp_config_schema import get_config_value
from core.utils.mcp_helpers import resolve_qualified_name_from_config

class MCPManager:
    def __init__(self, thread_manager: ThreadManager, account_id: str):
        self.thread_manager = thread_manager
        self.account_id = account_id

    async def register_mcp_tools(self, agent_config: dict) -> Optional[MCPToolWrapper]:
        all_mcps = []

        if agent_config.get('configured_mcps'):
            all_mcps.extend(agent_config['configured_mcps'])

        if agent_config.get('custom_mcp'):
            for custom_mcp in agent_config['custom_mcp']:
                custom_type = get_config_value(custom_mcp, "custom_type", "sse")

                if custom_type == 'composio':
                    qualified_name = get_config_value(custom_mcp, "qualified_name")
                    if not qualified_name:
                        qualified_name = f"composio.{custom_mcp['name'].replace(' ', '_').lower()}"

                    mcp_config = {
                        'name': custom_mcp['name'],
                        'qualifiedName': qualified_name,
                        'config': custom_mcp.get('config', {}),
                        'enabledTools': get_config_value(custom_mcp, "enabled_tools", []),
                        'instructions': custom_mcp.get('instructions', ''),
                        'isCustom': True,
                        'customType': 'composio'
                    }
                    all_mcps.append(mcp_config)
                    continue

                # Use canonical qualifiedName: prefer saved value, generate from name+URL otherwise
                qualified_name = resolve_qualified_name_from_config(custom_mcp)

                mcp_config = {
                    'name': custom_mcp['name'],
                    'qualifiedName': qualified_name,
                    'config': custom_mcp['config'],
                    'enabledTools': get_config_value(custom_mcp, "enabled_tools", []),
                    'instructions': custom_mcp.get('instructions', ''),
                    'isCustom': True,
                    'customType': custom_type
                }
                all_mcps.append(mcp_config)
        
        if not all_mcps:
            return None
        
        mcp_wrapper_instance = MCPToolWrapper(mcp_configs=all_mcps)
        try:
            await mcp_wrapper_instance.initialize_and_register_tools()
            
            updated_schemas = mcp_wrapper_instance.get_schemas()
            for method_name, schema_list in updated_schemas.items():
                for schema in schema_list:
                    self.thread_manager.tool_registry.tools[method_name] = {
                        "instance": mcp_wrapper_instance,
                        "schema": schema
                    }
            
            logger.info(f"⚡ Registered {len(updated_schemas)} MCP tools (Redis cache enabled)")
            return mcp_wrapper_instance
        except Exception as e:
            logger.error(f"Failed to initialize MCP tools: {e}")
            return None
