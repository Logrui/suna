"""Unified MCP Tool Executor.

Handles execution of MCP tools across all transport types (SSE, HTTP,
JSON/stdio, Composio). Used by both the legacy MCPToolWrapper and the
JIT loader path.

Two construction modes:
  1. Legacy: MCPToolExecutor(custom_tools, tool_wrapper) — for MCPToolWrapper
  2. Direct: MCPToolExecutor.from_mcp_config(mcp_config) — for JIT loader
"""

import json
import asyncio
import time
from typing import Dict, Any, Optional

from core.agentpress.tool import ToolResult
from mcp import ClientSession, StdioServerParameters
from mcp.client.sse import sse_client
from mcp.client.stdio import stdio_client
from mcp.client.streamable_http import streamablehttp_client
from core.utils.logger import logger
from core.utils.ssrf import is_safe_url, BLOCKED_HOSTNAMES, PRIVATE_IP_RANGES
from core.utils.mcp_config_schema import get_config_value


class MCPToolExecutor:
    """Unified executor for MCP tools across all transport types."""

    def __init__(self, custom_tools: Dict[str, Dict[str, Any]] = None, tool_wrapper=None):
        """Legacy constructor for use with MCPToolWrapper.

        Args:
            custom_tools: Mapping of tool names to their config dicts.
            tool_wrapper: Optional wrapper instance with success_response/fail_response.
        """
        self.custom_tools = custom_tools or {}
        self.tool_wrapper = tool_wrapper
        self._direct_mode = False
        self._mcp_config = None
        self._server_type = None
        self._mcp_service = None  # lazy-loaded to avoid circular import

    @classmethod
    def from_mcp_config(cls, mcp_config: Dict[str, Any]) -> "MCPToolExecutor":
        """Direct-mode constructor for JIT loader path.

        Creates an executor bound to a single MCP server config, dispatching
        tool calls based on the server type in the config.

        Args:
            mcp_config: Server configuration dict with customType/type, url/config, etc.
        """
        instance = cls.__new__(cls)
        instance.custom_tools = {}
        instance.tool_wrapper = None
        instance._direct_mode = True
        instance._mcp_config = mcp_config
        instance._server_type = get_config_value(mcp_config, "custom_type", "http").lower()
        instance._mcp_service = None
        return instance

    # ------------------------------------------------------------------
    # Header extraction (shared)
    # ------------------------------------------------------------------

    @staticmethod
    def build_headers(mcp_config: Dict[str, Any]) -> Dict[str, str]:
        """Extract and build headers from an MCP config dict.

        Looks for headers, access_token, and custom_headers in both the
        top-level config and the nested 'config' sub-dict.
        """
        config = mcp_config.get("config", {})
        headers = (mcp_config.get("headers") or config.get("headers") or {}).copy()

        access_token = mcp_config.get("access_token") or config.get("access_token")
        if access_token and "Authorization" not in headers:
            headers["Authorization"] = f"Bearer {access_token}"

        custom_headers = mcp_config.get("custom_headers") or config.get("custom_headers")
        if isinstance(custom_headers, dict):
            headers.update(custom_headers)

        return headers

    def _get_headers(self, mcp_config: Dict[str, Any] = None) -> Dict[str, str]:
        """Instance method wrapping build_headers for backward compat."""
        cfg = mcp_config or self._mcp_config or {}
        return self.build_headers(cfg)

    # ------------------------------------------------------------------
    # Main entry point
    # ------------------------------------------------------------------

    async def execute_tool(self, tool_name: str, arguments: Dict[str, Any]) -> ToolResult:
        logger.debug(f"Executing MCP tool {tool_name}")

        try:
            if self._direct_mode:
                return await self._execute_direct(tool_name, arguments)

            if tool_name in self.custom_tools:
                return await self._execute_custom_tool(tool_name, arguments)
            else:
                return await self._execute_standard_tool(tool_name, arguments)
        except Exception as e:
            logger.error(f"Error executing MCP tool {tool_name}: {e}")
            return self._create_error_result(f"Error executing tool: {str(e)}")

    # ------------------------------------------------------------------
    # Direct-mode dispatch (JIT path)
    # ------------------------------------------------------------------

    async def _execute_direct(self, tool_name: str, arguments: Dict[str, Any]) -> ToolResult:
        """Dispatch to transport handler based on server_type (direct mode).

        If detectedTransport is set from discovery, use it for direct dispatch
        to avoid fallback overhead for servers with known transport type.
        """
        cfg = self._mcp_config
        config_inner = cfg.get("config", {})

        # Build tool_info compatible with legacy transport methods
        tool_info = {
            "custom_type": self._server_type,
            "custom_config": config_inner if config_inner else cfg,
            "original_name": tool_name,
        }
        # Ensure url is accessible in custom_config
        if "url" not in tool_info["custom_config"]:
            url = cfg.get("url")
            if url:
                tool_info["custom_config"]["url"] = url

        # Check detectedTransport for direct dispatch (skip fallback overhead)
        detected = cfg.get("detectedTransport", "")
        if detected == "streamable-http":
            logger.debug(f"⚡ [MCP EXEC] Direct Streamable HTTP dispatch for {tool_name} (detectedTransport={detected})")
            return await self._execute_http_tool(tool_name, arguments, tool_info)

        if self._server_type == "composio":
            return await self._execute_composio_tool_direct(tool_name, arguments)
        elif self._server_type in ("sse", "http", "json"):
            if self._server_type == "sse":
                return await self._execute_sse_tool(tool_name, arguments, tool_info)
            elif self._server_type == "http":
                return await self._execute_http_tool(tool_name, arguments, tool_info)
            else:
                return await self._execute_json_tool(tool_name, arguments, tool_info)
        else:
            # Default to HTTP
            return await self._execute_http_tool(tool_name, arguments, tool_info)

    # ------------------------------------------------------------------
    # Standard tool execution (legacy path via mcp_service)
    # ------------------------------------------------------------------

    async def _execute_standard_tool(self, tool_name: str, arguments: Dict[str, Any]) -> ToolResult:
        if self._mcp_service is None:
            from core.mcp_module import mcp_service
            self._mcp_service = mcp_service

        result = await self._mcp_service.execute_tool(tool_name, arguments)
        if isinstance(result, dict):
            if result.get('isError', False):
                return self._create_error_result(result.get('content', 'Tool execution failed'))
            else:
                return self._create_success_result(result.get('content', result))
        if result and len(str(result)) > 500:
            logger.info(f"✅ [MCP EXEC] {tool_name} completed (output: {len(str(result))} chars)")
        else:
            logger.info(f"✅ [MCP EXEC] {tool_name} completed: {result}")
        return self._create_success_result(result)

    # ------------------------------------------------------------------
    # Custom tool dispatch (legacy path)
    # ------------------------------------------------------------------

    async def _execute_custom_tool(self, tool_name: str, arguments: Dict[str, Any]) -> ToolResult:
        tool_info = self.custom_tools[tool_name]
        custom_type = tool_info['custom_type']

        if custom_type == 'composio':
            custom_config = tool_info['custom_config']
            profile_id = custom_config.get('profile_id')
            if not profile_id:
                return self._create_error_result("Missing profile_id for Composio tool")
            try:
                from core.composio_integration.composio_profile_service import ComposioProfileService
                from core.services.supabase import DBConnection
                db = DBConnection()
                profile_service = ComposioProfileService(db)
                logger.info(f"🚀 [MCP EXEC] {tool_name} (via Composio {profile_id})")
                return await self._execute_http_tool(tool_name, arguments, tool_info)
            except Exception as e:
                logger.error(f"Failed to resolve Composio profile {profile_id}: {e}")
                return self._create_error_result(f"Failed to resolve Composio profile: {str(e)}")
        elif custom_type == 'sse':
            return await self._execute_sse_tool(tool_name, arguments, tool_info)
        elif custom_type == 'http':
            return await self._execute_http_tool(tool_name, arguments, tool_info)
        elif custom_type == 'json':
            return await self._execute_json_tool(tool_name, arguments, tool_info)
        else:
            return self._create_error_result(f"Unsupported custom MCP type: {custom_type}")

    # ------------------------------------------------------------------
    # Composio direct execution (JIT path — resolves MCP URL at runtime)
    # ------------------------------------------------------------------

    async def _execute_composio_tool_direct(self, tool_name: str, args: Dict[str, Any]) -> ToolResult:
        """Execute a Composio tool by resolving its MCP URL dynamically."""
        custom_config = (self._mcp_config or {}).get("config", self._mcp_config or {})
        profile_id = custom_config.get('profile_id')

        if not profile_id:
            return self._create_error_result("Missing profile_id for Composio tool")

        try:
            from core.composio_integration.composio_profile_service import ComposioProfileService
            from core.services.supabase import DBConnection

            db = DBConnection()
            profile_service = ComposioProfileService(db)
            mcp_url = await profile_service.get_mcp_url_for_runtime(profile_id)

            logger.debug(f"⚡ [MCP EXEC] Executing {tool_name} via Composio")

            start_exec = time.time()
            async with asyncio.timeout(30):
                async with streamablehttp_client(mcp_url) as (read, write, _):
                    async with ClientSession(read, write) as session:
                        await session.initialize()
                        result = await session.call_tool(tool_name, arguments=args)
                        elapsed = (time.time() - start_exec) * 1000
                        logger.info(f"✅ [MCP EXEC] {tool_name} success in {elapsed:.1f}ms")
                        return self._create_success_result(self._extract_content(result))

        except asyncio.TimeoutError:
            logger.error(f"❌ [MCP EXEC] Composio execution timeout for {tool_name}")
            return self._create_error_result("Composio tool execution timeout after 30 seconds")
        except Exception as e:
            logger.error(f"❌ [MCP EXEC] Composio execution failed for {tool_name}: {e}")
            return self._create_error_result(f"Failed to execute Composio tool: {str(e)}")

    # ------------------------------------------------------------------
    # Transport executors (shared by legacy and direct modes)
    # ------------------------------------------------------------------

    async def _execute_sse_tool(self, tool_name: str, arguments: Dict[str, Any], tool_info: Dict[str, Any]) -> ToolResult:
        """Execute tool via SSE transport, with Streamable HTTP fallback on failure.

        Many MCP servers registered as 'sse' type actually only support
        Streamable HTTP (POST-based). When SSE fails (e.g. 405 Method Not Allowed),
        we automatically fall back to Streamable HTTP transport.
        """
        custom_config = tool_info['custom_config']
        original_tool_name = tool_info.get('original_name', tool_name)

        url = custom_config.get('url')
        if not url:
            return self._create_error_result("Missing 'url' in SSE MCP config")

        # SSRF Protection
        is_safe, error_msg = is_safe_url(url)
        if not is_safe:
            logger.error(f"❌ [MCP EXEC] SSRF Blocked for {url}")
            return self._create_error_result(f"URL validation failed: {error_msg}")

        headers = self._get_headers(custom_config)
        logger.debug(f"🔑 [MCP EXEC] Headers: { {k: '***' if k.lower() == 'authorization' else v for k, v in headers.items()} }")

        # --- Attempt 1: Standard SSE transport (GET-based) ---
        sse_error = None
        start_exec = time.time()
        try:
            async with asyncio.timeout(30):
                try:
                    async with sse_client(url, headers=headers) as (read, write):
                        async with ClientSession(read, write) as session:
                            await session.initialize()
                            result = await session.call_tool(original_tool_name, arguments)
                            elapsed = (time.time() - start_exec) * 1000
                            logger.info(f"✅ [MCP EXEC] {tool_name} success in {elapsed:.1f}ms")
                            return self._create_success_result(self._extract_content(result))
                except TypeError as e:
                    if "unexpected keyword argument" in str(e):
                        async with sse_client(url) as (read, write):
                            async with ClientSession(read, write) as session:
                                await session.initialize()
                                result = await session.call_tool(original_tool_name, arguments)
                                return self._create_success_result(self._extract_content(result))
                    else:
                        raise
        except asyncio.TimeoutError:
            logger.error(f"❌ [MCP EXEC] SSE execution timeout for {tool_name}")
            return self._create_error_result("SSE tool execution timeout after 30 seconds")
        except (Exception, BaseException) as e:
            sse_error = e
            logger.info(f"ℹ️ [MCP EXEC] SSE execution failed for {tool_name}: {type(e).__name__}. Trying Streamable HTTP fallback...")

        # --- Attempt 2: Streamable HTTP transport (POST-based) fallback ---
        start_exec = time.time()
        try:
            async with asyncio.timeout(30):
                async with streamablehttp_client(url, headers=headers) as (read, write, _):
                    async with ClientSession(read, write) as session:
                        await session.initialize()
                        result = await session.call_tool(original_tool_name, arguments)
                        elapsed = (time.time() - start_exec) * 1000
                        logger.info(f"✅ [MCP EXEC] {tool_name} via Streamable HTTP fallback in {elapsed:.1f}ms")
                        return self._create_success_result(self._extract_content(result))
        except asyncio.TimeoutError:
            logger.error(f"❌ [MCP EXEC] Streamable HTTP fallback timeout for {tool_name}")
            return self._create_error_result("Tool execution timeout after 30 seconds (both SSE and Streamable HTTP)")
        except (Exception, BaseException) as http_err:
            logger.error(f"❌ [MCP EXEC] Both SSE and Streamable HTTP failed for {tool_name}. SSE: {sse_error}, HTTP: {http_err}")
            return self._create_error_result(f"Failed to execute tool (SSE: {sse_error}, Streamable HTTP: {http_err})")

    async def _execute_http_tool(self, tool_name: str, arguments: Dict[str, Any], tool_info: Dict[str, Any]) -> ToolResult:
        custom_config = tool_info['custom_config']
        original_tool_name = tool_info.get('original_name', tool_name)

        url = custom_config.get('url')
        if not url:
            return self._create_error_result("Missing 'url' in HTTP MCP config")

        # SSRF Protection
        is_safe, error_msg = is_safe_url(url)
        if not is_safe:
            logger.error(f"❌ [MCP EXEC] SSRF Blocked for {url}")
            return self._create_error_result(f"URL validation failed: {error_msg}")

        headers = self._get_headers(custom_config)
        logger.debug(f"🔑 [MCP EXEC] Headers: { {k: '***' if k.lower() == 'authorization' else v for k, v in headers.items()} }")

        start_exec = time.time()
        try:
            async with asyncio.timeout(30):
                async with streamablehttp_client(url, headers=headers) as (read, write, _):
                    async with ClientSession(read, write) as session:
                        await session.initialize()
                        result = await session.call_tool(original_tool_name, arguments)
                        elapsed = (time.time() - start_exec) * 1000
                        logger.info(f"✅ [MCP EXEC] {tool_name} success in {elapsed:.1f}ms")
                        return self._create_success_result(self._extract_content(result))
        except asyncio.TimeoutError:
            logger.error(f"❌ [MCP EXEC] HTTP execution timeout for {tool_name}")
            return self._create_error_result("HTTP tool execution timeout after 30 seconds")
        except Exception as e:
            logger.error(f"❌ [MCP EXEC] HTTP execution failed for {tool_name}: {e}")
            return self._create_error_result(f"Failed to execute HTTP tool: {str(e)}")

    async def _execute_json_tool(self, tool_name: str, arguments: Dict[str, Any], tool_info: Dict[str, Any]) -> ToolResult:
        custom_config = tool_info['custom_config']
        original_tool_name = tool_info.get('original_name', tool_name)

        command = custom_config.get("command")
        if not command:
            return self._create_error_result("Missing 'command' in JSON/stdio MCP config")

        server_params = StdioServerParameters(
            command=command,
            args=custom_config.get("args", []),
            env=custom_config.get("env", {})
        )

        start_exec = time.time()
        try:
            async with asyncio.timeout(30):
                async with stdio_client(server_params) as (read, write):
                    async with ClientSession(read, write) as session:
                        await session.initialize()
                        result = await session.call_tool(original_tool_name, arguments)
                        elapsed = (time.time() - start_exec) * 1000
                        logger.info(f"✅ [MCP EXEC] {tool_name} success in {elapsed:.1f}ms")
                        return self._create_success_result(self._extract_content(result))
        except asyncio.TimeoutError:
            logger.error(f"❌ [MCP EXEC] JSON/stdio execution timeout for {tool_name}")
            return self._create_error_result("JSON/stdio tool execution timeout after 30 seconds")
        except Exception as e:
            logger.error(f"❌ [MCP EXEC] JSON/stdio execution failed for {tool_name}: {e}")
            return self._create_error_result(f"Failed to execute JSON/stdio tool: {str(e)}")

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    async def _resolve_external_user_id(self, custom_config: Dict[str, Any]) -> str:
        profile_id = custom_config.get('profile_id')
        external_user_id = custom_config.get('external_user_id')

        if not profile_id:
            return external_user_id

        try:
            from core.services.supabase import DBConnection
            from core.utils.encryption import decrypt_data

            db = DBConnection()
            supabase = await db.client
            result = await supabase.table('user_mcp_credential_profiles').select(
                'encrypted_config'
            ).eq('profile_id', profile_id).single().execute()

            if result.data:
                decrypted_config = decrypt_data(result.data['encrypted_config'])
                config_data = json.loads(decrypted_config)
                return config_data.get('external_user_id', external_user_id)

        except Exception as e:
            logger.error(f"Failed to resolve profile {profile_id}: {e}")

        return external_user_id

    @staticmethod
    def _extract_content(result) -> str:
        """Extract text content from an MCP CallToolResult."""
        if hasattr(result, 'content'):
            content = result.content
            if isinstance(content, list):
                text_parts = []
                for item in content:
                    if hasattr(item, 'text'):
                        text_parts.append(item.text)
                    else:
                        text_parts.append(str(item))
                return "\n".join(text_parts)
            elif hasattr(content, 'text'):
                return content.text
            else:
                return str(content)
        elif isinstance(result, dict):
            return result.get('content', str(result))
        else:
            return str(result)

    def _create_success_result(self, content: Any) -> ToolResult:
        if self.tool_wrapper and hasattr(self.tool_wrapper, 'success_response'):
            return self.tool_wrapper.success_response(content)
        return ToolResult(success=True, output=str(content))

    def _create_error_result(self, error_message: str) -> ToolResult:
        if self.tool_wrapper and hasattr(self.tool_wrapper, 'fail_response'):
            return self.tool_wrapper.fail_response(error_message)
        return ToolResult(success=False, output=error_message)
