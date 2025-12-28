BEGIN;

-- Add 'advanced-legacy' value to the workflow_mode enum
-- This allows workflows to be saved with the legacy React Flow editor mode
ALTER TYPE public.workflow_mode ADD VALUE IF NOT EXISTS 'advanced-legacy';

COMMIT;

-- Note: CHECK constraints need to be updated in a separate transaction
-- because the new enum value won't be visible until the ALTER TYPE commits

BEGIN;

-- Drop existing constraints that don't include 'advanced-legacy'
ALTER TABLE public.agent_workflows DROP CONSTRAINT IF EXISTS check_advanced_workflow_data;
ALTER TABLE public.agent_workflows DROP CONSTRAINT IF EXISTS check_mode_data_consistency;

-- Re-create constraints to include 'advanced-legacy' mode
-- advanced-legacy workflows are treated the same as advanced workflows
ALTER TABLE public.agent_workflows ADD CONSTRAINT check_advanced_workflow_data CHECK (
    (mode = 'simple'::workflow_mode)
    OR (
        (mode = 'advanced'::workflow_mode)
        AND (graph_definition IS NOT NULL)
        AND (compiled_logic IS NOT NULL)
    )
    OR (
        (mode = 'advanced-legacy'::workflow_mode)
        -- advanced-legacy may have graph_definition and compiled_logic OR steps
        -- allowing more flexibility during transition
    )
);

ALTER TABLE public.agent_workflows ADD CONSTRAINT check_mode_data_consistency CHECK (
    (
        (mode = 'simple'::workflow_mode)
        AND (steps IS NOT NULL)
    )
    OR (
        (mode = 'advanced'::workflow_mode)
        AND (graph_definition IS NOT NULL)
    )
    OR (
        (mode = 'advanced-legacy'::workflow_mode)
        -- advanced-legacy can have steps, graph_definition, or both during transition
    )
);

COMMENT ON TYPE public.workflow_mode IS 'Workflow editor mode: simple (step-by-step), advanced (Langflow), or advanced-legacy (React Flow)';

COMMIT;
