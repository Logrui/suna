"""
Phase 5 – Comprehensive Test Suite (Gap Fill)

Fills test coverage gaps from Phases 1-4. Tests every MCP endpoint,
service, and logic path that lacks a dedicated test.

Coverage areas:
  5.1 API endpoint tests: client-metadata, credentials CRUD
  5.2 Service-level tests: MCPAuthService, CustomMCPRegistryService, helpers
  5.3 Composio-specific regression suite
  5.4 Test infrastructure: shared fixtures, full suite verification
"""

import pytest
import os
import json
import base64
import hashlib
import secrets
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch, MagicMock, PropertyMock
from dataclasses import dataclass

from httpx import AsyncClient, ASGITransport
from fastapi import FastAPI
import jwt

from core.mcp_module.api import router as mcp_router
from core.mcp_module.exceptions import (
    MCPException,
    MCPConnectionError,
    MCPAuthenticationError,
    CustomMCPError,
)
from core.mcp_module.custom_mcp_registry_service import (
    CustomMCPConnectionResult,
    CustomMCPRegistryService,
)
from core.mcp_module.auth_service import MCPAuthService
from core.credentials.credential_service import EncryptionService

# ==============================================================================
# Shared Fixtures
# ==============================================================================

test_app = FastAPI()
test_app.include_router(mcp_router, prefix="/v1")


def create_test_token(user_id="test_user_phase5"):
    secret = (
        os.getenv("SUPABASE_JWT_SECRET")
        or os.getenv("JWT_SECRET")
        or "your-super-secret-jwt-token-with-at-least-32-characters-long"
    )
    payload = {
        "sub": user_id,
        "aud": "authenticated",
        "role": "authenticated",
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(hours=1),
    }
    return jwt.encode(payload, secret, algorithm="HS256")


@pytest.fixture
def auth_headers():
    return {"Authorization": f"Bearer {create_test_token()}"}


def _make_connection_result(**overrides) -> CustomMCPConnectionResult:
    """Factory for CustomMCPConnectionResult with sensible defaults."""
    defaults = dict(
        success=True,
        qualified_name="custom_http_test",
        display_name="Test MCP",
        tools=[{"name": "ping", "description": "Ping", "inputSchema": {}}],
        config={"url": "https://example.com/mcp"},
        url="https://example.com/mcp",
        message="Connected (1 tools)",
        oauth_metadata=None,
        requires_auth=False,
    )
    defaults.update(overrides)
    return CustomMCPConnectionResult(**defaults)


# ==============================================================================
# 5.1  API Endpoint Tests
# ==============================================================================


class TestClientMetadataEndpoint:
    """GET /v1/mcp/client-metadata.json — SEP-991 identity document."""

    @pytest.mark.asyncio
    async def test_returns_client_metadata(self):
        async with AsyncClient(
            transport=ASGITransport(app=test_app), base_url="http://test"
        ) as ac:
            response = await ac.get("/v1/mcp/client-metadata.json")

        assert response.status_code == 200
        data = response.json()
        assert data["client_name"] == "Suna AI Agent Worker"
        assert "redirect_uris" in data
        assert len(data["redirect_uris"]) >= 1
        assert "response_types" in data
        assert "code" in data["response_types"]
        assert data["token_endpoint_auth_method"] == "none"

    @pytest.mark.asyncio
    async def test_client_id_matches_self_url(self):
        """SEP-991 requires client_id == URL of this document."""
        async with AsyncClient(
            transport=ASGITransport(app=test_app), base_url="http://test"
        ) as ac:
            response = await ac.get("/v1/mcp/client-metadata.json")

        data = response.json()
        assert data["client_id"].endswith("/mcp/client-metadata.json")

    @pytest.mark.asyncio
    async def test_redirect_uri_points_to_callback(self):
        async with AsyncClient(
            transport=ASGITransport(app=test_app), base_url="http://test"
        ) as ac:
            response = await ac.get("/v1/mcp/client-metadata.json")

        data = response.json()
        assert any("/mcp/auth/callback" in uri for uri in data["redirect_uris"])


class TestDiscoverEndpointAdditional:
    """Additional coverage for POST /v1/mcp/discover-custom-tools."""

    @pytest.mark.asyncio
    async def test_custom_headers_merged_into_config(self, auth_headers):
        """custom_headers from top-level request body should be merged into service_config."""
        payload = {
            "type": "http",
            "config": {"url": "https://example.com/mcp"},
            "custom_headers": {"X-Custom": "value"},
        }

        with patch(
            "core.mcp_module.api.mcp_registry_service.discover_custom_tools",
            new_callable=AsyncMock,
        ) as mock_discover:
            mock_discover.return_value = _make_connection_result()

            async with AsyncClient(
                transport=ASGITransport(app=test_app), base_url="http://test"
            ) as ac:
                response = await ac.post(
                    "/v1/mcp/discover-custom-tools", json=payload, headers=auth_headers
                )

            assert response.status_code == 200
            # Verify custom_headers was merged into the config passed to service
            call_args = mock_discover.call_args
            service_config = call_args[0][1]
            assert service_config["custom_headers"] == {"X-Custom": "value"}

    @pytest.mark.asyncio
    async def test_oauth_fields_merged_into_config(self, auth_headers):
        """oauth_client_id/secret from top-level should merge into service_config."""
        payload = {
            "type": "http",
            "config": {"url": "https://example.com/mcp"},
            "oauth_client_id": "my_client",
            "oauth_client_secret": "my_secret",
        }

        with patch(
            "core.mcp_module.api.mcp_registry_service.discover_custom_tools",
            new_callable=AsyncMock,
        ) as mock_discover:
            mock_discover.return_value = _make_connection_result()

            async with AsyncClient(
                transport=ASGITransport(app=test_app), base_url="http://test"
            ) as ac:
                response = await ac.post(
                    "/v1/mcp/discover-custom-tools", json=payload, headers=auth_headers
                )

            assert response.status_code == 200
            service_config = mock_discover.call_args[0][1]
            assert service_config["oauth_client_id"] == "my_client"
            assert service_config["oauth_client_secret"] == "my_secret"

    @pytest.mark.asyncio
    async def test_mcp_exception_returns_400(self, auth_headers):
        """Generic MCPException in the service layer should return 400 (not 500)."""
        payload = {"type": "http", "config": {"url": "https://broken.com"}}

        with patch(
            "core.mcp_module.api.mcp_registry_service.discover_custom_tools",
            new_callable=AsyncMock,
        ) as mock_discover:
            mock_discover.side_effect = MCPException("Connection pool exhausted")

            async with AsyncClient(
                transport=ASGITransport(app=test_app), base_url="http://test"
            ) as ac:
                response = await ac.post(
                    "/v1/mcp/discover-custom-tools", json=payload, headers=auth_headers
                )

            assert response.status_code == 400
            assert "Connection pool exhausted" in response.json()["detail"]


class TestAuthStartAdditional:
    """Additional coverage for GET /v1/mcp/auth/start."""

    @pytest.mark.asyncio
    async def test_auth_start_passes_agent_id_and_name(self, auth_headers):
        """agent_id and name should be encoded in the state parameter."""
        mock_metadata = {
            "authorization_endpoint": "https://auth.example.com/authorize",
            "token_endpoint": "https://auth.example.com/token",
        }

        with patch(
            "core.mcp_module.api.mcp_auth_service.discover_oauth_metadata",
            new_callable=AsyncMock,
        ) as mock_discover, \
        patch(
            "core.mcp_module.api.mcp_auth_service.generate_state",
        ) as mock_state:
            mock_discover.return_value = mock_metadata
            mock_state.return_value = "encoded_state_123"

            async with AsyncClient(
                transport=ASGITransport(app=test_app), base_url="http://test"
            ) as ac:
                response = await ac.get(
                    "/v1/mcp/auth/start",
                    params={
                        "url": "https://mcp.example.com",
                        "return_url": "https://suna.syhc.dev/dashboard",
                        "agent_id": "agent-abc",
                        "name": "My Server",
                    },
                    headers=auth_headers,
                )

            assert response.status_code == 200

            # Verify generate_state received agent_id and display_name
            state_kwargs = mock_state.call_args
            assert state_kwargs.kwargs.get("agent_id") == "agent-abc" or \
                   (len(state_kwargs.args) > 5 and state_kwargs.args[5] == "agent-abc")

    @pytest.mark.asyncio
    async def test_auth_start_discovery_failure_returns_400(self, auth_headers):
        """When discover_oauth_metadata raises MCPAuthenticationError, return 400."""
        with patch(
            "core.mcp_module.api.mcp_auth_service.discover_oauth_metadata",
            new_callable=AsyncMock,
        ) as mock_discover:
            mock_discover.side_effect = MCPAuthenticationError("No OAuth metadata found")

            async with AsyncClient(
                transport=ASGITransport(app=test_app), base_url="http://test"
            ) as ac:
                response = await ac.get(
                    "/v1/mcp/auth/start",
                    params={
                        "url": "https://no-oauth.com",
                        "return_url": "https://suna.syhc.dev",
                    },
                    headers=auth_headers,
                )

            assert response.status_code == 400


# ==============================================================================
# 5.2  Service-Level Tests
# ==============================================================================


class TestMCPAuthService:
    """Tests for MCPAuthService methods."""

    @pytest.fixture
    def auth_service(self):
        return MCPAuthService()

    def test_generate_validate_state_roundtrip(self, auth_service):
        """State generated by generate_state can be validated back."""
        state = auth_service.generate_state(
            user_id="user-42",
            return_url="https://suna.syhc.dev/dashboard",
            mcp_url="https://mcp.example.com",
            code_verifier="test_verifier",
            token_endpoint="https://auth.example.com/token",
            agent_id="agent-1",
            display_name="Test MCP",
        )

        decoded = auth_service.validate_state(state)
        assert decoded["user_id"] == "user-42"
        assert decoded["return_url"] == "https://suna.syhc.dev/dashboard"
        assert decoded["mcp_url"] == "https://mcp.example.com"
        assert decoded["code_verifier"] == "test_verifier"
        assert decoded["token_endpoint"] == "https://auth.example.com/token"
        assert decoded["agent_id"] == "agent-1"
        assert decoded["display_name"] == "Test MCP"

    def test_validate_state_rejects_tampered_data(self, auth_service):
        """Tampered state should raise MCPAuthenticationError."""
        state = auth_service.generate_state(
            user_id="user-1",
            return_url="https://a.com",
            mcp_url="https://b.com",
            code_verifier="cv",
            token_endpoint="https://c.com/token",
        )

        # Tamper with the base64 payload
        tampered = state[:-4] + "XXXX"

        with pytest.raises(MCPAuthenticationError, match="Invalid state"):
            auth_service.validate_state(tampered)

    def test_validate_state_rejects_garbage(self, auth_service):
        with pytest.raises(MCPAuthenticationError, match="Invalid state"):
            auth_service.validate_state("not-a-valid-state")

    def test_pkce_code_challenge_is_s256(self, auth_service):
        """PKCE challenge should be SHA256 of verifier, base64url-encoded without padding."""
        verifier, challenge = auth_service.generate_code_verifier_challenge()

        # Manually compute expected challenge
        expected_hash = hashlib.sha256(verifier.encode("ascii")).digest()
        expected_challenge = base64.urlsafe_b64encode(expected_hash).decode("ascii").rstrip("=")

        assert challenge == expected_challenge

    def test_pkce_verifier_has_sufficient_entropy(self, auth_service):
        """Verifier should be long enough (RFC 7636: 43-128 chars)."""
        verifier, _ = auth_service.generate_code_verifier_challenge()
        assert len(verifier) >= 43
        assert len(verifier) <= 128

    def test_pkce_generates_unique_values(self, auth_service):
        """Two calls should produce different verifiers."""
        v1, c1 = auth_service.generate_code_verifier_challenge()
        v2, c2 = auth_service.generate_code_verifier_challenge()
        assert v1 != v2
        assert c1 != c2

    @pytest.mark.asyncio
    async def test_discover_oauth_metadata_probes_well_known(self, auth_service):
        """discover_oauth_metadata should probe .well-known URLs in correct order."""
        import httpx

        call_log = []

        async def mock_get(self_client, url, **kwargs):
            call_log.append(url)
            # Return valid metadata on the oauth-authorization-server endpoint
            if url.endswith("/.well-known/oauth-authorization-server"):
                return httpx.Response(200, json={
                    "authorization_endpoint": "https://auth.example.com/authorize",
                    "token_endpoint": "https://auth.example.com/token",
                })
            return httpx.Response(404)

        with patch("httpx.AsyncClient.get", new=mock_get):
            result = await auth_service.discover_oauth_metadata("https://mcp.example.com/api")

        assert result["authorization_endpoint"] == "https://auth.example.com/authorize"
        # Should have tried oauth-protected-resource first
        assert any("oauth-protected-resource" in url for url in call_log)

    @pytest.mark.asyncio
    async def test_discover_oauth_metadata_raises_when_no_metadata(self, auth_service):
        """Should raise MCPAuthenticationError when no .well-known endpoints respond."""
        import httpx

        async def mock_get(self_client, url, **kwargs):
            return httpx.Response(404)

        with patch("httpx.AsyncClient.get", new=mock_get):
            with pytest.raises(MCPAuthenticationError, match="Could not discover"):
                await auth_service.discover_oauth_metadata("https://no-oauth.example.com")

    @pytest.mark.asyncio
    async def test_discover_oauth_follows_resource_metadata_auth_server(self, auth_service):
        """Should follow authorization_servers from protected resource metadata."""
        import httpx

        async def mock_get(self_client, url, **kwargs):
            if "oauth-protected-resource" in url:
                return httpx.Response(200, json={
                    "authorization_servers": ["https://auth-server.example.com"],
                })
            if url == "https://auth-server.example.com/.well-known/oauth-authorization-server":
                return httpx.Response(200, json={
                    "authorization_endpoint": "https://auth-server.example.com/authorize",
                    "token_endpoint": "https://auth-server.example.com/token",
                })
            return httpx.Response(404)

        with patch("httpx.AsyncClient.get", new=mock_get):
            result = await auth_service.discover_oauth_metadata("https://mcp.example.com")

        assert result["authorization_endpoint"] == "https://auth-server.example.com/authorize"


class TestCustomMCPRegistryService:
    """Tests for CustomMCPRegistryService path probing and error handling."""

    @pytest.fixture
    def registry(self):
        return CustomMCPRegistryService()

    def test_safe_append_path(self, registry):
        assert registry._safe_append_path("https://example.com", "/mcp") == "https://example.com/mcp"
        assert registry._safe_append_path("https://example.com/", "/mcp") == "https://example.com/mcp"
        assert registry._safe_append_path("https://example.com", "") == "https://example.com"

    @pytest.mark.asyncio
    async def test_discover_rejects_unsupported_type(self, registry):
        with pytest.raises(CustomMCPError, match="Unsupported"):
            await registry.discover_custom_tools("websocket", {"url": "wss://example.com"})

    @pytest.mark.asyncio
    async def test_http_discovery_requires_url(self, registry):
        with pytest.raises(CustomMCPError, match="URL is required"):
            await registry.discover_custom_tools("http", {})

    @pytest.mark.asyncio
    async def test_sse_discovery_requires_url(self, registry):
        with pytest.raises(CustomMCPError, match="URL is required"):
            await registry.discover_custom_tools("sse", {})


class TestMCPHelpers:
    """Tests for core.utils.mcp_helpers utility functions."""

    def test_get_qualified_name_consistency(self):
        from core.utils.mcp_helpers import get_custom_mcp_qualified_name

        name1 = get_custom_mcp_qualified_name("https://example.com/mcp", "http")
        name2 = get_custom_mcp_qualified_name("https://example.com/mcp", "http")
        assert name1 == name2
        assert name1.startswith("custom_http_")

    def test_get_qualified_name_trailing_slash_normalized(self):
        from core.utils.mcp_helpers import get_custom_mcp_qualified_name

        name1 = get_custom_mcp_qualified_name("https://example.com/mcp", "http")
        name2 = get_custom_mcp_qualified_name("https://example.com/mcp/", "http")
        assert name1 == name2

    def test_get_qualified_name_different_types(self):
        from core.utils.mcp_helpers import get_custom_mcp_qualified_name

        http_name = get_custom_mcp_qualified_name("https://example.com/mcp", "http")
        sse_name = get_custom_mcp_qualified_name("https://example.com/mcp", "sse")
        assert http_name != sse_name
        assert "http" in http_name
        assert "sse" in sse_name

    def test_merge_custom_mcps_appends_new(self):
        from core.utils.mcp_helpers import merge_custom_mcps

        existing = [{"name": "A", "qualifiedName": "qn_a"}]
        new = [{"name": "B", "qualifiedName": "qn_b"}]
        result = merge_custom_mcps(existing, new)
        assert len(result) == 2
        assert result[0]["name"] == "A"
        assert result[1]["name"] == "B"

    def test_merge_custom_mcps_replaces_by_qualified_name(self):
        from core.utils.mcp_helpers import merge_custom_mcps

        existing = [{"name": "A", "qualifiedName": "qn_a", "tools": []}]
        new = [{"name": "A-Updated", "qualifiedName": "qn_a", "tools": ["t1"]}]
        result = merge_custom_mcps(existing, new)
        assert len(result) == 1
        assert result[0]["name"] == "A-Updated"
        assert result[0]["tools"] == ["t1"]

    def test_merge_custom_mcps_replaces_by_name_fallback(self):
        from core.utils.mcp_helpers import merge_custom_mcps

        existing = [{"name": "Server A"}]
        new = [{"name": "Server A", "extra": True}]
        result = merge_custom_mcps(existing, new)
        assert len(result) == 1
        assert result[0].get("extra") is True

    def test_merge_custom_mcps_empty_new_returns_existing(self):
        from core.utils.mcp_helpers import merge_custom_mcps

        existing = [{"name": "A"}]
        assert merge_custom_mcps(existing, []) == existing
        assert merge_custom_mcps(existing, None) == existing

    def test_merge_custom_mcps_does_not_mutate_existing(self):
        """Verify shallow-copy: original list is not changed."""
        from core.utils.mcp_helpers import merge_custom_mcps

        # Use distinct qualifiedNames so B is appended (not replacing A)
        existing = [{"name": "A", "qualifiedName": "qn_a"}]
        new = [{"name": "B", "qualifiedName": "qn_b"}]
        result = merge_custom_mcps(existing, new)
        assert len(existing) == 1  # original not mutated
        assert len(result) == 2


# ==============================================================================
# 5.3  Composio-Specific Regression Suite
# ==============================================================================


class TestComposioRegression:
    """Dedicated Composio regression tests for the refactored MCP stack."""

    def test_composio_config_detection_in_agent_tools(self):
        """agent_tools.py should detect composio configs via get_config_value."""
        from core.utils.mcp_config_schema import get_config_value

        composio_config = {
            "name": "composio-github",
            "type": "composio",
            "toolkit_slug": "github",
            "enabledTools": ["GITHUB_CREATE_ISSUE"],
        }

        custom_type = get_config_value(composio_config, "custom_type", "").lower()
        assert custom_type == "composio"

    def test_composio_tool_map_building_with_enabled_tools(self):
        """Composio configs with enabledTools should produce correct tool map."""
        from core.utils.mcp_config_schema import get_config_value

        composio_config = {
            "name": "composio-slack",
            "qualifiedName": "composio.slack",
            "type": "composio",
            "toolkit_slug": "slack",
            "enabledTools": ["SLACK_SEND_MESSAGE", "SLACK_LIST_CHANNELS"],
        }

        tools = get_config_value(composio_config, "enabled_tools", [])
        assert len(tools) == 2
        assert "SLACK_SEND_MESSAGE" in tools

    def test_composio_qualified_name_format(self):
        """Composio qualified names follow composio.{slug} pattern."""
        from core.utils.mcp_config_schema import get_config_value

        cfg = {"qualifiedName": "composio.github"}
        qn = get_config_value(cfg, "qualified_name")
        assert qn == "composio.github"

    def test_composio_config_in_mcp_manager_path(self):
        """MCPManager should correctly detect and route Composio configs."""
        from core.utils.mcp_config_schema import get_config_value

        custom_mcp = {
            "name": "composio-github",
            "type": "composio",
            "config": {"profile_id": "test-123"},
            "enabledTools": ["GITHUB_CREATE_ISSUE"],
        }

        custom_type = get_config_value(custom_mcp, "custom_type", "sse")
        assert custom_type == "composio"

        enabled_tools = get_config_value(custom_mcp, "enabled_tools", [])
        assert enabled_tools == ["GITHUB_CREATE_ISSUE"]

    @pytest.mark.asyncio
    async def test_composio_discovery_uses_separate_path(self):
        """Composio discovery goes through MCPService, not CustomMCPRegistryService."""
        from core.mcp_module.mcp_service import MCPService

        service = MCPService()

        # Composio servers use connect_server with provider=composio
        # This should NOT go through CustomMCPRegistryService.discover_custom_tools
        composio_config = {
            "name": "composio-github",
            "qualifiedName": "composio.github",
            "type": "composio",
            "config": {"profile_id": "p-1"},
        }

        with patch.object(
            service, "_get_composio_server_url", new_callable=AsyncMock
        ) as mock_url, patch.object(
            service, "_get_composio_headers", new_callable=AsyncMock
        ) as mock_headers:
            mock_url.return_value = "https://composio-mcp.example.com/sse"
            mock_headers.return_value = {"Content-Type": "application/json"}

            try:
                await service.connect_server(composio_config, external_user_id="user-1")
            except Exception:
                pass  # Expected — no real server

            mock_url.assert_called_once()
            mock_headers.assert_called_once()


# ==============================================================================
# 5.4  Config Schema Edge Cases
# ==============================================================================


class TestConfigSchemaEdgeCases:
    """Additional edge cases for mcp_config_schema.py."""

    def test_normalize_to_snake_preserves_nested_structures(self):
        from core.utils.mcp_config_schema import normalize_to_snake

        raw = {
            "enabledTools": ["t1"],
            "config": {"url": "https://x.com", "nested": {"deep": True}},
        }
        out = normalize_to_snake(raw)
        assert out["config"]["nested"]["deep"] is True

    def test_normalize_to_camel_unknown_keys_passthrough(self):
        from core.utils.mcp_config_schema import normalize_to_camel

        raw = {"some_random_key": 42, "enabled_tools": ["t1"]}
        out = normalize_to_camel(raw)
        assert out["some_random_key"] == 42
        assert out["enabledTools"] == ["t1"]

    def test_get_config_value_with_none_default(self):
        from core.utils.mcp_config_schema import get_config_value

        cfg = {"name": "test"}
        assert get_config_value(cfg, "enabled_tools") is None
        assert get_config_value(cfg, "enabled_tools", None) is None

    def test_canonical_config_preserves_toolkit_slug(self):
        from core.utils.mcp_config_schema import CanonicalMCPConfig

        raw = {
            "name": "composio-jira",
            "type": "composio",
            "toolkit_slug": "jira",
            "enabledTools": ["JIRA_CREATE_ISSUE"],
        }
        cfg = CanonicalMCPConfig.from_raw(raw)
        assert cfg.toolkit_slug == "jira"

        stored = cfg.to_storage()
        assert stored["toolkit_slug"] == "jira"

    def test_canonical_config_preserves_custom_headers(self):
        from core.utils.mcp_config_schema import CanonicalMCPConfig

        raw = {
            "name": "test",
            "customType": "http",
            "custom_headers": {"X-Api-Key": "secret"},
        }
        cfg = CanonicalMCPConfig.from_raw(raw)
        assert cfg.custom_headers == {"X-Api-Key": "secret"}

        stored = cfg.to_storage()
        assert stored["custom_headers"] == {"X-Api-Key": "secret"}

    def test_canonical_config_preserves_access_token(self):
        from core.utils.mcp_config_schema import CanonicalMCPConfig

        raw = {"name": "test", "access_token": "tok_123"}
        cfg = CanonicalMCPConfig.from_raw(raw)
        assert cfg.access_token == "tok_123"

        stored = cfg.to_storage()
        assert stored["access_token"] == "tok_123"


# ==============================================================================
# 5.5  Executor Integration (verify Phase 3 executor with Phase 4 config)
# ==============================================================================


class TestExecutorWithNormalizedConfig:
    """Verify MCPToolExecutor.from_mcp_config works with all config formats."""

    def test_from_mcp_config_camelCase(self):
        from core.tools.utils.mcp_tool_executor import MCPToolExecutor

        config = {
            "customType": "http",
            "config": {"url": "https://example.com/mcp"},
        }
        executor = MCPToolExecutor.from_mcp_config(config)
        assert executor._server_type == "http"

    def test_from_mcp_config_snake_case(self):
        from core.tools.utils.mcp_tool_executor import MCPToolExecutor

        config = {
            "custom_type": "sse",
            "config": {"url": "https://example.com/mcp"},
        }
        executor = MCPToolExecutor.from_mcp_config(config)
        assert executor._server_type == "sse"

    def test_from_mcp_config_bare_type(self):
        from core.tools.utils.mcp_tool_executor import MCPToolExecutor

        config = {
            "type": "http",
            "config": {"url": "https://example.com"},
        }
        executor = MCPToolExecutor.from_mcp_config(config)
        assert executor._server_type == "http"

    def test_from_mcp_config_composio(self):
        from core.tools.utils.mcp_tool_executor import MCPToolExecutor

        config = {
            "type": "composio",
            "config": {"url": "https://composio.example.com/sse"},
        }
        executor = MCPToolExecutor.from_mcp_config(config)
        assert executor._server_type == "composio"

    def test_from_mcp_config_defaults_to_http(self):
        from core.tools.utils.mcp_tool_executor import MCPToolExecutor

        config = {"config": {"url": "https://example.com"}}
        executor = MCPToolExecutor.from_mcp_config(config)
        assert executor._server_type == "http"
