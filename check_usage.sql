-- Check llm_response_end messages for token usage data

-- 1. Count total llm_response_end messages
SELECT 
    COUNT(*) as total_llm_response_end_messages
FROM messages 
WHERE type = 'llm_response_end';

-- 2. Check recent messages for usage data
SELECT 
    message_id,
    thread_id,
    created_at,
    content->>'model' as model,
    content->'usage'->>'prompt_tokens' as prompt_tokens,
    content->'usage'->>'completion_tokens' as completion_tokens,
    content->'usage'->>'cache_read_input_tokens' as cache_read_tokens,
    CASE 
        WHEN content->'usage' IS NULL THEN '❌ NO USAGE'
        WHEN (content->'usage'->>'prompt_tokens')::int = 0 
         AND (content->'usage'->>'completion_tokens')::int = 0 THEN '⚠️ ZERO TOKENS'
        ELSE '✅ VALID'
    END as status
FROM messages 
WHERE type = 'llm_response_end'
ORDER BY created_at DESC
LIMIT 20;

-- 3. Summary statistics
SELECT 
    COUNT(*) as total_messages,
    COUNT(CASE WHEN content->'usage' IS NOT NULL THEN 1 END) as messages_with_usage,
    COUNT(CASE WHEN content->'usage' IS NULL THEN 1 END) as messages_without_usage,
    COUNT(CASE 
        WHEN (content->'usage'->>'prompt_tokens')::int > 0 
          OR (content->'usage'->>'completion_tokens')::int > 0 
        THEN 1 
    END) as messages_with_valid_tokens,
    COUNT(CASE 
        WHEN (content->'usage'->>'prompt_tokens')::int = 0 
         AND (content->'usage'->>'completion_tokens')::int = 0 
        THEN 1 
    END) as messages_with_zero_tokens
FROM messages 
WHERE type = 'llm_response_end';

-- 4. Example of a complete message with usage
SELECT 
    content
FROM messages 
WHERE type = 'llm_response_end'
  AND content->'usage' IS NOT NULL
  AND (content->'usage'->>'prompt_tokens')::int > 0
ORDER BY created_at DESC
LIMIT 1;
