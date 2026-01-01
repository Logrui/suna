import asyncio
from core.ai_models.registry import registry
from core.utils.logger import logger
import logging

# Configure logger to see output
# logging.basicConfig(level=logging.DEBUG)

async def main():
    print("Initializing main registry local models...")
    # Suppress logs during init
    logger.setLevel(logging.WARNING)
    await registry.initialize_local_models()
    
    models = registry.list_available_models(include_disabled=True)
    print(f"\n--- Available Models ({len(models)}) ---")
    
    for m in models:
        prefix = "[LOCAL]" if ("ollama/" in m['id'] or "lm_studio/" in m['id']) else "[CLOUD]"
        print(f"{prefix:<8} {m['id']} ({m['name']})")
            
    print("-----------------------------------")

if __name__ == "__main__":
    asyncio.run(main())