"""
Unit tests for batch version loading in VersionService.

These tests verify that the get_versions_batch method efficiently loads
multiple agent versions in a single database query, avoiding N+1 query patterns.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from core.versioning.version_service import VersionService, AgentVersion


class TestVersionServiceBatchLoading:
    """Test suite for batch version loading functionality."""
    
    @pytest.fixture
    def mock_db_client(self):
        """Create a mock database client."""
        mock_client = MagicMock()
        mock_table = MagicMock()
        mock_client.table.return_value = mock_table
        return mock_client
    
    @pytest.fixture
    def version_service(self, mock_db_client):
        """Create a VersionService instance with mocked database."""
        service = VersionService()
        service._get_client = AsyncMock(return_value=mock_db_client)
        return service
    
    @staticmethod
    def create_mock_version_data(
        version_id: str,
        agent_id: str,
        model: str = 'gpt-4',
        system_prompt: str = 'Test prompt',
        version_number: int = 1,
        created_by: str = 'user1'
    ):
        """Helper to create mock version data with consistent structure."""
        return {
            'version_id': version_id,
            'agent_id': agent_id,
            'version_number': version_number,
            'version_name': f'v{version_number}.0',
            'is_active': True,
            'created_at': '2024-01-01T00:00:00+00:00',
            'updated_at': '2024-01-01T00:00:00+00:00',
            'created_by': created_by,
            'change_description': None,
            'previous_version_id': None,
            'config': {
                'system_prompt': system_prompt,
                'model': model,
                'tools': {
                    'mcp': [],
                    'custom_mcp': [],
                    'agentpress': {}
                }
            }
        }
    
    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_get_versions_batch_empty_requests(self, version_service):
        """Test batch loading with empty request list."""
        result = await version_service.get_versions_batch(
            version_requests=[],
            user_id="test-user"
        )
        
        assert result == {}
    
    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_get_versions_batch_single_version(self, version_service):
        """Test batch loading with a single version request."""
        with patch('core.versioning.version_service.batch_query_in') as mock_batch_query:
            # Setup mock data using helper
            mock_version_data = [
                self.create_mock_version_data('v1', 'agent1', model='gpt-4')
            ]
            mock_batch_query.return_value = mock_version_data
            
            # Execute batch load
            result = await version_service.get_versions_batch(
                version_requests=[
                    {'agent_id': 'agent1', 'version_id': 'v1'}
                ],
                user_id="system"
            )
            
            # Verify results
            assert len(result) == 1
            assert 'agent1' in result
            assert isinstance(result['agent1'], AgentVersion)
            assert result['agent1'].version_id == 'v1'
            assert result['agent1'].model == 'gpt-4'
            
            # Verify batch_query_in was called with correct parameters
            mock_batch_query.assert_called_once()
            call_args = mock_batch_query.call_args
            assert call_args[1]['in_field'] == 'version_id'
            assert call_args[1]['in_values'] == ['v1']
    
    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_get_versions_batch_multiple_versions(self, version_service):
        """Test batch loading with multiple version requests."""
        with patch('core.versioning.version_service.batch_query_in') as mock_batch_query:
            # Setup mock data using helper
            mock_version_data = [
                self.create_mock_version_data('v1', 'agent1', model='gpt-4', system_prompt='Prompt 1'),
                self.create_mock_version_data('v2', 'agent2', model='claude-3', system_prompt='Prompt 2')
            ]
            mock_batch_query.return_value = mock_version_data
            
            # Execute batch load
            result = await version_service.get_versions_batch(
                version_requests=[
                    {'agent_id': 'agent1', 'version_id': 'v1'},
                    {'agent_id': 'agent2', 'version_id': 'v2'}
                ],
                user_id="system"
            )
            
            # Verify results
            assert len(result) == 2
            assert 'agent1' in result
            assert 'agent2' in result
            assert result['agent1'].model == 'gpt-4'
            assert result['agent2'].model == 'claude-3'
            
            # Verify batch_query_in was called once with both version IDs
            mock_batch_query.assert_called_once()
            call_args = mock_batch_query.call_args
            assert set(call_args[1]['in_values']) == {'v1', 'v2'}
    
    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_get_versions_batch_deduplicates_version_ids(self, version_service):
        """Test that batch loading deduplicates version IDs."""
        with patch('core.versioning.version_service.batch_query_in') as mock_batch_query:
            mock_batch_query.return_value = []
            
            # Execute batch load with duplicate version IDs
            await version_service.get_versions_batch(
                version_requests=[
                    {'agent_id': 'agent1', 'version_id': 'v1'},
                    {'agent_id': 'agent2', 'version_id': 'v1'},  # Same version_id
                    {'agent_id': 'agent3', 'version_id': 'v2'}
                ],
                user_id="system"
            )
            
            # Verify batch_query_in was called with deduplicated version IDs
            call_args = mock_batch_query.call_args
            version_ids = call_args[1]['in_values']
            assert len(version_ids) == 2  # Should only have v1 and v2, not 3
            assert set(version_ids) == {'v1', 'v2'}
    
    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_get_versions_batch_handles_missing_versions(self, version_service):
        """Test batch loading gracefully handles missing/invalid versions."""
        with patch('core.versioning.version_service.batch_query_in') as mock_batch_query:
            # Return data for only one of the requested versions using helper
            mock_version_data = [
                self.create_mock_version_data('v1', 'agent1', model='gpt-4')
            ]
            mock_batch_query.return_value = mock_version_data
            
            # Request two versions but only one exists
            result = await version_service.get_versions_batch(
                version_requests=[
                    {'agent_id': 'agent1', 'version_id': 'v1'},
                    {'agent_id': 'agent2', 'version_id': 'v2'}  # Doesn't exist
                ],
                user_id="system"
            )
            
            # Should only return the one that exists
            assert len(result) == 1
            assert 'agent1' in result
            assert 'agent2' not in result
    
    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_get_versions_batch_uses_batch_size(self, version_service):
        """Test that batch loading respects the batch_size parameter."""
        with patch('core.versioning.version_service.batch_query_in') as mock_batch_query:
            mock_batch_query.return_value = []
            
            # Create many version requests
            version_requests = [
                {'agent_id': f'agent{i}', 'version_id': f'v{i}'}
                for i in range(150)
            ]
            
            await version_service.get_versions_batch(
                version_requests=version_requests,
                user_id="system"
            )
            
            # Verify batch_query_in was called with batch_size parameter
            call_args = mock_batch_query.call_args
            assert call_args[1]['batch_size'] == 100
