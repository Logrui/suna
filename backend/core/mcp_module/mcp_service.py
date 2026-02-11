import os
import json
import base64
import asyncio
import logging
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime
from collections import OrderedDict
from time import time
from contextlib import AsyncExitStack

from mcp import ClientSession
from mcp.client.sse import sse_client
from mcp.client.streamable_http import streamablehttp_client
import httpx

from core.utils.logger import logger
from core.credentials import EncryptionService, get_credential_service
from core.utils.config import config as app_config, EnvMode
from core.tools.utils.mcp_tool_executor import is_safe_url
from core.services.supabase import DBConnection


class MCPException(Exception):
    pass

class MCPConnectionError(MCPException):
    pass

class MCPToolNotFoundError(MCPException):
    pass

class MCPToolExecutionError(MCPException):
    pass

class MCPProviderError(MCPException):
    pass

class MCPConfigurationError(MCPException):
    pass

class MCPAuthenticationError(MCPException):
    pass

class CustomMCPError(MCPException):
    pass


@dataclass(frozen=True)
class MCPConnection:
    qualified_name: str
    name: str
    config: Dict[str, Any]
    enabled_tools: List[str]
    provider: str = 'custom'
    external_user_id: Optional[str] = None
    session: Optional[ClientSession] = field(default=None, compare=False)
    tools: Optional[List[Any]] = field(default=None, compare=False)
    exit_stack: Optional[AsyncExitStack] = field(default=None, compare=False)


@dataclass(frozen=True)
class ToolInfo:
    name: str
    description: str
    input_schema: Dict[str, Any]


@dataclass(frozen=True)
class CustomMCPConnectionResult:
    success: bool
    qualified_name: str
    display_name: str
    tools: List[Dict[str, Any]]
    config: Dict[str, Any]
    url: str
    message: str


@dataclass
class MCPConnectionRequest:
    qualified_name: str
    name: str
    config: Dict[str, Any]
    enabled_tools: List[str]
    provider: str = 'custom'
    external_user_id: Optional[str] = None


@dataclass
class ToolExecutionRequest:
    tool_name: str
    arguments: Dict[str, Any]
    external_user_id: Optional[str] = None


@dataclass
class ToolExecutionResult:
    success: bool
    result: Any
    error: Optional[str] = None


class MCPService:
    def __init__(self):
        self._logger = logger
        # LRU cache: Dict[name, (connection, created_at_timestamp)]
        self._connections: OrderedDict[str, Tuple[MCPConnection, float]] = OrderedDict()
        self._encryption_service = EncryptionService()
        self._max_connections = 100  # Maximum connections to keep in memory
        self._connection_ttl = 3600  # 1 hour TTL for connections

    async def connect_server(self, mcp_config: Dict[str, Any], external_user_id: Optional[str] = None) -> MCPConnection:
        # Determine provider from type field
        provider = mcp_config.get('type', mcp_config.get('provider', 'custom'))
        
        request = MCPConnectionRequest(
            qualified_name=mcp_config.get('qualifiedName', mcp_config.get('name', '')),
            name=mcp_config.get('name', ''),
            config=mcp_config.get('config', {}),
            enabled_tools=mcp_config.get('enabledTools', mcp_config.get('enabled_tools', [])),
            provider=provider,  # Use the determined provider
            external_user_id=external_user_id
        )
        return await self._connect_server_internal(request)
    
    async def _connect_server_internal(self, request: MCPConnectionRequest) -> MCPConnection:
        self._logger.debug(f"Connecting to MCP server: {request.qualified_name}")
        
        try:
            server_url = await self._get_server_url(request.qualified_name, request.config, request.provider)
            headers = await self._get_headers(request.qualified_name, request.config, request.provider, request.external_user_id)
            
            # Add debugging
            self._logger.debug(f"MCP connection details - Provider: {request.provider}, URL: {server_url}, Headers: {headers}")

            async with AsyncExitStack() as stack:
                async def attempt_connect(provider: str):
                    if provider == 'sse':
                        client = await stack.enter_async_context(sse_client(server_url, headers=headers))
                    else:
                        client = await stack.enter_async_context(streamablehttp_client(server_url, headers=headers))
                    
                    try:
                        # sse_client returns (read, write), streamablehttp returns (read, write, _)
                        if len(client) == 3:
                            read_stream, write_stream, _ = client
                        else:
                            read_stream, write_stream = client
                            
                        session = ClientSession(read_stream, write_stream)
                        await session.initialize()
                        tool_result = await session.list_tools()
                        tools = tool_result.tools if tool_result else []
                        
                        return session, tools
                    except Exception:
                        # AsyncExitStack will handle cleanup automatically on exception
                        raise

                try:
                    # Add timeout to prevent hanging
                    async with asyncio.timeout(30):
                        try:
                            session, tools = await attempt_connect(request.provider)
                        except Exception as e:
                            # Detect signal codes in the error message or nested exceptions
                            error_str = str(e).lower()
                            signal_codes = ["405", "400", "401", "403"]
                            
                            def has_signal(ex):
                                s = str(ex).lower()
                                return any(code in s for code in signal_codes)
                                
                            is_protocol_error = any(code in error_str for code in signal_codes)
                            
                            # Support Python 3.11+ ExceptionGroup
                            if not is_protocol_error and hasattr(e, 'exceptions'):
                                for sub_e in e.exceptions:
                                    if has_signal(sub_e):
                                        is_protocol_error = True
                                        break

                            if request.provider == 'sse' and is_protocol_error:
                                self._logger.warning(f"SSE connection failed ({e}), falling back to HTTP...")
                                session, tools = await attempt_connect('http')
                            else:
                                raise
                except Exception as e:
                    # Log clearly if it's an auth error
                    err_msg = str(e).lower()
                    if "401" in err_msg or "unauthorized" in err_msg:
                        self._logger.error(f"Authentication failed for {request.name}: 401 Unauthorized. Check your credentials.")
                    elif "403" in err_msg or "forbidden" in err_msg:
                        self._logger.error(f"Access forbidden for {request.name}: 403 Forbidden. Check your permissions.")
                    else:
                        self._logger.error(f"Failed to connect to {request.name}: {e}")
                    raise MCPConnectionError(f"Failed to connect to MCP server: {e}")

                # If we got here, everything succeeded. Transfer stack to connection.
                connection_stack = stack.pop_all()

                connection = MCPConnection(
                    qualified_name=request.qualified_name,
                    name=request.name,
                    config=request.config,
                    enabled_tools=request.enabled_tools,
                    provider=request.provider,
                    external_user_id=request.external_user_id,
                    session=session,
                    tools=tools,
                    exit_stack=connection_stack
                )
                # Store with timestamp for TTL tracking
                self._connections[request.qualified_name] = (connection, time())
                # Move to end (most recently used)
                self._connections.move_to_end(request.qualified_name)
                self._logger.debug(f"Connected to {request.qualified_name} ({len(tools)} tools available)")
                
                # Cleanup old connections
                await self._cleanup_old_connections()
                
                return connection
                    
        except asyncio.TimeoutError:
            error_msg = f"Connection timeout for {request.qualified_name} after 30 seconds"
            self._logger.error(error_msg)
            raise MCPConnectionError(error_msg)
        except Exception as e:
            self._logger.error(f"Failed to connect to {request.qualified_name}: {str(e)}")
            raise MCPConnectionError(f"Failed to connect to MCP server: {str(e)}")
    
    async def connect_all(self, mcp_configs: List[Dict[str, Any]]) -> None:
        requests = []
        for config in mcp_configs:
            # Determine provider from type field
            provider = config.get('type', config.get('provider', 'custom'))
            
            request = MCPConnectionRequest(
                qualified_name=config.get('qualifiedName', config.get('name', '')),
                name=config.get('name', ''),
                config=config.get('config', {}),
                enabled_tools=config.get('enabledTools', config.get('enabled_tools', [])),
                provider=provider,  # Use the determined provider
                external_user_id=config.get('external_user_id')
            )
            requests.append(request)
        
        for request in requests:
            try:
                await self._connect_server_internal(request)
            except MCPConnectionError as e:
                self._logger.error(f"Failed to connect to {request.qualified_name}: {str(e)}")
                continue
    
    async def _cleanup_old_connections(self) -> None:
        """Remove connections older than TTL or if over limit (LRU eviction)"""
        now = time()
        expired_names = []
        
        # Find expired connections
        for name, (conn, created_at) in self._connections.items():
            if now - created_at > self._connection_ttl:
                expired_names.append(name)
        
        # Remove expired connections
        for name in expired_names:
            await self.disconnect_server(name)
        
        # Enforce LRU limit (remove oldest if over limit)
        while len(self._connections) > self._max_connections:
            oldest_name = next(iter(self._connections))
            await self.disconnect_server(oldest_name)
    
    async def disconnect_server(self, qualified_name: str) -> None:
        connection_data = self._connections.get(qualified_name)
        if connection_data:
            connection, _ = connection_data
            if connection:
                if connection.session:
                    try:
                        await connection.session.close()
                    except Exception as e:
                        self._logger.warning(f"Error closing session for {qualified_name}: {str(e)}")
                
                if connection.exit_stack:
                    try:
                        await connection.exit_stack.aclose()
                        self._logger.debug(f"Disconnected from {qualified_name}")
                    except Exception as e:
                        self._logger.warning(f"Error closing transport for {qualified_name}: {str(e)}")
        
        self._connections.pop(qualified_name, None)
    
    async def disconnect_all(self) -> None:
        for qualified_name in list(self._connections.keys()):
            await self.disconnect_server(qualified_name)
        self._connections.clear()
        self._logger.debug("Disconnected from all MCP servers")
    
    def get_connection(self, qualified_name: str) -> Optional[MCPConnection]:
        """Get connection, moving it to end (most recently used) for LRU"""
        if qualified_name in self._connections:
            connection_data = self._connections[qualified_name]
            self._connections.move_to_end(qualified_name)  # Mark as recently used
            return connection_data[0]  # Return connection, not tuple
        return None
    
    def get_all_connections(self) -> List[MCPConnection]:
        """Get all connections (without timestamps)"""
        return [conn for conn, _ in self._connections.values()]

    def get_all_tools_openapi(self) -> List[Dict[str, Any]]:
        tools = []
        
        for connection in self.get_all_connections():
            if not connection.tools:
                continue
            
            for tool in connection.tools:
                if tool.name not in connection.enabled_tools:
                    continue
                
                openapi_tool = {
                    "type": "function",
                    "function": {
                        "name": tool.name,
                        "description": tool.description,
                        "parameters": tool.inputSchema
                    }
                }
                tools.append(openapi_tool)
        
        return tools
    
    async def execute_tool(self, tool_name: str, arguments: Dict[str, Any], external_user_id: Optional[str] = None) -> ToolExecutionResult:
        request = ToolExecutionRequest(
            tool_name=tool_name,
            arguments=arguments,
            external_user_id=external_user_id
        )
        return await self._execute_tool_internal(request)
    
    async def _execute_tool_internal(self, request: ToolExecutionRequest) -> ToolExecutionResult:
        self._logger.debug(f"Executing tool: {request.tool_name}")
        
        connection = self._find_tool_connection(request.tool_name)
        if not connection:
            raise MCPToolNotFoundError(f"Tool not found: {request.tool_name}")
        
        if not connection.session:
            raise MCPToolExecutionError(f"No active session for tool: {request.tool_name}")
        
        # Note: _find_tool_connection already marks connection as recently used (LRU)
        
        if request.tool_name not in connection.enabled_tools:
            raise MCPToolExecutionError(f"Tool not enabled: {request.tool_name}")
        
        try:
            result = await connection.session.call_tool(request.tool_name, request.arguments)
            
            self._logger.debug(f"Tool {request.tool_name} executed successfully")
            
            if hasattr(result, 'content'):
                content = result.content
                if isinstance(content, list) and content:
                    if hasattr(content[0], 'text'):
                        result_data = content[0].text
                    else:
                        result_data = str(content[0])
                else:
                    result_data = str(content)
            else:
                result_data = str(result)
            
            return ToolExecutionResult(
                success=True,
                result=result_data
            )
            
        except Exception as e:
            error_msg = f"Tool execution failed: {str(e)}"
            self._logger.error(error_msg)
            
            return ToolExecutionResult(
                success=False,
                result=None,
                error=error_msg
            )
    
    def _find_tool_connection(self, tool_name: str) -> Optional[MCPConnection]:
        for connection in self.get_all_connections():
            if not connection.tools:
                continue
            
            for tool in connection.tools:
                if tool.name == tool_name:
                    return connection
        
        return None

    async def discover_custom_tools(self, request_type: str, config: Dict[str, Any]) -> CustomMCPConnectionResult:
        if request_type == "http":
            return await self._discover_http_tools(config)
        elif request_type == "sse":
            return await self._discover_sse_tools(config)
        else:
            raise CustomMCPError(f"Unsupported request type: {request_type}")
    
    async def _discover_http_tools(self, config: Dict[str, Any]) -> CustomMCPConnectionResult:
        url = config.get("url")
        if not url:
            raise CustomMCPError("URL is required for HTTP MCP connections")
        
        # Validate URL safety (only block private URLs in non-local environments)
        if app_config.ENV_MODE != EnvMode.LOCAL:
            is_safe, error_msg = is_safe_url(url)
            if not is_safe:
                return CustomMCPConnectionResult(
                    success=False,
                    qualified_name="",
                    display_name="",
                    tools=[],
                    config=config,
                    url=url,
                    message=f"Private/local MCP servers are not allowed in production: {error_msg}"
                )
        
        try:
            # Generate headers using the helper method which now supports custom_headers
            headers = self._get_custom_headers("", config)

            async with streamablehttp_client(url, headers=headers) as (read_stream, write_stream, _):
                async with ClientSession(read_stream, write_stream) as session:
                    await session.initialize()
                    tool_result = await session.list_tools()
                    
                    tools_info = []
                    for tool in tool_result.tools:
                        tools_info.append({
                            "name": tool.name,
                            "description": tool.description,
                            "inputSchema": tool.inputSchema
                        })
                    
                    return CustomMCPConnectionResult(
                        success=True,
                        qualified_name=f"custom_http_{url.split('/')[-1]}",
                        display_name=f"Custom HTTP MCP ({url})",
                        tools=tools_info,
                        config=config,
                        url=url,
                        message=f"Connected via HTTP ({len(tools_info)} tools)"
                    )
        
        except Exception as e:
            self._logger.error(f"Error connecting to HTTP MCP server: {str(e)}")
            return CustomMCPConnectionResult(
                success=False,
                qualified_name="",
                display_name="",
                tools=[],
                config=config,
                url=url,
                message=f"Failed to connect: {str(e)}"
            )
    
    async def _discover_sse_tools(self, config: Dict[str, Any]) -> CustomMCPConnectionResult:
        url = config.get("url")
        if not url:
            raise CustomMCPError("URL is required for SSE MCP connections")
        
        # Validate URL safety (only block private URLs in non-local environments)
        if app_config.ENV_MODE != EnvMode.LOCAL:
            is_safe, error_msg = is_safe_url(url)
            if not is_safe:
                return CustomMCPConnectionResult(
                    success=False,
                    qualified_name="",
                    display_name="",
                    tools=[],
                    config=config,
                    url=url,
                    message=f"Private/local MCP servers are not allowed in production: {error_msg}"
                )
        
        try:
             # Generate headers using the helper method which now supports custom_headers
            headers = self._get_custom_headers("", config)

            async with sse_client(url, headers=headers) as (read_stream, write_stream):
                async with ClientSession(read_stream, write_stream) as session:
                    await session.initialize()
                    tool_result = await session.list_tools()
                    
                    tools_info = []
                    for tool in tool_result.tools:
                        tools_info.append({
                            "name": tool.name,
                            "description": tool.description,
                            "inputSchema": tool.inputSchema
                        })
                    
                    return CustomMCPConnectionResult(
                        success=True,
                        qualified_name=f"custom_sse_{url.split('/')[-1]}",
                        display_name=f"Custom SSE MCP ({url})",
                        tools=tools_info,
                        config=config,
                        url=url,
                        message=f"Connected via SSE ({len(tools_info)} tools)"
                    )
        
        except Exception as e:
            self._logger.error(f"Error connecting to SSE MCP server: {str(e)}")
            return CustomMCPConnectionResult(
                success=False,
                qualified_name="",
                display_name="",
                tools=[],
                config=config,
                url=url,
                message=f"Failed to connect: {str(e)}"
            )

    async def _get_server_url(self, qualified_name: str, config: Dict[str, Any], provider: str) -> str:
        if provider in ['custom', 'http', 'sse']:
            return await self._get_custom_server_url(qualified_name, config)
        elif provider == 'composio':
            return await self._get_composio_server_url(qualified_name, config)
        else:
            raise MCPProviderError(f"Unknown provider type: {provider}")
    
    async def _get_headers(self, qualified_name: str, config: Dict[str, Any], provider: str, external_user_id: Optional[str] = None) -> Dict[str, str]:
        if provider in ['custom', 'http', 'sse']:
            return await self._get_custom_headers(qualified_name, config, external_user_id)
        elif provider == 'composio':
            return await self._get_composio_headers(qualified_name, config, external_user_id)
        else:
            raise MCPProviderError(f"Unknown provider type: {provider}")
    
    async def _get_custom_server_url(self, qualified_name: str, config: Dict[str, Any]) -> str:
        url = config.get("url")
        if not url:
            raise MCPProviderError(f"URL not provided for custom MCP server: {qualified_name}")
        return url
    
    async def _get_custom_headers(self, qualified_name: str, config: Dict[str, Any], external_user_id: Optional[str] = None) -> Dict[str, str]:
        headers = {}
        
        # Local config access_token (overrides DB)
        access_token = config.get("access_token")
        
        # If no access_token in config, try fetching from database using qualified_name
        if not access_token and qualified_name and external_user_id:
            try:
                db = DBConnection()
                service = get_credential_service(db)
                credential = await service.get_credential(external_user_id, qualified_name)
                
                if credential and credential.config and "access_token" in credential.config:
                    access_token = credential.config["access_token"]
                    self._logger.debug(f"Retrieved OAuth token from database for {qualified_name}")
            except Exception as e:
                self._logger.warning(f"Failed to lookup MCP credential for {qualified_name}: {e}")

        # Add Authorization header if we found a token
        if access_token:
            headers["Authorization"] = f"Bearer {access_token}"
            
        # Original logic: check for "headers" key in config
        if "headers" in config:
            headers.update(config["headers"])
            
        # New logic: check for "custom_headers" key in config
        if "custom_headers" in config and isinstance(config["custom_headers"], dict):
             headers.update(config["custom_headers"])
        
        return headers
    
    async def _get_composio_server_url(self, qualified_name: str, config: Dict[str, Any]) -> str:
        """Resolve Composio profile_id to actual MCP URL"""
        profile_id = config.get("profile_id")
        if not profile_id:
            raise MCPProviderError(f"profile_id not provided for Composio MCP server: {qualified_name}")
        
        # Import here to avoid circular dependency
        from core.composio_integration.composio_profile_service import ComposioProfileService
        from core.services.supabase import DBConnection
        
        try:
            db = DBConnection()
            profile_service = ComposioProfileService(db)
            mcp_url = await profile_service.get_mcp_url_for_runtime(profile_id)
            
            self._logger.debug(f"Resolved Composio profile {profile_id} to MCP URL {mcp_url}")
            return mcp_url
            
        except Exception as e:
            self._logger.error(f"Failed to resolve Composio profile {profile_id}: {str(e)}")
            raise MCPProviderError(f"Failed to resolve Composio profile: {str(e)}")
    
    def _get_composio_headers(self, qualified_name: str, config: Dict[str, Any], external_user_id: Optional[str] = None) -> Dict[str, str]:
        """Get headers for Composio MCP connection"""
        headers = {"Content-Type": "application/json"}
        # Composio handles auth through the URL itself
        return headers


mcp_service = MCPService() 