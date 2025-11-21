import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient
from core.sandbox.api import router, proxy_daytona_preview
from fastapi import FastAPI, Request

# Create a minimal app for testing the router
app = FastAPI()
app.include_router(router)

@pytest.mark.asyncio
async def test_proxy_daytona_preview():
    # Mock the request object
    mock_request = MagicMock(spec=Request)
    mock_request.query_params = ""
    
    # Mock httpx.AsyncClient
    with patch("httpx.AsyncClient") as MockClient:
        mock_client_instance = MockClient.return_value
        
        # Mock the response from Daytona
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.headers = {"content-type": "text/html"}
        
        # Mock aiter_bytes to yield some content
        async def mock_aiter_bytes():
            yield b"<html><body>Hello Daytona</body></html>"
            
        mock_response.aiter_bytes = mock_aiter_bytes
        
        # Mock the send method
        mock_client_instance.send = AsyncMock(return_value=mock_response)
        mock_client_instance.build_request = MagicMock()
        mock_client_instance.aclose = AsyncMock()
        
        # Call the endpoint function directly (easier than setting up full TestClient with dependencies)
        # We need to mock Depends(get_optional_user_id) if we were calling via TestClient, 
        # but calling directly allows us to pass arguments.
        
        response = await proxy_daytona_preview(
            sandbox_id="sandbox-123",
            port=3000,
            path="index.html",
            request=mock_request,
            user_id="user-123"
        )
        
        # Verify the response
        assert response.status_code == 200
        assert response.media_type == "text/html"
        
        # Verify content (StreamingResponse is an async generator)
        content = b""
        async for chunk in response.body_iterator:
            content += chunk
            
        assert content == b"<html><body>Hello Daytona</body></html>"
        
        # Verify that the correct URL and headers were used
        MockClient.assert_called()
        mock_client_instance.build_request.assert_called_with(
            'GET', 
            'https://3000-sandbox-123.proxy.daytona.work/index.html', 
            headers={'X-Daytona-Skip-Preview-Warning': 'true'}
        )

@pytest.mark.asyncio
async def test_proxy_daytona_preview_with_query_params():
    # Mock the request object with query params
    mock_request = MagicMock(spec=Request)
    mock_request.query_params = "foo=bar&baz=qux"
    
    # Mock httpx.AsyncClient
    with patch("httpx.AsyncClient") as MockClient:
        mock_client_instance = MockClient.return_value
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.headers = {"content-type": "application/json"}
        
        async def mock_aiter_bytes():
            yield b'{"status": "ok"}'
            
        mock_response.aiter_bytes = mock_aiter_bytes
        mock_client_instance.send = AsyncMock(return_value=mock_response)
        mock_client_instance.build_request = MagicMock()
        mock_client_instance.aclose = AsyncMock()
        
        response = await proxy_daytona_preview(
            sandbox_id="sandbox-123",
            port=8080,
            path="api/data",
            request=mock_request,
            user_id="user-123"
        )
        
        assert response.status_code == 200
        
        # Verify URL includes query params
        mock_client_instance.build_request.assert_called_with(
            'GET', 
            'https://8080-sandbox-123.proxy.daytona.work/api/data?foo=bar&baz=qux', 
            headers={'X-Daytona-Skip-Preview-Warning': 'true'}
        )
