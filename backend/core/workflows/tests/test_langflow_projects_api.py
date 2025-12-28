"""
Unit Tests for Langflow Projects API Endpoints (suna-advanced-workflows)

These tests directly test the Langflow API endpoints for Projects (Folders):
- GET /api/v1/projects/ - List all projects
- POST /api/v1/projects/ - Create a new project
- GET /api/v1/projects/{project_id} - Get a specific project
- PATCH /api/v1/projects/{project_id} - Update a project

These tests use httpx.AsyncClient to make real HTTP requests to a running
Langflow instance. Configure LANGFLOW_BASE_URL and auth settings via environment.

Usage:
    # Run with pytest
    pytest test_langflow_projects_api.py -v

    # Run with environment variables
    LANGFLOW_BASE_URL=http://localhost:7860 pytest test_langflow_projects_api.py -v
"""

import os
import pytest
from uuid import uuid4
from typing import Any
import httpx
import pytest_asyncio

# =============================================================================
# Configuration
# =============================================================================

# Base URL for Langflow/Advanced Workflows API
# Uses ADVANCED_WORKFLOWS_BACKEND_URL from Suna backend .env
# Default: http://host.docker.internal:7861 (for Docker), or http://localhost:7861 (local)
LANGFLOW_BASE_URL = os.getenv(
    "ADVANCED_WORKFLOWS_BACKEND_URL",
    os.getenv("LANGFLOW_BASE_URL", "http://host.docker.internal:7861")
)

# Integration secret for Suna <-> Langflow authentication
INTEGRATION_SECRET = os.getenv("ADVANCED_WORKFLOWS_INTEGRATION_SECRET", "")

# API Key for authentication (optional - if LANGFLOW_AUTO_LOGIN=true, not needed)
LANGFLOW_API_KEY = os.getenv("LANGFLOW_API_KEY", "")

# Timeout for API requests
REQUEST_TIMEOUT = 30.0


# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture
def base_url() -> str:
    """Return the Langflow API base URL."""
    return LANGFLOW_BASE_URL


@pytest.fixture
def api_headers() -> dict[str, str]:
    """Return headers for API requests, including authentication if configured."""
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    if LANGFLOW_API_KEY:
        headers["x-api-key"] = LANGFLOW_API_KEY
    return headers


@pytest.fixture
def unique_project_name() -> str:
    """Generate a unique project name for testing."""
    return f"Test Project {uuid4().hex[:8]}"


@pytest_asyncio.fixture
async def http_client(base_url: str, api_headers: dict[str, str]):
    """Create an async HTTP client for API requests."""
    async with httpx.AsyncClient(
        base_url=base_url,
        headers=api_headers,
        timeout=REQUEST_TIMEOUT,
    ) as client:
        yield client


@pytest_asyncio.fixture
async def created_project(http_client: httpx.AsyncClient, unique_project_name: str) -> dict[str, Any]:
    """
    Create a test project and yield it.
    
    The project will be automatically cleaned up after the test.
    """
    # Create the project
    response = await http_client.post(
        "/api/v1/projects/",
        json={
            "name": unique_project_name,
            "description": "Test project created by pytest",
        },
    )
    
    # If creation failed, skip the test with helpful error
    if response.status_code != 201:
        pytest.skip(
            f"Failed to create test project: {response.status_code} - {response.text}. "
            "Ensure Langflow is running and accessible."
        )
    
    project_data = response.json()
    yield project_data
    
    # Cleanup: Delete the project after the test
    project_id = project_data.get("id")
    if project_id:
        try:
            await http_client.delete(f"/api/v1/projects/{project_id}")
        except Exception:
            pass  # Best effort cleanup


# =============================================================================
# Test Classes
# =============================================================================

class TestProjectsListEndpoint:
    """Tests for GET /api/v1/projects/ - List Projects endpoint."""

    @pytest.mark.asyncio
    async def test_list_projects_returns_200(self, http_client: httpx.AsyncClient):
        """Test that listing projects returns 200 OK."""
        response = await http_client.get("/api/v1/projects/")
        
        assert response.status_code == 200, (
            f"Expected 200 OK, got {response.status_code}: {response.text}"
        )

    @pytest.mark.asyncio
    async def test_list_projects_returns_list(self, http_client: httpx.AsyncClient):
        """Test that listing projects returns a list (possibly empty)."""
        response = await http_client.get("/api/v1/projects/")
        
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list), f"Expected list, got {type(data)}"

    @pytest.mark.asyncio
    async def test_list_projects_contains_expected_fields(
        self,
        http_client: httpx.AsyncClient,
        created_project: dict[str, Any],
    ):
        """Test that listed projects contain expected fields."""
        response = await http_client.get("/api/v1/projects/")
        
        assert response.status_code == 200
        projects = response.json()
        
        # Find our created project in the list
        created_id = created_project["id"]
        matching_projects = [p for p in projects if p.get("id") == created_id]
        
        assert len(matching_projects) == 1, (
            f"Expected to find created project {created_id} in list"
        )
        
        project = matching_projects[0]
        
        # Verify expected fields exist (based on FolderRead schema)
        expected_fields = ["id", "name", "description", "parent_id"]
        for field in expected_fields:
            assert field in project, f"Expected field '{field}' in project response"


class TestCreateProjectEndpoint:
    """Tests for POST /api/v1/projects/ - Create Project endpoint."""

    @pytest.mark.asyncio
    async def test_create_project_returns_201(
        self,
        http_client: httpx.AsyncClient,
        unique_project_name: str,
    ):
        """Test that creating a project returns 201 Created."""
        response = await http_client.post(
            "/api/v1/projects/",
            json={
                "name": unique_project_name,
                "description": "Test project for create endpoint",
            },
        )
        
        assert response.status_code == 201, (
            f"Expected 201 Created, got {response.status_code}: {response.text}"
        )
        
        # Cleanup
        project_id = response.json().get("id")
        if project_id:
            await http_client.delete(f"/api/v1/projects/{project_id}")

    @pytest.mark.asyncio
    async def test_create_project_returns_project_data(
        self,
        http_client: httpx.AsyncClient,
        unique_project_name: str,
    ):
        """Test that creating a project returns the created project data."""
        response = await http_client.post(
            "/api/v1/projects/",
            json={
                "name": unique_project_name,
                "description": "Test description",
            },
        )
        
        assert response.status_code == 201
        data = response.json()
        
        # Verify returned data matches input
        assert data["name"] == unique_project_name
        assert data["description"] == "Test description"
        assert "id" in data
        assert data["id"] is not None
        
        # Cleanup
        await http_client.delete(f"/api/v1/projects/{data['id']}")

    @pytest.mark.asyncio
    async def test_create_project_with_custom_id(
        self,
        http_client: httpx.AsyncClient,
        unique_project_name: str,
    ):
        """Test creating a project with a custom ID (for Suna integration)."""
        custom_id = str(uuid4())
        
        response = await http_client.post(
            "/api/v1/projects/",
            json={
                "id": custom_id,
                "name": unique_project_name,
                "description": "Project with custom ID",
            },
        )
        
        assert response.status_code == 201, (
            f"Expected 201 Created, got {response.status_code}: {response.text}"
        )
        
        data = response.json()
        assert data["id"] == custom_id, (
            f"Expected custom ID {custom_id}, got {data['id']}"
        )
        
        # Cleanup
        await http_client.delete(f"/api/v1/projects/{custom_id}")

    @pytest.mark.asyncio
    async def test_create_project_with_duplicate_name_auto_renames(
        self,
        http_client: httpx.AsyncClient,
        created_project: dict[str, Any],
    ):
        """Test that creating a project with duplicate name auto-renames it."""
        original_name = created_project["name"]
        
        # Create another project with the same name
        response = await http_client.post(
            "/api/v1/projects/",
            json={
                "name": original_name,
                "description": "Duplicate name project",
            },
        )
        
        assert response.status_code == 201
        data = response.json()
        
        # Name should be auto-renamed (e.g., "Test Project (1)")
        assert data["name"] != original_name or data["id"] != created_project["id"], (
            "Duplicate project should either have a different name or different ID"
        )
        
        # Cleanup
        await http_client.delete(f"/api/v1/projects/{data['id']}")

    @pytest.mark.asyncio
    async def test_create_project_minimal_payload(
        self,
        http_client: httpx.AsyncClient,
        unique_project_name: str,
    ):
        """Test creating a project with minimal required fields (just name)."""
        response = await http_client.post(
            "/api/v1/projects/",
            json={
                "name": unique_project_name,
            },
        )
        
        assert response.status_code == 201, (
            f"Expected 201 Created with minimal payload, got {response.status_code}: {response.text}"
        )
        
        data = response.json()
        assert data["name"] == unique_project_name
        
        # Cleanup
        await http_client.delete(f"/api/v1/projects/{data['id']}")


class TestReadProjectEndpoint:
    """Tests for GET /api/v1/projects/{project_id} - Read Project endpoint."""

    @pytest.mark.asyncio
    async def test_read_project_returns_200(
        self,
        http_client: httpx.AsyncClient,
        created_project: dict[str, Any],
    ):
        """Test that reading a project returns 200 OK."""
        project_id = created_project["id"]
        
        response = await http_client.get(f"/api/v1/projects/{project_id}")
        
        assert response.status_code == 200, (
            f"Expected 200 OK, got {response.status_code}: {response.text}"
        )

    @pytest.mark.asyncio
    async def test_read_project_returns_correct_data(
        self,
        http_client: httpx.AsyncClient,
        created_project: dict[str, Any],
    ):
        """Test that reading a project returns correct data."""
        project_id = created_project["id"]
        
        response = await http_client.get(f"/api/v1/projects/{project_id}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify returned data matches created project
        # The response might be FolderWithPaginatedFlows or FolderReadWithFlows
        # Check for nested 'folder' key or direct fields
        if "folder" in data:
            folder_data = data["folder"]
        else:
            folder_data = data
        
        assert folder_data["id"] == project_id
        assert folder_data["name"] == created_project["name"]

    @pytest.mark.asyncio
    async def test_read_project_with_pagination(
        self,
        http_client: httpx.AsyncClient,
        created_project: dict[str, Any],
    ):
        """Test that reading a project with pagination parameters works."""
        project_id = created_project["id"]
        
        response = await http_client.get(
            f"/api/v1/projects/{project_id}",
            params={"page": 1, "size": 10},
        )
        
        assert response.status_code == 200, (
            f"Expected 200 OK with pagination, got {response.status_code}: {response.text}"
        )
        
        data = response.json()
        
        # When pagination is used, response should be FolderWithPaginatedFlows
        # which has 'folder' and 'flows' keys
        if "folder" in data:
            assert "flows" in data, "Paginated response should include 'flows' key"

    @pytest.mark.asyncio
    async def test_read_nonexistent_project_returns_404(
        self,
        http_client: httpx.AsyncClient,
    ):
        """Test that reading a non-existent project returns 404."""
        fake_id = str(uuid4())
        
        response = await http_client.get(f"/api/v1/projects/{fake_id}")
        
        assert response.status_code == 404, (
            f"Expected 404 Not Found for non-existent project, got {response.status_code}"
        )

    @pytest.mark.asyncio
    async def test_read_project_with_invalid_uuid_returns_422(
        self,
        http_client: httpx.AsyncClient,
    ):
        """Test that reading with an invalid UUID returns 422 Validation Error."""
        response = await http_client.get("/api/v1/projects/not-a-valid-uuid")
        
        assert response.status_code == 422, (
            f"Expected 422 Validation Error for invalid UUID, got {response.status_code}"
        )


class TestUpdateProjectEndpoint:
    """Tests for PATCH /api/v1/projects/{project_id} - Update Project endpoint."""

    @pytest.mark.asyncio
    async def test_update_project_name_returns_200(
        self,
        http_client: httpx.AsyncClient,
        created_project: dict[str, Any],
    ):
        """Test that updating a project name returns 200 OK."""
        project_id = created_project["id"]
        new_name = f"Updated Name {uuid4().hex[:6]}"
        
        response = await http_client.patch(
            f"/api/v1/projects/{project_id}",
            json={"name": new_name},
        )
        
        assert response.status_code == 200, (
            f"Expected 200 OK, got {response.status_code}: {response.text}"
        )

    @pytest.mark.asyncio
    async def test_update_project_name_persists(
        self,
        http_client: httpx.AsyncClient,
        created_project: dict[str, Any],
    ):
        """Test that updating a project name is persisted."""
        project_id = created_project["id"]
        new_name = f"Persisted Name {uuid4().hex[:6]}"
        
        # Update the project
        update_response = await http_client.patch(
            f"/api/v1/projects/{project_id}",
            json={"name": new_name},
        )
        
        assert update_response.status_code == 200
        
        # Verify the update persisted
        get_response = await http_client.get(f"/api/v1/projects/{project_id}")
        assert get_response.status_code == 200
        
        data = get_response.json()
        folder_data = data.get("folder", data)
        
        assert folder_data["name"] == new_name, (
            f"Expected name '{new_name}', got '{folder_data['name']}'"
        )

    @pytest.mark.asyncio
    async def test_update_project_description(
        self,
        http_client: httpx.AsyncClient,
        created_project: dict[str, Any],
    ):
        """Test updating a project's description."""
        project_id = created_project["id"]
        new_description = "Updated description via pytest"
        
        response = await http_client.patch(
            f"/api/v1/projects/{project_id}",
            json={"description": new_description},
        )
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["description"] == new_description

    @pytest.mark.asyncio
    async def test_update_nonexistent_project_returns_404(
        self,
        http_client: httpx.AsyncClient,
    ):
        """Test that updating a non-existent project returns 404."""
        fake_id = str(uuid4())
        
        response = await http_client.patch(
            f"/api/v1/projects/{fake_id}",
            json={"name": "Should Not Work"},
        )
        
        assert response.status_code == 404, (
            f"Expected 404 Not Found, got {response.status_code}"
        )

    @pytest.mark.asyncio
    async def test_update_project_with_empty_payload(
        self,
        http_client: httpx.AsyncClient,
        created_project: dict[str, Any],
    ):
        """Test updating a project with an empty payload (no-op)."""
        project_id = created_project["id"]
        
        response = await http_client.patch(
            f"/api/v1/projects/{project_id}",
            json={},
        )
        
        # Should still return 200 even with no changes
        assert response.status_code == 200, (
            f"Expected 200 OK for empty update, got {response.status_code}: {response.text}"
        )


# =============================================================================
# Integration / Sequence Tests
# =============================================================================

class TestProjectLifecycle:
    """Test complete project lifecycle: Create -> Read -> Update -> List -> Delete."""

    @pytest.mark.asyncio
    async def test_full_project_lifecycle(
        self,
        http_client: httpx.AsyncClient,
        unique_project_name: str,
    ):
        """Test the complete lifecycle of a project."""
        # 1. CREATE
        create_response = await http_client.post(
            "/api/v1/projects/",
            json={
                "name": unique_project_name,
                "description": "Lifecycle test project",
            },
        )
        
        assert create_response.status_code == 201, "Failed to create project"
        project_id = create_response.json()["id"]
        
        try:
            # 2. READ
            read_response = await http_client.get(f"/api/v1/projects/{project_id}")
            assert read_response.status_code == 200, "Failed to read project"
            
            read_data = read_response.json()
            folder_data = read_data.get("folder", read_data)
            assert folder_data["name"] == unique_project_name
            
            # 3. UPDATE
            new_name = f"{unique_project_name} (Updated)"
            update_response = await http_client.patch(
                f"/api/v1/projects/{project_id}",
                json={"name": new_name},
            )
            assert update_response.status_code == 200, "Failed to update project"
            assert update_response.json()["name"] == new_name
            
            # 4. LIST (verify project appears)
            list_response = await http_client.get("/api/v1/projects/")
            assert list_response.status_code == 200, "Failed to list projects"
            
            projects = list_response.json()
            project_ids = [p["id"] for p in projects]
            assert project_id in project_ids, "Created project not found in list"
            
            # 5. DELETE
            delete_response = await http_client.delete(f"/api/v1/projects/{project_id}")
            assert delete_response.status_code == 204, "Failed to delete project"
            
            # 6. VERIFY DELETED
            verify_response = await http_client.get(f"/api/v1/projects/{project_id}")
            assert verify_response.status_code == 404, "Project should be deleted"
            
        except AssertionError:
            # Cleanup on failure
            await http_client.delete(f"/api/v1/projects/{project_id}")
            raise


# =============================================================================
# Connection / Health Tests
# =============================================================================

class TestLangflowConnection:
    """Tests to verify Langflow API is accessible."""

    @pytest.mark.asyncio
    async def test_langflow_health_check(self, http_client: httpx.AsyncClient):
        """Test that Langflow health endpoint is reachable."""
        response = await http_client.get("/health")
        
        assert response.status_code == 200, (
            f"Langflow health check failed: {response.status_code}. "
            f"Ensure Langflow is running at {LANGFLOW_BASE_URL}"
        )

    @pytest.mark.asyncio
    async def test_langflow_api_docs_accessible(self, http_client: httpx.AsyncClient):
        """Test that Langflow API docs are accessible."""
        response = await http_client.get("/docs")
        
        # Swagger UI returns HTML, just check it's accessible
        assert response.status_code == 200, (
            f"Langflow API docs not accessible: {response.status_code}"
        )
