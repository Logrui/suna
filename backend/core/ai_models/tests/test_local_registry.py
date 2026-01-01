import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from core.ai_models.local_registry import LocalModelRegistry
from core.ai_models.models import ModelProvider

@pytest.fixture
def mock_ollama_client():
    with patch("core.ai_models.local_registry.OllamaClient") as MockClient:
        client_instance = MockClient.return_value
        client_instance.list_models = AsyncMock()
        client_instance.get_model_info = AsyncMock()
        client_instance.extract_context_window = MagicMock()
        client_instance.is_chat_model = MagicMock()
        client_instance.construct_display_name = MagicMock()
        yield client_instance

@pytest.fixture
def mock_lmstudio_client():
    with patch("core.ai_models.local_registry.LMStudioClient") as MockClient:
        client_instance = MockClient.return_value
        client_instance.list_models = AsyncMock()
        client_instance.get_context_window = AsyncMock()
        yield client_instance

@pytest.mark.asyncio
async def test_local_registry_initialization():
    with patch("core.ai_models.local_registry.OllamaClient") as MockOllama, \
         patch("core.ai_models.local_registry.LMStudioClient") as MockLM:
        
        # Setup mocks to return empty list
        MockOllama.return_value.list_models = AsyncMock(return_value=[])
        MockLM.return_value.list_models = AsyncMock(return_value=[])
        
        registry = LocalModelRegistry()
        assert registry.get_all() == []
        await registry.initialize()
        # Should be empty as mocks return empty
        assert registry.get_all() == []

@pytest.mark.asyncio
async def test_ollama_discovery(mock_ollama_client):
    # Setup mock return values
    mock_ollama_client.list_models.return_value = [
        {"name": "llama3:latest", "model": "llama3:latest"}
    ]
    mock_ollama_client.get_model_info.return_value = {
        "details": {"parameter_size": "8B", "quantization_level": "Q4_0"},
        "model_info": {"general.basename": "Llama 3"}
    }
    # Mock helper methods logic or just return values
    mock_ollama_client.construct_display_name.return_value = "Llama 3 (Q4_0 - 8B)"
    mock_ollama_client.extract_context_window.return_value = 8192
    mock_ollama_client.is_chat_model.return_value = True

    registry = LocalModelRegistry()
    registry.ollama_client = mock_ollama_client
    # Mock LMStudio too to avoid real calls
    registry.lmstudio_client = MagicMock()
    registry.lmstudio_client.list_models = AsyncMock(return_value=[])

    await registry.initialize()

    models = registry.get_all()
    # Filter for Ollama models in case LMStudio mocked returned something (it shouldn't)
    ollama_models = [m for m in models if m.provider == ModelProvider.OLLAMA]
    assert len(ollama_models) == 1
    model = ollama_models[0]
    assert model.id == "ollama/llama3:latest"
    assert model.name == "Llama 3 (Q4_0 - 8B)"
    assert model.provider == ModelProvider.OLLAMA
    assert model.context_window == 8192
    assert model.enabled is True

@pytest.mark.asyncio
async def test_ollama_failure_graceful(mock_ollama_client):
    # Simulate exception
    mock_ollama_client.list_models.side_effect = Exception("Connection refused")
    
    registry = LocalModelRegistry()
    registry.ollama_client = mock_ollama_client
    registry.lmstudio_client = MagicMock()
    registry.lmstudio_client.list_models = AsyncMock(return_value=[])
    
    await registry.initialize() # Should not raise
    
    assert len(registry.get_all()) == 0

@pytest.mark.asyncio
async def test_lmstudio_discovery(mock_lmstudio_client, mock_ollama_client):
    # Mock Ollama to return empty
    mock_ollama_client.list_models.return_value = []
    
    mock_lmstudio_client.list_models.return_value = [
        {"id": "local-model-v1", "object": "model", "owned_by": "organization-owner"}
    ]
    mock_lmstudio_client.get_context_window.return_value = 32768
    
    registry = LocalModelRegistry()
    registry.lmstudio_client = mock_lmstudio_client
    registry.ollama_client = mock_ollama_client
    
    await registry.initialize()
    
    models = registry.get_all()
    assert len(models) == 1
    model = models[0]
    assert model.id == "lm_studio/local-model-v1"
    assert model.name == "local-model-v1"
    assert model.provider == ModelProvider.LM_STUDIO
    assert model.context_window == 32768

@pytest.mark.asyncio
async def test_lmstudio_failure_graceful(mock_lmstudio_client, mock_ollama_client):
    mock_ollama_client.list_models.return_value = []
    mock_lmstudio_client.list_models.side_effect = Exception("Connection refused")
    
    registry = LocalModelRegistry()
    registry.lmstudio_client = mock_lmstudio_client
    registry.ollama_client = mock_ollama_client
    
    await registry.initialize() # Should not raise
    
    assert len(registry.get_all()) == 0
