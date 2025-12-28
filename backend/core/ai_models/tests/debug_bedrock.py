
import asyncio
import os
import sys
from litellm import acompletion
from core.utils.config import config
os.environ['LITELLM_LOG'] = 'DEBUG'

# Ensure env vars are set from config or environment for the test
if hasattr(config, "AWS_ACCESS_KEY_ID"):
    os.environ["AWS_ACCESS_KEY_ID"] = config.AWS_ACCESS_KEY_ID
if hasattr(config, "AWS_SECRET_ACCESS_KEY"):
    os.environ["AWS_SECRET_ACCESS_KEY"] = config.AWS_SECRET_ACCESS_KEY
if hasattr(config, "AWS_REGION_NAME"):
    os.environ["AWS_REGION_NAME"] = config.AWS_REGION_NAME

model_name = "bedrock/us.anthropic.claude-haiku-4-5-20251001-v1:0"

print(f"Testing model: {model_name}")
print(f"AWS Region: {os.environ.get('AWS_REGION_NAME')}")
print(f"AWS Key ID present: {bool(os.environ.get('AWS_ACCESS_KEY_ID'))}")

async def test_streaming():
    try:
        response = await acompletion(
            model=model_name,
            messages=[{"role": "user", "content": "Hello, are you working?"}],
            stream=True
        )
        print("Streaming response started...")
        async for chunk in response:
            content = chunk.choices[0].delta.content or ""
            print(content, end="", flush=True)
        print("\nStreaming complete.")
    except Exception as e:
        print(f"\nError details: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(test_streaming())
