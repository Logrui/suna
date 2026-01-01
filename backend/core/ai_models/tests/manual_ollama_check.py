import asyncio
from core.ai_models.local_registry import LocalModelRegistry

async def main():
    registry = LocalModelRegistry()
    await registry.initialize()
    models = registry.get_all()
    print(f"Found {len(models)} models:")
    for m in models:
        print(f"- {m.id} ({m.name})")

if __name__ == "__main__":
    asyncio.run(main())
