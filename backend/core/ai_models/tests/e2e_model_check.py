import asyncio
import time
from unittest.mock import patch
from core.ai_models.registry import registry
from core.ai_models.models import ModelProvider
from core.services.llm import make_llm_api_call, LLMError, setup_provider_router
from core.utils.logger import logger
import logging

# Configure logger to output
logging.basicConfig(level=logging.INFO)

async def check_model(model_id: str):
    logger.info(f"Checking model: {model_id}")
    messages = [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "This is a network connectivity test, respond with a short generic one sentence response"}
    ]
    
    start_time = time.time()
    try:
        # Use make_llm_api_call with stream=False
        response = await make_llm_api_call(
            messages=messages,
            model_name=model_id,
            stream=False,
            max_tokens=50
        )
        latency = (time.time() - start_time) * 1000
        
        # Check response content
        content = response.choices[0].message.content
        if content:
            logger.info(f"✅ PASS: {model_id} - Response: {content[:50]}...")
            return True, None, latency, content[:100]
        else:
            logger.error(f"❌ FAIL: {model_id} - Empty response")
            return False, "Empty response", latency, None
            
    except Exception as e:
        latency = (time.time() - start_time) * 1000
        logger.error(f"❌ FAIL: {model_id} - Error: {e}")
        return False, str(e), latency, None

async def main():
    print("\n--- Starting E2E Model Connectivity Check (Fallbacks Disabled) ---\n")
    
    # Disable fallbacks by patching registry
    with patch.object(registry, 'get_fallback_chains', return_value=[]):
        # Re-configure router with empty fallbacks
        setup_provider_router()
        
        # Ensure registry is initialized
        await registry.initialize_local_models()
        
        models = registry.list_available_models(include_disabled=True)
        
        results = []
        
        for m in models:
            model_obj = registry.get(m['id'])
            if not model_obj:
                continue
                
            # Skip local models
            if model_obj.provider in [ModelProvider.OLLAMA, ModelProvider.LM_STUDIO]:
                continue
                
            success, error, latency, response_text = await check_model(model_obj.id)
            results.append({
                "id": model_obj.id,
                "provider": model_obj.provider.value,
                "success": success,
                "error": error,
                "latency": latency,
                "response": response_text
            })
            
            # Small delay
            await asyncio.sleep(0.5)
        
    print("\n" + "="*120)
    print(f"{'ID':<50} | {'Provider':<12} | {'Status':<8} | {'Latency (ms)':<12} | {'Outcome'}")
    print("-" * 120)
    
    passed = 0
    failed = 0
    
    for res in results:
        status = "PASS" if res['success'] else "FAIL"
        if res['success']:
            passed += 1
            outcome = f"Success: {res['response'][:40]}..." if res['response'] else "Success"
        else:
            failed += 1
            # Clean up error message for table
            error_msg = res['error'].split('\n')[0] if res['error'] else "Unknown Error"
            # Truncate error if too long
            if len(error_msg) > 40:
                error_msg = error_msg[:37] + "..."
            outcome = error_msg
            
        print(f"{res['id']:<50} | {res['provider']:<12} | {status:<8} | {res['latency']:<12.2f} | {outcome}")
        
    print("-" * 120)
    print(f"Total: {len(results)} | Passed: {passed} | Failed: {failed}")
    print("="*120)

if __name__ == "__main__":
    asyncio.run(main())