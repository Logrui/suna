"""
Phase 2 – JIT Loader Bug Fixes (Stages 5-6)

Tests for:
  - MCPJITLoader.build_tool_map() with mock agent configs
  - MCPJITLoader._process_mcp_config() for custom MCP and Composio configs
  - MCPJITLoader.activate_tool() with mocked MCP server
  - SSRF validation in JIT discovery and execution paths
  - Composio regression: Composio tool map building
"""

import asyncio
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from core.jit.mcp_loader import MCPJITLoader, MCPToolInfo
from core.jit.result_types import ActivationSuccess, ActivationError, ActivationErrorType
from core.utils.ssrf import is_safe_url


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_agent_config(custom_mcps=None, configured_mcps=None, account_id="acct_1"):
    return {
        "custom_mcp": custom_mcps or [],
        "configured_mcps": configured_mcps or [],
        "account_id": account_id,
    }


def _make_custom_mcp(name="test-server", url="https://example.com/mcp", custom_type="http", enabled_tools=None):
    cfg = {
        "name": name,
        "customType": custom_type,
        "url": url,
        "config": {"url": url},
    }
    if enabled_tools is not None:
        cfg["enabledTools"] = enabled_tools
    return cfg


def _make_composio_mcp(toolkit_slug="github", enabled_tools=None):
    cfg = {
        "name": f"composio-{toolkit_slug}",
        "toolkit_slug": toolkit_slug,
        "qualifiedName": f"composio.{toolkit_slug}",
        "type": "composio",
    }
    if enabled_tools is not None:
        cfg["enabledTools"] = enabled_tools
    return cfg


# ===================================================================
# 1. build_tool_map — enabledTools present
# ===================================================================

@pytest.mark.asyncio
async def test_build_tool_map_uses_enabled_tools_directly():
    """In cache_only mode, custom MCPs with enabledTools register tools
    directly without any server probe."""
    mcp = _make_custom_mcp(
        name="my-server",
        url="https://example.com/mcp",
        custom_type="http",
        enabled_tools=["tool_alpha", "tool_beta"],
    )
    loader = MCPJITLoader(_make_agent_config(custom_mcps=[mcp]))

    # In cache_only mode, _discover_tools_with_fallback should never be called
    with patch.object(loader, "_discover_tools_with_fallback", new_callable=AsyncMock) as mock_discover:
        await loader.build_tool_map(cache_only=True)

        assert "tool_alpha" in loader.tool_map
        assert "tool_beta" in loader.tool_map
        assert len(loader.tool_map) == 2
        mock_discover.assert_not_called()


@pytest.mark.asyncio
async def test_build_tool_map_without_enabled_tools_probes_server():
    """When enabledTools is absent, the loader probes the server for tools."""
    mcp = _make_custom_mcp(name="probe-server", url="https://example.com/mcp", custom_type="http")
    loader = MCPJITLoader(_make_agent_config(custom_mcps=[mcp]))

    discovered = ["discovered_tool_1", "discovered_tool_2", "discovered_tool_3"]
    with patch.object(loader, "_discover_tools_with_fallback", new_callable=AsyncMock, return_value=discovered):
        await loader.build_tool_map()

        assert len(loader.tool_map) == 3
        for t in discovered:
            assert t in loader.tool_map


# ===================================================================
# 2. _process_mcp_config — custom SSE / HTTP / JSON types
# ===================================================================

@pytest.mark.asyncio
async def test_process_custom_sse_mcp_routes_correctly():
    """SSE-type custom MCPs go through _process_custom_mcp_config_internal."""
    mcp = _make_custom_mcp(name="sse-srv", url="https://example.com/sse", custom_type="sse")
    loader = MCPJITLoader(_make_agent_config())

    with patch.object(loader, "_process_custom_mcp_config_internal", new_callable=AsyncMock) as mock_internal:
        await loader._process_mcp_config(mcp, "custom")
        mock_internal.assert_awaited_once()


@pytest.mark.asyncio
async def test_process_custom_json_mcp_routes_correctly():
    """JSON-type custom MCPs go through _process_custom_mcp_config_internal."""
    mcp = {"name": "json-srv", "customType": "json", "command": "npx", "args": ["-y", "server"]}
    loader = MCPJITLoader(_make_agent_config())

    with patch.object(loader, "_process_custom_mcp_config_internal", new_callable=AsyncMock) as mock_internal:
        await loader._process_mcp_config(mcp, "custom")
        mock_internal.assert_awaited_once()


# ===================================================================
# 3. _process_mcp_config — Composio (configured) MCPs
# ===================================================================

@pytest.mark.asyncio
async def test_process_composio_config_uses_enabled_tools():
    """Composio MCP with enabledTools populates tool_map directly."""
    mcp = _make_composio_mcp(toolkit_slug="github", enabled_tools=["GITHUB_CREATE_ISSUE", "GITHUB_LIST_REPOS"])
    loader = MCPJITLoader(_make_agent_config(configured_mcps=[mcp]))

    await loader.build_tool_map()

    assert "GITHUB_CREATE_ISSUE" in loader.tool_map
    assert "GITHUB_LIST_REPOS" in loader.tool_map
    assert loader.tool_map["GITHUB_CREATE_ISSUE"].toolkit_slug == "github"


@pytest.mark.asyncio
async def test_process_composio_config_queries_registry_when_no_enabled_tools():
    """Composio MCP without enabledTools falls through to registry query."""
    mcp = _make_composio_mcp(toolkit_slug="slack")
    loader = MCPJITLoader(_make_agent_config(configured_mcps=[mcp]))

    registry_tools = ["SLACK_SEND_MESSAGE", "SLACK_LIST_CHANNELS"]
    with patch("core.jit.mcp_loader.get_toolkit_tools", new_callable=AsyncMock, return_value=registry_tools):
        await loader.build_tool_map()

        assert "SLACK_SEND_MESSAGE" in loader.tool_map
        assert "SLACK_LIST_CHANNELS" in loader.tool_map


# ===================================================================
# 4. activate_tool — with mocked schema loading
# ===================================================================

@pytest.mark.asyncio
async def test_activate_tool_loads_schema_and_caches():
    """activate_tool should call _load_tool_schema and cache the result."""
    mcp = _make_custom_mcp(enabled_tools=["my_tool"])
    loader = MCPJITLoader(_make_agent_config(custom_mcps=[mcp]))
    # Use cache_only to register enabledTools without server discovery
    await loader.build_tool_map(cache_only=True)

    fake_schema = {"name": "my_tool", "description": "A test tool", "input_schema": {"type": "object"}}
    with patch.object(loader, "_load_tool_schema", new_callable=AsyncMock, return_value=fake_schema):
        result = await loader.activate_tool("my_tool")

    assert isinstance(result, ActivationSuccess)
    assert result.tool_name == "my_tool"
    assert loader.tool_map["my_tool"].loaded is True
    assert loader.tool_map["my_tool"].schema == fake_schema
    assert "my_tool" in loader.schema_cache


@pytest.mark.asyncio
async def test_activate_tool_not_found_returns_error():
    """activate_tool for an unknown tool returns ActivationError."""
    loader = MCPJITLoader(_make_agent_config())
    await loader.build_tool_map()

    result = await loader.activate_tool("nonexistent_tool")
    assert isinstance(result, ActivationError)
    assert result.error_type == ActivationErrorType.TOOL_NOT_FOUND


@pytest.mark.asyncio
async def test_activate_tool_already_loaded_returns_immediately():
    """If a tool is already loaded, activate_tool returns immediately without re-loading."""
    mcp = _make_custom_mcp(enabled_tools=["cached_tool"])
    loader = MCPJITLoader(_make_agent_config(custom_mcps=[mcp]))
    # Use cache_only to register enabledTools without server discovery
    await loader.build_tool_map(cache_only=True)

    # Manually mark as loaded
    loader.tool_map["cached_tool"].loaded = True
    loader.tool_map["cached_tool"].load_time_ms = 5.0

    with patch.object(loader, "_load_tool_schema", new_callable=AsyncMock) as mock_load:
        result = await loader.activate_tool("cached_tool")
        mock_load.assert_not_called()

    assert isinstance(result, ActivationSuccess)


# ===================================================================
# 5. SSRF validation
# ===================================================================

class TestSSRFValidation:
    """Test SSRF protection via is_safe_url()."""

    def test_ssrf_blocks_localhost(self):
        safe, msg = is_safe_url("http://localhost:8080/mcp")
        assert safe is False
        assert "not allowed" in msg.lower()

    def test_ssrf_blocks_private_ip(self):
        safe, msg = is_safe_url("http://192.168.1.1/mcp")
        assert safe is False

    def test_ssrf_blocks_metadata_endpoint(self):
        safe, msg = is_safe_url("http://169.254.169.254/latest/meta-data/")
        assert safe is False

    def test_ssrf_blocks_loopback(self):
        safe, msg = is_safe_url("http://127.0.0.1:9999/mcp")
        assert safe is False

    def test_ssrf_allows_public_url(self):
        safe, msg = is_safe_url("https://api.example.com/mcp")
        assert safe is True
        assert msg == ""

    def test_ssrf_blocks_non_http_scheme(self):
        safe, msg = is_safe_url("ftp://example.com/file")
        assert safe is False
        assert "scheme" in msg.lower()


class TestSSRFInJITDiscovery:
    """SSRF validation is applied in JIT discovery before connecting."""

    @pytest.mark.asyncio
    async def test_discover_tools_blocks_private_url(self):
        mcp = _make_custom_mcp(url="http://192.168.1.100:8080/mcp")
        loader = MCPJITLoader(_make_agent_config(custom_mcps=[mcp]))

        result = await loader._discover_tools_with_fallback(mcp)
        assert result == []

    @pytest.mark.asyncio
    async def test_load_http_schema_blocks_private_url(self):
        mcp = _make_custom_mcp(url="http://10.0.0.5:3000/mcp", enabled_tools=["bad_tool"])
        loader = MCPJITLoader(_make_agent_config(custom_mcps=[mcp]))
        await loader.build_tool_map()

        with pytest.raises(ValueError, match="SSRF blocked"):
            await loader._load_http_schema("bad_tool", "http://10.0.0.5:3000/mcp", {})

    @pytest.mark.asyncio
    async def test_load_sse_schema_blocks_private_url(self):
        with pytest.raises(ValueError, match="SSRF blocked"):
            loader = MCPJITLoader(_make_agent_config())
            await loader._load_sse_schema("bad_tool", "http://127.0.0.1:9999/mcp", {})


class TestSSRFInJITExecutor:
    """SSRF validation in jit/mcp_tool_wrapper.py MCPToolExecutor."""

    @pytest.mark.asyncio
    async def test_jit_executor_sse_blocks_private_url(self):
        from core.jit.mcp_tool_wrapper import MCPToolExecutor as JITExecutor
        from core.agentpress.tool import ToolResult

        config = {
            "customType": "sse",
            "url": "http://192.168.1.1:8080/mcp",
            "config": {"url": "http://192.168.1.1:8080/mcp"},
        }
        executor = JITExecutor(config)

        result = await executor.execute_tool("some_tool", {"arg": "val"})
        assert isinstance(result, ToolResult)
        assert result.success is False
        assert "SSRF" in result.output or "not allowed" in result.output.lower()

    @pytest.mark.asyncio
    async def test_jit_executor_http_blocks_private_url(self):
        from core.jit.mcp_tool_wrapper import MCPToolExecutor as JITExecutor
        from core.agentpress.tool import ToolResult

        config = {
            "customType": "http",
            "url": "http://10.0.0.1/mcp",
            "config": {"url": "http://10.0.0.1/mcp"},
        }
        executor = JITExecutor(config)

        result = await executor.execute_tool("some_tool", {"arg": "val"})
        assert isinstance(result, ToolResult)
        assert result.success is False


# ===================================================================
# 6. Composio regression: tool map building
# ===================================================================

@pytest.mark.asyncio
async def test_composio_tool_map_building_with_enabled_tools():
    """Composio configs with enabledTools build the tool_map correctly.
    Uses cache_only mode so custom HTTP tools register from enabledTools
    without attempting real server discovery."""
    composio = _make_composio_mcp(
        toolkit_slug="twitter",
        enabled_tools=["TWITTER_CREATION_OF_A_POST", "TWITTER_BOOKMARKS_BY_USER"],
    )
    http_custom = _make_custom_mcp(
        name="notion-mcp",
        url="https://notion-mcp.example.com/mcp",
        custom_type="http",
        enabled_tools=["notion-search", "notion-create-pages"],
    )

    config = _make_agent_config(
        custom_mcps=[http_custom],
        configured_mcps=[composio],
    )
    loader = MCPJITLoader(config)
    await loader.build_tool_map(cache_only=True)

    # Both Composio and custom HTTP tools should be in the map
    assert "TWITTER_CREATION_OF_A_POST" in loader.tool_map
    assert "TWITTER_BOOKMARKS_BY_USER" in loader.tool_map
    assert "notion-search" in loader.tool_map
    assert "notion-create-pages" in loader.tool_map

    # Verify toolkit_slug is correctly assigned
    assert loader.tool_map["TWITTER_CREATION_OF_A_POST"].toolkit_slug == "twitter"
    assert loader.tool_map["notion-search"].toolkit_slug.startswith("custom_http_")  # custom toolkit slug pattern


@pytest.mark.asyncio
async def test_composio_tool_map_building_without_enabled_tools_queries_registry():
    """Composio configs without enabledTools query the registry for tool names."""
    composio = _make_composio_mcp(toolkit_slug="linear")

    config = _make_agent_config(configured_mcps=[composio])
    loader = MCPJITLoader(config)

    registry_tools = ["LINEAR_CREATE_ISSUE", "LINEAR_LIST_PROJECTS"]
    with patch("core.jit.mcp_loader.get_toolkit_tools", new_callable=AsyncMock, return_value=registry_tools):
        await loader.build_tool_map()

    assert "LINEAR_CREATE_ISSUE" in loader.tool_map
    assert "LINEAR_LIST_PROJECTS" in loader.tool_map
    assert loader.tool_map["LINEAR_CREATE_ISSUE"].toolkit_slug == "linear"
