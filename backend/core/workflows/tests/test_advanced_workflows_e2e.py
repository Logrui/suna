"""
End-to-End Integration Tests for Advanced Workflows Sync.

These tests verify the complete flow:
[Frontend] → [Suna Backend /session] → [Langflow /issue-token]
                                     → [Langflow /ensure-project]
                                     → [Langflow /ensure-flow]
                                     → [Response to Frontend]

These are integration tests that mock the HTTP layer but test
the full business logic across all three services.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

# Test the complete flow as documented


class TestAdvancedWorkflowsSyncE2E:
    """End-to-end tests for the Advanced Workflows sync flow."""

    @pytest.fixture
    def user_id(self):
        return str(uuid4())

    @pytest.fixture
    def agent_id(self):
        return str(uuid4())

    @pytest.fixture
    def workflow_id(self):
        return str(uuid4())

    @pytest.fixture
    def suna_session_token(self):
        return "suna-jwt-token-abc123"

    @pytest.fixture
    def langflow_token(self):
        return "langflow-jwt-token-xyz789"

    @pytest.fixture
    def mock_env(self):
        return {
            "ADVANCED_WORKFLOWS_BACKEND_URL": "http://langflow:7860",
            "ADVANCED_WORKFLOWS_FRONTEND_URL": "http://localhost:7860",
            "ADVANCED_WORKFLOWS_INTEGRATION_SECRET": "shared-secret-key",
        }

    @pytest.mark.asyncio
    async def test_complete_new_user_new_project_new_flow(
        self, user_id, agent_id, workflow_id, mock_env, langflow_token
    ):
        """
        Test the complete flow for a new user creating a new project and flow.
        
        This simulates:
        1. Frontend requests session from Suna backend
        2. Suna backend exchanges token with Langflow
        3. Langflow creates new user and issues token
        4. Suna backend calls ensure-project (creates new)
        5. Suna backend calls ensure-flow (creates new)
        6. Response returned to frontend with flow URL
        """
        import os
        with patch.dict(os.environ, mock_env):
            # Mock token exchange response from Langflow
            token_response = {
                "access_token": langflow_token,
                "refresh_token": "refresh-token",
                "expires_in": 3600,
            }

            # Mock project creation response
            project_response = {
                "id": agent_id,
                "name": "Test Agent",
                "description": "Project synced from Suna",
                "created": True,
            }

            # Mock flow creation response
            flow_response = {
                "id": workflow_id,
                "name": "Test Workflow",
                "folder_id": agent_id,
                "description": "Flow synced from Suna",
                "created": True,
            }

            from core.advanced_workflows_bridge import get_advanced_workflows_session

            with patch(
                "core.advanced_workflows_bridge.get_user_email",
                new_callable=AsyncMock,
                return_value="test@example.com",
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
                            "core.advanced_workflows_bridge.exchange_suna_token_for_advanced_workflows",
                            new_callable=AsyncMock,
                            return_value=token_response,
                        ):
                            with patch(
                                "core.advanced_workflows_bridge.ensure_project_exists",
                                new_callable=AsyncMock,
                                return_value=project_response,
                            ):
                                with patch(
                                    "core.advanced_workflows_bridge.ensure_flow_exists",
                                    new_callable=AsyncMock,
                                    return_value=flow_response,
                                ):
                                    result = await get_advanced_workflows_session(
                                        agent_id=agent_id,
                                        workflow_id=workflow_id,
                                        user_id=user_id,
                                    )

            # Verify the response
            assert result.access_token == langflow_token
            assert result.project_id == agent_id
            assert result.flow_id == workflow_id
            assert result.project_created is True
            assert result.flow_created is True
            assert f"/flow/{workflow_id}" in result.flow_url

    @pytest.mark.asyncio
    async def test_complete_existing_user_existing_resources(
        self, user_id, agent_id, workflow_id, mock_env, langflow_token
    ):
        """
        Test the complete flow for an existing user with existing project/flow.
        
        This simulates returning to an existing workflow - no new resources created.
        """
        import os
        with patch.dict(os.environ, mock_env):
            token_response = {
                "access_token": langflow_token,
                "expires_in": 3600,
            }

            project_response = {
                "id": agent_id,
                "name": "Existing Agent",
                "created": False,  # Already exists
            }

            flow_response = {
                "id": workflow_id,
                "name": "Existing Workflow",
                "folder_id": agent_id,
                "created": False,  # Already exists
            }

            from core.advanced_workflows_bridge import get_advanced_workflows_session

            with patch(
                "core.advanced_workflows_bridge.get_user_email",
                new_callable=AsyncMock,
                return_value="existing@example.com",
            ):
                with patch(
                    "core.advanced_workflows_bridge.get_agent_name",
                    new_callable=AsyncMock,
                    return_value="Existing Agent",
                ):
                    with patch(
                        "core.advanced_workflows_bridge.get_workflow_name",
                        new_callable=AsyncMock,
                        return_value="Existing Workflow",
                    ):
                        with patch(
                            "core.advanced_workflows_bridge.exchange_suna_token_for_advanced_workflows",
                            new_callable=AsyncMock,
                            return_value=token_response,
                        ):
                            with patch(
                                "core.advanced_workflows_bridge.ensure_project_exists",
                                new_callable=AsyncMock,
                                return_value=project_response,
                            ):
                                with patch(
                                    "core.advanced_workflows_bridge.ensure_flow_exists",
                                    new_callable=AsyncMock,
                                    return_value=flow_response,
                                ):
                                    result = await get_advanced_workflows_session(
                                        agent_id=agent_id,
                                        workflow_id=workflow_id,
                                        user_id=user_id,
                                    )

            # Verify the response - should work but not create new resources
            assert result.project_created is False
            assert result.flow_created is False
            assert result.project_id == agent_id
            assert result.flow_id == workflow_id

    @pytest.mark.asyncio
    async def test_id_mapping_consistency(
        self, user_id, agent_id, workflow_id, mock_env, langflow_token
    ):
        """
        Test that 1:1 ID mapping is maintained:
        - Suna Agent ID == Langflow Project ID
        - Suna Workflow ID == Langflow Flow ID
        """
        import os
        with patch.dict(os.environ, mock_env):
            # The IDs returned should match exactly
            project_response = {
                "id": agent_id,  # Must match input agent_id
                "name": "Agent",
                "created": True,
            }

            flow_response = {
                "id": workflow_id,  # Must match input workflow_id
                "folder_id": agent_id,  # Must link to project
                "name": "Workflow",
                "created": True,
            }

            from core.advanced_workflows_bridge import get_advanced_workflows_session

            with patch(
                "core.advanced_workflows_bridge.get_user_email",
                new_callable=AsyncMock,
            ):
                with patch(
                    "core.advanced_workflows_bridge.get_agent_name",
                    new_callable=AsyncMock,
                ):
                    with patch(
                        "core.advanced_workflows_bridge.get_workflow_name",
                        new_callable=AsyncMock,
                    ):
                        with patch(
                            "core.advanced_workflows_bridge.exchange_suna_token_for_advanced_workflows",
                            new_callable=AsyncMock,
                            return_value={"access_token": langflow_token},
                        ):
                            with patch(
                                "core.advanced_workflows_bridge.ensure_project_exists",
                                new_callable=AsyncMock,
                                return_value=project_response,
                            ):
                                with patch(
                                    "core.advanced_workflows_bridge.ensure_flow_exists",
                                    new_callable=AsyncMock,
                                    return_value=flow_response,
                                ):
                                    result = await get_advanced_workflows_session(
                                        agent_id=agent_id,
                                        workflow_id=workflow_id,
                                        user_id=user_id,
                                    )

            # Critical: IDs must match 1:1
            assert result.project_id == agent_id, "Project ID must equal Agent ID"
            assert result.flow_id == workflow_id, "Flow ID must equal Workflow ID"

    @pytest.mark.asyncio
    async def test_flow_url_construction(
        self, user_id, agent_id, workflow_id, mock_env, langflow_token
    ):
        """
        Test that the flow URL is correctly constructed for iframe loading.
        """
        import os
        with patch.dict(os.environ, mock_env):
            from core.advanced_workflows_bridge import get_advanced_workflows_session

            with patch(
                "core.advanced_workflows_bridge.get_user_email",
                new_callable=AsyncMock,
            ):
                with patch(
                    "core.advanced_workflows_bridge.get_agent_name",
                    new_callable=AsyncMock,
                ):
                    with patch(
                        "core.advanced_workflows_bridge.get_workflow_name",
                        new_callable=AsyncMock,
                    ):
                        with patch(
                            "core.advanced_workflows_bridge.exchange_suna_token_for_advanced_workflows",
                            new_callable=AsyncMock,
                            return_value={"access_token": langflow_token},
                        ):
                            with patch(
                                "core.advanced_workflows_bridge.ensure_project_exists",
                                new_callable=AsyncMock,
                                return_value={"id": agent_id, "created": False},
                            ):
                                with patch(
                                    "core.advanced_workflows_bridge.ensure_flow_exists",
                                    new_callable=AsyncMock,
                                    return_value={"id": workflow_id, "created": False},
                                ):
                                    result = await get_advanced_workflows_session(
                                        agent_id=agent_id,
                                        workflow_id=workflow_id,
                                        user_id=user_id,
                                    )

            # Flow URL should be: {frontend_url}/flow/{workflow_id}
            expected_flow_url = f"http://localhost:7860/flow/{workflow_id}"
            assert result.flow_url == expected_flow_url


class TestSyncFlowErrorHandling:
    """Test error handling throughout the sync flow."""

    @pytest.fixture
    def mock_env(self):
        return {
            "ADVANCED_WORKFLOWS_BACKEND_URL": "http://langflow:7860",
            "ADVANCED_WORKFLOWS_FRONTEND_URL": "http://localhost:7860",
            "ADVANCED_WORKFLOWS_INTEGRATION_SECRET": "shared-secret-key",
        }

    @pytest.mark.asyncio
    async def test_token_exchange_failure_propagates(self, mock_env):
        """Test that token exchange failures are properly propagated."""
        import os
        from fastapi import HTTPException
        
        with patch.dict(os.environ, mock_env):
            from core.advanced_workflows_bridge import get_advanced_workflows_session

            with patch(
                "core.advanced_workflows_bridge.get_user_email",
                new_callable=AsyncMock,
            ):
                with patch(
                    "core.advanced_workflows_bridge.exchange_suna_token_for_advanced_workflows",
                    new_callable=AsyncMock,
                    side_effect=HTTPException(status_code=502, detail="Token exchange failed"),
                ):
                    with pytest.raises(HTTPException) as exc_info:
                        await get_advanced_workflows_session(
                            agent_id="agent-123",
                            workflow_id="workflow-456",
                            user_id="user-789",
                        )

                    assert exc_info.value.status_code == 502

    @pytest.mark.asyncio
    async def test_project_sync_failure_propagates(self, mock_env):
        """Test that project sync failures are properly propagated."""
        import os
        from fastapi import HTTPException
        
        with patch.dict(os.environ, mock_env):
            from core.advanced_workflows_bridge import get_advanced_workflows_session

            with patch(
                "core.advanced_workflows_bridge.get_user_email",
                new_callable=AsyncMock,
            ):
                with patch(
                    "core.advanced_workflows_bridge.get_agent_name",
                    new_callable=AsyncMock,
                ):
                    with patch(
                        "core.advanced_workflows_bridge.get_workflow_name",
                        new_callable=AsyncMock,
                    ):
                        with patch(
                            "core.advanced_workflows_bridge.exchange_suna_token_for_advanced_workflows",
                            new_callable=AsyncMock,
                            return_value={"access_token": "token"},
                        ):
                            with patch(
                                "core.advanced_workflows_bridge.ensure_project_exists",
                                new_callable=AsyncMock,
                                side_effect=HTTPException(status_code=502, detail="Project sync failed"),
                            ):
                                with pytest.raises(HTTPException) as exc_info:
                                    await get_advanced_workflows_session(
                                        agent_id="agent-123",
                                        workflow_id="workflow-456",
                                        user_id="user-789",
                                    )

                                assert exc_info.value.status_code == 502

    @pytest.mark.asyncio
    async def test_flow_sync_failure_propagates(self, mock_env):
        """Test that flow sync failures are properly propagated."""
        import os
        from fastapi import HTTPException
        
        with patch.dict(os.environ, mock_env):
            from core.advanced_workflows_bridge import get_advanced_workflows_session

            with patch(
                "core.advanced_workflows_bridge.get_user_email",
                new_callable=AsyncMock,
            ):
                with patch(
                    "core.advanced_workflows_bridge.get_agent_name",
                    new_callable=AsyncMock,
                ):
                    with patch(
                        "core.advanced_workflows_bridge.get_workflow_name",
                        new_callable=AsyncMock,
                    ):
                        with patch(
                            "core.advanced_workflows_bridge.exchange_suna_token_for_advanced_workflows",
                            new_callable=AsyncMock,
                            return_value={"access_token": "token"},
                        ):
                            with patch(
                                "core.advanced_workflows_bridge.ensure_project_exists",
                                new_callable=AsyncMock,
                                return_value={"id": "agent-123", "created": True},
                            ):
                                with patch(
                                    "core.advanced_workflows_bridge.ensure_flow_exists",
                                    new_callable=AsyncMock,
                                    side_effect=HTTPException(status_code=502, detail="Flow sync failed"),
                                ):
                                    with pytest.raises(HTTPException) as exc_info:
                                        await get_advanced_workflows_session(
                                            agent_id="agent-123",
                                            workflow_id="workflow-456",
                                            user_id="user-789",
                                        )

                                    assert exc_info.value.status_code == 502
