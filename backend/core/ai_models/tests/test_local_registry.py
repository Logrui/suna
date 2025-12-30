import pytest
from core.ai_models.local_registry import LocalModelRegistry
from core.ai_models.models import ModelProvider

@pytest.mark.asyncio
async def test_local_registry_initialization():
    registry = LocalModelRegistry()
    assert registry.get_all() == []
    await registry.initialize()
    # Currently initialize does nothing, so list should still be empty
    assert registry.get_all() == []
