-- Project-based memories: per-project knowledge store for AI context
-- Modeled after user_memories, adding project_id scoping

-- Reuses existing memory_type enum from 20251211102440_user_memories.sql

CREATE TABLE user_project_memories (
    memory_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL,
    project_id UUID NOT NULL,
    content TEXT NOT NULL,
    memory_type memory_type NOT NULL DEFAULT 'fact',
    embedding vector(1536),
    source_thread_id UUID,
    confidence_score FLOAT DEFAULT 1.0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_project_memory_account FOREIGN KEY (account_id)
        REFERENCES basejump.accounts(id) ON DELETE CASCADE,
    CONSTRAINT fk_project_memory_project FOREIGN KEY (project_id)
        REFERENCES projects(project_id) ON DELETE CASCADE,
    CONSTRAINT fk_project_memory_source_thread FOREIGN KEY (source_thread_id)
        REFERENCES threads(thread_id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX idx_project_memories_account_id ON user_project_memories(account_id);
CREATE INDEX idx_project_memories_project_id ON user_project_memories(project_id);
CREATE INDEX idx_project_memories_memory_type ON user_project_memories(memory_type);
CREATE INDEX idx_project_memories_created_at ON user_project_memories(created_at DESC);
CREATE INDEX idx_project_memories_source_thread ON user_project_memories(source_thread_id)
    WHERE source_thread_id IS NOT NULL;

-- Vector similarity index for semantic search
CREATE INDEX idx_project_memories_embedding_vector ON user_project_memories
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- Auto-update updated_at (reuses existing trigger function from agentpress_schema)
CREATE TRIGGER trigger_update_project_memories_updated_at
    BEFORE UPDATE ON user_project_memories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- RPC: Search project memories by vector similarity
-- =============================================================================
CREATE OR REPLACE FUNCTION search_project_memories_by_similarity(
    p_account_id UUID,
    p_project_id UUID,
    p_query_embedding vector(1536),
    p_limit INTEGER DEFAULT 10,
    p_similarity_threshold FLOAT DEFAULT 0.1
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
        upm.memory_id,
        upm.content,
        upm.memory_type,
        upm.confidence_score,
        1 - (upm.embedding <=> p_query_embedding) AS similarity,
        upm.metadata,
        upm.created_at
    FROM user_project_memories upm
    WHERE upm.account_id = p_account_id
        AND upm.project_id = p_project_id
        AND upm.embedding IS NOT NULL
        AND (1 - (upm.embedding <=> p_query_embedding)) >= p_similarity_threshold
    ORDER BY upm.embedding <=> p_query_embedding
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- RPC: Get project memory statistics
-- =============================================================================
CREATE OR REPLACE FUNCTION get_project_memory_stats(
    p_account_id UUID,
    p_project_id UUID
)
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
        COALESCE(
            jsonb_object_agg(sub.mt, sub.cnt),
            '{}'::JSONB
        ) AS memories_by_type,
        MIN(sub.ca),
        MAX(sub.ca)
    FROM (
        SELECT
            upm.memory_type AS mt,
            COUNT(*) AS cnt,
            upm.created_at AS ca
        FROM user_project_memories upm
        WHERE upm.account_id = p_account_id
            AND upm.project_id = p_project_id
        GROUP BY upm.memory_type, upm.created_at
    ) sub;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Row Level Security
-- =============================================================================
ALTER TABLE user_project_memories ENABLE ROW LEVEL SECURITY;

-- SELECT: user owns the account (directly or via membership)
CREATE POLICY "Users can view their own project memories"
    ON user_project_memories FOR SELECT
    TO authenticated
    USING (
        account_id IN (
            SELECT id FROM basejump.accounts
            WHERE primary_owner_user_id = auth.uid()
            OR id IN (SELECT account_id FROM basejump.account_user WHERE user_id = auth.uid())
        )
    );

-- INSERT
CREATE POLICY "Users can insert their own project memories"
    ON user_project_memories FOR INSERT
    TO authenticated
    WITH CHECK (
        account_id IN (
            SELECT id FROM basejump.accounts
            WHERE primary_owner_user_id = auth.uid()
            OR id IN (SELECT account_id FROM basejump.account_user WHERE user_id = auth.uid())
        )
    );

-- UPDATE
CREATE POLICY "Users can update their own project memories"
    ON user_project_memories FOR UPDATE
    TO authenticated
    USING (
        account_id IN (
            SELECT id FROM basejump.accounts
            WHERE primary_owner_user_id = auth.uid()
            OR id IN (SELECT account_id FROM basejump.account_user WHERE user_id = auth.uid())
        )
    );

-- DELETE
CREATE POLICY "Users can delete their own project memories"
    ON user_project_memories FOR DELETE
    TO authenticated
    USING (
        account_id IN (
            SELECT id FROM basejump.accounts
            WHERE primary_owner_user_id = auth.uid()
            OR id IN (SELECT account_id FROM basejump.account_user WHERE user_id = auth.uid())
        )
    );

-- Service role: full access
CREATE POLICY "Service role has full access to project memories"
    ON user_project_memories FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- =============================================================================
-- Grants
-- =============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON user_project_memories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_project_memories TO service_role;
GRANT EXECUTE ON FUNCTION search_project_memories_by_similarity TO authenticated;
GRANT EXECUTE ON FUNCTION search_project_memories_by_similarity TO service_role;
GRANT EXECUTE ON FUNCTION get_project_memory_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_project_memory_stats TO service_role;

-- =============================================================================
-- Comments
-- =============================================================================
COMMENT ON TABLE user_project_memories IS 'Project-scoped memories for per-project AI context and knowledge persistence';
COMMENT ON FUNCTION search_project_memories_by_similarity IS 'Semantic search for project memories using vector cosine similarity';
COMMENT ON FUNCTION get_project_memory_stats IS 'Get statistics about project-scoped memories';
