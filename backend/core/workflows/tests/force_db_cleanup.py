
import os
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def main():
    db_url = os.getenv("LANGFLOW_DATABASE_URL")
    if not db_url:
        # Fallback to default if not set (though it should be in container)
        db_url = "postgresql+psycopg://langflow:langflow@suna-postgres-1:5432/langflow"
        print(f"Warning: LANGFLOW_DATABASE_URL not set, trying default: {db_url}")
    
    print(f"Using DB URL: {db_url}")
    
    try:
        engine = create_async_engine(db_url)
        
        async with engine.begin() as conn:
            id_to_delete = "8a6d27cb-bd6c-49e6-a3ab-d2351a7da42c"
            print(f"Force deleting folder {id_to_delete} from DB...")
            
            # Using text execution for raw power
            # Note: cascading should happen if FKs are set up correctly in DB
            result = await conn.execute(text(f"DELETE FROM folder WHERE id = '{id_to_delete}'"))
            print(f"Rows affected: {result.rowcount}")
            
        await engine.dispose()
        print("Success.")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
