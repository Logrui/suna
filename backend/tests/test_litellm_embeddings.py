import asyncio
import os
import sys
from core.utils.config import config

# Ensure we use OpenRouter for the test
os.environ["MEMORY_EMBEDDING_PROVIDER"] = "openrouter"
os.environ["MEMORY_EMBEDDING_MODEL"] = "openai/text-embedding-3-small"

# Ensure Python can find the 'core' module
sys.path.append(os.getcwd())

from core.memory.embedding_service import embedding_service

async def test_lite_llm_embeddings():
    print(f"OPENROUTER_API_KEY set: {bool(config.OPENROUTER_API_KEY)}")
    print(f"Testing LiteLLM Embeddings with provider: {embedding_service.provider_name}")
    print(f"Model: {embedding_service.model}")
    sys.stdout.flush()
    
    try:
        text = "Re-testing LiteLLM integration after refactor!"
        embedding = await embedding_service.embed_text(text)
        print(f"Success! Embedding length: {len(embedding)}")
        print(f"First 5 values: {embedding[:5]}")
    except Exception as e:
        print(f"Error during LiteLLM embedding: {e}")
    sys.stdout.flush()

if __name__ == "__main__":
    asyncio.run(test_lite_llm_embeddings())
