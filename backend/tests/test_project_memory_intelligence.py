import asyncio
import json
import os
import sys

# Ensure Python can find the 'core' module
sys.path.append(os.getcwd())

# Override settings for local run outside Docker — MUST be set BEFORE any imports
os.environ["SUPABASE_URL"] = "http://127.0.0.1:8888"
os.environ["REDIS_HOST"] = "127.0.0.1"
os.environ["MEMORY_EXTRACTION_MODEL"] = "openrouter/google/gemini-2.0-flash-001"

from core.memory.project_memory_service import project_memory_service
from core.memory.models import MemoryType
from core.utils.logger import logger

async def test_intelligence():
    # Use Gemini via OpenRouter (litellm) for intelligence tasks
    project_memory_service.model = "openrouter/google/gemini-2.0-flash-001"
    
    account_id = "dd9dcdcd-e305-42d5-8831-c6be38058724" 
    project_id = "d429e017-1f92-4f31-989e-6f1a4f3ece84"
    
    print("\n--- Testing Keyword Extraction ---")
    try:
        keywords = await project_memory_service.extract_keywords("Successfully implemented OAuth authentication using JWT tokens for the user login system.")
        print(f"Extracted Keywords: {keywords}")
    except Exception as e:
        print(f"Keyword extraction failed: {e}")
    
    print("\n--- Testing Create (Initial) ---")
    try:
        await project_memory_service.db.initialize()
        print("✅ DB Initialized")
    except Exception as e:
        print(f"❌ DB Initialization Failed: {e}")
        return

    # Clean up first
    await project_memory_service.delete_all_memories(account_id, project_id)
    
    m1 = await project_memory_service.create_memory(
        account_id=account_id,
        project_id=project_id,
        content="The project uses Tailwind CSS for styling.",
        memory_type="preference",
        skip_consolidation=True
    )
    print(f"Created Initial Memory: {m1.memory_id} - {m1.content}")

    print("\n--- Testing Consolidation (Replace) ---")
    print("Saving conflicting memory... (Tailwind -> Vanilla CSS)")
    # This should trigger consolidation and decide to REPLACE the Tailwind one
    m2 = await project_memory_service.create_memory(
        account_id=account_id,
        project_id=project_id,
        content="Actually, the project switched from Tailwind to Vanilla CSS with OKLCH variables. We prefer Vanilla CSS now.",
        memory_type="preference"
    )
    print(f"Consolidated Memory (Result): {m2.memory_id} - {m2.content}")
    
    # Check if old one is gone
    memories, count = await project_memory_service.list_memories(account_id, project_id)
    print(f"Memory count after consolidation: {count}")
    for m in memories:
        print(f"ID: {m.memory_id} | Content: {m.content}")
    
    if count == 1:
        print("✅ SUCCESS: Consolidation successfully replaced the outdated memory.")
    else:
        print("⚠️ WARNING: Consolidation did not replace the memory (count is still > 1).")

if __name__ == "__main__":
    asyncio.run(test_intelligence())
