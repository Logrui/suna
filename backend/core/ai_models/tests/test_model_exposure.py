import pytest
from core.ai_models.registry import registry

def test_all_models_exposed():
    """Verify that models from all registries (presets, fallback, AWS) are exposed."""
    models = registry.list_available_models(include_disabled=True)
    
    # Check for Presets
    ids = [m['id'] for m in models]
    assert "kortix/basic" in ids
    assert "kortix/power" in ids
    
    # Check for Fallback Models (e.g., Gemini)
    assert any("gemini" in m['id'] for m in models), "Gemini models should be present"
    
    # Check for AWS Models (e.g., Bedrock)
    # Note: Depending on config, AWS models might be enabled or not, but they should be in the list if include_disabled=True
    # Our reproduction script showed them.
    assert any("bedrock" in m['id'] or "anthropic" in m['id'] for m in models), "Bedrock/Anthropic models should be present"

    # Ensure we have a decent number of models
    assert len(models) >= 5, f"Expected at least 5 models, found {len(models)}"

def test_list_all_models_stdout():

    """Helper test to print all models to stdout (use pytest -s to see)."""

    models = registry.list_available_models(include_disabled=True)

    print("\n--- Available Models ---")

    for model in models:

        print(f"- {model['id']} ({model['name']})")

    print("------------------------")



@pytest.mark.asyncio

async def test_local_models_integration():

    from core.ai_models.local_registry import LocalModelRegistry

    from core.ai_models.models import Model, ModelProvider, ModelPricing

    from unittest.mock import AsyncMock

    

    # Create a mock local registry with some models

    local_reg = LocalModelRegistry()

    # Mock initialize to do nothing (or we'd need to mock clients)

    local_reg.initialize = AsyncMock()

    

    test_model = Model(

        id="ollama/test-model",

        name="Test Model",

        provider=ModelProvider.OLLAMA,

        enabled=True,

        pricing=ModelPricing(0, 0)

    )

    local_reg._models["ollama/test-model"] = test_model

    

    # Inject it into main registry

    # Note: registry is a singleton instance

    original_local_reg = registry.local_registry

    registry.local_registry = local_reg

    

    try:

        # Run initialization

        await registry.initialize_local_models()

        

        # Verify it's in the main list

        models = registry.list_available_models(include_disabled=True)

        ids = [m['id'] for m in models]

        assert "ollama/test-model" in ids

    finally:

        # Restore original registry to avoid side effects

        registry.local_registry = original_local_reg
