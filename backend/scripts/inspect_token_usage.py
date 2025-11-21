"""
Inspect llm_response_end messages to verify token usage data is being stored.

This script queries the messages table to check:
1. How many llm_response_end messages exist
2. Whether they contain usage data
3. What the structure of the usage data looks like
4. Identify any messages with missing/malformed usage data
"""

import asyncio
import json
from core.services.supabase import DBConnection
from core.utils.logger import logger


async def inspect_token_usage():
    """Inspect recent llm_response_end messages for token usage data."""
    
    db = DBConnection()
    client = await db.client
    
    print("\n" + "="*80)
    print("INSPECTING TOKEN USAGE DATA IN DATABASE")
    print("="*80 + "\n")
    
    # 1. Count total llm_response_end messages
    print("1. Counting llm_response_end messages...")
    count_result = await client.table('messages').select('message_id', count='exact').eq('type', 'llm_response_end').execute()
    total_count = count_result.count if hasattr(count_result, 'count') else len(count_result.data)
    print(f"   Total llm_response_end messages: {total_count}\n")
    
    # 2. Get recent messages (last 20)
    print("2. Fetching 20 most recent llm_response_end messages...")
    messages_result = await client.table('messages').select(
        'message_id, thread_id, content, created_at'
    ).eq('type', 'llm_response_end').order('created_at', desc=True).limit(20).execute()
    
    messages = messages_result.data
    print(f"   Retrieved {len(messages)} messages\n")
    
    if not messages:
        print("   ❌ No llm_response_end messages found!")
        return
    
    # 3. Analyze each message
    print("3. Analyzing message structure...\n")
    
    messages_with_usage = 0
    messages_without_usage = 0
    messages_with_zero_tokens = 0
    messages_with_valid_tokens = 0
    
    usage_structures = {}
    
    for i, msg in enumerate(messages, 1):
        message_id = msg.get('message_id')
        thread_id = msg.get('thread_id')
        content = msg.get('content', {})
        created_at = msg.get('created_at')
        
        print(f"\n{'─'*80}")
        print(f"Message #{i}")
        print(f"{'─'*80}")
        print(f"Message ID:  {message_id}")
        print(f"Thread ID:   {thread_id}")
        print(f"Created At:  {created_at}")
        
        # Check for usage field
        usage = content.get('usage')
        model = content.get('model', 'unknown')
        
        print(f"Model:       {model}")
        
        if usage is None:
            print(f"Usage:       ❌ MISSING (usage field not found)")
            messages_without_usage += 1
        else:
            messages_with_usage += 1
            
            # Extract token counts
            prompt_tokens = usage.get('prompt_tokens', 0)
            completion_tokens = usage.get('completion_tokens', 0)
            cache_read_tokens = usage.get('cache_read_input_tokens', 0)
            cache_creation_tokens = usage.get('cache_creation_input_tokens', 0)
            
            # Also check OpenAI format
            if cache_read_tokens == 0:
                prompt_tokens_details = usage.get('prompt_tokens_details', {})
                if prompt_tokens_details:
                    cache_read_tokens = prompt_tokens_details.get('cached_tokens', 0)
            
            print(f"Usage:       ✅ PRESENT")
            print(f"  - Prompt tokens:        {prompt_tokens}")
            print(f"  - Completion tokens:    {completion_tokens}")
            print(f"  - Cache read tokens:    {cache_read_tokens}")
            print(f"  - Cache creation tokens: {cache_creation_tokens}")
            
            # Check if tokens are zero
            if prompt_tokens == 0 and completion_tokens == 0:
                print(f"  ⚠️  WARNING: Both prompt and completion tokens are 0!")
                messages_with_zero_tokens += 1
            else:
                messages_with_valid_tokens += 1
            
            # Track usage structure
            usage_keys = tuple(sorted(usage.keys()))
            if usage_keys not in usage_structures:
                usage_structures[usage_keys] = 0
            usage_structures[usage_keys] += 1
        
        # Show top-level content keys
        content_keys = list(content.keys())
        print(f"Content keys: {content_keys}")
    
    # 4. Summary
    print("\n" + "="*80)
    print("SUMMARY")
    print("="*80 + "\n")
    
    print(f"Total messages analyzed:           {len(messages)}")
    print(f"Messages WITH usage field:         {messages_with_usage} ({messages_with_usage/len(messages)*100:.1f}%)")
    print(f"Messages WITHOUT usage field:      {messages_without_usage} ({messages_without_usage/len(messages)*100:.1f}%)")
    print(f"Messages with VALID tokens (>0):   {messages_with_valid_tokens} ({messages_with_valid_tokens/len(messages)*100:.1f}%)")
    print(f"Messages with ZERO tokens:         {messages_with_zero_tokens} ({messages_with_zero_tokens/len(messages)*100:.1f}%)")
    
    print("\n" + "─"*80)
    print("Usage field structures found:")
    print("─"*80)
    for keys, count in usage_structures.items():
        print(f"\n{count} messages with keys: {list(keys)}")
    
    # 5. Detailed example
    if messages_with_valid_tokens > 0:
        print("\n" + "="*80)
        print("DETAILED EXAMPLE (First message with valid tokens)")
        print("="*80 + "\n")
        
        for msg in messages:
            content = msg.get('content', {})
            usage = content.get('usage')
            if usage:
                prompt_tokens = usage.get('prompt_tokens', 0)
                completion_tokens = usage.get('completion_tokens', 0)
                if prompt_tokens > 0 or completion_tokens > 0:
                    print(json.dumps(content, indent=2, default=str))
                    break
    
    # 6. Check for threads with multiple messages
    print("\n" + "="*80)
    print("THREAD AGGREGATION TEST")
    print("="*80 + "\n")
    
    # Get a thread with multiple messages
    thread_counts = {}
    for msg in messages:
        thread_id = msg.get('thread_id')
        if thread_id not in thread_counts:
            thread_counts[thread_id] = 0
        thread_counts[thread_id] += 1
    
    # Find thread with most messages
    if thread_counts:
        max_thread = max(thread_counts.items(), key=lambda x: x[1])
        test_thread_id, msg_count = max_thread
        
        print(f"Thread with most llm_response_end messages:")
        print(f"  Thread ID: {test_thread_id}")
        print(f"  Message count: {msg_count}")
        
        # Get all messages for this thread
        thread_messages = await client.table('messages').select(
            'content'
        ).eq('thread_id', test_thread_id).eq('type', 'llm_response_end').execute()
        
        total_prompt = 0
        total_completion = 0
        total_cache_read = 0
        models_used = set()
        
        print(f"\n  Aggregating usage for this thread:")
        for msg in thread_messages.data:
            content = msg.get('content', {})
            usage = content.get('usage', {})
            model = content.get('model', 'unknown')
            
            prompt_tokens = usage.get('prompt_tokens', 0)
            completion_tokens = usage.get('completion_tokens', 0)
            cache_read_tokens = usage.get('cache_read_input_tokens', 0)
            
            if cache_read_tokens == 0:
                prompt_tokens_details = usage.get('prompt_tokens_details', {})
                if prompt_tokens_details:
                    cache_read_tokens = prompt_tokens_details.get('cached_tokens', 0)
            
            total_prompt += prompt_tokens
            total_completion += completion_tokens
            total_cache_read += cache_read_tokens
            models_used.add(model)
        
        print(f"  Total prompt tokens:     {total_prompt}")
        print(f"  Total completion tokens: {total_completion}")
        print(f"  Total cache read tokens: {total_cache_read}")
        print(f"  Models used:             {list(models_used)}")
        
        if total_prompt > 0 or total_completion > 0:
            print(f"\n  ✅ This thread has valid aggregatable usage data!")
        else:
            print(f"\n  ❌ This thread has NO valid usage data (all zeros)!")
    
    print("\n" + "="*80)
    print("INSPECTION COMPLETE")
    print("="*80 + "\n")


if __name__ == "__main__":
    asyncio.run(inspect_token_usage())
