#!/usr/bin/env python3
"""
Check token usage data in the database.
Run from backend directory: python check_token_usage.py
"""

import os
import sys
import asyncio

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

async def main():
    from core.services.supabase import DBConnection
    
    print("\n" + "="*80)
    print("INSPECTING TOKEN USAGE DATA")
    print("="*80 + "\n")
    
    db = DBConnection()
    client = await db.client
    
    # 1. Count total
    print("1. Counting llm_response_end messages...")
    count_result = await client.table('messages').select('message_id', count='exact').eq('type', 'llm_response_end').execute()
    total = count_result.count if hasattr(count_result, 'count') else len(count_result.data)
    print(f"   Total: {total}\n")
    
    # 2. Get recent messages
    print("2. Fetching 10 most recent messages...")
    result = await client.table('messages').select(
        'message_id, thread_id, content, created_at'
    ).eq('type', 'llm_response_end').order('created_at', desc=True).limit(10).execute()
    
    messages = result.data
    print(f"   Found: {len(messages)}\n")
    
    if not messages:
        print("   ❌ No messages found!\n")
        return
    
    # 3. Analyze
    print("3. Analysis:\n")
    print(f"{'#':<4} {'Thread ID':<12} {'Model':<30} {'Prompt':<8} {'Completion':<12} {'Status':<15}")
    print("─" * 90)
    
    with_usage = 0
    without_usage = 0
    with_valid = 0
    with_zero = 0
    
    for i, msg in enumerate(messages, 1):
        thread_id = msg['thread_id'][:10]
        content = msg.get('content', {})
        model = content.get('model', 'unknown')[:28]
        usage = content.get('usage')
        
        if usage is None:
            status = "❌ NO USAGE"
            pt = ct = "-"
            without_usage += 1
        else:
            with_usage += 1
            pt = usage.get('prompt_tokens', 0)
            ct = usage.get('completion_tokens', 0)
            
            if pt == 0 and ct == 0:
                status = "⚠️ ZERO TOKENS"
                with_zero += 1
            else:
                status = "✅ VALID"
                with_valid += 1
        
        print(f"{i:<4} {thread_id:<12} {model:<30} {str(pt):<8} {str(ct):<12} {status:<15}")
    
    # 4. Summary
    print("\n" + "="*80)
    print("SUMMARY")
    print("="*80)
    print(f"Total messages:              {len(messages)}")
    print(f"With usage field:            {with_usage} ({with_usage/len(messages)*100:.0f}%)")
    print(f"Without usage field:         {without_usage} ({without_usage/len(messages)*100:.0f}%)")
    print(f"With valid tokens (>0):      {with_valid} ({with_valid/len(messages)*100:.0f}%)")
    print(f"With zero tokens:            {with_zero} ({with_zero/len(messages)*100:.0f}%)")
    
    # 5. Show example
    if with_valid > 0:
        print("\n" + "="*80)
        print("EXAMPLE MESSAGE WITH VALID USAGE")
        print("="*80)
        for msg in messages:
            content = msg.get('content', {})
            usage = content.get('usage')
            if usage and (usage.get('prompt_tokens', 0) > 0 or usage.get('completion_tokens', 0) > 0):
                import json
                print(json.dumps({
                    'model': content.get('model'),
                    'usage': usage,
                    'llm_response_id': content.get('llm_response_id'),
                    'streaming': content.get('streaming')
                }, indent=2))
                break
    
    print("\n")

if __name__ == "__main__":
    asyncio.run(main())
