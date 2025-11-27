import asyncio
import os
import redis.asyncio as redis
from dotenv import load_dotenv

# Load env vars
load_dotenv()

REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))

async def test_pubsub():
    print(f"Connecting to Redis at {REDIS_HOST}:{REDIS_PORT}...")
    try:
        client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
        await client.ping()
        print("Connected to Redis.")
    except Exception as e:
        print(f"Failed to connect: {e}")
        return

    channel = "test_channel"
    pubsub = client.pubsub()
    await pubsub.subscribe(channel)
    print(f"Subscribed to {channel}.")

    async def listener():
        print("Listening...")
        try:
            async for message in pubsub.listen():
                print(f"Received: {message}")
                if message['type'] == 'message' and message['data'] == 'STOP':
                    break
        except Exception as e:
            print(f"Listener error: {e}")

    task = asyncio.create_task(listener())

    await asyncio.sleep(1)
    print("Publishing message...")
    await client.publish(channel, "Hello")
    await asyncio.sleep(1)
    print("Publishing STOP...")
    await client.publish(channel, "STOP")
    
    await task
    await pubsub.unsubscribe(channel)
    await client.aclose()
    print("Done.")

if __name__ == "__main__":
    asyncio.run(test_pubsub())
