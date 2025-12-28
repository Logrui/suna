"""
Unit tests for the Advanced Workflows Bridge.

Tests the /advanced-workflows/session, /token, and /status endpoints
that bridge Suna Kortix authentication to Langflow.
"""

import pytest
import os
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import httpx
from fastapi import HTTPException


# Test fixtures
@pytest.fixture
def sample_user_id():
    """Sample user ID."""
    return str(uuid4())


@pytest.fixture
def sample_agent_id():
    """Sample agent ID."""
    return str(uuid4())


@pytest.fixture
def sample_workflow_id():
    """Sample workflow ID."""
    return str(uuid4())


@pytest.fixture
def mock_env_vars():
    """Set up mock environment variables for testing."""
    return {
        "ADVANCED_WORKFLOWS_BACKEND_URL": "http://langflow:7860",
        "ADVANCED_WORKFLOWS_FRONTEND_URL": "http://localhost:7860",
        "ADVANCED_WORKFLOWS_INTEGRATION_SECRET": "test-secret-key",
    }


@pytest.fixture
def mock_token_response():
    """Mock token exchange response from Langflow."""
    return {
        "access_token": "langflow-access-token-123",
        "refresh_token": "langflow-refresh-token-456",
        "expires_in": 3600,
    }


@pytest.fixture
def mock_project_response(sample_agent_id):
    """Mock project creation response from Langflow."""
    return {
        "id": sample_agent_id,
        "name": "Test Agent",
        "description": "Test description",
        "created": True,
    }


@pytest.fixture
def mock_flow_response(sample_workflow_id, sample_agent_id):
    """Mock flow creation response from Langflow."""
    return {
        "id": sample_workflow_id,
        "name": "Test Workflow",
        "folder_id": sample_agent_id,
        "description": "Test workflow description",
        "created": True,
    }


class TestAdvancedWorkflowsConfig:
    """Tests for the AdvancedWorkflowsConfig class."""

    def test_get_backend_url_returns_env_value(self, mock_env_vars):
        """Test that backend URL is read from environment."""
        from core.advanced_workflows_bridge import AdvancedWorkflowsConfig

        with patch.dict(os.environ, mock_env_vars):
            result = AdvancedWorkflowsConfig.get_backend_url()
            assert result == "http://langflow:7860"

    def test_get_backend_url_returns_none_when_not_set(self):
        """Test that None is returned when env var not set."""
        from core.advanced_workflows_bridge import AdvancedWorkflowsConfig

        with patch.dict(os.environ, {}, clear=True):
            result = AdvancedWorkflowsConfig.get_backend_url()
            assert result is None

    def test_is_configured_returns_true_when_all_set(self, mock_env_vars):
        """Test configuration check when all vars are set."""
        from core.advanced_workflows_bridge import AdvancedWorkflowsConfig

        with patch.dict(os.environ, mock_env_vars):
            assert AdvancedWorkflowsConfig.is_configured() is True

    def test_is_configured_returns_false_when_missing(self):
        """Test configuration check when vars are missing."""
        from core.advanced_workflows_bridge import AdvancedWorkflowsConfig

        with patch.dict(os.environ, {}, clear=True):
            assert AdvancedWorkflowsConfig.is_configured() is False


class TestExchangeToken:
    """Tests for the token exchange function."""

    @pytest.mark.asyncio
    async def test_exchange_token_success(
        self, mock_env_vars, sample_user_id, mock_token_response
    ):
        """Test successful token exchange with Langflow."""
        from core.advanced_workflows_bridge import (
            exchange_suna_token_for_advanced_workflows,
        )

        with patch.dict(os.environ, mock_env_vars):
            with patch("httpx.AsyncClient") as mock_client:
                mock_response = MagicMock()
                mock_response.status_code = 200
                mock_response.json.return_value = mock_token_response

                mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                    return_value=mock_response
                )

                result = await exchange_suna_token_for_advanced_workflows(
                    suna_user_id=sample_user_id,
                    suna_user_email="test@example.com",
                )

                assert result["access_token"] == "langflow-access-token-123"
                assert result["refresh_token"] == "langflow-refresh-token-456"

    @pytest.mark.asyncio
    async def test_exchange_token_unauthorized(self, mock_env_vars, sample_user_id):
        """Test token exchange with invalid integration key."""
        from core.advanced_workflows_bridge import (
            exchange_suna_token_for_advanced_workflows,
        )

        with patch.dict(os.environ, mock_env_vars):
            with patch("httpx.AsyncClient") as mock_client:
                mock_response = MagicMock()
                mock_response.status_code = 401
                mock_response.text = "Invalid integration key"

                mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                    return_value=mock_response
                )

                with pytest.raises(HTTPException) as exc_info:
                    await exchange_suna_token_for_advanced_workflows(
                        suna_user_id=sample_user_id,
                        suna_user_email=None,
                    )

                assert exc_info.value.status_code == 502

    @pytest.mark.asyncio
    async def test_exchange_token_timeout(self, mock_env_vars, sample_user_id):
        """Test token exchange timeout handling."""
        from core.advanced_workflows_bridge import (
            exchange_suna_token_for_advanced_workflows,
        )

        with patch.dict(os.environ, mock_env_vars):
            with patch("httpx.AsyncClient") as mock_client:
                mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                    side_effect=httpx.TimeoutException("Connection timed out")
                )

                with pytest.raises(HTTPException) as exc_info:
                    await exchange_suna_token_for_advanced_workflows(
                        suna_user_id=sample_user_id,
                        suna_user_email=None,
                    )

                assert exc_info.value.status_code == 504

    @pytest.mark.asyncio
    async def test_exchange_token_connection_error(self, mock_env_vars, sample_user_id):
        """Test token exchange connection error handling."""
        from core.advanced_workflows_bridge import (
            exchange_suna_token_for_advanced_workflows,
        )

        with patch.dict(os.environ, mock_env_vars):
            with patch("httpx.AsyncClient") as mock_client:
                mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                    side_effect=httpx.RequestError("Connection refused")
                )

                with pytest.raises(HTTPException) as exc_info:
                    await exchange_suna_token_for_advanced_workflows(
                        suna_user_id=sample_user_id,
                        suna_user_email=None,
                    )

                assert exc_info.value.status_code == 503


class TestEnsureProject:
    """Tests for the ensure_project_exists function."""

    @pytest.mark.asyncio
    async def test_ensure_project_success(
        self, mock_env_vars, sample_agent_id, mock_project_response
    ):
        """Test successful project creation/retrieval."""
        from core.advanced_workflows_bridge import ensure_project_exists

        with patch.dict(os.environ, mock_env_vars):
            with patch("httpx.AsyncClient") as mock_client:
                mock_response = MagicMock()
                mock_response.status_code = 200
                mock_response.json.return_value = mock_project_response

                mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                    return_value=mock_response
                )

                result = await ensure_project_exists(
                    access_token="test-token",
                    agent_id=sample_agent_id,
                    agent_name="Test Agent",
                )

                assert result["id"] == sample_agent_id
                assert result["created"] is True

    @pytest.mark.asyncio
    async def test_ensure_project_failure(self, mock_env_vars, sample_agent_id):
        """Test project ensure failure handling."""
        from core.advanced_workflows_bridge import ensure_project_exists

        with patch.dict(os.environ, mock_env_vars):
            with patch("httpx.AsyncClient") as mock_client:
                mock_response = MagicMock()
                mock_response.status_code = 500
                mock_response.text = "Internal server error"

                mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                    return_value=mock_response
                )

                with pytest.raises(HTTPException) as exc_info:
                    await ensure_project_exists(
                        access_token="test-token",
                        agent_id=sample_agent_id,
                        agent_name="Test Agent",
                    )

                assert exc_info.value.status_code == 502


class TestEnsureFlow:
    """Tests for the ensure_flow_exists function."""

    @pytest.mark.asyncio
    async def test_ensure_flow_success(
        self, mock_env_vars, sample_workflow_id, sample_agent_id, mock_flow_response
    ):
        """Test successful flow creation/retrieval."""
        from core.advanced_workflows_bridge import ensure_flow_exists

        with patch.dict(os.environ, mock_env_vars):
            with patch("httpx.AsyncClient") as mock_client:
                mock_response = MagicMock()
                mock_response.status_code = 200
                mock_response.json.return_value = mock_flow_response

                mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                    return_value=mock_response
                )

                result = await ensure_flow_exists(
                    access_token="test-token",
                    workflow_id=sample_workflow_id,
                    agent_id=sample_agent_id,
                    workflow_name="Test Workflow",
                )

                assert result["id"] == sample_workflow_id
                assert result["folder_id"] == sample_agent_id
                assert result["created"] is True


class TestSessionEndpoint:
    """Tests for the /session endpoint."""

    @pytest.mark.asyncio
    async def test_session_not_configured_raises_503(self, sample_user_id):
        """Test that unconfigured integration raises 503."""
        from core.advanced_workflows_bridge import get_advanced_workflows_session

        with patch.dict(os.environ, {}, clear=True):
            with pytest.raises(HTTPException) as exc_info:
                await get_advanced_workflows_session(
                    agent_id="agent-123",
                    workflow_id="workflow-456",
                    user_id=sample_user_id,
                )

            assert exc_info.value.status_code == 503

    @pytest.mark.asyncio
    async def test_session_full_flow(
        self,
        mock_env_vars,
        sample_user_id,
        sample_agent_id,
        sample_workflow_id,
        mock_token_response,
        mock_project_response,
        mock_flow_response,
    ):
        """Test the complete session flow."""
        from core.advanced_workflows_bridge import get_advanced_workflows_session

        with patch.dict(os.environ, mock_env_vars):
            # Mock all the async functions
            with patch(
                "core.advanced_workflows_bridge.get_user_email",
                new_callable=AsyncMock,
                return_value="test@example.com",
            ):
                with patch(
                    "core.advanced_workflows_bridge.exchange_suna_token_for_advanced_workflows",
                    new_callable=AsyncMock,
                    return_value=mock_token_response,
                ):
                    with patch(
                        "core.advanced_workflows_bridge.get_agent_name",
                        new_callable=AsyncMock,
                        return_value="Test Agent",
                    ):
                        with patch(
                            "core.advanced_workflows_bridge.get_workflow_name",
                            new_callable=AsyncMock,
                            return_value="Test Workflow",
                        ):
                            with patch(
                                "core.advanced_workflows_bridge.ensure_project_exists",
                                new_callable=AsyncMock,
                                return_value=mock_project_response,
                            ):
                                with patch(
                                    "core.advanced_workflows_bridge.ensure_flow_exists",
                                    new_callable=AsyncMock,
                                    return_value=mock_flow_response,
                                ):
                                    result = await get_advanced_workflows_session(
                                        agent_id=sample_agent_id,
                                        workflow_id=sample_workflow_id,
                                        user_id=sample_user_id,
                                    )

                                    assert result.access_token == "langflow-access-token-123"
                                    assert result.project_id == sample_agent_id
                                    assert result.flow_id == sample_workflow_id
                                    assert result.project_created is True
                                    assert result.flow_created is True
                                    assert f"/flow/{sample_workflow_id}" in result.flow_url


class TestStatusEndpoint:
    """Tests for the /status endpoint."""

    @pytest.mark.asyncio
    async def test_status_when_configured(self, mock_env_vars):
        """Test status endpoint when integration is configured."""
        from core.advanced_workflows_bridge import get_advanced_workflows_status

        with patch.dict(os.environ, mock_env_vars):
            with patch("httpx.AsyncClient") as mock_client:
                # Mock health check responses
                mock_health_response = MagicMock()
                mock_health_response.status_code = 200

                mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                    return_value=mock_health_response
                )

                result = await get_advanced_workflows_status()

                assert result["configured"] is True
                assert result["backend_url"] == "http://langflow:7860"
                assert result["integration_secret_set"] is True

    @pytest.mark.asyncio
    async def test_status_when_not_configured(self):
        """Test status endpoint when integration is not configured."""
        from core.advanced_workflows_bridge import get_advanced_workflows_status

        with patch.dict(os.environ, {}, clear=True):
            result = await get_advanced_workflows_status()

            assert result["configured"] is False
            assert result["backend_url"] is None


class TestTokenEndpoint:
    """Tests for the /token endpoint."""

    @pytest.mark.asyncio
    async def test_token_not_configured_raises_503(self, sample_user_id):
        """Test that unconfigured integration raises 503."""
        from core.advanced_workflows_bridge import get_advanced_workflows_token

        with patch.dict(os.environ, {}, clear=True):
            with pytest.raises(HTTPException) as exc_info:
                await get_advanced_workflows_token(user_id=sample_user_id)

            assert exc_info.value.status_code == 503

    @pytest.mark.asyncio
    async def test_token_success(
        self, mock_env_vars, sample_user_id, mock_token_response
    ):
        """Test successful token retrieval."""
        from core.advanced_workflows_bridge import get_advanced_workflows_token

        with patch.dict(os.environ, mock_env_vars):
            with patch(
                "core.advanced_workflows_bridge.get_user_email",
                new_callable=AsyncMock,
                return_value="test@example.com",
            ):
                with patch(
                    "core.advanced_workflows_bridge.exchange_suna_token_for_advanced_workflows",
                    new_callable=AsyncMock,
                    return_value=mock_token_response,
                ):
                    result = await get_advanced_workflows_token(user_id=sample_user_id)

                    assert result.access_token == "langflow-access-token-123"
                    assert result.refresh_token == "langflow-refresh-token-456"
