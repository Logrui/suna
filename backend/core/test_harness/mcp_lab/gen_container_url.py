import asyncio
import httpx
import os
import json
import hashlib
import base64
from urllib.parse import urlencode

async def main():
    # Use the EXACT parameters that match the production backend's expectation
    # Suna's backend uses its own URL as the client_id for URL-based identity (SEP-991)
    backend_base = "https://api.suna.syhc.dev/v1"
    client_id = f"{backend_base}/mcp/client-metadata.json"
    redirect_uri = f"{backend_base}/mcp/auth/callback"
    
    auth_endpoint = "https://mcp.desktopcommander.app/authorize"
    
    # Generate PKCE
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
        # Resource is often required by strict servers to audience-bind the token
        "resource": "https://mcp.desktopcommander.app/mcp", 
        "state": "harness_test_state"
    }
    
    auth_url = f"{auth_endpoint}?{urlencode(params)}"
    
    # Save pending state so exchange script can find it
    pending = {
        "mcp_url": "https://mcp.desktopcommander.app/mcp",
        "code_verifier": code_verifier,
        "token_endpoint": "https://mcp.desktopcommander.app/token",
        "client_id": client_id,
        "redirect_uri": redirect_uri
    }
    
    os.makedirs("/app/core/test_harness/mcp_lab/layouts", exist_ok=True)
    with open("/app/core/test_harness/mcp_lab/layouts/pending_auth.json", "w") as f:
        json.dump(pending, f, indent=2)
        
    print(f"\n👉 AUTH_URL: {auth_url}\n")

if __name__ == "__main__":
    asyncio.run(main())
