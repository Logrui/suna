"""
Phase 4 – Configuration Key Normalization Tests

Tests for:
  - normalize_to_snake(): camelCase → snake_case conversion
  - normalize_to_camel(): snake_case → camelCase conversion
  - get_config_value(): dual-format key reading
  - CanonicalMCPConfig: typed config from raw dicts
  - Backward compatibility: configs saved in camelCase still readable
  - Composio configs normalize correctly
"""

import pytest
from core.utils.mcp_config_schema import (
    normalize_to_snake,
    normalize_to_camel,
    get_config_value,
    CanonicalMCPConfig,
)


# ===================================================================
# 1. normalize_to_snake
# ===================================================================

class TestNormalizeToSnake:

    def test_camel_case_input(self):
        raw = {"enabledTools": ["a", "b"], "customType": "sse", "qualifiedName": "custom_sse_abc"}
        out = normalize_to_snake(raw)
        assert out["enabled_tools"] == ["a", "b"]
        assert out["custom_type"] == "sse"
        assert out["qualified_name"] == "custom_sse_abc"

    def test_snake_case_passthrough(self):
        raw = {"enabled_tools": ["x"], "custom_type": "http", "qualified_name": "qn"}
        out = normalize_to_snake(raw)
        assert out["enabled_tools"] == ["x"]
        assert out["custom_type"] == "http"

    def test_mixed_input(self):
        raw = {"enabledTools": ["a"], "custom_type": "http", "name": "test"}
        out = normalize_to_snake(raw)
        assert out["enabled_tools"] == ["a"]
        assert out["custom_type"] == "http"
        assert out["name"] == "test"

    def test_bare_type_fallback(self):
        """If only 'type' is present (no customType), it becomes custom_type."""
        raw = {"type": "sse", "name": "srv"}
        out = normalize_to_snake(raw)
        assert out["custom_type"] == "sse"

    def test_customType_takes_priority_over_type(self):
        raw = {"customType": "http", "type": "sse"}
        out = normalize_to_snake(raw)
        assert out["custom_type"] == "http"

    def test_missing_keys_no_error(self):
        raw = {"name": "test"}
        out = normalize_to_snake(raw)
        assert "enabled_tools" not in out
        assert "custom_type" not in out
        assert out["name"] == "test"

    def test_extra_keys_preserved(self):
        raw = {"enabledTools": [], "someOtherKey": 42}
        out = normalize_to_snake(raw)
        assert out["someOtherKey"] == 42


# ===================================================================
# 2. normalize_to_camel
# ===================================================================

class TestNormalizeToCamel:

    def test_snake_case_input(self):
        raw = {"enabled_tools": ["a"], "custom_type": "http", "qualified_name": "qn"}
        out = normalize_to_camel(raw)
        assert out["enabledTools"] == ["a"]
        assert out["customType"] == "http"
        assert out["qualifiedName"] == "qn"

    def test_camel_case_passthrough(self):
        raw = {"enabledTools": ["x"], "customType": "sse"}
        out = normalize_to_camel(raw)
        assert out["enabledTools"] == ["x"]
        assert out["customType"] == "sse"

    def test_backward_compat_type_field(self):
        """normalize_to_camel should also set 'type' alongside 'customType'."""
        raw = {"custom_type": "http"}
        out = normalize_to_camel(raw)
        assert out["customType"] == "http"
        assert out["type"] == "http"

    def test_existing_type_not_overwritten(self):
        raw = {"custom_type": "http", "type": "legacy_value"}
        out = normalize_to_camel(raw)
        assert out["customType"] == "http"
        assert out["type"] == "legacy_value"


# ===================================================================
# 3. get_config_value
# ===================================================================

class TestGetConfigValue:

    def test_reads_snake_case(self):
        cfg = {"enabled_tools": ["a"]}
        assert get_config_value(cfg, "enabled_tools") == ["a"]

    def test_reads_camel_case_fallback(self):
        cfg = {"enabledTools": ["b"]}
        assert get_config_value(cfg, "enabled_tools") == ["b"]

    def test_snake_case_takes_priority(self):
        cfg = {"enabled_tools": ["snake"], "enabledTools": ["camel"]}
        assert get_config_value(cfg, "enabled_tools") == ["snake"]

    def test_custom_type_reads_camelCase(self):
        cfg = {"customType": "sse"}
        assert get_config_value(cfg, "custom_type") == "sse"

    def test_custom_type_bare_type_fallback(self):
        cfg = {"type": "http"}
        assert get_config_value(cfg, "custom_type") == "http"

    def test_default_returned_when_missing(self):
        cfg = {"name": "test"}
        assert get_config_value(cfg, "enabled_tools", []) == []
        assert get_config_value(cfg, "custom_type", "http") == "http"

    def test_qualified_name_camel(self):
        cfg = {"qualifiedName": "custom_sse_abc"}
        assert get_config_value(cfg, "qualified_name") == "custom_sse_abc"


# ===================================================================
# 4. CanonicalMCPConfig dataclass
# ===================================================================

class TestCanonicalMCPConfig:

    def test_from_raw_camelCase(self):
        raw = {
            "name": "test-server",
            "customType": "http",
            "qualifiedName": "custom_http_abc",
            "enabledTools": ["tool1", "tool2"],
            "config": {"url": "https://example.com/mcp"},
        }
        cfg = CanonicalMCPConfig.from_raw(raw)
        assert cfg.name == "test-server"
        assert cfg.custom_type == "http"
        assert cfg.qualified_name == "custom_http_abc"
        assert cfg.enabled_tools == ["tool1", "tool2"]
        assert cfg.config["url"] == "https://example.com/mcp"

    def test_from_raw_snake_case(self):
        raw = {
            "name": "srv",
            "custom_type": "sse",
            "qualified_name": "qn",
            "enabled_tools": ["t1"],
        }
        cfg = CanonicalMCPConfig.from_raw(raw)
        assert cfg.custom_type == "sse"
        assert cfg.qualified_name == "qn"
        assert cfg.enabled_tools == ["t1"]

    def test_from_raw_defaults(self):
        cfg = CanonicalMCPConfig.from_raw({})
        assert cfg.name == ""
        assert cfg.custom_type == "http"
        assert cfg.enabled_tools == []
        assert cfg.config == {}

    def test_to_storage_outputs_camelCase(self):
        cfg = CanonicalMCPConfig(
            name="srv",
            custom_type="http",
            qualified_name="custom_http_abc",
            enabled_tools=["tool1"],
            config={"url": "https://example.com"},
        )
        stored = cfg.to_storage()
        assert stored["customType"] == "http"
        assert stored["type"] == "http"
        assert stored["qualifiedName"] == "custom_http_abc"
        assert stored["enabledTools"] == ["tool1"]

    def test_round_trip_camel_to_canonical_to_storage(self):
        """Config from frontend (camelCase) → canonical → back to storage."""
        frontend_config = {
            "name": "my-mcp",
            "customType": "sse",
            "qualifiedName": "custom_sse_abc",
            "enabledTools": ["tool_a", "tool_b"],
            "config": {"url": "https://example.com/mcp"},
        }
        canonical = CanonicalMCPConfig.from_raw(frontend_config)
        stored = canonical.to_storage()

        assert stored["customType"] == "sse"
        assert stored["enabledTools"] == ["tool_a", "tool_b"]
        assert stored["qualifiedName"] == "custom_sse_abc"


# ===================================================================
# 5. Backward compatibility: DB configs still readable
# ===================================================================

class TestBackwardCompatibility:

    def test_old_config_with_only_type_field(self):
        """Old configs may have 'type' instead of 'customType'."""
        old_config = {"name": "old-srv", "type": "sse", "config": {"url": "https://example.com"}}
        assert get_config_value(old_config, "custom_type") == "sse"

    def test_old_config_with_enabledTools(self):
        """Old configs use camelCase enabledTools — still readable."""
        old_config = {"enabledTools": ["old_tool_1"]}
        assert get_config_value(old_config, "enabled_tools") == ["old_tool_1"]

    def test_new_config_with_both_formats_prefers_snake(self):
        """If a config somehow has both, snake_case wins."""
        cfg = {"enabledTools": ["camel"], "enabled_tools": ["snake"]}
        assert get_config_value(cfg, "enabled_tools") == ["snake"]


# ===================================================================
# 6. Composio config normalization
# ===================================================================

class TestComposioConfigNormalization:

    def test_composio_config_reads_correctly(self):
        """Composio configs use 'type': 'composio' and toolkit_slug."""
        composio_cfg = {
            "name": "composio-github",
            "type": "composio",
            "toolkit_slug": "github",
            "enabledTools": ["GITHUB_CREATE_ISSUE", "GITHUB_LIST_REPOS"],
            "qualifiedName": "composio.github",
        }
        assert get_config_value(composio_cfg, "custom_type") == "composio"
        assert get_config_value(composio_cfg, "enabled_tools") == ["GITHUB_CREATE_ISSUE", "GITHUB_LIST_REPOS"]
        assert get_config_value(composio_cfg, "qualified_name") == "composio.github"

    def test_composio_canonical_config(self):
        composio_cfg = {
            "name": "composio-slack",
            "type": "composio",
            "toolkit_slug": "slack",
            "enabledTools": ["SLACK_SEND_MESSAGE"],
            "qualifiedName": "composio.slack",
        }
        canonical = CanonicalMCPConfig.from_raw(composio_cfg)
        assert canonical.custom_type == "composio"
        assert canonical.toolkit_slug == "slack"
        assert canonical.enabled_tools == ["SLACK_SEND_MESSAGE"]

    def test_composio_round_trip(self):
        composio_cfg = {
            "name": "composio-github",
            "type": "composio",
            "toolkit_slug": "github",
            "enabledTools": ["GITHUB_CREATE_ISSUE"],
        }
        canonical = CanonicalMCPConfig.from_raw(composio_cfg)
        stored = canonical.to_storage()
        assert stored["customType"] == "composio"
        assert stored["type"] == "composio"
        assert stored["toolkit_slug"] == "github"


# ===================================================================
# 7. Integration: normalized configs work with JIT loader reads
# ===================================================================

class TestIntegrationWithJITLoader:

    def test_jit_loader_reads_camelCase_config(self):
        """Simulate JIT loader reading a camelCase config from DB."""
        db_config = {
            "name": "test-srv",
            "customType": "http",
            "enabledTools": ["tool1", "tool2"],
            "config": {"url": "https://example.com/mcp"},
        }
        # JIT loader now uses get_config_value for these reads
        custom_type = get_config_value(db_config, "custom_type", "").lower()
        enabled_tools = get_config_value(db_config, "enabled_tools", [])

        assert custom_type == "http"
        assert enabled_tools == ["tool1", "tool2"]

    def test_jit_loader_reads_mixed_config(self):
        """Config with some camelCase and some snake_case keys."""
        mixed_config = {
            "name": "mixed-srv",
            "custom_type": "sse",
            "enabledTools": ["t1"],
            "config": {"url": "https://example.com/mcp"},
        }
        custom_type = get_config_value(mixed_config, "custom_type", "").lower()
        enabled_tools = get_config_value(mixed_config, "enabled_tools", [])

        assert custom_type == "sse"
        assert enabled_tools == ["t1"]

    def test_executor_reads_customType_via_get_config_value(self):
        """Executor's from_mcp_config now uses get_config_value."""
        from core.tools.utils.mcp_tool_executor import MCPToolExecutor

        # camelCase config (stored format)
        config = {"customType": "sse", "url": "https://example.com/mcp", "config": {"url": "https://example.com/mcp"}}
        executor = MCPToolExecutor.from_mcp_config(config)
        assert executor._server_type == "sse"

        # bare 'type' config (old format)
        config2 = {"type": "http", "url": "https://example.com", "config": {"url": "https://example.com"}}
        executor2 = MCPToolExecutor.from_mcp_config(config2)
        assert executor2._server_type == "http"
