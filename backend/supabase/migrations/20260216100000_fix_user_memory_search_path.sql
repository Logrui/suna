-- Fix: search_memories_by_similarity missing SET search_path = public, extensions
-- The <=> (cosine distance) operator lives in the extensions schema where pgvector
-- is installed. Without search_path including extensions, PostgreSQL cannot resolve
-- the operator, producing:
--   ERROR: operator does not exist: extensions.vector <=> extensions.vector
--
-- The project memories function (search_project_memories_by_similarity) already had
-- the correct search_path; this aligns the user memories function to match.

CREATE OR REPLACE FUNCTION search_memories_by_similarity(
    p_account_id UUID,
    p_query_embedding vector(1536),
    p_limit INTEGER DEFAULT 10,
    p_similarity_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
    memory_id UUID,
    content TEXT,
    memory_type memory_type,
    confidence_score FLOAT,
    similarity FLOAT,
    metadata JSONB,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        um.memory_id,
        um.content,
        um.memory_type,
        um.confidence_score,
        1 - (um.embedding <=> p_query_embedding) AS similarity,
        um.metadata,
        um.created_at
    FROM user_memories um
    WHERE um.account_id = p_account_id
        AND um.embedding IS NOT NULL
        AND (1 - (um.embedding <=> p_query_embedding)) >= p_similarity_threshold
    ORDER BY um.embedding <=> p_query_embedding
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql
SET search_path = public, extensions;

-- Also fix get_memory_stats for consistency (no vector ops but good hygiene)
CREATE OR REPLACE FUNCTION get_memory_stats(p_account_id UUID)
RETURNS TABLE (
    total_memories BIGINT,
    memories_by_type JSONB,
    oldest_memory TIMESTAMPTZ,
    newest_memory TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT,
        jsonb_object_agg(memory_type, count) AS memories_by_type,
        MIN(created_at),
        MAX(created_at)
    FROM (
        SELECT
            um.memory_type,
            COUNT(*) as count,
            um.created_at
        FROM user_memories um
        WHERE um.account_id = p_account_id
        GROUP BY um.memory_type, um.created_at
    ) subquery;
END;
$$ LANGUAGE plpgsql
SET search_path = public, extensions;
