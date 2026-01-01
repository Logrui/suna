import asyncio
from core.ai_models.local_registry import LocalModelRegistry
from core.utils.logger import logger
import logging

# Configure logger to see output
logging.basicConfig(level=logging.DEBUG)

async def main():
    registry = LocalModelRegistry()
    await registry.initialize()
    models = registry.get_all()
    print(f"\nFound {len(models)} models:")
    for m in models:
        print(f"- {m.id} ({m.name}) [Provider: {m.provider.value}]")

if __name__ == "__main__":
    asyncio.run(main())