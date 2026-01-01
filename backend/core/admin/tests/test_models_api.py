import asyncio
import sys
import os

# Add backend to sys.path to allow imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../")))

from core.admin.models_api import list_admin_models, test_models, TestRequest
from unittest.mock import AsyncMock, MagicMock, patch
from core.ai_models.models import Model, ModelProvider, ModelPricing

async def run_tests():
    print("--- Testing Models Admin API Logic ---")
    
    # Mock admin user
    mock_admin = {"user_id": "test_admin"}
    
    # 1. Test Listing Models
    print("Test 1: List Admin Models")
    with patch("core.ai_models.registry.registry.get_all") as mock_get_all, \
         patch("core.ai_models.registry.registry.initialize_local_models", AsyncMock()):
        
        mock_get_all.return_value = [
            Model(
                id="test/model",
                name="Test Model",
                provider=ModelProvider.OPENROUTER,
                enabled=True,
                pricing=ModelPricing(1, 2),
                fallback_models=["fallback/model"]
            )
        ]
        
        result = await list_admin_models(admin=mock_admin)
        assert len(result) == 1
        assert result[0].id == "test/model"
        assert result[0].fallbacks == ["fallback/model"]
        print("✅ List Admin Models Passed")

    # 2. Test Testing Models
    print("Test 2: Test Models (Inference)")
    with patch("core.ai_models.registry.registry.get_all") as mock_get_all, \
         patch("core.ai_models.registry.registry.get") as mock_get, \
         patch("core.ai_models.registry.registry.initialize_local_models", AsyncMock()), \
         patch("core.admin.models_api.make_llm_api_call", AsyncMock()) as mock_call:
        
        test_model = Model(
            id="test/model",
            name="Test Model",
            provider=ModelProvider.OPENROUTER,
            enabled=True,
            pricing=ModelPricing(1, 2)
        )
        mock_get_all.return_value = [test_model]
        mock_get.return_value = test_model
        
        # Mock successful LLM call
        mock_response = MagicMock()
        mock_response.choices[0].message.content = "Test success"
        mock_call.return_value = mock_response
        
        request = TestRequest(include_local=False, disable_fallbacks=True)
        results = await test_models(request=request, admin=mock_admin)
        
        assert len(results) == 1
        assert results[0].model_id == "test/model"
        assert results[0].status == "PASS"
        assert results[0].outcome == "Test success"
        
        # Verify fallbacks list was passed as empty
        mock_call.assert_called_once()
        args, kwargs = mock_call.call_args
        assert kwargs["fallbacks"] == []
        
        print("✅ Test Models Passed")

    print("\n--- All Admin Models API Logic Tests Passed! ---")

if __name__ == "__main__":
    asyncio.run(run_tests())
