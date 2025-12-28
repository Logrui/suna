import asyncio
import os
import httpx
import json

# Setup
BASE_URL = os.getenv(
    "ADVANCED_WORKFLOWS_BACKEND_URL",
    os.getenv("LANGFLOW_BASE_URL", "http://host.docker.internal:7861")
)
PROJECT_ID = "8a6d27cb-bd6c-49e6-a3ab-d2351a7da42c"
PROJECT_NAME = "Deal Flow Agent"

async def main():
    print(f"Connecting to {BASE_URL}...")
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        # 0. DIRECT ID CHECK (Crucial fix)
        print(f"Checking for existing UUID: {PROJECT_ID}...")
        direct_resp = await client.get(f"/api/v1/projects/{PROJECT_ID}")
        
        if direct_resp.status_code == 200:
            print(" -> Found project by ID (was hidden from list?). Deleting...")
            data = direct_resp.json()
            if "folder" in data: data = data["folder"] # Handle different response shapes
            print(f"    Name: {data.get('name')}")
            
            await client.delete(f"/api/v1/projects/{PROJECT_ID}")
            print("    Deleted.")
        else:
            print(f" -> Not found by direct ID check ({direct_resp.status_code})")

        # 1. List Projects (still good to cleanup name collisions)
        print("Listing projects...")
        resp = await client.get("/api/v1/projects/")
        # ... rest of loop logic ...
        if resp.status_code != 200:
            print(f"Error listing projects: {resp.status_code} {resp.text}")
            return

        projects = resp.json()
        print(f"Found {len(projects)} projects.")
        
        target_found = False
        
        for p in projects:
            print(f" - {p['name']} ({p['id']})")
            
            # Name collision check only (ID check handled above)
            if p['name'] == PROJECT_NAME and p['id'] != PROJECT_ID:
                print("   -> Name collision! Deleting...")
                await client.delete(f"/api/v1/projects/{p['id']}")

        # 2. Create if not found
        print(f"Creating project '{PROJECT_NAME}' ({PROJECT_ID})...")
        payload = {
            "id": PROJECT_ID,
            "name": PROJECT_NAME,
            "description": "Created by debug script"
        }
        create_resp = await client.post("/api/v1/projects/", json=payload)
        print(f"Create Status: {create_resp.status_code}")
        print(f"Response: {create_resp.text}")

if __name__ == "__main__":
    asyncio.run(main())
