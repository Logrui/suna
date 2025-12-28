import asyncio
import os
import sys
from pprint import pprint

# Ensure backend directory is in path
sys.path.append(os.path.join(os.path.dirname(__file__), '../../../'))

async def run_test():
    try:
        from core.services.llm import make_llm_api_call, setup_api_keys, setup_provider_router
        from core.ai_models.manager import model_manager
        
        # Setup
        setup_api_keys()
        setup_provider_router()
        
        print("\n=== STARTING E2E SIMULATION ===\n")


        # Test 1: Gemini 3 Pro Preview (Google AI Studio)
        print("--- Testing Gemini 3 Pro Preview (Google AI Studio) ---")
        gemini_model = "gemini/gemini-3-pro-preview"
        if not model_manager.get_model(gemini_model):
            print(f"ERROR: Model {gemini_model} not found in manager!")
        else:
            try:
                response = await make_llm_api_call(
                    messages=[{"role": "user", "content": "Hello Gemini 3!"}],
                    model_name=gemini_model,
                    stream=True
                )
                print("✅ Gemini 3 Success! Streaming response:")
                async for chunk in response:
                    content = chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
                    if content:
                        print(content, end="", flush=True)
                print("\n")
            except Exception as e:
                print(f"❌ Gemini 3 Failed: {e}")
                import traceback
                traceback.print_exc()

        # Test 2: Gemini 2.5 Flash (Google AI Studio)
        print("\n--- Testing Gemini 2.5 Flash (Google AI Studio) ---")
        gemini_flash = "gemini/gemini-2.5-flash"
        if not model_manager.get_model(gemini_flash):
            print(f"ERROR: Model {gemini_flash} not found in manager!")
        else:
            try:
                response = await make_llm_api_call(
                    messages=[{"role": "user", "content": "Hello Gemini Flash!"}],
                    model_name=gemini_flash,
                    stream=True
                )
                print("✅ Gemini Flash Success! Streaming response:")
                async for chunk in response:
                    content = chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
                    if content:
                         print(content, end="", flush=True)
                print("\n")
            except Exception as e:
                print(f"❌ Gemini Flash Failed: {e}")
                import traceback
                traceback.print_exc()

        print("\n" + "="*30 + "\n")

        # Test 2: Haiku 4.5 (Bedrock)
        print("--- Testing Haiku 4.5 (Bedrock) ---")
        haiku_model = "bedrock/us.anthropic.claude-haiku-4-5-20251001-v1:0"
        
        model_obj = model_manager.get_model(haiku_model)
        if not model_obj:
            print(f"ERROR: Model {haiku_model} not found in manager!")
            # Try finding by alias to see if that's the issue
            print(f"Aliases available: {model_manager.registry._aliases.keys()}")
        else:
            print(f"DEBUG: Registry ID for Haiku: '{model_obj.id}'")
            try:
                response = await make_llm_api_call(
                    messages=[{"role": "user", "content": "Hello Haiku!"}],
                    model_name=haiku_model,
                    stream=True
                )
                print("✅ Haiku 4.5 Success! Streaming response:")
                async for chunk in response:
                     content = chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
                     if content:
                         print(content, end="", flush=True)
                print("\n")
            except Exception as e:
                print(f"❌ Haiku 4.5 Failed: {e}")
                import traceback
                traceback.print_exc()

    except Exception as e:
        print(f"CRITICAL SETUP ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(run_test())
