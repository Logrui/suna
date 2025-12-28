"""
Read-Only Database Inspection Script
Inspects the Langflow database to understand folder/project state
"""

import os
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def main():
    db_url = os.getenv("LANGFLOW_DATABASE_URL")
    if not db_url:
        db_url = "postgresql://langflow:langflow@postgres:5432/langflow"
        print(f"Warning: LANGFLOW_DATABASE_URL not set, using default: {db_url}")
    
    print(f"Using DB URL: {db_url}")
    print("=" * 80)
    
    try:
        engine = create_async_engine(db_url)
        
        async with engine.begin() as conn:
            target_id = "8a6d27cb-bd6c-49e6-a3ab-d2351a7da42c"
            target_name = "Deal Flow Agent"
            
            # 1. Check if the specific UUID exists
            print(f"\n1. Checking for UUID: {target_id}")
            print("-" * 80)
            result = await conn.execute(
                text("SELECT id, name, description, parent_id, user_id FROM folder WHERE id = :id"),
                {"id": target_id}
            )
            row = result.fetchone()
            if row:
                print(f"✅ FOUND:")
                print(f"   ID:          {row[0]}")
                print(f"   Name:        {row[1]}")
                print(f"   Description: {row[2]}")
                print(f"   Parent ID:   {row[3]}")
                print(f"   User ID:     {row[4]}")
            else:
                print(f"❌ NOT FOUND")
            
            # 2. Check if the name exists
            print(f"\n2. Checking for name: '{target_name}'")
            print("-" * 80)
            result = await conn.execute(
                text("SELECT id, name, user_id, parent_id FROM folder WHERE name = :name"),
                {"name": target_name}
            )
            rows = result.fetchall()
            if rows:
                print(f"✅ FOUND {len(rows)} folder(s) with this name:")
                for row in rows:
                    print(f"   ID: {row[0]}, User: {row[2]}, Parent: {row[3]}")
            else:
                print(f"❌ NOT FOUND")
            
            # 3. List all folders
            print(f"\n3. All folders in database:")
            print("-" * 80)
            result = await conn.execute(
                text("SELECT id, name, user_id, parent_id FROM folder ORDER BY name")
            )
            rows = result.fetchall()
            print(f"Total folders: {len(rows)}")
            for row in rows:
                print(f"   '{row[1]}' (ID: {row[0]}, User: {row[2]}, Parent: {row[3]})")
            
            # 4. List all users
            print(f"\n4. All users in database:")
            print("-" * 80)
            result = await conn.execute(
                text("SELECT id, username FROM \"user\" ORDER BY username")
            )
            rows = result.fetchall()
            print(f"Total users: {len(rows)}")
            for row in rows:
                print(f"   Username: {row[1]}, ID: {row[0]}")
            
        await engine.dispose()
        print("\n" + "=" * 80)
        print("Inspection complete.")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
