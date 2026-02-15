
import asyncio
import json
import httpx
import sys
import os

# Ensure /app is on path
APP_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../"))
if APP_ROOT not in sys.path:
    sys.path.insert(0, APP_ROOT)

async def main():
    if len(sys.argv) < 2:
        print("Usage: python manual_exchange.py <AUTH_CODE> [redirect_uri]")
        return

    code = sys.argv[1]
    
    # Optional override for redirect_uri if needed
    override_redirect = sys.argv[2] if len(sys.argv) > 2 else None
    
    layout_path = "backend/core/test_harness/mcp_lab/layouts/pending_auth.json"
    secrets_path = "backend/core/test_harness/mcp_lab/layouts/secrets.json"
    
    # Handle paths relative to container root if needed
    if not os.path.exists(layout_path):
        layout_path = "/app/core/test_harness/mcp_lab/layouts/pending_auth.json"
        secrets_path = "/app/core/test_harness/mcp_lab/layouts/secrets.json"

    try:
        with open(layout_path, "r") as f:
            pending = json.load(f)
    except FileNotFoundError:
        print(f"❌ Pending auth file not found at {layout_path}")
        return
        
    print(f"🔑 Exchanging code for {pending['mcp_url']}...")
    print(f"   Code: {code[:10]}...")
    print(f"   Verifier: {pending['code_verifier'][:10]}...")
    
    redirect_uri = override_redirect or pending["redirect_uri"]
    print(f"   Redirect URI: {redirect_uri}")
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            exchange_data = {
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
                "client_id": pending["client_id"],
                "code_verifier": pending["code_verifier"]
            }
            
            res = await client.post(pending["token_endpoint"], data=exchange_data)
            
            if res.status_code == 200:
                token_data = res.json()
                print("✅ Success! Token received.")
                
                # Load existing secrets to preserve other creds
                secrets = {}
                if os.path.exists(secrets_path):
                    with open(secrets_path, "r") as f:
                        try:
                            secrets = json.load(f)
                        except:
                            pass
                
                secrets.setdefault("credentials", {})
                secrets["credentials"]["desktop_commander"] = token_data
                
                with open(secrets_path, "w") as f:
                    json.dump(secrets, f, indent=2)
                print("💾 Token saved to secrets.json")
            else:
                print(f"❌ Exchange Error ({res.status_code}): {res.text}")
                
    except Exception as e:
        print(f"❌ Connection Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
