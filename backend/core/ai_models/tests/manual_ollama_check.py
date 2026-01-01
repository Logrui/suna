import asyncio
from core.ai_models.registry import registry
from core.utils.logger import logger
import logging

# Configure logger to see output
logging.basicConfig(level=logging.DEBUG)

async def main():
    print("Initializing main registry local models...")
    await registry.initialize_local_models()
    
    models = registry.list_available_models(include_disabled=True)
    print(f"\nFound {len(models)} total models:")
    
    local_count = 0
    for m in models:
        # Check if it looks like a local model (ollama/...)
        is_local = "ollama/" in m['id'] or "lm_studio/" in m['id']
        if is_local:
            local_count += 1
            print(f"- [LOCAL] {m['id']} ({m['name']})")
        else:
            # print(f"- {m['id']} ({m['name']})") # Too noisy
            pass
            
    print(f"\nTotal Local Models Found: {local_count}")

if __name__ == "__main__":
    asyncio.run(main())
