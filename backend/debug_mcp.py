
import os
import traceback
import asyncio
import httpx
from fastapi import FastAPI, Depends

# Set env vars for tests if needed
os.environ["MCP_CREDENTIAL_ENCRYPTION_KEY"] = "I8XbZGYZ8kSSBfV44kH6uVOxJaDVaDl2RumfFgsYZ7g="

try:
    from core.mcp_module.api import router as mcp_router
    from core.utils.auth_utils import verify_and_get_user_id_from_jwt
    
    app = FastAPI()
    
    # Mock auth dependency
    async def mock_auth():
        return "test_user_123"
    
    app.include_router(mcp_router, prefix="/v1")
    app.dependency_overrides[verify_and_get_user_id_from_jwt] = mock_auth
    
    async def run_debug():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            try:
                print("Calling /v1/mcp/auth/start...")
                response = await client.get("/v1/mcp/auth/start", params={
                    "url": "https://example.com", 
                    "return_url": "https://suna.syhc.dev/connectors"
                })
                print(f"Status: {response.status_code}")
                print(f"Body: {response.text}")
                
                if response.status_code == 500:
                    print("\nEndpoint returned 500. This is what we are looking for.")
            except Exception:
                traceback.print_exc()

    asyncio.run(run_debug())
    
except Exception:
    traceback.print_exc()
