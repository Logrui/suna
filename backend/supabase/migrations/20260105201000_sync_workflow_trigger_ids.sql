-- Sync agent_workflows.trigger_id from agent_triggers.workflow_id
-- This migration populates the trigger_id column on agent_workflows
-- based on triggers that have a workflow_id pointing to that workflow.

BEGIN;

-- Update agent_workflows.trigger_id where agent_triggers has a workflow_id reference
-- If a trigger has workflow_id pointing to a workflow, set that workflow's trigger_id to this trigger
UPDATE agent_workflows aw
SET trigger_id = at.trigger_id
FROM agent_triggers at
WHERE at.workflow_id = aw.id
  AND aw.trigger_id IS NULL;  -- Only update if not already set

-- Also handle the case where trigger info is embedded in steps JSON
-- Extract trigger_id from steps[0].config.trigger_id if it exists
UPDATE agent_workflows aw
SET trigger_id = (
    SELECT (steps->0->'config'->>'trigger_id')::uuid
    FROM agent_workflows aw2
    WHERE aw2.id = aw.id
      AND aw2.steps IS NOT NULL
      AND jsonb_array_length(aw2.steps) > 0
      AND aw2.steps->0->'config'->>'trigger_id' IS NOT NULL
)
WHERE aw.trigger_id IS NULL
  AND aw.steps IS NOT NULL
  AND jsonb_array_length(aw.steps) > 0
  AND aw.steps->0->'config'->>'trigger_id' IS NOT NULL;

-- Create index on agent_triggers.workflow_id if not exists for faster lookups
CREATE INDEX IF NOT EXISTS idx_agent_triggers_workflow_id ON agent_triggers(workflow_id);

-- Add a comment documenting the relationship
COMMENT ON COLUMN agent_workflows.trigger_id IS 'The trigger that activates this workflow. Synced from agent_triggers.workflow_id or steps JSON.';
COMMENT ON COLUMN agent_triggers.workflow_id IS 'The workflow this trigger executes when activated. Bidirectional with agent_workflows.trigger_id.';

COMMIT;
