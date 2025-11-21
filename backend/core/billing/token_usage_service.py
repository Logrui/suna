"""
Token Usage Service - Aggregates token usage from messages table

This service provides on-demand token usage aggregation for threads,
eliminating the need for storing aggregated data in the database.
"""

from typing import Dict, List, Optional
from decimal import Decimal
from core.services.supabase import DBConnection
from core.utils.logger import logger
from core.utils.auth_utils import verify_and_authorize_thread_access


async def get_thread_token_usage(thread_id: str, account_id: str) -> Dict:
    """
    Aggregate token usage for a thread from messages table.
    
    Args:
        thread_id: Thread ID to get usage for
        account_id: User's account ID (for authorization)
        
    Returns:
        Dictionary containing:
        - total_prompt_tokens
        - total_completion_tokens
        - total_cache_read_tokens
        - total_cache_creation_tokens
        - estimated_cost_dollars
        - models: List of per-model breakdowns
    """
    try:
        db = DBConnection()
        client = await db.client
        
        # Verify user has access to this thread
        await verify_and_authorize_thread_access(client, thread_id, account_id)
        
        # Query all llm_response_end messages for this thread
        messages_result = await client.table('messages').select('content').eq('thread_id', thread_id).eq('type', 'llm_response_end').execute()
        
        logger.info(f"Found {len(messages_result.data)} llm_response_end messages for thread {thread_id}")
        
        # Log the raw query result for debugging
        if len(messages_result.data) > 0:
            logger.info(f"Sample message content keys: {list(messages_result.data[0].get('content', {}).keys())}")
        
        # Aggregate tokens by model
        model_usage = {}
        total_prompt_tokens = 0
        total_completion_tokens = 0
        total_cache_read_tokens = 0
        total_cache_creation_tokens = 0
        
        for message in messages_result.data:
            content = message.get('content', {})
            logger.info(f"Processing message with content keys: {list(content.keys())}")
            usage = content.get('usage', {})
            model = content.get('model', 'unknown')
            
            logger.info(f"Message model: {model}, usage keys: {list(usage.keys()) if usage else 'NO USAGE'}")
            
            logger.debug(f"Message model: {model}, usage: {usage}")
            
            # Extract token counts
            prompt_tokens = int(usage.get('prompt_tokens', 0) or 0)
            completion_tokens = int(usage.get('completion_tokens', 0) or 0)
            cache_read_tokens = int(usage.get('cache_read_input_tokens', 0) or 0)
            
            logger.info(f"Extracted tokens - prompt: {prompt_tokens}, completion: {completion_tokens}, cache_read: {cache_read_tokens}")
            
            # Also support OpenAI's cached tokens format
            if not cache_read_tokens:
                prompt_tokens_details = usage.get('prompt_tokens_details', {})
                if prompt_tokens_details:
                    cache_read_tokens = int(prompt_tokens_details.get('cached_tokens', 0) or 0)
            
            cache_creation_tokens = int(usage.get('cache_creation_input_tokens', 0) or 0)
            
            # Skip messages with no token usage (likely malformed or missing usage data)
            if prompt_tokens == 0 and completion_tokens == 0:
                logger.warning(f"⚠️ SKIPPING message with 0 tokens for model {model} in thread {thread_id}")
                continue
            
            logger.info(f"✅ VALID message - Adding {prompt_tokens} prompt + {completion_tokens} completion tokens for {model}")
            
            # Initialize model entry if not exists
            if model not in model_usage:
                model_usage[model] = {
                    'model': model,
                    'prompt_tokens': 0,
                    'completion_tokens': 0,
                    'cache_read_tokens': 0,
                    'cache_creation_tokens': 0,
                    'call_count': 0
                }
            
            # Aggregate for this model
            model_usage[model]['prompt_tokens'] += prompt_tokens
            model_usage[model]['completion_tokens'] += completion_tokens
            model_usage[model]['cache_read_tokens'] += cache_read_tokens
            model_usage[model]['cache_creation_tokens'] += cache_creation_tokens
            model_usage[model]['call_count'] += 1
            
            # Aggregate totals
            total_prompt_tokens += prompt_tokens
            total_completion_tokens += completion_tokens
            total_cache_read_tokens += cache_read_tokens
            total_cache_creation_tokens += cache_creation_tokens
        
        # Calculate cost for each model
        from core.billing.api import calculate_token_cost
        
        models_list = []
        total_cost = Decimal('0')
        
        for model_data in model_usage.values():
            # Calculate cost for this model
            model_cost = calculate_token_cost(
                model_data['prompt_tokens'],
                model_data['completion_tokens'],
                model_data['model']
            )
            
            # Handle cache discounting (same logic as billing_integration.py)
            if model_data['cache_read_tokens'] > 0:
                model_lower = model_data['model'].lower()
                if any(provider in model_lower for provider in ['anthropic', 'claude', 'sonnet']):
                    cache_discount = Decimal('0.1')
                elif any(provider in model_lower for provider in ['gpt', 'openai', 'gpt-4o']):
                    cache_discount = Decimal('0.5')
                else:
                    cache_discount = Decimal('0.5')
                
                # Recalculate with cache discount
                non_cached_prompt = model_data['prompt_tokens'] - model_data['cache_read_tokens']
                cached_cost = calculate_token_cost(model_data['cache_read_tokens'], 0, model_data['model']) * cache_discount
                non_cached_cost = calculate_token_cost(non_cached_prompt, model_data['completion_tokens'], model_data['model'])
                model_cost = cached_cost + non_cached_cost
            
            model_data['cost_dollars'] = float(model_cost)
            total_cost += model_cost
            models_list.append(model_data)
        
        # Sort models by cost (descending)
        models_list.sort(key=lambda x: x['cost_dollars'], reverse=True)
        
        logger.info(f"Token usage for thread {thread_id}: {total_prompt_tokens} prompt, {total_completion_tokens} completion, ${total_cost:.6f} estimated")
        logger.info(f"Returning {len(models_list)} models with {sum(m['call_count'] for m in models_list)} total LLM calls")
        
        result = {
            'thread_id': thread_id,
            'total_prompt_tokens': total_prompt_tokens,
            'total_completion_tokens': total_completion_tokens,
            'total_cache_read_tokens': total_cache_read_tokens,
            'total_cache_creation_tokens': total_cache_creation_tokens,
            'estimated_cost_dollars': float(total_cost),
            'models': models_list,
            'total_llm_calls': sum(m['call_count'] for m in models_list)
        }
        
        logger.info(f"Final result: {len(result.get('models', []))} models, total_llm_calls={result.get('total_llm_calls', 0)}")
        
        return result
        
    except Exception as e:
        logger.error(f"Error aggregating token usage for thread {thread_id}: {str(e)}", exc_info=True)
        raise
