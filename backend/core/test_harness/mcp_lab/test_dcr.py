import httpx
import asyncio
import json

async def test_reg():
    reg_endpoint = "https://mcp.desktopcommander.app/register"
    redirect_uri = "https://api.suna.syhc.dev/v1/mcp/auth/callback"
    
    reg_payload = {
        "client_name": "Suna Test Registration",
        "redirect_uris": [redirect_uri],
        "grant_types": ["authorization_code", "refresh_token"],
        "response_types": ["code"],
        "token_endpoint_auth_method": "none"
    }
    
    print(f"Testing registration at {reg_endpoint}")
    async with httpx.AsyncClient() as client:
        try:
            res = await client.post(reg_endpoint, json=reg_payload)
            print(f"Status: {res.status_code}")
            print(f"Body: {res.text}")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_reg())
