"""
Phase 1 Unit Tests: Core MCP Module (Layer 1, Stages 1-4)

Tests cover:
- Discovery endpoint routing (CustomMCPRegistryService)
- OAuth auth/start endpoint
- OAuth auth/callback endpoint
- Credential service encrypt/decrypt
- Composio regression (discovery path)
"""
import pytest
import os
import json
import base64
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch, MagicMock

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
from core.credentials.credential_service import EncryptionService, CredentialService

# ==============================================================================
# Setup
# ==============================================================================

test_app = FastAPI()
test_app.include_router(mcp_router, prefix="/v1")


def create_test_token(user_id="test_user_123"):
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


# ==============================================================================
# 1. Discovery Endpoint Tests (routes to CustomMCPRegistryService)
# ==============================================================================


@pytest.mark.asyncio
async def test_discover_endpoint_uses_registry_service():
    """
    Verify that POST /v1/mcp/discover-custom-tools dispatches to
    CustomMCPRegistryService.discover_custom_tools (advanced, with path
    probing) rather than MCPService.discover_custom_tools (simple).
    """
    token = create_test_token()
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "type": "http",
        "config": {"url": "https://example-mcp.com/mcp"},
    }

    mock_result = CustomMCPConnectionResult(
        success=True,
        qualified_name="custom_http_example",
        display_name="Example MCP",
        tools=[{"name": "ping", "description": "Ping tool", "inputSchema": {}}],
        config=payload["config"],
        url="https://example-mcp.com/mcp",
        message="Connected via HTTP (1 tools)",
    )

    with patch(
        "core.mcp_module.api.mcp_registry_service.discover_custom_tools",
        new_callable=AsyncMock,
    ) as mock_registry_discover:
        mock_registry_discover.return_value = mock_result

        async with AsyncClient(
            transport=ASGITransport(app=test_app), base_url="http://test"
        ) as ac:
            response = await ac.post(
                "/v1/mcp/discover-custom-tools", json=payload, headers=headers
            )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["qualified_name"] == "custom_http_example"
        assert len(data["tools"]) == 1

        # Verify registry service was called (not mcp_service)
        mock_registry_discover.assert_called_once()
        args, kwargs = mock_registry_discover.call_args
        assert args[0] == "http"
        assert "url" in args[1]
        # user_id should be passed as kwarg
        assert kwargs.get("user_id") == "test_user_123"


@pytest.mark.asyncio
async def test_discover_endpoint_http_and_sse():
    """Test that both HTTP and SSE discovery types are forwarded correctly."""
    token = create_test_token()
    headers = {"Authorization": f"Bearer {token}"}

    for request_type in ("http", "sse"):
        payload = {
            "type": request_type,
            "config": {"url": f"https://example-{request_type}.com/mcp"},
        }

        mock_result = CustomMCPConnectionResult(
            success=True,
            qualified_name=f"custom_{request_type}_example",
            display_name=f"Example {request_type.upper()} MCP",
            tools=[],
            config=payload["config"],
            url=payload["config"]["url"],
            message=f"Connected via {request_type.upper()} (0 tools)",
        )

        with patch(
            "core.mcp_module.api.mcp_registry_service.discover_custom_tools",
            new_callable=AsyncMock,
        ) as mock_discover:
            mock_discover.return_value = mock_result

            async with AsyncClient(
                transport=ASGITransport(app=test_app), base_url="http://test"
            ) as ac:
                response = await ac.post(
                    "/v1/mcp/discover-custom-tools", json=payload, headers=headers
                )

            assert response.status_code == 200
            args, _ = mock_discover.call_args
            assert args[0] == request_type


@pytest.mark.asyncio
async def test_discover_endpoint_requires_auth_response():
    """Test that requires_auth=True is forwarded correctly from registry service."""
    token = create_test_token()
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "type": "http",
        "config": {"url": "https://oauth-server.com/mcp"},
    }

    mock_result = CustomMCPConnectionResult(
        success=True,
        qualified_name="",
        display_name="Custom MCP (https://oauth-server.com/mcp)",
        tools=[],
        config=payload["config"],
        url="https://oauth-server.com/mcp",
        message="Authentication required",
        oauth_metadata={"authorization_endpoint": "https://oauth-server.com/authorize"},
        requires_auth=True,
    )

    with patch(
        "core.mcp_module.api.mcp_registry_service.discover_custom_tools",
        new_callable=AsyncMock,
    ) as mock_discover:
        mock_discover.return_value = mock_result

        async with AsyncClient(
            transport=ASGITransport(app=test_app), base_url="http://test"
        ) as ac:
            response = await ac.post(
                "/v1/mcp/discover-custom-tools", json=payload, headers=headers
            )

    assert response.status_code == 200
    data = response.json()
    assert data["requires_auth"] is True
    assert data["oauth_metadata"] is not None


# ==============================================================================
# 2. OAuth auth/start Tests
# ==============================================================================


@pytest.mark.asyncio
async def test_auth_start_generates_redirect_url():
    """Verify /v1/mcp/auth/start returns a proper redirect URL with PKCE params."""
    token = create_test_token()
    headers = {"Authorization": f"Bearer {token}"}

    mock_metadata = {
        "authorization_endpoint": "https://auth.example.com/authorize",
        "token_endpoint": "https://auth.example.com/token",
    }

    with patch(
        "core.mcp_module.api.mcp_auth_service.discover_oauth_metadata",
        new_callable=AsyncMock,
    ) as mock_discover:
        mock_discover.return_value = mock_metadata

        async with AsyncClient(
            transport=ASGITransport(app=test_app), base_url="http://test"
        ) as ac:
            response = await ac.get(
                "/v1/mcp/auth/start",
                params={
                    "url": "https://mcp.example.com",
                    "return_url": "https://suna.syhc.dev/dashboard",
                },
                headers=headers,
            )

    assert response.status_code == 200
    data = response.json()
    redirect = data["redirect_url"]

    assert "https://auth.example.com/authorize" in redirect
    assert "state=" in redirect
    assert "code_challenge=" in redirect
    assert "code_challenge_method=S256" in redirect
    assert "response_type=code" in redirect
    assert "scope=mcp" in redirect


@pytest.mark.asyncio
async def test_auth_start_missing_metadata_returns_400():
    """When OAuth metadata has no endpoints, return 400."""
    token = create_test_token()
    headers = {"Authorization": f"Bearer {token}"}

    with patch(
        "core.mcp_module.api.mcp_auth_service.discover_oauth_metadata",
        new_callable=AsyncMock,
    ) as mock_discover:
        mock_discover.return_value = {}  # no endpoints

        async with AsyncClient(
            transport=ASGITransport(app=test_app), base_url="http://test"
        ) as ac:
            response = await ac.get(
                "/v1/mcp/auth/start",
                params={
                    "url": "https://no-oauth.example.com",
                    "return_url": "https://suna.syhc.dev/dashboard",
                },
                headers=headers,
            )

    assert response.status_code == 400


# ==============================================================================
# 3. OAuth auth/callback Tests
# ==============================================================================


@pytest.mark.asyncio
async def test_auth_callback_validates_state_and_exchanges_token():
    """
    Verify the callback endpoint validates state, exchanges code for token,
    and stores the credential. Uses minimal mocking for just the token exchange
    portion (no agent linking, which has deep internal dependencies).
    """
    mock_state_data = {
        "user_id": "test_user_123",
        "return_url": "https://suna.syhc.dev/dashboard",
        "mcp_url": "https://mcp.example.com",
        "code_verifier": "test_code_verifier",
        "token_endpoint": "https://auth.example.com/token",
        # No agent_id - simpler flow without agent linking
        "display_name": "Test MCP",
    }

    mock_token_response = MagicMock()
    mock_token_response.status_code = 200
    mock_token_response.json.return_value = {
        "access_token": "test_access_token",
        "refresh_token": "test_refresh_token",
        "expires_in": 3600,
    }

    mock_discovery_result = CustomMCPConnectionResult(
        success=True,
        qualified_name="custom_http_example",
        display_name="Test MCP",
        tools=[{"name": "tool_a", "description": "A tool", "inputSchema": {}}],
        config={"url": "https://mcp.example.com"},
        url="https://mcp.example.com",
        message="OK",
    )

    with patch("core.mcp_module.api.mcp_auth_service.validate_state") as mock_validate, \
         patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post, \
         patch("core.mcp_module.api.get_credential_service") as mock_cred_svc, \
         patch("core.mcp_module.api.get_profile_service") as mock_profile_svc, \
         patch("core.mcp_module.api.mcp_service.discover_custom_tools", new_callable=AsyncMock) as mock_discover:

        mock_validate.return_value = mock_state_data
        mock_post.return_value = mock_token_response
        mock_discover.return_value = mock_discovery_result

        mock_cred = AsyncMock()
        mock_cred_svc.return_value = mock_cred

        mock_profile = AsyncMock()
        mock_profile_svc.return_value = mock_profile

        async with AsyncClient(
            transport=ASGITransport(app=test_app), base_url="http://test"
        ) as ac:
            response = await ac.get(
                "/v1/mcp/auth/callback",
                params={"code": "auth_code_xyz", "state": "encrypted_state"},
                follow_redirects=False,
            )

        # Should redirect (303)
        assert response.status_code == 303
        location = response.headers.get("location", "")
        assert "mcp_auth=success" in location

        # State should have been validated
        mock_validate.assert_called_once()

        # Token exchange should have been attempted
        mock_post.assert_called_once()

        # Credential service should have been called to store the token
        mock_cred.store_credential.assert_called_once()


# ==============================================================================
# 4. Credential Service Tests
# ==============================================================================


class TestEncryptionService:
    """Test encrypt/decrypt round-trip and failure behavior."""

    @pytest.fixture
    def encryption_service(self):
        """Create an EncryptionService with a test key."""
        from cryptography.fernet import Fernet

        test_key = Fernet.generate_key()
        with patch.dict(os.environ, {"MCP_CREDENTIAL_ENCRYPTION_KEY": test_key.decode()}):
            return EncryptionService()

    def test_encrypt_decrypt_roundtrip(self, encryption_service):
        config = {"access_token": "secret123", "url": "https://example.com"}
        encrypted, hash_val = encryption_service.encrypt_config(config)

        decrypted = encryption_service.decrypt_config(encrypted, hash_val)
        assert decrypted == config

    def test_decrypt_with_wrong_hash_raises(self, encryption_service):
        config = {"key": "value"}
        encrypted, _ = encryption_service.encrypt_config(config)

        with pytest.raises(ValueError, match="Failed to decrypt"):
            encryption_service.decrypt_config(encrypted, "wrong_hash")

    def test_decrypt_with_corrupted_data_raises(self, encryption_service):
        with pytest.raises(ValueError, match="Failed to decrypt"):
            encryption_service.decrypt_config(b"corrupted_data", "some_hash")


class TestCredentialServiceDecryptionFailure:
    """Test that _map_to_credential raises instead of returning empty config."""

    def test_map_to_credential_raises_on_decrypt_failure(self):
        from cryptography.fernet import Fernet

        test_key = Fernet.generate_key()
        with patch.dict(os.environ, {"MCP_CREDENTIAL_ENCRYPTION_KEY": test_key.decode()}):
            mock_db = MagicMock()
            service = CredentialService(mock_db)

            # Create data with invalid encrypted_config
            bad_data = {
                "credential_id": "cred-1",
                "account_id": "user-1",
                "mcp_qualified_name": "custom_http_test",
                "display_name": "Test",
                "encrypted_config": base64.b64encode(b"corrupted").decode(),
                "config_hash": "wrong",
                "is_active": True,
                "last_used_at": None,
                "created_at": None,
                "updated_at": None,
            }

            with pytest.raises(ValueError, match="Failed to decrypt"):
                service._map_to_credential(bad_data)


# ==============================================================================
# 5. Composio Regression Test
# ==============================================================================


@pytest.mark.asyncio
async def test_composio_discovery_path_unaffected():
    """
    Verify that changes to the custom MCP discovery routing do NOT affect
    the Composio discovery path. Composio uses mcp_service.connect_server()
    with provider='composio', which is a separate code path.
    """
    from core.mcp_module.mcp_service import MCPService

    service = MCPService()

    composio_config = {
        "name": "GitHub Composio",
        "qualifiedName": "composio_github",
        "type": "composio",
        "config": {"profile_id": "test-profile-id"},
        "enabledTools": ["github_create_issue"],
    }

    # The Composio path goes through connect_server -> _get_server_url ->
    # _get_composio_server_url which resolves profile_id.
    # We mock the profile resolution to verify the routing is intact.
    with patch(
        "core.mcp_module.mcp_service.MCPService._get_composio_server_url",
        new_callable=AsyncMock,
    ) as mock_url:
        mock_url.return_value = "https://composio-mcp.example.com/sse"

        with patch(
            "core.mcp_module.mcp_service.MCPService._get_composio_headers",
            new_callable=AsyncMock,
        ) as mock_headers:
            mock_headers.return_value = {"Content-Type": "application/json"}

            # We expect the connection to fail (no real server) but the routing
            # should reach the Composio-specific methods.
            try:
                await service.connect_server(composio_config, external_user_id="user-1")
            except Exception:
                pass

            # Verify Composio-specific methods were called
            mock_url.assert_called_once()
            mock_headers.assert_called_once()

            # Verify the provider was correctly determined
            call_args = mock_url.call_args
            assert call_args[0][0] == "composio_github"  # qualified_name


# ==============================================================================
# 6. Exception Hierarchy Test
# ==============================================================================


def test_exception_classes_from_single_source():
    """
    Verify that exception classes used in mcp_service.py come from
    exceptions.py (not duplicated locally).
    """
    import importlib
    from core.mcp_module import exceptions as exc_module

    # Import the module directly (not the package re-export which is the singleton)
    svc_module = importlib.import_module("core.mcp_module.mcp_service")

    # All exception classes in mcp_service should be the SAME objects
    # as those in exceptions.py (not re-defined copies)
    assert svc_module.MCPException is exc_module.MCPException
    assert svc_module.MCPConnectionError is exc_module.MCPConnectionError
    assert svc_module.MCPToolNotFoundError is exc_module.MCPToolNotFoundError
    assert svc_module.MCPToolExecutionError is exc_module.MCPToolExecutionError
    assert svc_module.MCPProviderError is exc_module.MCPProviderError
    assert svc_module.MCPAuthenticationError is exc_module.MCPAuthenticationError
    assert svc_module.CustomMCPError is exc_module.CustomMCPError


# ==============================================================================
# 7. Composio Headers Async Regression
# ==============================================================================


@pytest.mark.asyncio
async def test_composio_headers_is_awaitable():
    """
    Verify that _get_composio_headers is async and can be awaited.
    This was a bug: the method was sync but called with await.
    """
    from core.mcp_module.mcp_service import MCPService
    import inspect

    service = MCPService()

    # Verify the method is a coroutine function
    assert inspect.iscoroutinefunction(service._get_composio_headers), \
        "_get_composio_headers must be async (was previously sync, called with await)"

    # Verify it can be awaited without error
    result = await service._get_composio_headers("test_name", {})
    assert isinstance(result, dict)
    assert "Content-Type" in result
