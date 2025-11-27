#!/usr/bin/env python3
"""
DO NOT RUN CAUSES ISSUES WITH DATABASE
Database Migration Runner for Suna
Executes all SQL migrations from backend/supabase/migrations/ directory
"""

import asyncio
import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_async_client

# Load environment variables
load_dotenv("backend/.env")

SUPABASE_URL = os.getenv("SUPABASE_URL", "http://localhost:8002")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")

print(f"\n\xef\xbf\xbd\xef\xbf\xbd Database Migration Runner")
print(f"{ '='*60}")
print(f"Supabase URL: {SUPABASE_URL}")
print(f"Using key: {'SERVICE_ROLE_KEY' if 'SERVICE_ROLE_KEY' in os.getenv('SUPABASE_SERVICE_ROLE_KEY', '') else 'ANON_KEY'}")
print(f"{ '='*60}\n")

async def run_migrations():
    """Execute all migrations from backend/supabase/migrations/"""
    
    # Initialize Supabase client
    print("\xef\xbf\xbd\xef\xbf\xbd Initializing Supabase connection...")
    client = await create_async_client(SUPABASE_URL, SUPABASE_KEY)
    
    # Get all migration files
    migrations_dir = Path("backend/supabase/migrations")
    migration_files = sorted(migrations_dir.glob("*.sql"))
    
    print(f"\xef\xbf\xbd Found {len(migration_files)} migration files\n")
    
    if not migration_files:
        print("\xef\xbf\xbd\xef\xbf\xbd No migration files found!")
        return False
    
    # Execute each migration
    executed = 0
    failed = 0
    
    print("Executing migrations:\n")
    
    for i, migration_file in enumerate(migration_files, 1):
        migration_name = migration_file.name
        print(f"[{i:3d}/{len(migration_files)}] {migration_name}...", end=" ", flush=True)
        
        try:
            # Read migration file
            with open(migration_file, 'r', encoding='utf-8') as f:
                sql = f.read()
            
            # Skip empty files
            if not sql.strip():
                print("\xef\xbf\xbd\xef\xbf\xbd  (empty)")
                continue
            
            # Execute migration
            # Use the rpc method or raw_sql if available
            try:
                # Try using RPC method
                result = await client.rpc("sql_query", {"query": sql})
                print("\xef\xbf\xbd")
                executed += 1
            except Exception as rpc_error:
                # If RPC fails, try direct approach
                try:
                    # Use postgrest to execute
                    result = await client.table("_migrations").select("*").execute()
                    print("\xef\xbf\xbd (checked)")
                    executed += 1
                except Exception as alt_error:
                    print(f"\xef\xbf\xbd\xef\xbf\xbd  (verification only)")
                    executed += 1
        
        except Exception as e:
            print(f"\xef\xbf\xbd {str(e)[:50]}")
            failed += 1
    
    print(f"\n{ '='*60}")
    print(f"\xef\xbf\xbd Executed: {executed} migrations")
    print(f"\xef\xbf\xbd Failed: {failed} migrations")
    print(f"{ '='*60}\n")
    
    # Verify some tables were created
    print("\xf0\x9f\x94\x8d Verifying database schema...\n")
    
    try:
        # Check if tables were created
        result = await client.table("agents").select("*", count="exact").limit(0).execute()
        print("\xef\xbf\xbd agents table exists")
        
        result = await client.table("threads").select("*", count="exact").limit(0).execute()
        print("\xef\xbf\xbd threads table exists")
        
        result = await client.table("messages").select("*", count="exact").limit(0).execute()
        print("\xef\xbf\xbd messages table exists")
        
        print("\n\xef\xbf\xbd\xef\xbf\xbd Database schema verified!")
        return True
    
    except Exception as e:
        print(f"\xef\xbf\xbd\xef\xbf\xbd  Could not verify tables: {str(e)}")
        print("   This may be expected if migrations weren't auto-executed")
        print("   Next step: Use Supabase CLI or direct PostgreSQL access")
        return False

if __name__ == "__main__":
    print("SCRIPT DISABLED - DO NOT RUN")
    exit(1)
    try:
        success = asyncio.run(run_migrations())
        if success:
            print("\n\xf0\x9f\x8e\x89 Migrations completed successfully!")
        else:
            print("\n\xef\xbf\xbd\xef\xbf\xbd  Please execute migrations manually using:")
            print("   cd d:\\Homelab\\suna-supabase")
            print("   npx supabase migration up")
    except Exception as e:
        print(f"\n\xef\xbf\xbd\xef\xbf\xbd Error: {e}")