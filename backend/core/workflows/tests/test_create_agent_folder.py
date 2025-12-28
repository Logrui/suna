"""
Specific Test: Create 'Deal Flow Agent' Project
Target UUID: 8a6d27cb-bd6c-49e6-a3ab-d2351a7da42c
Target Name: Deal Flow Agent

This test forces the creation of a specific project for development/verification purposes.
It robustly handles name collisions by deleting existing projects with the same name but different IDs.
"""

import os
import pytest
import pytest_asyncio
import httpx
from typing import Any

# =============================================================================
# Configuration
# =============================================================================

LANGFLOW_BASE_URL = os.getenv(
    "ADVANCED_WORKFLOWS_BACKEND_URL",
    os.getenv("LANGFLOW_BASE_URL", "http://host.docker.internal:7861")
)

LANGFLOW_API_KEY = os.getenv("LANGFLOW_API_KEY", "")
REQUEST_TIMEOUT = 30.0

TARGET_PROJECT_ID = "8a6d27cb-bd6c-49e6-a3ab-d2351a7da42c"
TARGET_PROJECT_NAME = "Deal Flow Agent"

# =============================================================================
# Fixtures
# =============================================================================

@pytest_asyncio.fixture
async def http_client():
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    if LANGFLOW_API_KEY:
        headers["x-api-key"] = LANGFLOW_API_KEY

    async with httpx.AsyncClient(
        base_url=LANGFLOW_BASE_URL,
        headers=headers,
        timeout=REQUEST_TIMEOUT,
    ) as client:
        yield client

# =============================================================================
# Test
# =============================================================================

@pytest.mark.asyncio
async def test_create_deal_flow_agent_project(http_client: httpx.AsyncClient):
    """
    Creates (or verifies) the 'Deal Flow Agent' project with specific UUID.
    """
    print(f"\nTarget: {TARGET_PROJECT_NAME} ({TARGET_PROJECT_ID})")
    
    # 1. Search for existing project by name or ID
    print("Searching for existing projects...")
    projects_response = await http_client.get("/api/v1/projects/")
    assert projects_response.status_code == 200, f"Failed to list projects: {projects_response.text}"
    
    projects = projects_response.json()
    
    # Check for exact match (ID and Name) or Collisions (Name match, ID mismatch)
    existing_exact = None
    existing_name_collision = None
    existing_id_collision = None
    
    for p in projects:
        if p["id"] == TARGET_PROJECT_ID:
            existing_exact = p
            # If ID matches but name is different, that's an ID collision/mismatch
            if p["name"] != TARGET_PROJECT_NAME:
                existing_id_collision = p
        elif p["name"] == TARGET_PROJECT_NAME:
            existing_name_collision = p

    # 2. Logic to handle state
    if existing_exact and existing_exact["name"] == TARGET_PROJECT_NAME:
        print(f"✅ SUCCESS: Project already exists correctly. ID: {existing_exact['id']}")
        return

    if existing_id_collision:
        print(f"⚠️  WARNING: ID {TARGET_PROJECT_ID} exists but has name '{existing_id_collision['name']}'. Deleting it...")
        await http_client.delete(f"/api/v1/projects/{TARGET_PROJECT_ID}")
    
    if existing_name_collision:
        print(f"⚠️  WARNING: Name '{TARGET_PROJECT_NAME}' exists with different ID {existing_name_collision['id']}. Deleting it...")
        await http_client.delete(f"/api/v1/projects/{existing_name_collision['id']}")

    # 3. Create the project
    print(f"Creating project '{TARGET_PROJECT_NAME}' with ID {TARGET_PROJECT_ID}...")
    payload = {
        "id": TARGET_PROJECT_ID,
        "name": TARGET_PROJECT_NAME,
        "description": "Specific project verification test",
    }
    
    response = await http_client.post("/api/v1/projects/", json=payload)
    
    if response.status_code == 201:
        data = response.json()
        print(f"✅ SUCCESS: Project created. ID: {data['id']}, Name: {data['name']}")
        assert data['id'] == TARGET_PROJECT_ID
        assert data['name'] == TARGET_PROJECT_NAME
    else:
        pytest.fail(f"Failed to create project. Status: {response.status_code}. Body: {response.text}")
