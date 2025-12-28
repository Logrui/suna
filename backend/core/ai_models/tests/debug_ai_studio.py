
import asyncio
import os
import sys
from litellm import acompletion
from pprint import pprint

# Ensure backend directory is in path
sys.path.append(os.path.join(os.path.dirname(__file__), '../../../'))
# Reload config to get new env vars
import importlib
from core.utils import config as config_module
importlib.reload(config_module)
from core.utils.config import config

async def test_ai_studio(model_id):
    print(f"\n--- Testing AI Studio Model: gemini/{model_id} ---")
    
    full_model_name = f"gemini/{model_id}"
    
    # AI studio primarily uses GEMINI_API_KEY
    if not config.GEMINI_API_KEY:
        print("❌ Error: GEMINI_API_KEY not found in config")
        # Fallback check
        if os.getenv("GEMINI_API_KEY"):
             print(f"⚠️ Found in env but not config: {os.getenv('GEMINI_API_KEY')[:5]}...")
        return

    print(f"DEBUG: Config API Key: {config.GEMINI_API_KEY[:10]}...")
    print(f"DEBUG: Env GEMINI_API_KEY: {os.getenv('GEMINI_API_KEY', '')[:10]}...")
    print(f"DEBUG: Env GOOGLE_API_KEY: {os.getenv('GOOGLE_API_KEY', '')[:10]}...")
    print(f"DEBUG: Env VERTEX_AI_API_KEY: {os.getenv('VERTEX_AI_API_KEY', '')[:10]}...")

    params = {
        "model": full_model_name,
        "messages": [{"role": "user", "content": "Hello! Are you working? Answer in 1 short sentence."}],
        "stream": True,
        # Explicitly remove Vertex params if they leaked into config
        "api_key": config.GEMINI_API_KEY # Explicitly pass key to LiteLLM
    }

    try:
        response = await acompletion(**params)
        print(f"✅ Connection Established! Streaming response:")
        async for chunk in response:
            content = chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
            if content:
                print(content, end="", flush=True)
        print("\nSUCCESS for " + model_id)
        return True
    except Exception as e:
        error_str = str(e)
        if "404" in error_str:
             print(f"❌ 404 Not Found (Invalid ID: {model_id})")
        elif "400" in error_str:
             print(f"❌ 400 Bad Request: {error_str[:200]}")
        else:
             print(f"⚠️ Error: {error_str}")
             import traceback
             traceback.print_exc()
        return False

async def run_tests():
    # Test specific candidates requested by user
    candidates = [
        "gemini-3-pro-preview",	# High probability for "Gemini 3" reference
    ]
    
    for c in candidates:
        await test_ai_studio(c)

if __name__ == "__main__":
    asyncio.run(run_tests())
