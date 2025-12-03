-- Migration: 20251127100000_add_advanced_workflows.sql
-- Description: Extend agent_workflows table to support advanced visual workflow mode

-- 1. Create workflow mode enum
-- Check if type exists first to be idempotent
DO $$ BEGIN
    CREATE TYPE workflow_mode AS ENUM ('simple', 'advanced');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Extend agent_workflows table
ALTER TABLE agent_workflows
ADD COLUMN IF NOT EXISTS mode workflow_mode DEFAULT 'simple' NOT NULL,
ADD COLUMN IF NOT EXISTS graph_definition JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS compiled_logic JSONB DEFAULT NULL;

-- 3. Add check constraints
-- Drop if exists to allow updates
ALTER TABLE agent_workflows DROP CONSTRAINT IF EXISTS check_advanced_workflow_data;
ALTER TABLE agent_workflows
ADD CONSTRAINT check_advanced_workflow_data
CHECK (
  (mode = 'simple') OR
  (mode = 'advanced' AND graph_definition IS NOT NULL AND compiled_logic IS NOT NULL)
);

ALTER TABLE agent_workflows DROP CONSTRAINT IF EXISTS check_mode_data_consistency;
ALTER TABLE agent_workflows
ADD CONSTRAINT check_mode_data_consistency
CHECK (
  (mode = 'simple' AND steps IS NOT NULL) OR
  (mode = 'advanced' AND graph_definition IS NOT NULL)
);

-- 4. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_workflows_mode ON agent_workflows(mode);
CREATE INDEX IF NOT EXISTS idx_agent_workflows_agent_mode ON agent_workflows(agent_id, mode);
CREATE INDEX IF NOT EXISTS idx_agent_workflows_status_mode ON agent_workflows(status, mode);

-- 5. Add comments for documentation
COMMENT ON COLUMN agent_workflows.mode IS 'Workflow editor mode: simple (list-based) or advanced (visual graph)';
COMMENT ON COLUMN agent_workflows.graph_definition IS 'React Flow visual state (nodes, edges, viewport) - used only by advanced mode';
COMMENT ON COLUMN agent_workflows.compiled_logic IS 'Optimized execution graph (adjacency list) - used only by advanced mode';
