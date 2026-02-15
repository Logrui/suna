import time
import asyncio
import traceback
from typing import Dict, List, Optional, Any
from dataclasses import dataclass

from core.utils.logger import logger
from core.jit.mcp_registry import get_toolkit_tools
from core.jit.result_types import ActivationResult, ActivationSuccess, ActivationError, ActivationErrorType
from core.utils.ssrf import is_safe_url

from mcp import ClientSession
from mcp.client.sse import sse_client
from mcp.client.streamable_http import streamablehttp_client

@dataclass
class MCPToolInfo:
    tool_name: str
    toolkit_slug: str
    mcp_config: Dict[str, Any]
    loaded: bool = False
    schema: Optional[Dict[str, Any]] = None
    load_time_ms: Optional[float] = None

class MCPJITLoader:

    def __init__(self, agent_config: Dict[str, Any]):
        self.agent_config = agent_config
        self.tool_map: Dict[str, MCPToolInfo] = {}
        self.schema_cache: Dict[str, Dict[str, Any]] = {}
        self._initialized = False
        self._tool_map_built = False
    
    async def rebuild_tool_map(self, fresh_config: Dict[str, Any]) -> None:
        logger.info(f"🔍 [MCP-REBUILD-DEBUG] Starting rebuild with fresh config")
        
        custom_mcp = fresh_config.get('custom_mcp', [])
        configured_mcps = fresh_config.get('configured_mcps', [])
        
        logger.info(f"🔍 [MCP-REBUILD-DEBUG] Fresh config keys: {list(fresh_config.keys())}")
        logger.info(f"🔍 [MCP-REBUILD-DEBUG] custom_mcp: {len(custom_mcp)}")
        logger.info(f"🔍 [MCP-REBUILD-DEBUG] configured_mcps: {len(configured_mcps)}")
        
        if custom_mcp:
            for i, mcp in enumerate(custom_mcp):
                logger.info(f"🔍 [MCP-REBUILD-DEBUG] Fresh custom_mcp[{i}]: name={mcp.get('name')}, toolkit_slug={mcp.get('toolkit_slug')}, type={mcp.get('type')}")
        else:
            logger.warning(f"🔍 [MCP-REBUILD-DEBUG] ❌ NO CUSTOM MCPs FOUND IN FRESH CONFIG!")
        
        for i, mcp in enumerate(configured_mcps):
            logger.info(f"🔍 [MCP-REBUILD-DEBUG] Fresh configured_mcp[{i}]: name={mcp.get('name')}, toolkit_slug={mcp.get('toolkit_slug')}")
        
        old_tools = list(self.tool_map.keys())
        logger.info(f"🔍 [MCP-REBUILD-DEBUG] Old tool map had {len(old_tools)} tools: {old_tools[:10]}{'...' if len(old_tools) > 10 else ''}")
        
        old_agent_config = dict(self.agent_config)
        
        normalized_fresh_config = {
            'custom_mcp': custom_mcp,
            'configured_mcps': configured_mcps,
            'account_id': fresh_config.get('account_id', old_agent_config.get('account_id'))
        }
        
        logger.info(f"🔍 [MCP-REBUILD-DEBUG] Normalized config: custom_mcp={len(normalized_fresh_config['custom_mcp'])}, configured_mcps={len(normalized_fresh_config['configured_mcps'])}")
        
        self.agent_config.update(normalized_fresh_config)
        logger.info(f"🔍 [MCP-REBUILD-DEBUG] Updated agent config - old custom: {len(old_agent_config.get('custom_mcp', []))}, new custom: {len(self.agent_config.get('custom_mcp', []))}")
        
        # Clear existing tool map
        self.tool_map.clear()
        self._tool_map_built = False
        logger.info(f"🔍 [MCP-REBUILD-DEBUG] Cleared tool map and reset build flag")
        
        # Rebuild with fresh config
        logger.info(f"🔍 [MCP-REBUILD-DEBUG] Starting build_tool_map with force_rebuild=True")
        await self.build_tool_map(cache_only=False, force_rebuild=True)
        
        new_tools = list(self.tool_map.keys())
        logger.info(f"🔍 [MCP-REBUILD-DEBUG] ✅ Rebuilt tool map: {len(new_tools)} tools loaded")
        logger.info(f"🔍 [MCP-REBUILD-DEBUG] New tools: {new_tools[:10]}{'...' if len(new_tools) > 10 else ''}")
        
        # Log toolkit breakdown
        toolkit_breakdown = {}
        for tool_name, tool_info in self.tool_map.items():
            toolkit = tool_info.toolkit_slug
            if toolkit not in toolkit_breakdown:
                toolkit_breakdown[toolkit] = []
            toolkit_breakdown[toolkit].append(tool_name)
        
        for toolkit, tools in toolkit_breakdown.items():
            logger.info(f"🔍 [MCP-REBUILD-DEBUG] Toolkit '{toolkit}': {len(tools)} tools")

    async def build_tool_map(self, cache_only: bool = False, force_rebuild: bool = False) -> None:
        if self._tool_map_built and not force_rebuild and cache_only:
            logger.debug("⚡ [MCP JIT] Tool map already built, skipping")
            return
        
        if not cache_only and self._tool_map_built and len(self.tool_map) == 0:
            logger.info("⚡ [MCP JIT] Rebuilding tool map with full discovery (previous build was cache-only with no results)")
        
        start_time = time.time()
        
        # Check for both singular and plural forms of the key
        custom_mcps = self.agent_config.get("custom_mcps") or self.agent_config.get("custom_mcp", [])
        configured_mcps = self.agent_config.get("configured_mcps", [])
        
        mode_str = "cache-only" if cache_only else "full discovery"
        logger.debug(f"⚡ [MCP JIT] Processing {len(custom_mcps)} custom MCPs and {len(configured_mcps)} configured MCPs ({mode_str})")
        
        for i, mcp in enumerate(custom_mcps):
            logger.debug(f"⚡ [MCP JIT] custom_mcp[{i}]: name={mcp.get('name')}, toolkit={mcp.get('toolkit_slug') or mcp.get('config', {}).get('toolkit_name')}")
        
        for i, mcp in enumerate(configured_mcps):
            logger.debug(f"⚡ [MCP JIT] configured_mcp[{i}]: name={mcp.get('name')}, toolkit={mcp.get('toolkit_slug')}")
        
        process_tasks = []
        for mcp_config in custom_mcps:
            process_tasks.append(self._process_mcp_config(mcp_config, "custom", cache_only=cache_only))
        
        for mcp_config in configured_mcps:
            process_tasks.append(self._process_mcp_config(mcp_config, "configured", cache_only=cache_only))
        
        if process_tasks:
            await asyncio.gather(*process_tasks, return_exceptions=True)
        
        elapsed_ms = (time.time() - start_time) * 1000
        
        self._tool_map_built = True
        logger.info(f"✅ [MCP JIT] Build complete: {len(self.tool_map)} tools from {len(custom_mcps + configured_mcps)} servers in {elapsed_ms:.1f}ms ({mode_str})")
        
        if self.tool_map:
            logger.info(f"📊 [MCP JIT] Discovery Summary:")
            toolkit_counts = {}
            for info in self.tool_map.values():
                toolkit_counts[info.toolkit_slug] = toolkit_counts.get(info.toolkit_slug, 0) + 1
            for tk, count in toolkit_counts.items():
                logger.info(f"   - {tk}: {count} tools")
        else:
            logger.warning("⚠️ [MCP JIT] Build complete but NO tools were mapped. Check server availability and configuration.")
        
        toolkit_counts = {}
        for tool_info in self.tool_map.values():
            toolkit = tool_info.toolkit_slug
            toolkit_counts[toolkit] = toolkit_counts.get(toolkit, 0) + 1
        
        for toolkit, count in toolkit_counts.items():
            logger.debug(f"⚡ [MCP JIT] {toolkit}: {count} tools")
    
    async def _process_mcp_config(self, mcp_config: Dict[str, Any], config_type: str, cache_only: bool = False) -> None:
        custom_type = mcp_config.get("customType", mcp_config.get("type", "")).lower()
        server_name = mcp_config.get('name', 'unnamed')
        
        logger.info(f"🔍 [MCP-PROCESS-DEBUG] Processing {config_type} MCP config:")
        logger.info(f"🔍 [MCP-PROCESS-DEBUG]   server_name: {server_name}")
        logger.info(f"🔍 [MCP-PROCESS-DEBUG]   custom_type: {custom_type}")
        logger.info(f"🔍 [MCP-PROCESS-DEBUG]   cache_only: {cache_only}")
        
        if custom_type in ("sse", "http", "json"):
            logger.info(f"🔍 [MCP-PROCESS-DEBUG] Processing as custom MCP (type: {custom_type})")
            await self._process_custom_mcp_config_internal(mcp_config, cache_only)
            return
        
        toolkit_slug = self._extract_toolkit_slug(mcp_config)
        logger.info(f"🔍 [MCP-PROCESS-DEBUG]   extracted toolkit_slug: {toolkit_slug}")
        
        if not toolkit_slug:
            logger.warning(f"🔍 [MCP-PROCESS-DEBUG] ❌ No toolkit_slug found in {config_type} MCP config: {mcp_config}")
            return

        enabled_tools = mcp_config.get('enabledTools', [])
        logger.info(f"🔍 [MCP-PROCESS-DEBUG] enabledTools from config: {len(enabled_tools)} tools")
        
        if enabled_tools:
            logger.info(f"🔍 [MCP-PROCESS-DEBUG] ✅ Using enabledTools DIRECTLY from config (bypassing registry cache)")
            logger.info(f"🔍 [MCP-PROCESS-DEBUG] {toolkit_slug}: {len(enabled_tools)} enabled tools: {enabled_tools[:10]}{'...' if len(enabled_tools) > 10 else ''}")
            
            for tool_name in enabled_tools:
                if tool_name in self.tool_map:
                    logger.warning(f"🔍 [MCP-PROCESS-DEBUG] ⚠️ Tool '{tool_name}' already registered, skipping duplicate")
                    continue
                
                logger.info(f"🔍 [MCP-PROCESS-DEBUG] ✅ Adding tool '{tool_name}' to map (from {toolkit_slug})")
                self.tool_map[tool_name] = MCPToolInfo(
                    tool_name=tool_name,
                    toolkit_slug=toolkit_slug,
                    mcp_config=mcp_config
                )
            return
        
        account_id = self.agent_config.get('account_id')
        logger.info(f"🔍 [MCP-PROCESS-DEBUG] No enabledTools in config, querying registry for toolkit: {toolkit_slug}")
        
        available_tools = await get_toolkit_tools(toolkit_slug, account_id=account_id, cache_only=cache_only)
        
        logger.info(f"🔍 [MCP-PROCESS-DEBUG] Registry returned {len(available_tools)} tools for {toolkit_slug}")
        if available_tools:
            logger.info(f"🔍 [MCP-PROCESS-DEBUG] Available tools: {available_tools[:10]}{'...' if len(available_tools) > 10 else ''}")
        
        if not available_tools:
            if cache_only:
                logger.info(f"🔍 [MCP-PROCESS-DEBUG] No cached tools for {toolkit_slug} - will discover in enrichment")
            else:
                logger.warning(f"🔍 [MCP-PROCESS-DEBUG] ❌ No tools found for toolkit: {toolkit_slug}")
            return
        
        for tool_name in available_tools:
            if tool_name in self.tool_map:
                logger.warning(f"🔍 [MCP-PROCESS-DEBUG] ⚠️ Tool '{tool_name}' already registered, skipping duplicate")
                continue
            
            logger.info(f"🔍 [MCP-PROCESS-DEBUG] ✅ Adding tool '{tool_name}' to map (from {toolkit_slug})")
            self.tool_map[tool_name] = MCPToolInfo(
                tool_name=tool_name,
                toolkit_slug=toolkit_slug,
                mcp_config=mcp_config
            )
    
    async def _process_custom_mcp_config_internal(self, mcp_config: Dict[str, Any], cache_only: bool = False) -> None:
        toolkit_slug = self._extract_toolkit_slug(mcp_config) or 'custom'
        server_name = mcp_config.get('name', 'unnamed')
        custom_type = mcp_config.get("customType", mcp_config.get("type", "http")).lower()
        url = mcp_config.get('url') or mcp_config.get('config', {}).get('url')
        
        logger.debug(f"⚡ [MCP JIT] Processing custom MCP: {server_name} (type: {custom_type})")
        
        if custom_type == "json":
            if cache_only:
                logger.debug(f"⚡ [MCP JIT] Custom MCP {server_name}: JSON type, skipping discovery in cache-only mode.")
                return
            tool_names = await self._discover_json_tools(mcp_config)
        elif url:
            if cache_only:
                enabled_tools = mcp_config.get('enabledTools', [])
                if enabled_tools:
                    for tool_name in enabled_tools:
                        if tool_name not in self.tool_map:
                            self.tool_map[tool_name] = MCPToolInfo(
                                tool_name=tool_name,
                                toolkit_slug=f"custom_{custom_type}_{server_name}",
                                mcp_config=mcp_config
                            )
                    logger.debug(f"⚡ [MCP JIT] Custom MCP {server_name}: Added {len(enabled_tools)} enabled tools from config (cache-only mode)")
                else:
                    logger.debug(f"⚡ [MCP JIT] Custom MCP {server_name}: No enabled tools in config, will discover later")
                return
            tool_names = await self._discover_tools_with_fallback(mcp_config)
        else:
            logger.error(f"❌ [MCP JIT] Missing 'url' for custom MCP '{server_name}' of type '{custom_type}'")
            return []
        
        if not tool_names:
            logger.warning(f"⚠️ [MCP JIT] No tools discovered for '{server_name}' at {url or 'stdio'}")
            return

        enabled_tools = mcp_config.get('enabledTools', [])
        if enabled_tools:
            tools_to_add = [tool for tool in tool_names if tool in enabled_tools]
            logger.debug(f"⚡ [MCP JIT] Custom MCP {server_name}: Filtered to {len(tools_to_add)}/{len(tool_names)} enabled tools")
        else:
            tools_to_add = tool_names
            logger.debug(f"⚡ [MCP JIT] Custom MCP {server_name}: No enabledTools filter, loading all {len(tools_to_add)} tools")
        
        final_toolkit_slug = f"custom_{custom_type}_{server_name.replace(' ', '_').lower()}" if toolkit_slug == 'custom' else toolkit_slug

        for tool_name in tools_to_add:
            if tool_name in self.tool_map:
                logger.warning(f"⚠️  [MCP JIT] Tool '{tool_name}' already registered, skipping duplicate")
                continue
            
            logger.debug(f"📌 [MCP JIT] Mapping tool: {tool_name} -> {final_toolkit_slug}")
            self.tool_map[tool_name] = MCPToolInfo(
                tool_name=tool_name,
                toolkit_slug=final_toolkit_slug,
                mcp_config=mcp_config
            )
        
        logger.info(f"✅ [MCP JIT] {server_name}: Successfully registered {len(tools_to_add)} tools")
    
    async def _discover_custom_mcp_tools(self, custom_type: str, config: Dict[str, Any]) -> List[str]:
        # This method is now largely superseded by _process_custom_mcp_config_internal
        # but kept for compatibility if other parts of the system still call it directly.
        # It should ideally be refactored to call _discover_tools_with_fallback or _discover_json_tools.
        if custom_type == "json":
            return await self._discover_json_tools(config)
        elif custom_type in ("sse", "http"):
            return await self._discover_tools_with_fallback(config)
        else:
            logger.warning(f"⚠️  [MCP JIT] Unknown custom MCP type: {custom_type}")
            return []
    
    async def _discover_tools_with_fallback(self, config: Dict[str, Any]) -> List[str]:
        """Discovery with automatic transport fallback and path probing."""
        url = config.get('url') or config.get('config', {}).get('url')
        custom_type = config.get("customType", config.get("type", "http")).lower()

        if not url: return []

        # SSRF Protection: Validate URL before connecting
        safe, error_msg = is_safe_url(url)
        if not safe:
            logger.error(f"❌ [MCP JIT] SSRF Blocked during discovery for {url}: {error_msg}")
            return []
        
        # Build headers
        config_nested = config.get('config', {})
        headers = (config.get('headers') or config_nested.get('headers') or {}).copy()
        
        # 1. Try config first
        access_token = config.get("access_token") or config_nested.get("access_token")
        
        # 2. Try DB lookup if missing
        if not access_token:
            qualified_name = config.get('qualifiedName') or config.get('name')
            account_id = self.agent_config.get('account_id')
            
            if qualified_name and account_id:
                try:
                    from core.services.supabase import DBConnection
                    from core.credentials import get_credential_service
                    
                    db = DBConnection()
                    service = get_credential_service(db)
                    credential = await service.get_credential(account_id, qualified_name)
                    
                    if credential and credential.config and "access_token" in credential.config:
                        access_token = credential.config["access_token"]
                        config["access_token"] = access_token
                        logger.debug(f"🔑 [MCP JIT] Used stored credential for {qualified_name}")
                except Exception as e:
                    logger.warning(f"⚠️ [MCP JIT] Failed credential lookup for {qualified_name}: {e}")

        if access_token and "Authorization" not in headers:
            headers["Authorization"] = f"Bearer {access_token}"
        custom_headers = config.get("custom_headers") or config_nested.get("custom_headers")
        if isinstance(custom_headers, dict):
            headers.update(custom_headers)

        # Paths to try
        paths = [""]
        if "/mcp" not in url.lower():
            paths.append("/mcp")
            
        # Transport order (try preferred first, then the other)
        transports = ["sse", "http"] if custom_type == "sse" else ["http", "sse"]
        
        for transport in transports:
            for path in paths:
                current_url = url.rstrip('/') + path if path else url
                try:
                    if transport == "sse":
                        logger.debug(f"🌐 [MCP JIT] Discovery [SSE] -> {current_url}")
                        async def _probe_sse():
                            async with sse_client(current_url, headers=headers) as (read, write):
                                async with ClientSession(read, write) as session:
                                    await session.initialize()
                                    res = await session.list_tools()
                                    return [t.name for t in (res.tools if hasattr(res, 'tools') else res)]
                        
                        tool_names = await asyncio.wait_for(_probe_sse(), timeout=15.0)
                        logger.info(f"✨ [MCP JIT] Success! {len(tool_names)} tools found via SSE at {current_url}")
                        return tool_names
                    else:
                        logger.debug(f"🌐 [MCP JIT] Discovery [HTTP] -> {current_url}")
                        logger.info(f"📤 [MCP JIT] Discovery Headers: { {k: '***' if k.lower() == 'authorization' else v for k, v in headers.items()} }")
                        if "Authorization" in headers:
                            logger.info(f"🔑 [MCP JIT] Auth Token present in probe: Bearer {'*' * 10}{headers['Authorization'][-5:]}")
                        
                        async def _probe_http():
                            async with streamablehttp_client(current_url, headers=headers) as (read, write, _):
                                async with ClientSession(read, write) as session:
                                    await session.initialize()
                                    res = await session.list_tools()
                                    return [t.name for t in (res.tools if hasattr(res, 'tools') else res)]
                        
                        tool_names = await asyncio.wait_for(_probe_http(), timeout=15.0)
                        logger.info(f"✨ [MCP JIT] Success! {len(tool_names)} tools found via HTTP at {current_url}")
                        return tool_names
                except Exception as e:
                    logger.debug(f"ℹ️ [MCP JIT] Probe failed ({transport} @ {current_url}): {e}")
                    logger.debug(traceback.format_exc())
                    continue
        
        return []
    
    async def _discover_json_tools(self, config: Dict[str, Any]) -> List[str]:
        command = config.get('command')
        if not command:
            logger.error("❌ [MCP JIT] Missing 'command' in JSON/stdio MCP config")
            return []
        
        from mcp import ClientSession, StdioServerParameters
        from mcp.client.stdio import stdio_client
        
        try:
            server_params = StdioServerParameters(
                command=command,
                args=config.get("args", []),
                env=config.get("env", {})
            )
            
            async with stdio_client(server_params) as (read_stream, write_stream):
                async with ClientSession(read_stream, write_stream) as session:
                    await session.initialize()
                    tools_result = await session.list_tools()
                    tools = tools_result.tools if hasattr(tools_result, 'tools') else tools_result
                    tool_names = [tool.name for tool in tools]
                    logger.debug(f"⚡ [MCP JIT] Discovered {len(tool_names)} JSON/stdio tools")
                    return tool_names
        except Exception as e:
            logger.error(f"❌ [MCP JIT] Failed to discover JSON/stdio tools: {e}")
            return []
    
    def _extract_toolkit_slug(self, mcp_config: Dict[str, Any]) -> Optional[str]:
        toolkit_slug = mcp_config.get("toolkit_slug")
        if not toolkit_slug:
            qualified_name = mcp_config.get("qualifiedName", "")
            if qualified_name:
                toolkit_slug = qualified_name.split(".")[-1]
        
        if not toolkit_slug:
            config_obj = mcp_config.get("config", {})
            if isinstance(config_obj, dict):
                toolkit_slug = config_obj.get("toolkit_slug") or config_obj.get("toolkit_name")
        
        return toolkit_slug
    
    async def _ensure_tool_map_built(self) -> None:
        if not self._tool_map_built:
            await self.build_tool_map()
    
    async def get_available_tools(self) -> List[str]:
        await self._ensure_tool_map_built()
        return list(self.tool_map.keys())
    
    async def get_toolkit_tools(self, toolkit_slug: str) -> List[str]:
        await self._ensure_tool_map_built()
        return [
            tool_name for tool_name, tool_info in self.tool_map.items()
            if tool_info.toolkit_slug == toolkit_slug
        ]
    
    async def get_toolkits(self) -> List[str]:
        await self._ensure_tool_map_built()
        toolkits = set()
        for tool_info in self.tool_map.values():
            toolkits.add(tool_info.toolkit_slug)
        return list(toolkits)
    
    async def is_tool_available(self, tool_name: str) -> bool:
        await self._ensure_tool_map_built()
        return tool_name in self.tool_map
    
    def is_tool_available_sync(self, tool_name: str) -> bool:
        return self._tool_map_built and tool_name in self.tool_map
    
    async def get_tool_info(self, tool_name: str) -> Optional[MCPToolInfo]:
        await self._ensure_tool_map_built()
        return self.tool_map.get(tool_name)
    
    async def activate_tool(self, tool_name: str) -> ActivationResult:
        if tool_name not in self.tool_map:
            return ActivationError(
                error_type=ActivationErrorType.TOOL_NOT_FOUND,
                message=f"MCP tool '{tool_name}' not found in static registry",
                tool_name=tool_name
            )
        
        tool_info = self.tool_map[tool_name]
        
        if tool_info.loaded:
            return ActivationSuccess(
                tool_name=tool_name,
                load_time_ms=tool_info.load_time_ms or 0,
                dependencies_loaded=[]
            )
        
        try:
            start_time = time.time()
            
            schema = await self._load_tool_schema(tool_name, tool_info)
            
            self.schema_cache[tool_name] = schema
            tool_info.schema = schema
            tool_info.loaded = True
            tool_info.load_time_ms = (time.time() - start_time) * 1000
            
            logger.info(f"✅ [MCP JIT] Activated '{tool_name}' in {tool_info.load_time_ms:.1f}ms")
            
            return ActivationSuccess(
                tool_name=tool_name,
                load_time_ms=tool_info.load_time_ms,
                dependencies_loaded=[]
            )
            
        except Exception as e:
            logger.error(f"❌ [MCP JIT] Failed to activate '{tool_name}': {e}")
            return ActivationError(
                error_type=ActivationErrorType.INIT_FAILED,
                message=str(e),
                tool_name=tool_name,
                details={
                    'toolkit_slug': tool_info.toolkit_slug,
                    'mcp_config': tool_info.mcp_config.get('name', 'Unknown')
                }
            )
    
    async def activate_multiple(self, tool_names: List[str]) -> Dict[str, ActivationResult]:
        logger.info(f"⚡ [MCP JIT] Activating {len(tool_names)} MCP tools in parallel")

        tasks = [(tool_name, self.activate_tool(tool_name)) for tool_name in tool_names]

        results = {}
        task_results = await asyncio.gather(*[task for _, task in tasks], return_exceptions=True)
        
        for (tool_name, _), result in zip(tasks, task_results):
            if isinstance(result, Exception):
                results[tool_name] = ActivationError(
                    error_type=ActivationErrorType.INIT_FAILED,
                    message=str(result),
                    tool_name=tool_name
                )
            else:
                results[tool_name] = result
        
        successful = sum(1 for r in results.values() if isinstance(r, ActivationSuccess))
        logger.info(f"⚡ [MCP JIT] Parallel activation completed: {successful}/{len(tool_names)} successful")
        
        return results
    
    async def _load_tool_schema(self, tool_name: str, tool_info: MCPToolInfo) -> Dict[str, Any]:
        toolkit_slug = tool_info.toolkit_slug
        mcp_config = tool_info.mcp_config
        
        custom_type = mcp_config.get("customType", mcp_config.get("type", "standard"))
        
        if custom_type == "composio":
            return await self._load_composio_schema(tool_name, toolkit_slug, mcp_config)
        elif custom_type in ("sse", "http", "json"):
            return await self._load_custom_mcp_schema(tool_name, toolkit_slug, mcp_config, custom_type)
        else:
            return await self._load_custom_mcp_schema(tool_name, toolkit_slug, mcp_config, "http")
    
    async def _load_composio_schema(self, tool_name: str, toolkit_slug: str, mcp_config: Dict[str, Any]) -> Dict[str, Any]:
        try:
            config = mcp_config.get('config', {})
            profile_id = config.get('profile_id')
            
            if not profile_id:
                raise ValueError(f"Missing profile_id for Composio tool {tool_name}")
            
            from core.composio_integration.composio_profile_service import ComposioProfileService
            from core.services.supabase import DBConnection
            from mcp.client.streamable_http import streamablehttp_client
            from mcp import ClientSession
            
            db = DBConnection()
            profile_service = ComposioProfileService(db)
            mcp_url = await profile_service.get_mcp_url_for_runtime(profile_id)
            
            logger.debug(f"⚡ [MCP JIT] Resolved Composio profile {profile_id} to MCP URL for {tool_name}")
            
            async with streamablehttp_client(mcp_url) as (read_stream, write_stream, _):
                async with ClientSession(read_stream, write_stream) as session:
                    await session.initialize()
                    tools_result = await session.list_tools()
                    tools = tools_result.tools if hasattr(tools_result, 'tools') else tools_result
                    
                    for tool in tools:
                        if tool.name == tool_name:
                            schema = {
                                "name": tool.name,
                                "description": tool.description,
                                "input_schema": tool.inputSchema
                            }
                            logger.debug(f"⚡ [MCP JIT] Found Composio schema for {tool_name}")
                            return schema
                    
                    available_tools = [tool.name for tool in tools]
                    raise ValueError(f"Tool '{tool_name}' not found. Available: {available_tools}")
                
        except Exception as e:
            logger.error(f"❌ [MCP JIT] Failed to load Composio schema for {tool_name}: {e}")
            raise
    
    async def _load_custom_mcp_schema(self, tool_name: str, toolkit_slug: str, mcp_config: Dict[str, Any], custom_type: str) -> Dict[str, Any]:
        try:
            config = mcp_config.get('config', {})
            # URL can be at top level or nested in 'config'
            url = mcp_config.get('url') or config.get('url')
            
            # Calculate headers for discovery
            # Extract headers from both mcp_config and nested config
            headers = (mcp_config.get('headers') or {}).copy()
            headers.update(config.get('headers', {}) or {})
            
            # Add auth if present in mcp_config or nested config
            access_token = mcp_config.get("access_token") or config.get("access_token")
            if access_token and "Authorization" not in headers:
                headers["Authorization"] = f"Bearer {access_token}"
                
            # Add custom headers if present
            custom_headers = mcp_config.get("custom_headers") or config.get("custom_headers")
            if isinstance(custom_headers, dict):
                headers.update(custom_headers)
            
            if custom_type == "sse":
                return await self._load_sse_schema(tool_name, url, config, headers=headers)
            elif custom_type == "http":
                return await self._load_http_schema(tool_name, url, config, headers=headers)
            elif custom_type == "json":
                return await self._load_json_schema(tool_name, config)
            else:
                # Default to HTTP for unknown types
                return await self._load_http_schema(tool_name, url, config, headers=headers)
            
        except Exception as e:
            logger.error(f"❌ [MCP JIT] Failed to load schema for tool '{tool_name}' (toolkit: {toolkit_slug}, type: {custom_type}): {e}")
            raise
    
    async def _load_sse_schema(self, tool_name: str, url: str, config: Dict[str, Any], headers: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        if not url:
            raise ValueError(f"Missing 'url' in SSE MCP config for {tool_name}")

        # SSRF Protection
        safe, error_msg = is_safe_url(url)
        if not safe:
            raise ValueError(f"SSRF blocked for {tool_name}: {error_msg}")

        if headers is None:
            headers = config.get('headers', {})
        
        try:
            async with sse_client(url, headers=headers) as (read_stream, write_stream):
                async with ClientSession(read_stream, write_stream) as session:
                    await session.initialize()
                    tools_result = await session.list_tools()
                    tools = tools_result.tools if hasattr(tools_result, 'tools') else tools_result
                    
                    for tool in tools:
                        if tool.name == tool_name:
                            schema = {
                                "name": tool.name,
                                "description": tool.description,
                                "input_schema": tool.inputSchema
                            }
                            logger.debug(f"⚡ [MCP JIT] Found SSE schema for {tool_name}")
                            return schema
                    
                    available_tools = [tool.name for tool in tools]
                    raise ValueError(f"Tool '{tool_name}' not found in SSE server. Available: {available_tools}")
        except TypeError as e:
            if "unexpected keyword argument" in str(e):
                async with sse_client(url) as (read_stream, write_stream):
                    async with ClientSession(read_stream, write_stream) as session:
                        await session.initialize()
                        tools_result = await session.list_tools()
                        tools = tools_result.tools if hasattr(tools_result, 'tools') else tools_result
                        
                        for tool in tools:
                            if tool.name == tool_name:
                                schema = {
                                    "name": tool.name,
                                    "description": tool.description,
                                    "input_schema": tool.inputSchema
                                }
                                logger.debug(f"⚡ [MCP JIT] Found SSE schema for {tool_name} (no headers)")
                                return schema
                        
                        available_tools = [tool.name for tool in tools]
                        raise ValueError(f"Tool '{tool_name}' not found in SSE server. Available: {available_tools}")
            else:
                raise
    
    async def _load_http_schema(self, tool_name: str, url: str, config: Dict[str, Any], headers: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        if not url:
            raise ValueError(f"Missing 'url' in HTTP MCP config for {tool_name}")

        # SSRF Protection
        safe, error_msg = is_safe_url(url)
        if not safe:
            raise ValueError(f"SSRF blocked for {tool_name}: {error_msg}")

        if headers is None:
            headers = config.get('headers', {})
            
        async with streamablehttp_client(url, headers=headers) as (read_stream, write_stream, _):
            async with ClientSession(read_stream, write_stream) as session:
                await session.initialize()
                tools_result = await session.list_tools()
                tools = tools_result.tools if hasattr(tools_result, 'tools') else tools_result
                
                for tool in tools:
                    if tool.name == tool_name:
                        schema = {
                            "name": tool.name,
                            "description": tool.description,
                            "input_schema": tool.inputSchema
                        }
                        logger.debug(f"⚡ [MCP JIT] Found HTTP schema for {tool_name}")
                        return schema
                
                available_tools = [tool.name for tool in tools]
                raise ValueError(f"Tool '{tool_name}' not found in HTTP server. Available: {available_tools}")
    
    async def _load_json_schema(self, tool_name: str, config: Dict[str, Any]) -> Dict[str, Any]:
        command = config.get('command')
        if not command:
            raise ValueError(f"Missing 'command' in JSON/stdio MCP config for {tool_name}")
        
        from mcp import ClientSession, StdioServerParameters
        from mcp.client.stdio import stdio_client
        
        server_params = StdioServerParameters(
            command=command,
            args=config.get("args", []),
            env=config.get("env", {})
        )
        
        async with stdio_client(server_params) as (read_stream, write_stream):
            async with ClientSession(read_stream, write_stream) as session:
                await session.initialize()
                tools_result = await session.list_tools()
                tools = tools_result.tools if hasattr(tools_result, 'tools') else tools_result
                
                for tool in tools:
                    if tool.name == tool_name:
                        schema = {
                            "name": tool.name,
                            "description": tool.description,
                            "input_schema": tool.inputSchema
                        }
                        logger.debug(f"⚡ [MCP JIT] Found JSON/stdio schema for {tool_name}")
                        return schema
                
                available_tools = [tool.name for tool in tools]
                raise ValueError(f"Tool '{tool_name}' not found in JSON/stdio server. Available: {available_tools}")
    
    def get_activation_stats(self) -> Dict[str, Any]:
        loaded_count = sum(1 for tool_info in self.tool_map.values() if tool_info.loaded)
        
        toolkit_stats = {}
        for tool_info in self.tool_map.values():
            toolkit = tool_info.toolkit_slug
            if toolkit not in toolkit_stats:
                toolkit_stats[toolkit] = {"total": 0, "loaded": 0}
            toolkit_stats[toolkit]["total"] += 1
            if tool_info.loaded:
                toolkit_stats[toolkit]["loaded"] += 1
        
        return {
            "total_tools": len(self.tool_map),
            "loaded_tools": loaded_count,
            "load_percentage": (loaded_count / len(self.tool_map) * 100) if self.tool_map else 0,
            "toolkit_breakdown": toolkit_stats,
            "schema_cache_size": len(self.schema_cache)
        }
    
    def cleanup(self) -> None:
        self.schema_cache.clear()
        for tool_info in self.tool_map.values():
            tool_info.schema = None
            tool_info.loaded = False
        
        logger.info("⚡ [MCP JIT] Cleaned up tool schemas and cache")
