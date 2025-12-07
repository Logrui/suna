import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient
from core.sandbox.api import router, proxy_daytona_preview, proxy_daytona_websocket
from fastapi import FastAPI, Request, HTTPException, WebSocket

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


@pytest.mark.asyncio
async def test_websocket_auth_rejects_unauthorized():
    """Test that WebSocket connection is rejected when user doesn't have access"""
    # Mock WebSocket
    mock_websocket = MagicMock(spec=WebSocket)
    mock_websocket.headers = MagicMock()
    mock_websocket.headers.get = MagicMock(return_value=None)
    mock_websocket.query_params = MagicMock()
    mock_websocket.query_params.get = MagicMock(return_value=None)
    mock_websocket.cookies = MagicMock()
    mock_websocket.cookies.get = MagicMock(return_value=None)
    mock_websocket.close = AsyncMock()
    
    # Mock database and verification to raise HTTPException (access denied)
    with patch('core.sandbox.api.db') as mock_db, \
         patch('core.sandbox.api.get_optional_user_id_from_websocket', return_value=None), \
         patch('core.sandbox.api.verify_sandbox_access_optional', side_effect=HTTPException(status_code=403, detail="Access denied")):
        
        mock_client = AsyncMock()
        mock_db.client = AsyncMock(return_value=mock_client)
        
        # Call the endpoint
        await proxy_daytona_websocket(
            websocket=mock_websocket,
            sandbox_id="sandbox-123",
            port=6080
        )
        
        # Verify WebSocket was closed with access denied code
        mock_websocket.close.assert_called_once()
        call_args = mock_websocket.close.call_args
        assert call_args[1]['code'] == 1008  # Policy violation code
        assert "Access denied" in call_args[1]['reason']


@pytest.mark.asyncio
async def test_websocket_auth_accepts_authorized():
    """Test that WebSocket connection is accepted when user has valid access"""
    # Mock WebSocket with valid authentication
    mock_websocket = MagicMock(spec=WebSocket)
    mock_websocket.headers = MagicMock()
    mock_websocket.headers.get = MagicMock(return_value='Bearer valid-token')
    mock_websocket.query_params = MagicMock()
    mock_websocket.cookies = MagicMock()
    mock_websocket.accept = AsyncMock()
    mock_websocket.receive = AsyncMock(side_effect=Exception("Test interrupt"))
    mock_websocket.close = AsyncMock()
    
    # Mock database, auth, and sandbox
    with patch('core.sandbox.api.db') as mock_db, \
         patch('core.sandbox.api.get_optional_user_id_from_websocket', return_value='user-123'), \
         patch('core.sandbox.api.verify_sandbox_access_optional', return_value=None), \
         patch('core.sandbox.api.get_sandbox_by_id_safely') as mock_get_sandbox:
        
        mock_client = AsyncMock()
        mock_db.client = AsyncMock(return_value=mock_client)
        
        # Mock the sandbox
        mock_sandbox = AsyncMock()
        mock_preview_link = MagicMock()
        mock_preview_link.url = "https://6080-sandbox-123.proxy.daytona.work"
        mock_sandbox.get_preview_link = AsyncMock(return_value=mock_preview_link)
        mock_get_sandbox.return_value = mock_sandbox
        
        # Call the endpoint (it will fail at websockets.connect but that's expected)
        try:
            await proxy_daytona_websocket(
                websocket=mock_websocket,
                sandbox_id="sandbox-123",
                port=6080
            )
        except Exception:
            # Expected to fail when trying to connect to upstream
            pass
        
        # Verify WebSocket was accepted (authentication passed)
        mock_websocket.accept.assert_called_once()

