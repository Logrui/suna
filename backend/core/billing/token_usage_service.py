"""
Token Usage Service - Aggregates token usage from messages table

This service provides on-demand token usage aggregation for threads,
eliminating the need for storing aggregated data in the database.
"""

from typing import Dict, List, Optional
from decimal import Decimal
from typing import Dict, List, Any
from core.services.supabase import DBConnection
from core.utils.logger import logger
from litellm import token_counter
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
        
        # NEW APPROACH: Analyze actual thread messages for accurate categorization
        logger.info(f"🔍 Querying all thread messages for component breakdown")
        
        # Query all messages for this thread (user, assistant, tool types)
        thread_messages_result = await client.table('messages').select('type, content, created_at').eq('thread_id', thread_id).order('created_at').execute()
        
        component_breakdown = await _analyze_thread_messages(thread_messages_result.data, thread_id)
        
        logger.info(f"📊 Component breakdown from thread analysis: {component_breakdown}")
        
        # Calculate percentages
        total_tracked = sum(component_breakdown.values())
        component_percentages = {}
        if total_tracked > 0:
            for component, tokens in component_breakdown.items():
                component_percentages[component] = (tokens / total_tracked) * 100
        
        logger.info(f"📊 Component breakdown totals: {component_breakdown}")
        logger.info(f"📊 Total tracked tokens: {total_tracked}")
        logger.info(f"📊 Component percentages: {component_percentages}")
        
        # Calculate enhanced cache metrics
        fresh_input_tokens = total_prompt_tokens - total_cache_read_tokens
        cache_hit_rate = (total_cache_read_tokens / total_prompt_tokens * 100) if total_prompt_tokens > 0 else 0
        
        # Calculate estimated cache savings
        # Cache tokens cost ~10% (Anthropic) or ~50% (OpenAI) vs normal
        # Estimate savings as: (cache_tokens * normal_rate) - (cache_tokens * discounted_rate)
        estimated_cache_savings = Decimal('0')
        for model_data in models_list:
            if model_data['cache_read_tokens'] > 0:
                # Calculate what these tokens would have cost at full price
                full_price_cost = calculate_token_cost(
                    model_data['cache_read_tokens'],
                    0,
                    model_data['model']
                )
                
                # Calculate actual discounted cost
                model_lower = model_data['model'].lower()
                if any(provider in model_lower for provider in ['anthropic', 'claude', 'sonnet']):
                    cache_discount = Decimal('0.1')
                elif any(provider in model_lower for provider in ['gpt', 'openai', 'gpt-4o']):
                    cache_discount = Decimal('0.5')
                else:
                    cache_discount = Decimal('0.5')
                
                discounted_cost = full_price_cost * cache_discount
                savings = full_price_cost - discounted_cost
                estimated_cache_savings += savings
        
        result = {
            'thread_id': thread_id,
            'total_prompt_tokens': total_prompt_tokens,
            'total_completion_tokens': total_completion_tokens,
            'total_cache_read_tokens': total_cache_read_tokens,
            'total_cache_creation_tokens': total_cache_creation_tokens,
            'estimated_cost_dollars': float(total_cost),
            'models': models_list,
            'total_llm_calls': sum(m['call_count'] for m in models_list),
            # Enhanced cache metrics
            'fresh_input_tokens': fresh_input_tokens,
            'cache_hit_rate': float(cache_hit_rate),
            'estimated_cache_savings': float(estimated_cache_savings),
            # Agent component breakdown
            'token_breakdown_by_component': component_breakdown,
            'component_percentages': {k: float(v) for k, v in component_percentages.items()}
        }
        
        logger.info(f"Final result: {len(result.get('models', []))} models, total_llm_calls={result.get('total_llm_calls', 0)}")
        logger.info(f"Cache metrics: hit_rate={cache_hit_rate:.1f}%, savings=${estimated_cache_savings:.6f}")
        
        return result
        
    except Exception as e:
        logger.error(f"Error aggregating token usage for thread {thread_id}: {str(e)}", exc_info=True)
        raise


async def _analyze_thread_messages(messages: List[Dict[str, Any]], thread_id: str) -> Dict[str, int]:
    """
    Analyze thread messages to categorize token usage by component.
    
    Args:
        messages: List of thread messages from database
        thread_id: Thread ID for logging
        
    Returns:
        Dictionary with token counts by component
    """
    breakdown = {
        'system_prompt': 0,
        'tools': 0,
        'conversation_history': 0,
        'workspace_context': 0,
        'search_results': 0,
        'user_input': 0
    }
    
    try:
        # Categorize messages by type and content
        user_messages = []
        assistant_messages = []
        
        for msg in messages:
            msg_type = msg.get('type', '')
            content = msg.get('content', {})
            
            if msg_type == 'user':
                user_messages.append(msg)
            elif msg_type == 'assistant':
                assistant_messages.append(msg)
        
        logger.info(f"Thread {thread_id}: {len(user_messages)} user messages, {len(assistant_messages)} assistant messages")
        
        # Analyze user messages
        for idx, msg in enumerate(user_messages):
            content = msg.get('content', {})
            
            # Check if this is a tool execution result
            if isinstance(content, dict) and 'tool_execution' in content:
                tool_exec = content['tool_execution']
                function_name = tool_exec.get('function_name', '')
                result_content = str(tool_exec.get('result', ''))
                
                tokens = token_counter(model="gpt-4", text=result_content)
                
                # Categorize by function name
                if function_name in ['web_search', 'scrape_webpage', 'search_web']:
                    breakdown['search_results'] += tokens
                    logger.debug(f"Tool result ({function_name}): {tokens} tokens → search_results")
                else:
                    # read_file, list_dir, grep_search, execute_command, etc.
                    breakdown['workspace_context'] += tokens
                    logger.debug(f"Tool result ({function_name}): {tokens} tokens → workspace_context")
            
            # Regular user message
            elif isinstance(content, dict) and 'role' in content:
                text = content.get('content', '')
                tokens = token_counter(model="gpt-4", text=str(text))
                
                # Last user message is likely the actual user input
                if idx == len(user_messages) - 1:
                    breakdown['user_input'] += tokens
                    logger.debug(f"Last user message: {tokens} tokens → user_input")
                else:
                    # Historical user messages
                    breakdown['conversation_history'] += tokens
                    logger.debug(f"Historical user message: {tokens} tokens → conversation_history")
            
            # String content (older format)
            elif isinstance(content, str):
                tokens = token_counter(model="gpt-4", text=content)
                if idx == len(user_messages) - 1:
                    breakdown['user_input'] += tokens
                else:
                    breakdown['conversation_history'] += tokens
        
        # Analyze assistant messages (all are conversation history)
        for msg in assistant_messages:
            content = msg.get('content', {})
            
            if isinstance(content, dict) and 'content' in content:
                text = content.get('content', '')
                tokens = token_counter(model="gpt-4", text=str(text))
                breakdown['conversation_history'] += tokens
                logger.debug(f"Assistant message: {tokens} tokens → conversation_history")
            elif isinstance(content, str):
                tokens = token_counter(model="gpt-4", text=content)
                breakdown['conversation_history'] += tokens
        
        # System prompt estimation (not stored in messages, but part of every call)
        # Rough estimate based on typical system prompts
        breakdown['system_prompt'] = 2000  # Placeholder estimate
        
        # Tool definitions estimation
        breakdown['tools'] = 1500  # Placeholder estimate for tool schemas
        
        logger.info(f"✅ Thread analysis complete: {breakdown}")
        return breakdown
        
    except Exception as e:
        logger.error(f"Error analyzing thread messages: {e}", exc_info=True)
        return breakdown
