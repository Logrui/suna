import asyncio
import httpx
import os
import json
import hashlib
import base64
from urllib.parse import urlencode

async def main():
    reg_endpoint = "https://mcp.desktopcommander.app/register"
    backend_base = "https://api.suna.syhc.dev/v1"
    redirect_uri = f"{backend_base}/mcp/auth/callback"
    
    # 1. Register Client
    print(f"📝 Registering client at {reg_endpoint}...")
    reg_payload = {
        "client_name": "Kortix CLI Harness",
        "redirect_uris": [redirect_uri],
        "grant_types": ["authorization_code", "refresh_token"],
        "response_types": ["code"],
        "token_endpoint_auth_method": "none"
    }
    
    async with httpx.AsyncClient() as client:
        try:
            res = await client.post(reg_endpoint, json=reg_payload)
            if res.status_code not in (200, 201):
                print(f"❌ Registration failed ({res.status_code}): {res.text}")
                client_id = f"{backend_base}/mcp/client-metadata.json"
                print(f"🔄 Falling back to: {client_id}")
            else:
                data = res.json()
                client_id = data.get("client_id")
                print(f"✅ Registered! Client ID: {client_id}")
        except Exception as e:
            print(f"⚠️ Error during registration: {e}")
            client_id = f"{backend_base}/mcp/client-metadata.json"

    # 2. Generate URL
    auth_endpoint = "https://mcp.desktopcommander.app/authorize"
    code_verifier = "ZID_vImZ6Z_ID_vImZ6Z_ID_vImZ6Z_ID_vImZ6Z_I"
    hashed = hashlib.sha256(code_verifier.encode('ascii')).digest()
    challenge = base64.urlsafe_b64encode(hashed).decode('ascii').rstrip('=')

    params = {
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
        "scope": "mcp:tools",
        "resource": "https://mcp.desktopcommander.app/mcp",
        "state": "harness_test_state"
    }
    
    auth_url = f"{auth_endpoint}?{urlencode(params)}"
    
    pending = {
        "mcp_url": "https://mcp.desktopcommander.app/mcp",
        "code_verifier": code_verifier,
        "token_endpoint": "https://mcp.desktopcommander.app/token",
        "client_id": client_id,
        "redirect_uri": redirect_uri
    }
    
    os.makedirs("backend/core/test_harness/mcp_lab/layouts", exist_ok=True)
    with open("backend/core/test_harness/mcp_lab/layouts/pending_auth.json", "w") as f:
        json.dump(pending, f, indent=2)
        
    print(f"\n👉 AUTH_URL: {auth_url}\n")

if __name__ == "__main__":
    asyncio.run(main())
