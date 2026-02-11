
    @staticmethod
    def _parse_tools_from_config(fresh_mcp_config: dict) -> dict:
        toolkit_tools = {}
        if not fresh_mcp_config:
            return toolkit_tools
            
        custom_mcps = fresh_mcp_config.get('custom_mcps') or fresh_mcp_config.get('custom_mcp', [])
        configured_mcps = fresh_mcp_config.get('configured_mcps', [])
        
        logger.info(f"🔍 [MCP-PROMPT-FALLBACK] Parsing config: {len(custom_mcps)} custom, {len(configured_mcps)} configured")
        
        for mcp in custom_mcps:
            mcp_name = mcp.get('name', 'unknown')
            toolkit_slug = mcp.get('toolkit_slug', '')
            enabled_tools = mcp.get('enabledTools', [])
            mcp_type = mcp.get('type') or mcp.get('customType', '')
            
            if enabled_tools:
                if mcp_type in ('sse', 'http', 'json'):
                    display_name = mcp_name.upper().replace(' ', '_')
                else:
                    display_name = toolkit_slug.upper() if toolkit_slug else mcp_name.upper().replace(' ', '_')
                
                if display_name not in toolkit_tools:
                    toolkit_tools[display_name] = []
                
                for tool in enabled_tools:
                    if tool not in toolkit_tools[display_name]:
                        toolkit_tools[display_name].append(tool)
        
        for mcp in configured_mcps:
            mcp_name = mcp.get('name', 'unknown')
            toolkit_slug = mcp.get('toolkit_slug', '')
            enabled_tools = mcp.get('enabledTools', [])
            qualified_name = mcp.get('qualifiedName', '')
            
            if not toolkit_slug and qualified_name:
                toolkit_slug = qualified_name.split('.')[-1]
            
            if enabled_tools:
                display_name = toolkit_slug.upper() if toolkit_slug else mcp_name.upper().replace(' ', '_')
                
                if display_name not in toolkit_tools:
                    toolkit_tools[display_name] = []
                
                for tool in enabled_tools:
                    if tool not in toolkit_tools[display_name]:
                        toolkit_tools[display_name].append(tool)
                        
        return toolkit_tools
