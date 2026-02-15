"""
Phase 3 – Executor Consolidation Tests

Tests for:
  - Unified MCPToolExecutor dual-mode construction (legacy + JIT)
  - Header building (static + instance methods)
  - Direct-mode dispatch routing
  - Legacy-mode dispatch routing
  - SSRF protection in both modes
  - Composio direct execution path
  - Result helpers (_extract_content, _create_success_result, _create_error_result)
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from core.tools.utils.mcp_tool_executor import MCPToolExecutor
from core.agentpress.tool import ToolResult


# ===================================================================
# 1. Dual-mode construction
# ===================================================================

class TestDualModeConstruction:
    """Verify both construction modes set internal state correctly."""

    def test_legacy_constructor_defaults(self):
        executor = MCPToolExecutor()
        assert executor._direct_mode is False
        assert executor.custom_tools == {}
        assert executor.tool_wrapper is None
        assert executor._mcp_config is None
        assert executor._server_type is None

    def test_legacy_constructor_with_tools(self):
        tools = {"my_tool": {"custom_type": "http", "custom_config": {"url": "https://example.com"}, "original_name": "my_tool"}}
        wrapper = MagicMock()
        executor = MCPToolExecutor(tools, wrapper)
        assert executor._direct_mode is False
        assert executor.custom_tools == tools
        assert executor.tool_wrapper is wrapper

    def test_jit_constructor_from_mcp_config(self):
        config = {"customType": "sse", "url": "https://example.com/mcp"}
        executor = MCPToolExecutor.from_mcp_config(config)
        assert executor._direct_mode is True
        assert executor._mcp_config == config
        assert executor._server_type == "sse"
        assert executor.custom_tools == {}
        assert executor.tool_wrapper is None

    def test_jit_constructor_defaults_to_http(self):
        config = {"url": "https://example.com/mcp"}
        executor = MCPToolExecutor.from_mcp_config(config)
        assert executor._server_type == "http"

    def test_jit_constructor_normalizes_type(self):
        config = {"customType": "HTTP", "url": "https://example.com"}
        executor = MCPToolExecutor.from_mcp_config(config)
        assert executor._server_type == "http"


# ===================================================================
# 2. Header building
# ===================================================================

class TestHeaderBuilding:

    def test_build_headers_with_access_token(self):
        config = {"access_token": "tok123"}
        headers = MCPToolExecutor.build_headers(config)
        assert headers["Authorization"] == "Bearer tok123"

    def test_build_headers_nested_access_token(self):
        config = {"config": {"access_token": "nested_tok"}}
        headers = MCPToolExecutor.build_headers(config)
        assert headers["Authorization"] == "Bearer nested_tok"

    def test_build_headers_custom_headers_merged(self):
        config = {"custom_headers": {"X-Custom": "val1"}, "config": {"custom_headers": {"X-Other": "val2"}}}
        headers = MCPToolExecutor.build_headers(config)
        # Top-level custom_headers wins first, then nested
        assert "X-Custom" in headers or "X-Other" in headers

    def test_build_headers_existing_auth_not_overwritten(self):
        config = {"access_token": "tok", "headers": {"Authorization": "Bearer existing"}}
        headers = MCPToolExecutor.build_headers(config)
        assert headers["Authorization"] == "Bearer existing"

    def test_instance_get_headers_uses_mcp_config(self):
        config = {"customType": "http", "access_token": "direct_tok"}
        executor = MCPToolExecutor.from_mcp_config(config)
        headers = executor._get_headers()
        assert headers["Authorization"] == "Bearer direct_tok"

    def test_instance_get_headers_override(self):
        executor = MCPToolExecutor.from_mcp_config({"customType": "http"})
        headers = executor._get_headers({"access_token": "override"})
        assert headers["Authorization"] == "Bearer override"


# ===================================================================
# 3. Direct-mode dispatch routing
# ===================================================================

class TestDirectModeDispatch:

    @pytest.mark.asyncio
    async def test_dispatch_routes_to_sse(self):
        config = {"customType": "sse", "url": "https://example.com/mcp", "config": {"url": "https://example.com/mcp"}}
        executor = MCPToolExecutor.from_mcp_config(config)

        with patch.object(executor, "_execute_sse_tool", new_callable=AsyncMock, return_value=ToolResult(success=True, output="ok")) as mock_sse:
            result = await executor.execute_tool("test_tool", {"arg": "val"})
            mock_sse.assert_awaited_once()
            assert result.success is True

    @pytest.mark.asyncio
    async def test_dispatch_routes_to_http(self):
        config = {"customType": "http", "url": "https://example.com/mcp", "config": {"url": "https://example.com/mcp"}}
        executor = MCPToolExecutor.from_mcp_config(config)

        with patch.object(executor, "_execute_http_tool", new_callable=AsyncMock, return_value=ToolResult(success=True, output="ok")) as mock_http:
            result = await executor.execute_tool("test_tool", {"arg": "val"})
            mock_http.assert_awaited_once()
            assert result.success is True

    @pytest.mark.asyncio
    async def test_dispatch_routes_to_json(self):
        config = {"customType": "json", "config": {"command": "npx", "args": ["-y", "server"]}}
        executor = MCPToolExecutor.from_mcp_config(config)

        with patch.object(executor, "_execute_json_tool", new_callable=AsyncMock, return_value=ToolResult(success=True, output="ok")) as mock_json:
            result = await executor.execute_tool("test_tool", {"arg": "val"})
            mock_json.assert_awaited_once()
            assert result.success is True

    @pytest.mark.asyncio
    async def test_dispatch_routes_to_composio(self):
        config = {"customType": "composio", "config": {"profile_id": "prof_123"}}
        executor = MCPToolExecutor.from_mcp_config(config)

        with patch.object(executor, "_execute_composio_tool_direct", new_callable=AsyncMock, return_value=ToolResult(success=True, output="ok")) as mock_composio:
            result = await executor.execute_tool("GITHUB_CREATE_ISSUE", {"arg": "val"})
            mock_composio.assert_awaited_once()
            assert result.success is True

    @pytest.mark.asyncio
    async def test_dispatch_unknown_type_defaults_to_http(self):
        config = {"customType": "unknown_type", "url": "https://example.com", "config": {"url": "https://example.com"}}
        executor = MCPToolExecutor.from_mcp_config(config)

        with patch.object(executor, "_execute_http_tool", new_callable=AsyncMock, return_value=ToolResult(success=True, output="ok")) as mock_http:
            result = await executor.execute_tool("test_tool", {})
            mock_http.assert_awaited_once()


# ===================================================================
# 4. Legacy-mode dispatch routing
# ===================================================================

class TestLegacyModeDispatch:

    @pytest.mark.asyncio
    async def test_custom_tool_routes_to_execute_custom_tool(self):
        tools = {"my_tool": {"custom_type": "http", "custom_config": {"url": "https://example.com"}, "original_name": "my_tool"}}
        executor = MCPToolExecutor(tools, None)

        with patch.object(executor, "_execute_custom_tool", new_callable=AsyncMock, return_value=ToolResult(success=True, output="ok")) as mock_custom:
            result = await executor.execute_tool("my_tool", {"arg": "val"})
            mock_custom.assert_awaited_once_with("my_tool", {"arg": "val"})

    @pytest.mark.asyncio
    async def test_unknown_tool_routes_to_execute_standard_tool(self):
        executor = MCPToolExecutor({}, None)

        with patch.object(executor, "_execute_standard_tool", new_callable=AsyncMock, return_value=ToolResult(success=True, output="ok")) as mock_std:
            result = await executor.execute_tool("unknown_tool", {"arg": "val"})
            mock_std.assert_awaited_once_with("unknown_tool", {"arg": "val"})

    @pytest.mark.asyncio
    async def test_execute_tool_error_handling(self):
        executor = MCPToolExecutor({}, None)

        with patch.object(executor, "_execute_standard_tool", new_callable=AsyncMock, side_effect=Exception("boom")):
            result = await executor.execute_tool("tool", {})
            assert result.success is False
            assert "boom" in result.output


# ===================================================================
# 5. SSRF protection in both modes
# ===================================================================

class TestSSRFBothModes:

    @pytest.mark.asyncio
    async def test_direct_mode_sse_blocks_private(self):
        config = {"customType": "sse", "url": "http://192.168.1.1:8080/mcp", "config": {"url": "http://192.168.1.1:8080/mcp"}}
        executor = MCPToolExecutor.from_mcp_config(config)
        result = await executor.execute_tool("some_tool", {})
        assert result.success is False
        assert "validation failed" in result.output.lower() or "SSRF" in result.output

    @pytest.mark.asyncio
    async def test_direct_mode_http_blocks_private(self):
        config = {"customType": "http", "url": "http://10.0.0.1/mcp", "config": {"url": "http://10.0.0.1/mcp"}}
        executor = MCPToolExecutor.from_mcp_config(config)
        result = await executor.execute_tool("some_tool", {})
        assert result.success is False

    @pytest.mark.asyncio
    async def test_legacy_mode_sse_blocks_private(self):
        tools = {"bad_tool": {"custom_type": "sse", "custom_config": {"url": "http://127.0.0.1:9999/mcp"}, "original_name": "bad_tool"}}
        executor = MCPToolExecutor(tools, None)
        result = await executor.execute_tool("bad_tool", {})
        assert result.success is False

    @pytest.mark.asyncio
    async def test_legacy_mode_http_blocks_private(self):
        tools = {"bad_tool": {"custom_type": "http", "custom_config": {"url": "http://169.254.169.254/latest"}, "original_name": "bad_tool"}}
        executor = MCPToolExecutor(tools, None)
        result = await executor.execute_tool("bad_tool", {})
        assert result.success is False


# ===================================================================
# 6. Result helpers
# ===================================================================

class TestResultHelpers:

    def test_extract_content_from_text_result(self):
        mock_result = MagicMock()
        mock_item = MagicMock()
        mock_item.text = "hello world"
        mock_result.content = [mock_item]
        assert MCPToolExecutor._extract_content(mock_result) == "hello world"

    def test_extract_content_from_dict(self):
        result = {"content": "dict content"}
        assert MCPToolExecutor._extract_content(result) == "dict content"

    def test_extract_content_from_string(self):
        assert MCPToolExecutor._extract_content("plain string") == "plain string"

    def test_create_success_with_wrapper(self):
        wrapper = MagicMock()
        wrapper.success_response.return_value = ToolResult(success=True, output="wrapped")
        executor = MCPToolExecutor({}, wrapper)
        result = executor._create_success_result("content")
        wrapper.success_response.assert_called_once_with("content")
        assert result.output == "wrapped"

    def test_create_success_without_wrapper(self):
        executor = MCPToolExecutor({}, None)
        result = executor._create_success_result("content")
        assert result.success is True
        assert result.output == "content"

    def test_create_error_with_wrapper(self):
        wrapper = MagicMock()
        wrapper.fail_response.return_value = ToolResult(success=False, output="wrapped error")
        executor = MCPToolExecutor({}, wrapper)
        result = executor._create_error_result("oops")
        wrapper.fail_response.assert_called_once_with("oops")

    def test_create_error_without_wrapper(self):
        executor = MCPToolExecutor({}, None)
        result = executor._create_error_result("oops")
        assert result.success is False
        assert result.output == "oops"


# ===================================================================
# 7. JIT loader integration — uses unified executor
# ===================================================================

@pytest.mark.asyncio
async def test_jit_loader_creates_unified_executor():
    """The JIT loader's _create_mcp_tool_wrapper should use the unified
    MCPToolExecutor.from_mcp_config, not the old jit/mcp_tool_wrapper."""
    from core.jit.loader import JITLoader

    mock_tool_info = MagicMock()
    mock_tool_info.mcp_config = {"customType": "http", "url": "https://example.com/mcp", "config": {"url": "https://example.com/mcp"}}

    schema = {"name": "test_tool", "description": "test", "input_schema": {"type": "object"}}

    wrapper = await JITLoader._create_mcp_tool_wrapper("test_tool", schema, mock_tool_info)

    # Verify it uses the unified executor
    assert hasattr(wrapper, "_executor")
    assert isinstance(wrapper._executor, MCPToolExecutor)
    assert wrapper._executor._direct_mode is True
    assert wrapper._executor._server_type == "http"
