
import asyncio
import json
import os
import sys
import httpx

# Ensure /app is on path
APP_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../"))
if APP_ROOT not in sys.path:
    sys.path.insert(0, APP_ROOT)

async def main():
    pending_path = "backend/core/test_harness/mcp_lab/layouts/pending_auth.json"
    secrets_path = "backend/core/test_harness/mcp_lab/layouts/secrets.json"
    
    if not os.path.exists(pending_path):
        print(f"❌ Pending auth file not found: {pending_path}")
        return

    with open(pending_path, "r") as f:
        pending = json.load(f)
        
    code = "OUQgDBtg1n96tC-OnSwQuxtipal8maYbUBo86dmOFY0"
    
    print(f"🔑 Exchanging code for {pending['mcp_url']}...")
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            exchange_data = {
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": pending["redirect_uri"],
                "client_id": pending["client_id"],
                "code_verifier": pending["code_verifier"]
            }
            
            res = await client.post(pending["token_endpoint"], data=exchange_data)
            if res.status_code != 200:
                print(f"❌ Exchange failed ({res.status_code}): {res.text}")
                return
                
            token_data = res.json()
            print("✅ Authentication successful!")
            
            # Save to secrets.json
            secrets = {}
            if os.path.exists(secrets_path):
                with open(secrets_path, "r") as f:
                    secrets = json.load(f)
            
            secrets.setdefault("credentials", {})
            secrets["credentials"]["desktop_commander"] = token_data
            
            with open(secrets_path, "w") as f:
                json.dump(secrets, f, indent=2)
            
            print(f"💾 Saved tokens to secrets.json")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
