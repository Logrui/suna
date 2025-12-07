import asyncio
from core.services.supabase import DBConnection

async def main():
    try:
        db = DBConnection()
        await db.initialize()
        client = await db.client
        print("Checking feedback table...")
        res = await client.table('feedback').select('*').limit(1).execute()
        print(f"Success: {res}")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await db.disconnect()

if __name__ == "__main__":
    asyncio.run(main())
