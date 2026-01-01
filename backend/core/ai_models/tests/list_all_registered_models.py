import asyncio
from core.ai_models.registry import registry

async def main():
    print("--- Initializing Registry ---")
    # Initialize local models (Ollama, LM Studio)
    await registry.initialize_local_models()
    
    # Get all models, sorted by priority (how the registry returns them)
    models = registry.list_available_models(include_disabled=True)
    
    print(f"\n{'ID':<55} | {'Priority':<8} | {'Provider':<12} | {'Tiers':<15} | {'Context':<8}")
    print("-" * 110)
    
    for m in models:
        # Get the actual model object to access raw provider data
        model_obj = registry.get(m['id'])
        provider = model_obj.provider.value if model_obj else "unknown"
        
        id_str = m['id']
        priority = m.get('priority', 0)
        tier = ", ".join(m.get('tier_availability', []))
        context = m.get('context_window', 0)
        
        print(f"{id_str:<55} | {priority:<8} | {provider:<12} | {tier:<15} | {context:<8}")
    
    print("-" * 110)
    print(f"Total models registered: {len(models)}")

if __name__ == "__main__":
    asyncio.run(main())

