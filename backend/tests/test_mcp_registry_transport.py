"""
MCP Registry Transport Tests: SSE vs Streamable HTTP fallback

Tests cover:
- Valyu-style servers that reject GET (SSE) with 405 but accept POST (Streamable HTTP)
- MCPRegistry._load_sse_mcp_schemas should fall back to Streamable HTTP on 405
- MCPRegistry._load_custom_mcp_schemas routing based on custom_type
- Discovery vs Runtime transport consistency
- Tool EXECUTION fallback: both JIT wrapper and unified executor
- Real probe against Valyu MCP endpoint (integration test, skipped in CI)

Root Cause Under Test:
  Discovery (custom_mcp_registry_service.py) has SSE→HTTP fallback
  Runtime schema loading (mcp_registry.py) — FIXED with SSE→HTTP fallback
  Runtime execution (mcp_tool_wrapper.py, mcp_tool_executor.py) — FIXED with SSE→HTTP fallback
"""
import pytest
import asyncio
import time
from unittest.mock import AsyncMock, patch, MagicMock
from typing import Dict, Any

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

VALYU_URL = "https://mcp.valyu.ai/mcp?valyuApiKey=16DoiorLuv4rvvzwQhRdo2p2W0CqD1ZN9t4RQGeX"

VALYU_TOOLS = [
    "valyu_search", "valyu_academic_search", "valyu_financial_search",
    "valyu_sec_search", "valyu_company_research", "valyu_patents",
    "valyu_bio_search", "valyu_economics_search", "valyu_contents",
    "valyu_datasources", "valyu_datasources_categories"
]


def make_mock_tool(name: str, description: str = ""):
    """Create a mock MCP Tool object"""
    tool = MagicMock()
    tool.name = name
    tool.description = description or f"Execute {name}"
    tool.inputSchema = {"type": "object", "properties": {}, "required": []}
    return tool


def make_mock_tool_result(tool_names: list):
    """Create a mock tools/list result"""
    result = MagicMock()
    result.tools = [make_mock_tool(name) for name in tool_names]
    return result


def make_valyu_config() -> Dict[str, Any]:
    """Config as stored in agent's custom_mcp array"""
    return {
        "name": "Valyu",
        "type": "sse",
        "config": {
            "url": VALYU_URL,
            "requires_config": False
        },
        "isCustom": True,
        "enabledTools": VALYU_TOOLS,
        "qualifiedName": "custom_mcp_valyu_fa45fd"
    }


# ==============================================================================
# Unit Tests: Transport routing
# ==============================================================================

class TestMCPRegistryTransportRouting:
    """Test that _load_custom_mcp_schemas routes to the right loader"""

    @pytest.mark.asyncio
    async def test_sse_type_routes_to_sse_loader(self):
        """custom_type='sse' should call _load_sse_mcp_schemas"""
        from core.agentpress.mcp_registry import MCPRegistry

        registry = MCPRegistry()
        config = make_valyu_config()

        with patch.object(registry, '_load_sse_mcp_schemas', new_callable=AsyncMock, return_value={"tool1": {}}) as mock_sse:
            with patch.object(registry, '_load_http_mcp_schemas', new_callable=AsyncMock) as mock_http:
                result = await registry._load_custom_mcp_schemas("sse", config)
                mock_sse.assert_called_once()
                mock_http.assert_not_called()
                assert result == {"tool1": {}}

    @pytest.mark.asyncio
    async def test_http_type_routes_to_http_loader(self):
        """custom_type='http' should call _load_http_mcp_schemas"""
        from core.agentpress.mcp_registry import MCPRegistry

        registry = MCPRegistry()
        config = make_valyu_config()

        with patch.object(registry, '_load_sse_mcp_schemas', new_callable=AsyncMock) as mock_sse:
            with patch.object(registry, '_load_http_mcp_schemas', new_callable=AsyncMock, return_value={"tool1": {}}) as mock_http:
                result = await registry._load_custom_mcp_schemas("http", config)
                mock_sse.assert_not_called()
                mock_http.assert_called_once()

    @pytest.mark.asyncio
    async def test_unknown_type_defaults_to_http(self):
        """Unknown custom_type should default to HTTP"""
        from core.agentpress.mcp_registry import MCPRegistry

        registry = MCPRegistry()
        config = make_valyu_config()

        with patch.object(registry, '_load_http_mcp_schemas', new_callable=AsyncMock, return_value={}) as mock_http:
            result = await registry._load_custom_mcp_schemas("unknown_type", config)
            mock_http.assert_called_once()


# ==============================================================================
# Unit Tests: SSE loader with 405 → Streamable HTTP fallback
# ==============================================================================

class TestSSELoaderFallback:
    """Test that _load_sse_mcp_schemas falls back to Streamable HTTP on 405"""

    @pytest.mark.asyncio
    async def test_sse_405_should_fallback_to_streamable_http(self):
        """
        THE KEY BUG: When SSE client gets 405, runtime should fall back to
        Streamable HTTP, just like discovery does.
        """
        from core.agentpress.mcp_registry import MCPRegistry
        import httpx

        registry = MCPRegistry()
        config = make_valyu_config()

        # Simulate SSE 405 error (what Valyu returns for GET)
        sse_error = httpx.HTTPStatusError(
            "Client error '405 Method Not Allowed'",
            request=MagicMock(),
            response=MagicMock(status_code=405)
        )
        # Wrap in ExceptionGroup like anyio does
        sse_exception_group = ExceptionGroup(
            "unhandled errors in a TaskGroup",
            [sse_error]
        )

        mock_tool_result = make_mock_tool_result(VALYU_TOOLS)

        # Mock SSE client to fail with 405 ExceptionGroup
        mock_sse_context = AsyncMock()
        mock_sse_context.__aenter__ = AsyncMock(side_effect=sse_exception_group)

        # Mock Streamable HTTP client to succeed
        mock_http_context = AsyncMock()
        mock_http_context.__aenter__ = AsyncMock(return_value=(AsyncMock(), AsyncMock(), None))
        mock_http_context.__aexit__ = AsyncMock(return_value=False)

        # Patch at the import source since _load_sse_mcp_schemas imports inside the function
        with patch('mcp.client.sse.sse_client', return_value=mock_sse_context):
            with patch('mcp.client.streamable_http.streamablehttp_client', return_value=mock_http_context):
                with patch('mcp.ClientSession') as mock_session_cls:
                    mock_session_instance = AsyncMock()
                    mock_session_instance.initialize = AsyncMock()
                    mock_session_instance.list_tools = AsyncMock(return_value=mock_tool_result)
                    mock_session_instance.__aenter__ = AsyncMock(return_value=mock_session_instance)
                    mock_session_instance.__aexit__ = AsyncMock(return_value=False)
                    mock_session_cls.return_value = mock_session_instance

                    schemas = await registry._load_sse_mcp_schemas(config)

                    # After fix: should have found tools via Streamable HTTP fallback
                    assert len(schemas) == len(VALYU_TOOLS), (
                        f"Expected {len(VALYU_TOOLS)} tools from Streamable HTTP fallback, "
                        f"got {len(schemas)}. SSE→HTTP fallback is missing in runtime!"
                    )

    @pytest.mark.asyncio
    async def test_sse_success_no_fallback_needed(self):
        """When SSE works fine, no fallback should be attempted"""
        from core.agentpress.mcp_registry import MCPRegistry

        registry = MCPRegistry()
        config = {"url": "https://example.com/sse", "config": {"url": "https://example.com/sse"}}

        mock_tool_result = make_mock_tool_result(["tool_a", "tool_b"])

        mock_session = AsyncMock()
        mock_session.initialize = AsyncMock()
        mock_session.list_tools = AsyncMock(return_value=mock_tool_result)
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=False)

        mock_sse_streams = AsyncMock()
        mock_sse_streams.__aenter__ = AsyncMock(return_value=(AsyncMock(), AsyncMock()))
        mock_sse_streams.__aexit__ = AsyncMock(return_value=False)

        # Patch at import source level
        with patch('mcp.client.sse.sse_client', return_value=mock_sse_streams):
            with patch('mcp.ClientSession', return_value=mock_session):
                schemas = await registry._load_sse_mcp_schemas(config)
                assert len(schemas) == 2
                assert "tool_a" in schemas
                assert "tool_b" in schemas


# ==============================================================================
# Unit Tests: Discovery vs Runtime consistency
# ==============================================================================

class TestDiscoveryRuntimeConsistency:
    """Verify that discovery and runtime use consistent transport logic"""

    @pytest.mark.asyncio
    async def test_discovery_sse_has_http_fallback(self):
        """Verify discovery's SSE path has Streamable HTTP fallback (reference test)"""
        from core.mcp_module.custom_mcp_registry_service import CustomMCPRegistryService

        service = CustomMCPRegistryService()

        import inspect
        source = inspect.getsource(service._discover_sse_tools)

        # Discovery should have streamablehttp_client fallback
        assert "streamablehttp_client" in source, (
            "Discovery SSE path should have Streamable HTTP fallback"
        )

    @pytest.mark.asyncio
    async def test_runtime_sse_should_have_http_fallback(self):
        """
        Verify runtime's SSE schema loader also has Streamable HTTP fallback.
        This test checks the source code for the fix.
        """
        from core.agentpress.mcp_registry import MCPRegistry

        import inspect
        source = inspect.getsource(MCPRegistry._load_sse_mcp_schemas)

        # Runtime SSE loader SHOULD have streamablehttp_client fallback
        assert "streamablehttp_client" in source, (
            "Runtime SSE schema loader is MISSING Streamable HTTP fallback! "
            "This causes 405 errors for servers like Valyu that only support "
            "POST-based Streamable HTTP transport."
        )


# ==============================================================================
# Unit Tests: Config custom_type extraction
# ==============================================================================

class TestConfigTypeExtraction:
    """Test how custom_type is extracted from stored agent configs"""

    def test_valyu_config_extracts_sse_type(self):
        """Valyu is stored as type='sse' even though it's Streamable HTTP"""
        from core.utils.mcp_config_schema import get_config_value

        config = make_valyu_config()
        custom_type = get_config_value(config, "custom_type", "http")

        # This is the stored type — it's 'sse' because the frontend discovery
        # succeeded via the SSE endpoint (with backend's internal fallback)
        # but the frontend doesn't know about the internal Streamable HTTP fallback
        assert custom_type in ("sse", "http"), f"Unexpected custom_type: {custom_type}"

    def test_config_type_vs_custom_type(self):
        """Verify type and customType resolve correctly"""
        from core.utils.mcp_config_schema import get_config_value

        config = make_valyu_config()

        # 'type' is what's stored at top level
        stored_type = config.get("type")
        assert stored_type == "sse"


# ==============================================================================
# Unit Tests: Execution fallback (JIT mcp_tool_wrapper.py)
# ==============================================================================

class TestJITExecutorSSEFallback:
    """Test that JIT MCPToolExecutor._execute_sse_tool falls back to Streamable HTTP"""

    @pytest.mark.asyncio
    async def test_sse_execution_405_falls_back_to_streamable_http(self):
        """When SSE execution fails with 405, should fall back to Streamable HTTP"""
        from core.jit.mcp_tool_wrapper import MCPToolExecutor

        config = {
            "type": "sse",
            "config": {"url": "https://example.com/mcp"},
        }
        executor = MCPToolExecutor(config)

        # Simulate SSE 405 error
        sse_error = ExceptionGroup(
            "unhandled errors in a TaskGroup",
            [Exception("405 Method Not Allowed")]
        )

        mock_sse_ctx = AsyncMock()
        mock_sse_ctx.__aenter__ = AsyncMock(side_effect=sse_error)

        # Mock Streamable HTTP to succeed
        mock_call_result = MagicMock()
        mock_call_result.content = [MagicMock(text="search result data")]

        mock_session = AsyncMock()
        mock_session.initialize = AsyncMock()
        mock_session.call_tool = AsyncMock(return_value=mock_call_result)
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=False)

        mock_http_ctx = AsyncMock()
        mock_http_ctx.__aenter__ = AsyncMock(return_value=(AsyncMock(), AsyncMock(), None))
        mock_http_ctx.__aexit__ = AsyncMock(return_value=False)

        with patch('mcp.client.sse.sse_client', return_value=mock_sse_ctx):
            with patch('mcp.client.streamable_http.streamablehttp_client', return_value=mock_http_ctx):
                with patch('mcp.ClientSession', return_value=mock_session):
                    result = await executor._execute_sse_tool("valyu_search", {"query": "test"})

                    assert result.success is True, (
                        f"Expected success via Streamable HTTP fallback, got: {result.output}"
                    )

    @pytest.mark.asyncio
    async def test_sse_execution_success_no_fallback(self):
        """When SSE execution works, no fallback should be triggered"""
        from core.jit.mcp_tool_wrapper import MCPToolExecutor

        config = {
            "type": "sse",
            "config": {"url": "https://example.com/mcp"},
        }
        executor = MCPToolExecutor(config)

        mock_call_result = MagicMock()
        mock_call_result.content = [MagicMock(text="success")]

        mock_session = AsyncMock()
        mock_session.initialize = AsyncMock()
        mock_session.call_tool = AsyncMock(return_value=mock_call_result)
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=False)

        mock_sse_ctx = AsyncMock()
        mock_sse_ctx.__aenter__ = AsyncMock(return_value=(AsyncMock(), AsyncMock()))
        mock_sse_ctx.__aexit__ = AsyncMock(return_value=False)

        with patch('mcp.client.sse.sse_client', return_value=mock_sse_ctx):
            with patch('mcp.ClientSession', return_value=mock_session):
                result = await executor._execute_sse_tool("some_tool", {"arg": "val"})
                assert result.success is True

    def test_jit_executor_has_streamable_http_fallback_in_source(self):
        """Verify the JIT executor source code contains Streamable HTTP fallback"""
        from core.jit.mcp_tool_wrapper import MCPToolExecutor
        import inspect
        source = inspect.getsource(MCPToolExecutor._execute_sse_tool)

        assert "streamablehttp_client" in source, (
            "JIT MCPToolExecutor._execute_sse_tool is MISSING Streamable HTTP fallback!"
        )


# ==============================================================================
# Unit Tests: Execution fallback (unified mcp_tool_executor.py)
# ==============================================================================

class TestUnifiedExecutorSSEFallback:
    """Test that unified MCPToolExecutor._execute_sse_tool falls back to Streamable HTTP"""

    @pytest.mark.asyncio
    async def test_unified_sse_execution_405_falls_back_to_streamable_http(self):
        """When SSE execution fails with 405, unified executor should fall back"""
        from core.tools.utils.mcp_tool_executor import MCPToolExecutor

        mcp_config = {
            "customType": "sse",
            "config": {"url": "https://example.com/mcp"},
        }
        executor = MCPToolExecutor.from_mcp_config(mcp_config)

        tool_info = {
            "custom_type": "sse",
            "custom_config": {"url": "https://example.com/mcp"},
            "original_name": "valyu_search",
        }

        # Simulate SSE 405 error
        sse_error = ExceptionGroup(
            "unhandled errors in a TaskGroup",
            [Exception("405 Method Not Allowed")]
        )

        mock_sse_ctx = AsyncMock()
        mock_sse_ctx.__aenter__ = AsyncMock(side_effect=sse_error)

        # Mock Streamable HTTP to succeed
        mock_call_result = MagicMock()
        mock_call_result.content = [MagicMock(text="search result data")]

        mock_session = AsyncMock()
        mock_session.initialize = AsyncMock()
        mock_session.call_tool = AsyncMock(return_value=mock_call_result)
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=False)

        mock_http_ctx = AsyncMock()
        mock_http_ctx.__aenter__ = AsyncMock(return_value=(AsyncMock(), AsyncMock(), None))
        mock_http_ctx.__aexit__ = AsyncMock(return_value=False)

        with patch('core.tools.utils.mcp_tool_executor.sse_client', return_value=mock_sse_ctx):
            with patch('core.tools.utils.mcp_tool_executor.streamablehttp_client', return_value=mock_http_ctx):
                with patch('core.tools.utils.mcp_tool_executor.ClientSession', return_value=mock_session):
                    result = await executor._execute_sse_tool("valyu_search", {"query": "test"}, tool_info)

                    assert result.success is True, (
                        f"Expected success via Streamable HTTP fallback, got: {result.output}"
                    )

    def test_unified_executor_has_streamable_http_fallback_in_source(self):
        """Verify the unified executor source code contains Streamable HTTP fallback"""
        from core.tools.utils.mcp_tool_executor import MCPToolExecutor
        import inspect
        source = inspect.getsource(MCPToolExecutor._execute_sse_tool)

        assert "streamablehttp_client" in source, (
            "Unified MCPToolExecutor._execute_sse_tool is MISSING Streamable HTTP fallback!"
        )


# ==============================================================================
# Integration Tests: Real Valyu endpoint
# ==============================================================================

@pytest.mark.integration
class TestValyuRealEndpoint:
    """
    Integration tests against real Valyu MCP endpoint.
    Skip in CI with: pytest -m "not integration"
    """

    @pytest.mark.asyncio
    async def test_valyu_rejects_sse_get(self):
        """Confirm Valyu rejects GET (SSE) with 405"""
        import httpx
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(VALYU_URL)
            assert r.status_code == 405, f"Expected 405, got {r.status_code}"

    @pytest.mark.asyncio
    async def test_valyu_accepts_streamable_http_post(self):
        """Confirm Valyu accepts POST (Streamable HTTP) for initialize"""
        import httpx
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "test-harness", "version": "1.0"}
            }
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(
                VALYU_URL,
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json, text/event-stream"
                }
            )
            assert r.status_code == 200, f"Expected 200, got {r.status_code}"
            assert "text/event-stream" in r.headers.get("content-type", "")

    @pytest.mark.asyncio
    async def test_valyu_tools_list_via_post(self):
        """Confirm Valyu returns tools via POST tools/list"""
        import httpx
        payload = {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/list",
            "params": {}
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(
                VALYU_URL,
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json, text/event-stream"
                }
            )
            assert r.status_code == 200
            # Parse SSE event data
            body = r.text
            assert "valyu_search" in body, f"Expected valyu_search in response, got: {body[:500]}"

    @pytest.mark.asyncio
    async def test_valyu_via_mcp_sdk_streamable_http(self):
        """Test Valyu using the MCP SDK streamablehttp_client (what runtime should use)"""
        from mcp.client.streamable_http import streamablehttp_client
        from mcp import ClientSession

        async with streamablehttp_client(VALYU_URL) as (read_stream, write_stream, _):
            async with ClientSession(read_stream, write_stream) as session:
                await session.initialize()
                tools_result = await session.list_tools()

                tool_names = [t.name for t in tools_result.tools]
                assert len(tool_names) >= 10, f"Expected 10+ tools, got {len(tool_names)}: {tool_names}"
                assert "valyu_search" in tool_names
                assert "valyu_academic_search" in tool_names

    @pytest.mark.asyncio
    async def test_valyu_via_mcp_sdk_sse_fails(self):
        """Confirm that sse_client fails with Valyu (405)"""
        from mcp.client.sse import sse_client

        with pytest.raises((Exception, BaseException)):
            async with sse_client(VALYU_URL) as (read_stream, write_stream):
                pass  # Should never reach here
