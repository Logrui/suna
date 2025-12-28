-- Relax workflow mode constraints to allow seamless switching between modes
-- without data loss or requiring specific fields to be populated.
--
-- Rationale:
-- - Users should be able to switch between simple/advanced/advanced-legacy modes freely
-- - Data (steps, graph_definition, compiled_logic) should be preserved when switching
-- - The strict NOT NULL requirements were causing 500 errors when switching modes
-- - The "advanced" mode is now for Langflow iframe (suna-advanced-workflows) which manages its own data

BEGIN;

-- Drop both constraints that enforce strict mode-data relationships
ALTER TABLE public.agent_workflows DROP CONSTRAINT IF EXISTS check_advanced_workflow_data;
ALTER TABLE public.agent_workflows DROP CONSTRAINT IF EXISTS check_mode_data_consistency;

-- Create relaxed constraints that only validate the mode value itself
-- No requirements on which columns must be NULL or NOT NULL for each mode
-- This allows data to persist when switching modes

ALTER TABLE public.agent_workflows ADD CONSTRAINT check_workflow_mode_valid CHECK (
    mode IN ('simple'::workflow_mode, 'advanced'::workflow_mode, 'advanced-legacy'::workflow_mode)
);

COMMENT ON CONSTRAINT check_workflow_mode_valid ON public.agent_workflows IS 
    'Ensures mode is a valid workflow_mode enum value. No data field requirements enforced to allow seamless mode switching.';

COMMIT;
