import asyncio
import json
import os
import sys
import httpx
from urllib.parse import urlencode

# Ensure /app is on path
APP_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../"))
if APP_ROOT not in sys.path:
    sys.path.insert(0, APP_ROOT)

from core.mcp_module.auth_service import mcp_auth_service

async def main():
    mcp_url = "https://mcp.desktopcommander.app/mcp"
    print(f"🔍 Discovering OAuth metadata for {mcp_url}...")
    
    try:
        metadata = await mcp_auth_service.discover_oauth_metadata(mcp_url)
    except Exception as e:
        print(f"❌ Discovery failed: {e}")
        return

    auth_endpoint = metadata.get("authorization_endpoint")
    token_endpoint = metadata.get("token_endpoint")
    
    if not auth_endpoint or not token_endpoint:
        print(f"❌ Incomplete metadata: {metadata}")
        return

    code_verifier, code_challenge = mcp_auth_service.generate_code_verifier_challenge()
    
    # Standard redirect for Desktop Commander
    client_id = "https://api.suna.syhc.dev/v1/mcp/client-metadata.json"
    redirect_uri = "https://api.suna.syhc.dev/v1/mcp/auth/callback"
    
    params = {
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
        "scope": "mcp:tools",
        "state": "harness_test_state"
    }
    
    auth_url = f"{auth_endpoint}?{urlencode(params)}"
    
    pending = {
        "mcp_url": mcp_url,
        "code_verifier": code_verifier,
        "token_endpoint": token_endpoint,
        "client_id": client_id,
        "redirect_uri": redirect_uri
    }
    
    os.makedirs("backend/core/test_harness/mcp_lab/layouts", exist_ok=True)
    with open("backend/core/test_harness/mcp_lab/layouts/pending_auth.json", "w") as f:
        json.dump(pending, f, indent=2)
        
    print(f"\n👉 AUTH_URL: {auth_url}\n")
    print("Verifier saved to pending_auth.json")

if __name__ == "__main__":
    asyncio.run(main())
