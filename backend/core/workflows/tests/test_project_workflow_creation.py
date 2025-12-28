"""
Unit Tests for Project and Workflow Creation via Advanced Workflows Bridge

These tests focus specifically on:
1. ensure_project_exists() - Creating/fetching projects in Langflow
2. ensure_flow_exists() - Creating/fetching flows in Langflow

Using the auth session exchange logic.
"""

import pytest
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4
import httpx

from core.advanced_workflows_bridge import ensure_project_exists, ensure_flow_exists


def create_mock_http_client(mock_response):
    """Helper to create a properly mocked httpx.AsyncClient."""
    mock_client = AsyncMock()
    mock_client.__aenter__.return_value = mock_client
    mock_client.__aexit__.return_value = None
    mock_client.post = AsyncMock(return_value=mock_response)
    return mock_client


class TestEnsureProjectExists:
    """Unit tests for ensure_project_exists() function."""

    @pytest.fixture
    def access_token(self):
        return "test-access-token-abc123"

    @pytest.fixture
    def agent_id(self):
        return str(uuid4())

    @pytest.fixture
    def agent_name(self):
        return "Test Agent"

    @pytest.fixture
    def mock_env(self):
        return {
            "ADVANCED_WORKFLOWS_BACKEND_URL": "http://langflow:7860",
            "ADVANCED_WORKFLOWS_INTEGRATION_SECRET": "shared-secret-key",
        }

    @pytest.mark.asyncio
    async def test_create_new_project_success(
        self, access_token, agent_id, agent_name, mock_env
    ):
        """Test successful creation of a new project."""
        import os
        
        with patch.dict(os.environ, mock_env):
            # Mock successful project creation response
            mock_response = Mock()
            mock_response.status_code = 201
            mock_response.json.return_value = {
                "id": agent_id,
                "name": agent_name,
                "description": f"Project synced from Suna Kortix agent: {agent_name}",
                "created": True,
            }

            mock_client = create_mock_http_client(mock_response)

            with patch("httpx.AsyncClient", return_value=mock_client):
                result = await ensure_project_exists(
                    access_token=access_token,
                    agent_id=agent_id,
                    agent_name=agent_name,
                )

            # Verify the result
            assert result["id"] == agent_id
            assert result["name"] == agent_name
            assert result["created"] is True

    @pytest.mark.asyncio
    async def test_fetch_existing_project_success(
        self, access_token, agent_id, agent_name, mock_env
    ):
        """Test fetching an existing project (not creating new)."""
        import os
        
        with patch.dict(os.environ, mock_env):
            # Mock response for existing project (200, not 201)
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "id": agent_id,
                "name": agent_name,
                "created": False,  # Already exists
            }

            mock_client = create_mock_http_client(mock_response)

            with patch("httpx.AsyncClient", return_value=mock_client):
                result = await ensure_project_exists(
                    access_token=access_token,
                    agent_id=agent_id,
                    agent_name=agent_name,
                )

            # Verify the result indicates it was not created
            assert result["id"] == agent_id
            assert result["created"] is False


class TestEnsureFlowExists:
    """Unit tests for ensure_flow_exists() function."""

    @pytest.fixture
    def access_token(self):
        return "test-access-token-xyz789"

    @pytest.fixture
    def workflow_id(self):
        return str(uuid4())

    @pytest.fixture
    def agent_id(self):
        return str(uuid4())

    @pytest.fixture
    def workflow_name(self):
        return "Test Workflow"

    @pytest.fixture
    def mock_env(self):
        return {
            "ADVANCED_WORKFLOWS_BACKEND_URL": "http://langflow:7860",
            "ADVANCED_WORKFLOWS_INTEGRATION_SECRET": "shared-secret-key",
        }

    @pytest.mark.asyncio
    async def test_create_new_flow_success(
        self, access_token, workflow_id, agent_id, workflow_name, mock_env
    ):
        """Test successful creation of a new flow."""
        import os
        
        with patch.dict(os.environ, mock_env):
            # Mock successful flow creation response
            mock_response = Mock()
            mock_response.status_code = 201
            mock_response.json.return_value = {
                "id": workflow_id,
                "name": workflow_name,
                "folder_id": agent_id,
                "description": f"Advanced workflow synced from Suna Kortix: {workflow_name}",
                "created": True,
            }

            mock_client = create_mock_http_client(mock_response)

            with patch("httpx.AsyncClient", return_value=mock_client):
                result = await ensure_flow_exists(
                    access_token=access_token,
                    workflow_id=workflow_id,
                    agent_id=agent_id,
                    workflow_name=workflow_name,
                )

            # Verify the result
            assert result["id"] == workflow_id
            assert result["name"] == workflow_name
            assert result["folder_id"] == agent_id
            assert result["created"] is True

    @pytest.mark.asyncio
    async def test_fetch_existing_flow_success(
        self, access_token, workflow_id, agent_id, workflow_name, mock_env
    ):
        """Test fetching an existing flow (not creating new)."""
        import os
        
        with patch.dict(os.environ, mock_env):
            # Mock response for existing flow
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "id": workflow_id,
                "name": workflow_name,
                "folder_id": agent_id,
                "created": False,  # Already exists
            }

            mock_client = create_mock_http_client(mock_response)

            with patch("httpx.AsyncClient", return_value=mock_client):
                result = await ensure_flow_exists(
                    access_token=access_token,
                    workflow_id=workflow_id,
                    agent_id=agent_id,
                    workflow_name=workflow_name,
                )

            # Verify the result indicates it was not created
            assert result["id"] == workflow_id
            assert result["created"] is False


class TestProjectAndFlowCreationSequence:
    """Test the complete sequence of project + flow creation."""

    @pytest.fixture
    def mock_env(self):
        return {
            "ADVANCED_WORKFLOWS_BACKEND_URL": "http://langflow:7860",
            "ADVANCED_WORKFLOWS_INTEGRATION_SECRET": "shared-secret-key",
        }

    @pytest.mark.asyncio
    async def test_new_project_new_flow_sequence(self, mock_env):
        """Test creating both a new project and new flow in sequence."""
        import os
        
        access_token = "test-token"
        agent_id = str(uuid4())
        workflow_id = str(uuid4())
        
        with patch.dict(os.environ, mock_env):
            # Project creation response
            project_response = Mock()
            project_response.status_code = 201
            project_response.json.return_value = {
                "id": agent_id,
                "created": True,
            }

            # Flow creation response
            flow_response = Mock()
            flow_response.status_code = 201
            flow_response.json.return_value = {
                "id": workflow_id,
                "folder_id": agent_id,
                "created": True,
            }

            # Create mock client that returns different responses for each call
            mock_client = AsyncMock()
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client.post = AsyncMock(side_effect=[project_response, flow_response])

            with patch("httpx.AsyncClient", return_value=mock_client):
                # Create project
                project_result = await ensure_project_exists(
                    access_token=access_token,
                    agent_id=agent_id,
                    agent_name="Test Agent",
                )

                # Create flow linked to project
                flow_result = await ensure_flow_exists(
                    access_token=access_token,
                    workflow_id=workflow_id,
                    agent_id=agent_id,
                    workflow_name="Test Workflow",
                )

            # Verify both were created and properly linked
            assert project_result["created"] is True
            assert flow_result["created"] is True
            assert flow_result["folder_id"] == agent_id
