
import asyncio
import json
import sys
import os

# Add parent directory to path to allow importing core
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from core.services.supabase import DBConnection

async def main():
    try:
        connection = DBConnection()
        client = await connection.client
        
        # Check for online browsers
        browsers_res = await client.table('user_browsers').select('*').eq('is_online', True).execute()
        online_browsers = browsers_res.data or []
        
        # Check for threads with browser_id
        threads_res = await client.table('threads').select('thread_id,metadata').limit(10).execute()
        threads_with_browser = []
        for t in (threads_res.data or []):
            meta = t.get('metadata') or {}
            if meta.get('browser_id'):
                threads_with_browser.append(t)
        
        result = {
            "online_browsers": online_browsers,
            "threads_with_browser": threads_with_browser
        }
        print(json.dumps(result, indent=2))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    asyncio.run(main())
