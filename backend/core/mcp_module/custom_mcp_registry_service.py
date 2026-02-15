import httpx
import asyncio
import time
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from urllib.parse import urlparse, urlunparse

from mcp import ClientSession
from mcp.client.sse import sse_client
from mcp.client.streamable_http import streamablehttp_client

from core.utils.logger import logger
from core.utils.config import config as app_config, EnvMode
from core.tools.utils.mcp_tool_executor import is_safe_url
from core.utils.mcp_helpers import get_custom_mcp_qualified_name

@dataclass(frozen=True)
class CustomMCPConnectionResult:
    success: bool
    qualified_name: str
    display_name: str
    tools: List[Dict[str, Any]]
    config: Dict[str, Any]
    url: str
    message: str
    oauth_metadata: Optional[Dict[str, Any]] = None
    requires_auth: bool = False

from .exceptions import CustomMCPError

class CustomMCPRegistryService:
    def __init__(self):
        self._logger = logger

    async def discover_custom_tools(self, request_type: str, config: Dict[str, Any], user_id: Optional[str] = None) -> CustomMCPConnectionResult:
        if request_type == "http":
            return await self._discover_http_tools(config, user_id=user_id)
        elif request_type == "sse":
            return await self._discover_sse_tools(config, user_id=user_id)
        else:
            raise CustomMCPError(f"Unsupported request type: {request_type}")

    async def _get_discovery_headers(self, mcp_config: Dict[str, Any], user_id: Optional[str] = None) -> Dict[str, str]:
        config = mcp_config.get("config", {})
        headers = (mcp_config.get("headers") or config.get("headers") or {}).copy()
        url = mcp_config.get("url") or config.get("url", "")
        
        # Add default MCP headers
        if "Accept" not in headers:
            headers["Accept"] = "application/json, text/event-stream"
             
        # Add auth if present in config or nested config
        access_token = mcp_config.get("access_token") or config.get("access_token")
        if access_token and "Authorization" not in headers:
            headers["Authorization"] = f"Bearer {access_token}"
            
        # Add custom headers if present
        custom_headers = mcp_config.get("custom_headers") or config.get("custom_headers")
        if isinstance(custom_headers, dict):
            headers.update(custom_headers)
            
        from .auth_service import mcp_auth_service
        auth_headers = await mcp_auth_service.get_auth_headers(url, user_id=user_id)
        if auth_headers:
            headers.update(auth_headers)
            
        return headers

    def _safe_append_path(self, base_url: str, extra_path: str) -> str:
        if not extra_path:
            return base_url
        parsed = urlparse(base_url)
        new_path = (parsed.path.rstrip('/') + extra_path).replace('//', '/')
        return urlunparse(parsed._replace(path=new_path))

    async def _discover_http_tools(self, config: Dict[str, Any], user_id: Optional[str] = None) -> CustomMCPConnectionResult:
        url = config.get("url")
        if not url:
            raise CustomMCPError("URL is required for HTTP MCP connections")
        
        # Validate URL safety
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
            # 1. Discover Metadata (OAuth)
            from .auth_service import mcp_auth_service
            oauth_metadata = None
            try:
                oauth_metadata = await mcp_auth_service.discover_oauth_metadata(url)
                self._logger.info(f"✨ [MCP DISCOVERY] Detected OAuth capability for {url}")
            except Exception:
                pass

            # 2. Attempt Connection with path probing
            paths_to_try = [""]
            if "/mcp" not in url.lower():
                paths_to_try.append("/mcp")
                
            last_error = None
            headers = await self._get_discovery_headers(config, user_id=user_id)
            self._logger.debug(f"🔑 [MCP DISCOVERY] Headers: { {k: '***' if k.lower() in ('authorization', 'accept') else v for k, v in headers.items()} }")
            
            for path_choice in paths_to_try:
                current_url = self._safe_append_path(url, path_choice)
                self._logger.debug(f"🔍 [MCP DISCOVERY] Probing HTTP path: {current_url}")
                start_probe = time.time()
                
                try:
                    async with httpx.AsyncClient(timeout=5.0) as client:
                        try:
                            head_res = await client.head(current_url, headers=headers)
                            status_code = head_res.status_code
                            content_type = head_res.headers.get("Content-Type", "").lower()
                            self._logger.debug(f"🔍 [MCP DISCOVERY] HEAD request to {current_url} returned status {status_code}, content-type: {content_type}")
                        except (httpx.HTTPError, Exception) as head_err:
                            self._logger.debug(f"🔍 [MCP DISCOVERY] HEAD request to {current_url} failed: {head_err}. Assuming 200 and empty content-type for further probing.")
                            status_code = 200 # Proceed with GET if HEAD fails
                            content_type = ""
                        
                        # Check for 401 or 403 indicating auth requirement
                        if status_code in (401, 403) and oauth_metadata and "Authorization" not in headers:
                            self._logger.info(f"⚠️  [MCP DISCOVERY] Auth required for {current_url} (status {status_code})")
                            return CustomMCPConnectionResult(
                                success=True,
                                qualified_name="",
                                display_name=f"Custom MCP ({url})",
                                tools=[],
                                config=config,
                                url=current_url,
                                message="Authentication required",
                                oauth_metadata=oauth_metadata,
                                requires_auth=True
                            )

                        if "text/html" in content_type:
                            self._logger.debug(f"🔍 [MCP DISCOVERY] Skipping {current_url} due to 'text/html' content type.")
                            continue

                    async with streamablehttp_client(current_url, headers=headers) as (read_stream, write_stream, _):
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
                            
                            elapsed = (time.time() - start_probe) * 1000
                            self._logger.info(f"✅ [MCP DISCOVERY] HTTP probe successful for {current_url}. Found {len(tools_info)} tools in {elapsed:.1f}ms.")
                            
                            return CustomMCPConnectionResult(
                                success=True,
                                qualified_name=get_custom_mcp_qualified_name(current_url, "http"),
                                display_name=f"Custom HTTP MCP ({current_url})",
                                tools=tools_info,
                                config=config,
                                url=current_url,
                                message=f"Connected via HTTP ({len(tools_info)} tools)",
                                oauth_metadata=oauth_metadata
                            )
                except Exception as probe_error:
                    self._logger.debug(f"ℹ️ [MCP DISCOVERY] Probe failed for {current_url}: {probe_error}")
                    last_error = probe_error
                    continue

            # If we reached here, all paths failed
            if oauth_metadata:
                self._logger.info(f"⚠️  [MCP DISCOVERY] All probes failed for {url}, but OAuth is available. Flagging as requires_auth.")
                return CustomMCPConnectionResult(
                    success=True,
                    qualified_name="",
                    display_name=f"Custom MCP ({url})",
                    tools=[],
                    config=config,
                    url=url,
                    message="Authentication required or endpoint not found",
                    oauth_metadata=oauth_metadata,
                    requires_auth=True
                )
            raise last_error or Exception("All probing paths failed")
        
        except Exception as e:
            self._logger.error(f"❌ [MCP DISCOVERY] HTTP discovery failed: {str(e)}")
            return CustomMCPConnectionResult(
                success=False,
                qualified_name="",
                display_name="",
                tools=[],
                config=config,
                url=url,
                message=f"Failed to connect: {str(e)}"
            )

    async def _discover_sse_tools(self, config: Dict[str, Any], user_id: Optional[str] = None) -> CustomMCPConnectionResult:
        url = config.get("url")
        if not url:
            raise CustomMCPError("URL is required for SSE MCP connections")
        
        # Validate URL safety
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
            # 1. Probe for OAuth Metadata (Proactive detection)
            from .auth_service import mcp_auth_service
            oauth_metadata = None
            try:
                oauth_metadata = await mcp_auth_service.discover_oauth_metadata(url)
                self._logger.info(f"Detected OAuth capability for {url}")
            except Exception:
                pass

            # 2. Attempt Connection
            headers = await self._get_discovery_headers(config, user_id=user_id)

            paths_to_try = [""]
            if "/sse" not in url.lower() and "/mcp" not in url.lower():
                paths_to_try.extend(["/sse", "/mcp"])
                
            last_error = None
            
            for path_choice in paths_to_try:
                current_url = self._safe_append_path(url, path_choice)
                self._logger.debug(f"Probing SSE MCP path: {current_url}")
                
                try:
                    async with httpx.AsyncClient(timeout=5.0) as client:
                        try:
                            head_res = await client.head(current_url, headers=headers)
                            status_code = head_res.status_code
                            content_type = head_res.headers.get("Content-Type", "").lower()
                        except (httpx.HTTPError, Exception):
                            status_code = 200
                            content_type = ""
                        
                        # Check for 401 or 403 indicating auth requirement
                        if status_code in (401, 403) and oauth_metadata and "Authorization" not in headers:
                            return CustomMCPConnectionResult(
                                success=True,
                                qualified_name="",
                                display_name=f"Custom MCP ({url})",
                                tools=[],
                                config=config,
                                url=current_url,
                                message="Authentication required",
                                oauth_metadata=oauth_metadata,
                                requires_auth=True
                            )
                            
                        if "text/html" in content_type:
                            continue

                    # Try standard SSE transport first
                    try:
                        self._logger.debug(f"Attempting standard SSE transport for {current_url}")
                        async def _probe_sse():
                            async with sse_client(current_url, headers=headers) as (read_stream, write_stream):
                                 async with ClientSession(read_stream, write_stream) as session:
                                     await session.initialize()
                                     return await session.list_tools()
                        
                        tool_result = await asyncio.wait_for(_probe_sse(), timeout=15.0)
                        return self._build_sse_success_result(current_url, tool_result, config, oauth_metadata, "sse")
                    except (Exception, BaseException) as sse_err:
                        self._logger.debug(f"Standard SSE transport failed for {current_url}: {sse_err}")
                        
                        # Fallback to Streamable HTTP transport (modern Spec)
                        try:
                            self._logger.debug(f"Attempting Streamable HTTP transport for {current_url}")
                            async def _probe_http():
                                async with streamablehttp_client(current_url, headers=headers) as (read_stream, write_stream, _):
                                    async with ClientSession(read_stream, write_stream) as session:
                                        await session.initialize()
                                        return await session.list_tools()
                            
                            tool_result = await asyncio.wait_for(_probe_http(), timeout=15.0)
                            return self._build_sse_success_result(current_url, tool_result, config, oauth_metadata, "sse-http")
                        except (Exception, BaseException) as stream_err:
                            self._logger.debug(f"Streamable HTTP transport also failed for {current_url}: {stream_err}")
                            last_error = sse_err # Prefer the first error for reporting
                except Exception as probe_error:
                    last_error = probe_error
                    continue
            
            # If we reached here, all paths failed
            if oauth_metadata:
                return CustomMCPConnectionResult(
                    success=True,
                    qualified_name="",
                    display_name=f"Custom MCP ({url})",
                    tools=[],
                    config=config,
                    url=url,
                    message="Authentication required or endpoint not found",
                    oauth_metadata=oauth_metadata,
                    requires_auth=True
                )
            raise last_error or Exception("All SSE probing paths failed")
        
        except Exception as e:
            # Handle Python 3.11+ ExceptionGroup (TaskGroup errors)
            error_msg = str(e)
            if hasattr(e, "exceptions"):
                sub_errors = [str(se) for se in e.exceptions]
                error_msg = f"{error_msg} (Sub-errors: {', '.join(sub_errors)})"
                
            self._logger.error(f"Error connecting to SSE MCP server: {error_msg}")
            return CustomMCPConnectionResult(
                success=False,
                qualified_name="",
                display_name="",
                tools=[],
                config=config,
                url=url,
                message=f"Failed to connect: {str(e)}"
            )

    def _build_sse_success_result(self, url: str, tool_result: Any, config: Dict[str, Any], oauth_metadata: Optional[Dict[str, Any]], transport_type: str = "sse") -> CustomMCPConnectionResult:
        tools_info = []
        for tool in tool_result.tools:
            tools_info.append({
                "name": tool.name,
                "description": tool.description,
                "inputSchema": tool.inputSchema
            })
        
        display_transport = "SSE" if transport_type == "sse" else "Streamable HTTP"
        
        return CustomMCPConnectionResult(
            success=True,
            qualified_name=get_custom_mcp_qualified_name(url, "sse"),
            display_name=f"Custom {display_transport} MCP ({url})",
            tools=tools_info,
            config=config,
            url=url,
            message=f"Connected via {display_transport} ({len(tools_info)} tools)",
            oauth_metadata=oauth_metadata
        )

# Global singleton
mcp_registry_service = CustomMCPRegistryService()
