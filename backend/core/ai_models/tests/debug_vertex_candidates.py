
import asyncio
import os
import sys
from litellm import acompletion
from pprint import pprint

# Ensure backend directory is in path
sys.path.append(os.path.join(os.path.dirname(__file__), '../../../'))
from core.utils.config import config
from core.agentpress.error_processor import ErrorProcessor

async def test_candidate(model_id):
    print(f"\n--- Testing Candidate: vertex_ai/{model_id} ---")
    
    full_model_name = f"vertex_ai/{model_id}"
    
    params = {
        "model": full_model_name,
        "messages": [{"role": "user", "content": "Hi"}],
        "stream": False,
        "vertex_project": config.VERTEX_AI_PROJECT,
        "vertex_location": config.VERTEX_AI_LOCATION,
        "vertex_credentials": config.VERTEX_AI_CREDENTIALS_JSON
    }

    try:
        response = await acompletion(**params)
        print(f"✅ SUCCESS! Model ID '{model_id}' is valid.")
        return True
    except Exception as e:
        error_str = str(e)
        if "404" in error_str:
             print(f"❌ 404 Not Found (Invalid ID)")
        elif "403" in error_str:
             print(f"⛔ 403 Forbidden (Project not allowed/API disabled)")
        else:
             print(f"⚠️ Error: {error_str[:200]}...")
        return False

async def run_discovery():
    print(f"Project: {config.VERTEX_AI_PROJECT}")
    print(f"Location: {config.VERTEX_AI_LOCATION}")
    
    # List of likely candidates for Gemini 3 / Experimental models
    candidates = [
        "gemini-exp-1206",           # Dec 2024 Experimental (Likely what 'Gemini 3' refers to mentally)
        "gemini-2.0-flash-exp",       # The official 2.0 Flash Exp name
        "gemini-experimental",        
        # "gemini-3-pro-preview",     # Very likely invalid/non-existent public ID
    ]
    
    found = False
    for candidate in candidates:
        if await test_candidate(candidate):
            found = True
            break
            
    if not found:
        print("\n❌ No working candidate found in likely list.")

if __name__ == "__main__":
    asyncio.run(run_discovery())
