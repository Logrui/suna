"""
Simple script to check token usage data by querying Supabase directly.
Run this with: python -m scripts.check_usage_simple
"""

import os
import asyncio
from supabase import create_client, Client

async def check_usage():
    # Get Supabase credentials from environment
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        print("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
        return
    
    # Create client
    supabase: Client = create_client(url, key)
    
    print("\n" + "="*80)
    print("CHECKING TOKEN USAGE DATA")
    print("="*80 + "\n")
    
    # Count llm_response_end messages
    result = supabase.table('messages').select('*', count='exact').eq('type', 'llm_response_end').limit(1).execute()
    total = result.count if hasattr(result, 'count') else 0
    print(f"Total llm_response_end messages: {total}\n")
    
    # Get recent messages
    messages = supabase.table('messages').select('message_id, thread_id, content, created_at').eq('type', 'llm_response_end').order('created_at', desc=True).limit(10).execute()
    
    print(f"Analyzing {len(messages.data)} recent messages:\n")
    
    for i, msg in enumerate(messages.data, 1):
        content = msg.get('content', {})
        usage = content.get('usage')
        model = content.get('model', 'unknown')
        
        print(f"{i}. Thread: {msg['thread_id'][:8]}... | Model: {model}")
        
        if usage:
            pt = usage.get('prompt_tokens', 0)
            ct = usage.get('completion_tokens', 0)
            print(f"   Usage: {pt} prompt + {ct} completion = {pt+ct} total")
            if pt == 0 and ct == 0:
                print(f"   ⚠️  WARNING: Zero tokens!")
        else:
            print(f"   ❌ NO USAGE DATA")
        print()

if __name__ == "__main__":
    asyncio.run(check_usage())
