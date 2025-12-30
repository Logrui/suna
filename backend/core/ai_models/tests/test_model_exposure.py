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