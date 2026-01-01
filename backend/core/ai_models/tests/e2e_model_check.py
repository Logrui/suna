import asyncio
from core.ai_models.registry import registry
from core.ai_models.models import ModelProvider
from core.services.llm import make_llm_api_call, LLMError
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
    
    try:
        # Use make_llm_api_call to get the full logic (params, fallback, etc)
        # We use stream=False for simplicity
        response = await make_llm_api_call(
            messages=messages,
            model_name=model_id,
            stream=False,
            max_tokens=50
        )
        
        # Check response content
        content = response.choices[0].message.content
        if content:
            logger.info(f"✅ PASS: {model_id} - Response: {content[:50]}...")
            return True, None
        else:
            logger.error(f"❌ FAIL: {model_id} - Empty response")
            return False, "Empty response"
            
    except Exception as e:
        logger.error(f"❌ FAIL: {model_id} - Error: {e}")
        return False, str(e)

async def main():
    print("\n--- Starting E2E Model Connectivity Check ---\n")
    
    # Ensure registry is initialized (including local, though we skip them)
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
            
        success, error = await check_model(model_obj.id)
        results.append({
            "id": model_obj.id,
            "provider": model_obj.provider.value,
            "success": success,
            "error": error
        })
        
        # Small delay to be nice
        await asyncio.sleep(0.5)
        
    print("\n--- Summary ---")
    print(f"{'ID':<50} | {'Provider':<12} | {'Status':<8} | {'Error'}")
    print("-" * 100)
    
    passed = 0
    failed = 0
    
    for res in results:
        status = "PASS" if res['success'] else "FAIL"
        if res['success']:
            passed += 1
        else:
            failed += 1
        error_msg = res['error'] if res['error'] else ""
        print(f"{res['id']:<50} | {res['provider']:<12} | {status:<8} | {error_msg}")
        
    print("-" * 100)
    print(f"Total: {len(results)} | Passed: {passed} | Failed: {failed}")

if __name__ == "__main__":
    asyncio.run(main())
