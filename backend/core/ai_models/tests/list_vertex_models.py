
import os
import time
import requests
from google.oauth2 import service_account
import google.auth.transport.requests

# Load config to get credentials
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), '../../../'))
from core.utils.config import config

def list_vertex_models():
    print(f"Project: {config.VERTEX_AI_PROJECT}")
    print(f"Location: {config.VERTEX_AI_LOCATION}")
    
    # Load credentials
    creds_json = config.VERTEX_AI_CREDENTIALS_JSON
    if not creds_json:
        print("Error: VERTEX_AI_CREDENTIALS_JSON not found")
        return

    try:
        if isinstance(creds_json, str):
            import json
            info = json.loads(creds_json)
            creds = service_account.Credentials.from_service_account_info(info)
        else:
            creds = service_account.Credentials.from_service_account_info(creds_json)
            
        creds = creds.with_scopes(['https://www.googleapis.com/auth/cloud-platform'])
            
        # Refreshed credentials to get token
        auth_req = google.auth.transport.requests.Request()
        creds.refresh(auth_req)
        token = creds.token
        
        # Call Vertex AI API to list models
        # Note: 'publishers/google/models' lists the foundation models
        # Correct Endpoint: https://us-central1-aiplatform.googleapis.com/v1/publishers/google/models
        url = f"https://{config.VERTEX_AI_LOCATION}-aiplatform.googleapis.com/v1/publishers/google/models"
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        print(f"Querying: {url} ...")
        response = requests.get(url, headers=headers)
        
        if response.status_code != 200:
            print(f"Error listing models: {response.status_code} - {response.text}")
            return

        models = response.json().get("models", [])
        print(f"\nFound {len(models)} models:")
        
        gemini_models = []
        for m in models:
            model_id = m.get("name", "").split("/")[-1]
            if "gemini" in model_id.lower():
                gemini_models.append(model_id)
                # print(f" - {model_id}") # Too noisy to print all
        
        # Sort and print Gemini models
        print("\n--- GEMINI MODELS FOUND ---")
        for m in sorted(gemini_models):
            print(f" - {m}")
            
    except Exception as e:
        print(f"Exception: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    list_vertex_models()
