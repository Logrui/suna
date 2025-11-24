"""
Diagnostic script to verify Vertex AI configuration
"""
import os
from core.utils.config import config

# Fix for local execution vs Docker execution
# The .env file has /app/gcloud-credentials.json which is for Docker
# If running locally on Windows, we need to point to the actual file
if os.name == 'nt':  # Windows
    creds_path = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')
    if creds_path and creds_path.startswith('/app/'):
        # Try to find standard gcloud credentials
        appdata = os.environ.get('APPDATA')
        if appdata:
            local_creds = os.path.join(appdata, 'gcloud', 'application_default_credentials.json')
            if os.path.exists(local_creds):
                print(f"⚠️  Detected local execution: Overriding credentials path")
                print(f"    Old: {creds_path}")
                print(f"    New: {local_creds}\n")
                os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = local_creds

print("=== Vertex AI Configuration Diagnostic ===\n")
print(f"VERTEX_AI_PROJECT: {config.VERTEX_AI_PROJECT}")
print(f"VERTEX_AI_LOCATION: {config.VERTEX_AI_LOCATION}")
print(f"GOOGLE_APPLICATION_CREDENTIALS: {os.getenv('GOOGLE_APPLICATION_CREDENTIALS')}")

print("\n=== Environment Variables ===")
print(f"VERTEXAI_PROJECT: {os.getenv('VERTEXAI_PROJECT')}")
print(f"VERTEXAI_LOCATION: {os.getenv('VERTEXAI_LOCATION')}")

print("\n=== Testing Model Manager ===")
from core.ai_models import model_manager

# Test getting LiteLLM params for a Claude model
claude_params = model_manager.get_litellm_params("vertex_ai/claude-sonnet-4-5@20250929", messages=[{"role": "user", "content": "test"}])
print(f"\nClaude Sonnet 4.5 params:")
print(f"  vertex_project: {claude_params.get('vertex_project')}")
print(f"  vertex_location: {claude_params.get('vertex_location')}")

# Test getting LiteLLM params for a Llama model  
llama_params = model_manager.get_litellm_params("vertex_ai/meta/llama-4-scout-17b-16e-instruct-maas", messages=[{"role": "user", "content": "test"}])
print(f"\nLlama 4 Scout params:")
print(f"  vertex_project: {llama_params.get('vertex_project')}")
print(f"  vertex_location: {llama_params.get('vertex_location')}")

print("\n=== Diagnostic Complete ===")
