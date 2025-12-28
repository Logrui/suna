
import os
import sys
import asyncio
from core.utils.config import config

# Set env vars BEFORE importing litellm
os.environ['LITELLM_LOG'] = 'DEBUG'
os.environ["VERTEX_AI_PROJECT"] = config.VERTEX_AI_PROJECT or ""
os.environ["VERTEX_AI_LOCATION"] = config.VERTEX_AI_LOCATION or ""

if config.VERTEX_AI_API_KEY:
    os.environ["GOOGLE_API_KEY"] = config.VERTEX_AI_API_KEY
    os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "TRUE"
    if "GOOGLE_APPLICATION_CREDENTIALS" in os.environ:
        del os.environ["GOOGLE_APPLICATION_CREDENTIALS"]

from litellm import acompletion

# === OPTION 1: Vertex AI (Production/Enterprise) ===
# Requires: VERTEX_AI_CREDENTIALS_JSON (Service Account) OR gcloud auth (User)
#           VERTEX_AI_PROJECT, VERTEX_AI_LOCATION
model_name = "vertex_ai/gemini-2.5-flash"

# === OPTION 2: Google AI Studio (Simpler/Prototyping) ===
# Requires: GEMINI_API_KEY (starts with AIza...)
#           No project/location needed usually
# model_name = "gemini/gemini-1.5-flash"


print(f"\n--- Debugging Google/Vertex AI ---")

# Setup for AI Studio
if model_name.startswith("gemini/"):
    print("Mode: Google AI Studio (Gemini API)")
    if "GOOGLE_GENAI_USE_VERTEXAI" in os.environ:
        print("Clearing GOOGLE_GENAI_USE_VERTEXAI to force AI Studio path")
        del os.environ["GOOGLE_GENAI_USE_VERTEXAI"]
    
    api_key = os.getenv("GEMINI_API_KEY") or config.GEMINI_API_KEY
    if api_key:
        os.environ["GEMINI_API_KEY"] = api_key
        print(f"GEMINI_API_KEY found: {api_key[:8]}...")
    else:
        print("ERROR: GEMINI_API_KEY not found!")

# Setup for Vertex AI
elif model_name.startswith("vertex_ai/"):
    print("Mode: Vertex AI (GCP)")
    print(f"Project: {config.VERTEX_AI_PROJECT}")
    print(f"Location: {config.VERTEX_AI_LOCATION}")
    
    # Check for Service Account
    if config.VERTEX_AI_CREDENTIALS_JSON:
        print("Service Account JSON loaded from config.")
        if "type" in config.VERTEX_AI_CREDENTIALS_JSON and "authorized_user" in config.VERTEX_AI_CREDENTIALS_JSON:
             print("WARNING: Detected 'authorized_user' credentials. These expire and require gcloud login.")
             print("         For persistent server use, please use a 'service_account' key.")
    else:
        print("No Service Account JSON found. Will rely on default credentials (gcloud auth/metadata).")


async def test_streaming():
    try:
        params = {
            "model": model_name,
            "messages": [{"role": "user", "content": "Hello, are you working?"}],
            "stream": True,
        }
        
        # Inject custom credentials for Vertex if available
        if model_name.startswith("vertex_ai/") and config.VERTEX_AI_CREDENTIALS_JSON:
            params["vertex_credentials"] = config.VERTEX_AI_CREDENTIALS_JSON
            
        print(f"\nCalling acompletion({model_name})...")
        response = await acompletion(**params)
        print("Streaming response started...")
        async for chunk in response:
            content = chunk.choices[0].delta.content or ""
            print(content, end="", flush=True)
        print("\nStreaming complete.")
    except Exception as e:
        print(f"\nError details: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(test_streaming())
