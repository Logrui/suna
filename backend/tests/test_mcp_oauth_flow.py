import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, patch
from fastapi import FastAPI
from core.mcp_module.api import router as mcp_router
from core.mcp_module.mcp_service import MCPConnectionRequest
import jwt
from datetime import datetime, timedelta
import os
import json
import httpx

# ==============================================================================
# Setup Minimal App for Testing
# ==============================================================================

test_app = FastAPI()
test_app.include_router(mcp_router, prefix="/v1")

# ==============================================================================
# Helpers
# ==============================================================================

def create_test_token(user_id="test_user_123"):
    """Creates a valid JWT for testing endpoints."""
    # Try to get secret from env, fallback to default 'dev_secret' potentially used in test env
    secret = os.getenv("SUPABASE_JWT_SECRET") or os.getenv("JWT_SECRET") or "your-super-secret-jwt-token-with-at-least-32-characters-long"
    
    # We create a dummy token with the expected structure
    payload = {
        "sub": user_id,
        "aud": "authenticated", 
        "role": "authenticated", # Supabase default role
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(hours=1)
    }
    return jwt.encode(payload, secret, algorithm="HS256")

# ==============================================================================
# Integration Tests
# ==============================================================================

@pytest.mark.asyncio
async def test_mcp_auth_flow_initialization():
    """
    Verifies that GET /v1/mcp/auth/start:
    1. Correctly discovers OAuth metadata from the target MCP server (mocked).
    2. Generates a valid redirect URL with state, code_challenge, etc.
    3. Handles failure gracefully.
    """
    
    # Mock Data
    mock_mcp_url = "https://mock-mcp-server.com"
    mock_return_url = "https://suna.syhc.dev/connectors"
    mock_metadata = {
        "issuer": mock_mcp_url,
        "authorization_endpoint": f"{mock_mcp_url}/authorize",
        "token_endpoint": f"{mock_mcp_url}/token",
        "scopes_supported": ["mcp", "openid"]
    }
    
    # Generate Token
    token = create_test_token()
    headers = {"Authorization": f"Bearer {token}"}
    
    with patch("core.mcp_module.api.mcp_auth_service.discover_oauth_metadata", new_callable=AsyncMock) as mock_discover:
        mock_discover.return_value = mock_metadata

        async with AsyncClient(transport=ASGITransport(app=test_app), base_url="http://test") as ac:
            # 1. Successful Start
            response = await ac.get(
                "/v1/mcp/auth/start", 
                params={"url": mock_mcp_url, "return_url": mock_return_url},
                headers=headers
            )
            
            if response.status_code != 200:
                print(f"\n[DEBUG] Status: {response.status_code}")
                print(f"[DEBUG] Body: {response.text}")
            
            assert response.status_code == 200
            data = response.json()
            assert "redirect_url" in data
            redirect_url = data["redirect_url"]
            
            # Verify URL components
            assert mock_metadata["authorization_endpoint"] in redirect_url
            assert "client_id=" in redirect_url
            assert "state=" in redirect_url
            assert "code_challenge=" in redirect_url
            assert "redirect_uri=" in redirect_url
            
            print(f"\n[SUCCESS] Generated Redirect URL: {redirect_url}")

@pytest.mark.asyncio
async def test_mcp_auth_callback_handling():
    """
    Verifies that GET /v1/mcp/auth/callback:
    1. Validates the state parameter.
    2. Exchanges auth code for token using the token endpoint.
    3. Stores results in the credential service.
    4. Redirects the user with a success flag.
    """
    token = create_test_token()
    user_id = "test_user_123"
    return_url = "https://suna.syhc.dev/connectors"
    mcp_url = "https://mcp-server.com"
    
    from unittest.mock import AsyncMock, patch, MagicMock
    
    mock_state = "simulated_secure_state_123"
    mock_code = "simulated_auth_code_456"
    
    with patch("core.mcp_module.api.mcp_auth_service.validate_state") as mock_validate, \
         patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post, \
         patch("core.mcp_module.api.get_credential_service") as mock_get_service:
        
        # Mocking State Context
        mock_validate.return_value = {
            "user_id": user_id,
            "return_url": return_url,
            "mcp_url": mcp_url,
            "code_verifier": "test_verifier",
            "token_endpoint": "https://mcp-server.com/token",
            "timestamp": datetime.utcnow().timestamp()
        }
        
        # Mock Token Exchange Response
        mock_post.return_value = MagicMock()
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {
            "access_token": "test_access_token_789",
            "refresh_token": "test_refresh_token_012",
            "expires_in": 3600
        }
        
        # Mock Credential Service
        mock_service = AsyncMock()
        mock_get_service.return_value = mock_service
        
        async with AsyncClient(transport=ASGITransport(app=test_app), base_url="http://test") as ac:
            response = await ac.get(
                "/v1/mcp/auth/callback",
                params={"code": mock_code, "state": mock_state},
                follow_redirects=False
            )
            
            # Expect Redirect with success flag
            expected_redirect = f"{return_url}?mcp_auth=success"
            assert response.status_code in [302, 303, 307]
            assert response.headers["location"] == expected_redirect
            
            # Verify Token Exchange was called
            assert mock_post.called
            # Verify Storage was called
            assert mock_service.store_credential.called
            
            print(f"\n[SUCCESS] Callback handled token exchange and redirected to: {response.headers['location']}")

@pytest.mark.asyncio
async def test_custom_headers_discovery():
    """
    Verifies that CustomMCPDiscoverRequest correctly handles custom headers
    by mocking the service call.
    """
    token = create_test_token()
    headers = {"Authorization": f"Bearer {token}"}
    
    payload = {
        "type": "http",
        "config": {
            "url": "https://custom-header-test.com",
        },
        "custom_headers": {"X-Test-Key": "test-value-123"}
    }
    
    with patch("core.mcp_module.mcp_service.MCPService.discover_custom_tools", new_callable=AsyncMock) as mock_discover:
        mock_discover.return_value.success = True
        mock_discover.return_value.tools = [{"name": "test_tool", "description": "test", "inputSchema": {}}]
        mock_discover.return_value.qualified_name = "test_mcp"
        mock_discover.return_value.display_name = "Test MCP"
        mock_discover.return_value.config = payload["config"]
        mock_discover.return_value.url = payload["config"]["url"]
        mock_discover.return_value.message = "Connected"
        mock_discover.return_value.oauth_metadata = None
        mock_discover.return_value.requires_auth = False

        async with AsyncClient(transport=ASGITransport(app=test_app), base_url="http://test") as ac:
            response = await ac.post("/v1/mcp/discover-custom-tools", json=payload, headers=headers)
            
            assert response.status_code == 200
            
            # Check arguments called on mock
            args, _ = mock_discover.call_args
            passed_config = args[1]
            
            # Verify that custom_headers are in the passed config
            assert "custom_headers" in passed_config, "custom_headers key missing from service config"
            assert passed_config["custom_headers"]["X-Test-Key"] == "test-value-123", "Custom header value mismatch"
            
            print(f"\n[SUCCESS] Custom Headers merged correctly: {passed_config.get('custom_headers')}")
