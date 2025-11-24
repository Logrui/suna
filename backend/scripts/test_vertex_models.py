"""
Test script for Vertex AI models using the registry configuration.
Run this with: python -m scripts.test_vertex_models
"""

import os
import sys
import asyncio
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.ai_models import model_manager
from core.ai_models.ai_models import ModelProvider
from core.services.llm import make_llm_api_call
from core.utils.logger import logger

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
            else:
                print(f"⚠️  Warning: Could not find local gcloud credentials at {local_creds}")

async def test_vertex_models():
    """Test all Vertex AI models with a simple API call."""
    
    print("\n" + "="*80)
    print("TESTING VERTEX AI MODELS")
    print("="*80 + "\n")
    
    # Get all Vertex AI models from registry
    all_models = model_manager.list_available_models(include_disabled=False)
    vertex_models = [
        model for model in all_models 
        if model.get('provider') == ModelProvider.VERTEX_AI.value
    ]
    
    if not vertex_models:
        print("❌ No enabled Vertex AI models found in registry")
        return
    
    print(f"Found {len(vertex_models)} enabled Vertex AI models:\n")
    for model in vertex_models:
        print(f"  - {model['name']} ({model['id']})")
    print()
    
    # Test each model
    results = []
    for i, model_info in enumerate(vertex_models, 1):
        model_id = model_info['id']
        model_name = model_info['name']
        
        print(f"\n[{i}/{len(vertex_models)}] Testing {model_name}...")
        print(f"    Model ID: {model_id}")
        
        try:
            # Simple test message
            messages = [
                {"role": "user", "content": "Say 'Hello' in 1 word."}
            ]
            
            # Make API call with fast settings and timeout
            try:
                response = await asyncio.wait_for(
                    make_llm_api_call(
                        messages=messages,
                        model_name=model_id,
                        max_tokens=10,  # Reduced for speed
                        temperature=0,
                        stream=False  # Disable streaming for faster tests
                    ),
                    timeout=60.0  # 60 second timeout for cold starts
                )
            except asyncio.TimeoutError:
                print(f"    ❌ FAILED: Request timed out after 60 seconds")
                results.append({
                    'model': model_name,
                    'id': model_id,
                    'status': 'FAILED',
                    'error': 'Request timed out after 60 seconds'
                })
                continue
            
            # Extract response
            if hasattr(response, 'choices') and len(response.choices) > 0:
                content = response.choices[0].message.content
                usage = getattr(response, 'usage', None)
                
                print(f"    ✅ SUCCESS")
                print(f"    Response: {content[:100]}...")
                
                if usage:
                    print(f"    Tokens: {usage.prompt_tokens} in + {usage.completion_tokens} out = {usage.total_tokens} total")
                
                results.append({
                    'model': model_name,
                    'id': model_id,
                    'status': 'SUCCESS',
                    'response': content,
                    'usage': usage
                })
            else:
                print(f"    ⚠️  WARNING: Unexpected response format")
                print(f"    Raw Response: {response}")
                results.append({
                    'model': model_name,
                    'id': model_id,
                    'status': 'WARNING',
                    'error': 'Unexpected response format'
                })
                
        except Exception as e:
            print(f"    ❌ FAILED: {str(e)}")
            results.append({
                'model': model_name,
                'id': model_id,
                'status': 'FAILED',
                'error': str(e)
            })
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80 + "\n")
    
    success_count = sum(1 for r in results if r['status'] == 'SUCCESS')
    failed_count = sum(1 for r in results if r['status'] == 'FAILED')
    warning_count = sum(1 for r in results if r['status'] == 'WARNING')
    
    print(f"Total: {len(results)} models")
    print(f"✅ Success: {success_count}")
    print(f"⚠️  Warning: {warning_count}")
    print(f"❌ Failed: {failed_count}\n")
    
    if failed_count > 0:
        print("Failed models:")
        for r in results:
            if r['status'] == 'FAILED':
                print(f"  - {r['model']}: {r['error']}")
        print()
    
    return results

if __name__ == "__main__":
    asyncio.run(test_vertex_models())
