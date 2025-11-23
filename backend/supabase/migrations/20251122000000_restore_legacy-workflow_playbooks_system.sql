
-- ==================================================================
-- MIGRATION SOURCE: 20250417000000_workflow_system.sql
-- ==================================================================

-- Workflow System Migration
-- This migration creates all necessary tables for the agent workflow system

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum types for workflow system
DO $$ BEGIN
    CREATE TYPE workflow_status AS ENUM ('draft', 'active', 'paused', 'disabled', 'archived');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE execution_status AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled', 'timeout');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE trigger_type AS ENUM ('webhook', 'schedule', 'event', 'polling', 'manual', 'workflow');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE node_type AS ENUM ('trigger', 'agent', 'tool', 'condition', 'loop', 'parallel', 'webhook', 'transform', 'delay', 'output');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE connection_type AS ENUM ('data', 'tool', 'processed_data', 'action', 'condition');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Workflows table
CREATE TABLE IF NOT EXISTS workflows (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    project_id UUID NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES basejump.accounts(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    status workflow_status DEFAULT 'draft',
    version INTEGER DEFAULT 1,
    definition JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes
    CONSTRAINT workflows_name_project_unique UNIQUE (name, project_id)
);

-- Create indexes for workflows
CREATE INDEX IF NOT EXISTS idx_workflows_project_id ON workflows(project_id);
CREATE INDEX IF NOT EXISTS idx_workflows_account_id ON workflows(account_id);
CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
CREATE INDEX IF NOT EXISTS idx_workflows_created_by ON workflows(created_by);

-- Workflow executions table
CREATE TABLE IF NOT EXISTS workflow_executions (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    workflow_version INTEGER NOT NULL,
    workflow_name VARCHAR(255) NOT NULL,
    execution_context JSONB NOT NULL,
    project_id UUID NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES basejump.accounts(id) ON DELETE CASCADE,
    triggered_by VARCHAR(255),
    scheduled_for TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_seconds FLOAT,
    status execution_status NOT NULL DEFAULT 'pending',
    result JSONB,
    error TEXT,
    nodes_executed INTEGER DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,
    cost DECIMAL(10, 4) DEFAULT 0.0,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for workflow_executions
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_project_id ON workflow_executions(project_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_account_id ON workflow_executions(account_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_started_at ON workflow_executions(started_at DESC);

-- Triggers table
CREATE TABLE IF NOT EXISTS triggers (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    type trigger_type NOT NULL,
    config JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for triggers
CREATE INDEX IF NOT EXISTS idx_triggers_workflow_id ON triggers(workflow_id);
CREATE INDEX IF NOT EXISTS idx_triggers_type ON triggers(type);
CREATE INDEX IF NOT EXISTS idx_triggers_is_active ON triggers(is_active);

-- Webhook registrations table
CREATE TABLE IF NOT EXISTS webhook_registrations (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    trigger_id VARCHAR(255) NOT NULL,
    path VARCHAR(255) UNIQUE NOT NULL,
    secret VARCHAR(255) NOT NULL,
    method VARCHAR(10) DEFAULT 'POST',
    headers_validation JSONB,
    body_schema JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_triggered TIMESTAMP WITH TIME ZONE,
    trigger_count INTEGER DEFAULT 0
);

-- Create indexes for webhook_registrations
CREATE INDEX IF NOT EXISTS idx_webhook_registrations_workflow_id ON webhook_registrations(workflow_id);
CREATE INDEX IF NOT EXISTS idx_webhook_registrations_path ON webhook_registrations(path);
CREATE INDEX IF NOT EXISTS idx_webhook_registrations_is_active ON webhook_registrations(is_active);

-- Scheduled jobs table
CREATE TABLE IF NOT EXISTS scheduled_jobs (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    trigger_id VARCHAR(255) NOT NULL,
    cron_expression VARCHAR(255) NOT NULL,
    timezone VARCHAR(50) DEFAULT 'UTC',
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    last_run TIMESTAMP WITH TIME ZONE,
    next_run TIMESTAMP WITH TIME ZONE,
    run_count INTEGER DEFAULT 0,
    consecutive_failures INTEGER DEFAULT 0,
    max_consecutive_failures INTEGER DEFAULT 5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for scheduled_jobs
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_workflow_id ON scheduled_jobs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_is_active ON scheduled_jobs(is_active);
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_next_run ON scheduled_jobs(next_run);

-- Workflow templates table
CREATE TABLE IF NOT EXISTS workflow_templates (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    workflow_definition JSONB NOT NULL,
    required_variables JSONB,
    required_tools TEXT[],
    required_models TEXT[],
    author VARCHAR(255) NOT NULL,
    version VARCHAR(50) NOT NULL,
    tags TEXT[],
    preview_image TEXT,
    usage_count INTEGER DEFAULT 0,
    rating DECIMAL(3, 2) DEFAULT 0.0,
    is_featured BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for workflow_templates
CREATE INDEX IF NOT EXISTS idx_workflow_templates_category ON workflow_templates(category);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_is_featured ON workflow_templates(is_featured);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_rating ON workflow_templates(rating DESC);

-- Workflow execution logs table (for detailed logging)
CREATE TABLE IF NOT EXISTS workflow_execution_logs (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    execution_id UUID NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
    node_id VARCHAR(255) NOT NULL,
    node_name VARCHAR(255),
    node_type node_type,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    status execution_status NOT NULL,
    input_data JSONB,
    output_data JSONB,
    error TEXT,
    tokens_used INTEGER DEFAULT 0,
    cost DECIMAL(10, 4) DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for workflow_execution_logs
CREATE INDEX IF NOT EXISTS idx_workflow_execution_logs_execution_id ON workflow_execution_logs(execution_id);
CREATE INDEX IF NOT EXISTS idx_workflow_execution_logs_node_id ON workflow_execution_logs(node_id);
CREATE INDEX IF NOT EXISTS idx_workflow_execution_logs_status ON workflow_execution_logs(status);

-- Workflow variables table (for storing workflow-specific variables/secrets)
CREATE TABLE IF NOT EXISTS workflow_variables (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    value TEXT,
    is_secret BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT workflow_variables_unique UNIQUE (workflow_id, name)
);

-- Create indexes for workflow_variables
CREATE INDEX IF NOT EXISTS idx_workflow_variables_workflow_id ON workflow_variables(workflow_id);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_variables ENABLE ROW LEVEL SECURITY;

-- Workflows policies (using basejump pattern)
DO $$ BEGIN
    CREATE POLICY "Users can view workflows in their accounts" ON workflows
        FOR SELECT USING (
            basejump.has_role_on_account(account_id) = true OR
            EXISTS (
                SELECT 1 FROM projects
                WHERE projects.project_id = workflows.project_id
                AND projects.is_public = TRUE
            )
        );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
    
DO $$ BEGIN
    CREATE POLICY "Users can create workflows in their accounts" ON workflows
        FOR INSERT WITH CHECK (
            basejump.has_role_on_account(account_id) = true
        );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can update workflows in their accounts" ON workflows
        FOR UPDATE USING (
            basejump.has_role_on_account(account_id) = true
        );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can delete workflows in their accounts" ON workflows
        FOR DELETE USING (
            basejump.has_role_on_account(account_id) = true
        );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Workflow executions policies
DO $$ BEGIN
    CREATE POLICY "Users can view executions in their accounts" ON workflow_executions
        FOR SELECT USING (
            basejump.has_role_on_account(account_id) = true OR
            EXISTS (
                SELECT 1 FROM workflows w
                JOIN projects p ON w.project_id = p.project_id
                WHERE w.id = workflow_executions.workflow_id
                AND p.is_public = TRUE
            )
        );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Service role can insert executions" ON workflow_executions
        FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Service role can update executions" ON workflow_executions
        FOR UPDATE USING (auth.jwt() ->> 'role' = 'service_role');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Triggers policies
DO $$ BEGIN
    CREATE POLICY "Users can view triggers in their workflows" ON triggers
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM workflows 
                WHERE workflows.id = triggers.workflow_id
                AND basejump.has_role_on_account(workflows.account_id) = true
            )
        );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Service role full access to webhook_registrations" ON webhook_registrations
        FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Service role full access to scheduled_jobs" ON scheduled_jobs
        FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Public can view workflow templates" ON workflow_templates
        FOR SELECT USING (true);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Service role can manage workflow templates" ON workflow_templates
        FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can view execution logs in their accounts" ON workflow_execution_logs
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM workflow_executions 
                WHERE workflow_executions.id = workflow_execution_logs.execution_id
                AND basejump.has_role_on_account(workflow_executions.account_id) = true
            )
        );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Service role can insert execution logs" ON workflow_execution_logs
        FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can manage variables for their workflows" ON workflow_variables
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM workflows 
                WHERE workflows.id = workflow_variables.workflow_id
                AND basejump.has_role_on_account(workflows.account_id) = true
            )
        );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Functions for automatic timestamp updates
-- Note: update_updated_at_column function already exists from previous migrations

-- Create triggers for updated_at
DO $$ BEGIN
    CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflows
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TRIGGER update_triggers_updated_at BEFORE UPDATE ON triggers
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TRIGGER update_scheduled_jobs_updated_at BEFORE UPDATE ON scheduled_jobs
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TRIGGER update_workflow_templates_updated_at BEFORE UPDATE ON workflow_templates
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TRIGGER update_workflow_variables_updated_at BEFORE UPDATE ON workflow_variables
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Function to clean up old execution logs (can be called periodically)
CREATE OR REPLACE FUNCTION cleanup_old_execution_logs(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM workflow_execution_logs
    WHERE created_at < NOW() - INTERVAL '1 day' * days_to_keep;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get workflow execution statistics
CREATE OR REPLACE FUNCTION get_workflow_statistics(p_workflow_id UUID)
RETURNS TABLE (
    total_executions BIGINT,
    successful_executions BIGINT,
    failed_executions BIGINT,
    average_duration_seconds FLOAT,
    total_cost DECIMAL,
    total_tokens BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_executions,
        COUNT(*) FILTER (WHERE status = 'completed')::BIGINT as successful_executions,
        COUNT(*) FILTER (WHERE status = 'failed')::BIGINT as failed_executions,
        AVG(duration_seconds)::FLOAT as average_duration_seconds,
        SUM(cost)::DECIMAL as total_cost,
        SUM(tokens_used)::BIGINT as total_tokens
    FROM workflow_executions
    WHERE workflow_id = p_workflow_id;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions to roles
GRANT ALL PRIVILEGES ON TABLE workflows TO authenticated, service_role;
GRANT ALL PRIVILEGES ON TABLE workflow_executions TO authenticated, service_role;
GRANT ALL PRIVILEGES ON TABLE triggers TO authenticated, service_role;
GRANT ALL PRIVILEGES ON TABLE webhook_registrations TO service_role;
GRANT ALL PRIVILEGES ON TABLE scheduled_jobs TO service_role;
GRANT SELECT ON TABLE workflow_templates TO authenticated, anon;
GRANT ALL PRIVILEGES ON TABLE workflow_templates TO service_role;
GRANT SELECT ON TABLE workflow_execution_logs TO authenticated;
GRANT ALL PRIVILEGES ON TABLE workflow_execution_logs TO service_role;
GRANT ALL PRIVILEGES ON TABLE workflow_variables TO authenticated, service_role;

-- Add comments for documentation
COMMENT ON TABLE workflows IS 'Stores workflow definitions and configurations';
COMMENT ON TABLE workflow_executions IS 'Records of workflow execution instances';
COMMENT ON TABLE triggers IS 'Workflow trigger configurations';
COMMENT ON TABLE webhook_registrations IS 'Webhook endpoints for workflow triggers';
COMMENT ON TABLE scheduled_jobs IS 'Scheduled workflow executions';
COMMENT ON TABLE workflow_templates IS 'Pre-built workflow templates';
COMMENT ON TABLE workflow_execution_logs IS 'Detailed logs for workflow node executions';
COMMENT ON TABLE workflow_variables IS 'Workflow-specific variables and secrets'; 


-- ==================================================================
-- MIGRATION SOURCE: 20250418000000_workflow_flows.sql
-- ==================================================================

-- Add workflow_flows table for storing visual flow representations
-- This table stores the visual flow data (nodes and edges) separately from the workflow definition

CREATE TABLE IF NOT EXISTS workflow_flows (
    workflow_id UUID PRIMARY KEY REFERENCES workflows(id) ON DELETE CASCADE,
    nodes JSONB NOT NULL DEFAULT '[]',
    edges JSONB NOT NULL DEFAULT '[]',
    metadata JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE workflow_flows ENABLE ROW LEVEL SECURITY;

-- RLS policies
DO $$ BEGIN
    CREATE POLICY "Users can view flows for their workflows" ON workflow_flows
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM workflows 
            WHERE workflows.id = workflow_flows.workflow_id
            AND basejump.has_role_on_account(workflows.account_id) = true
        )
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can manage flows for their workflows" ON workflow_flows
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM workflows 
                WHERE workflows.id = workflow_flows.workflow_id
                AND basejump.has_role_on_account(workflows.account_id) = true
            )
        );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create trigger for updated_at
DO $$ BEGIN
    CREATE TRIGGER update_workflow_flows_updated_at BEFORE UPDATE ON workflow_flows
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Grant permissions
GRANT ALL PRIVILEGES ON TABLE workflow_flows TO authenticated, service_role;

-- Add comment
COMMENT ON TABLE workflow_flows IS 'Stores visual flow representations (nodes and edges) for workflows'; 


-- ==================================================================
-- MIGRATION SOURCE: 20250705155923_rollback_workflows.sql
-- ==================================================================

-- Rollback script for old workflow system
DROP TABLE IF EXISTS workflow_flows CASCADE;

-- Drop workflow execution logs (depends on workflow_executions)
DROP TABLE IF EXISTS workflow_execution_logs CASCADE;

-- Drop workflow variables (depends on workflows)
DROP TABLE IF EXISTS workflow_variables CASCADE;

-- Drop webhook registrations (depends on workflows)
DROP TABLE IF EXISTS webhook_registrations CASCADE;

-- Drop scheduled jobs (depends on workflows)
DROP TABLE IF EXISTS scheduled_jobs CASCADE;

-- Drop triggers (depends on workflows)
DROP TABLE IF EXISTS triggers CASCADE;

-- Drop workflow executions (depends on workflows)
DROP TABLE IF EXISTS workflow_executions CASCADE;

-- Drop workflow templates (standalone table)
DROP TABLE IF EXISTS workflow_templates CASCADE;

-- Drop workflows table (main table)
DROP TABLE IF EXISTS workflows CASCADE;

-- Drop workflow-specific functions
DROP FUNCTION IF EXISTS cleanup_old_execution_logs(INTEGER);
DROP FUNCTION IF EXISTS get_workflow_statistics(UUID);

-- Drop enum types (in reverse order of dependencies)
DROP TYPE IF EXISTS connection_type CASCADE;
DROP TYPE IF EXISTS node_type CASCADE;
DROP TYPE IF EXISTS trigger_type CASCADE;
DROP TYPE IF EXISTS execution_status CASCADE;
DROP TYPE IF EXISTS workflow_status CASCADE;


-- ==================================================================
-- MIGRATION SOURCE: 20250705161610_agent_workflows.sql
-- ==================================================================

-- Agent Workflows Migration
-- This migration creates tables for agent-specific workflows
-- Simple step-by-step task execution system

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum types for agent workflow system
DO $$ BEGIN
    CREATE TYPE agent_workflow_status AS ENUM ('draft', 'active', 'paused', 'archived');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE workflow_step_type AS ENUM ('message', 'tool_call', 'condition', 'loop', 'wait', 'input', 'output');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE workflow_execution_status AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Agent workflows table
CREATE TABLE IF NOT EXISTS agent_workflows (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status agent_workflow_status DEFAULT 'draft',
    trigger_phrase VARCHAR(255), -- Optional phrase to trigger this workflow
    is_default BOOLEAN DEFAULT FALSE, -- Whether this is the default workflow for the agent
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workflow steps table
CREATE TABLE IF NOT EXISTS workflow_steps (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES agent_workflows(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type workflow_step_type NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    conditions JSONB, -- Conditions for when this step should execute
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique order per workflow
    CONSTRAINT workflow_steps_order_unique UNIQUE (workflow_id, step_order)
);

-- Workflow executions table
CREATE TABLE IF NOT EXISTS workflow_executions (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES agent_workflows(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,
    thread_id UUID, -- Optional reference to thread if execution is part of a conversation
    triggered_by VARCHAR(255), -- What triggered this execution
    status workflow_execution_status NOT NULL DEFAULT 'pending',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_seconds FLOAT,
    input_data JSONB, -- Input data for the workflow
    output_data JSONB, -- Final output data
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workflow step executions table
CREATE TABLE IF NOT EXISTS workflow_step_executions (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    execution_id UUID NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
    step_id UUID NOT NULL REFERENCES workflow_steps(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL,
    status workflow_execution_status NOT NULL DEFAULT 'pending',
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_seconds FLOAT,
    input_data JSONB,
    output_data JSONB,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_workflows_agent_id ON agent_workflows(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_workflows_status ON agent_workflows(status);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_workflow_id ON workflow_steps(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_order ON workflow_steps(workflow_id, step_order);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_agent_id ON workflow_executions(agent_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_started_at ON workflow_executions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_step_executions_execution_id ON workflow_step_executions(execution_id);
CREATE INDEX IF NOT EXISTS idx_workflow_step_executions_step_id ON workflow_step_executions(step_id);

ALTER TABLE agent_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_step_executions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view workflows for their agents" ON agent_workflows;
DROP POLICY IF EXISTS "Users can create workflows for their agents" ON agent_workflows;
DROP POLICY IF EXISTS "Users can update workflows for their agents" ON agent_workflows;
DROP POLICY IF EXISTS "Users can delete workflows for their agents" ON agent_workflows;
DROP POLICY IF EXISTS "Users can manage steps for their workflows" ON workflow_steps;
DROP POLICY IF EXISTS "Users can view steps for their workflows" ON workflow_steps;
DROP POLICY IF EXISTS "Users can view executions for their workflows" ON workflow_executions;
DROP POLICY IF EXISTS "Service role can manage executions" ON workflow_executions;
DROP POLICY IF EXISTS "Users can view step executions for their workflows" ON workflow_step_executions;
DROP POLICY IF EXISTS "Service role can manage step executions" ON workflow_step_executions;

CREATE POLICY "Users can view workflows for their agents" ON agent_workflows
    FOR SELECT USING (
        agent_id IN (
            SELECT agent_id FROM agents 
            WHERE basejump.has_role_on_account(account_id)
        )
    );

CREATE POLICY "Users can create workflows for their agents" ON agent_workflows
    FOR INSERT WITH CHECK (
        agent_id IN (
            SELECT agent_id FROM agents 
            WHERE basejump.has_role_on_account(account_id)
        )
    );

CREATE POLICY "Users can update workflows for their agents" ON agent_workflows
    FOR UPDATE USING (
        agent_id IN (
            SELECT agent_id FROM agents 
            WHERE basejump.has_role_on_account(account_id)
        )
    );

CREATE POLICY "Users can delete workflows for their agents" ON agent_workflows
    FOR DELETE USING (
        agent_id IN (
            SELECT agent_id FROM agents 
            WHERE basejump.has_role_on_account(account_id)
        )
    );

-- Workflow steps policies
CREATE POLICY "Users can view steps for their workflows" ON workflow_steps
    FOR SELECT USING (
        workflow_id IN (
            SELECT id FROM agent_workflows 
            WHERE agent_id IN (
                SELECT agent_id FROM agents 
                WHERE basejump.has_role_on_account(account_id)
            )
        )
    );

CREATE POLICY "Users can manage steps for their workflows" ON workflow_steps
    FOR ALL USING (
        workflow_id IN (
            SELECT id FROM agent_workflows 
            WHERE agent_id IN (
                SELECT agent_id FROM agents 
                WHERE basejump.has_role_on_account(account_id)
            )
        )
    );

-- Workflow executions policies
CREATE POLICY "Users can view executions for their workflows" ON workflow_executions
    FOR SELECT USING (
        workflow_id IN (
            SELECT id FROM agent_workflows 
            WHERE agent_id IN (
                SELECT agent_id FROM agents 
                WHERE basejump.has_role_on_account(account_id)
            )
        )
    );

CREATE POLICY "Service role can manage executions" ON workflow_executions
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Workflow step executions policies
CREATE POLICY "Users can view step executions for their workflows" ON workflow_step_executions
    FOR SELECT USING (
        execution_id IN (
            SELECT id FROM workflow_executions
            WHERE workflow_id IN (
                SELECT id FROM agent_workflows 
                WHERE agent_id IN (
                    SELECT agent_id FROM agents 
                    WHERE basejump.has_role_on_account(account_id)
                )
            )
        )
    );

CREATE POLICY "Service role can manage step executions" ON workflow_step_executions
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Create function to update updated_at timestamp if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at (drop existing first to avoid conflicts)
DROP TRIGGER IF EXISTS update_agent_workflows_updated_at ON agent_workflows;
DROP TRIGGER IF EXISTS update_workflow_steps_updated_at ON workflow_steps;

CREATE TRIGGER update_agent_workflows_updated_at 
    BEFORE UPDATE ON agent_workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_steps_updated_at 
    BEFORE UPDATE ON workflow_steps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL PRIVILEGES ON TABLE agent_workflows TO authenticated, service_role;
GRANT ALL PRIVILEGES ON TABLE workflow_steps TO authenticated, service_role;
GRANT ALL PRIVILEGES ON TABLE workflow_executions TO authenticated, service_role;
GRANT ALL PRIVILEGES ON TABLE workflow_step_executions TO authenticated, service_role;

-- Add comments for documentation
COMMENT ON TABLE agent_workflows IS 'Workflows specific to individual agents for step-by-step task execution';
COMMENT ON TABLE workflow_steps IS 'Individual steps within agent workflows';
COMMENT ON TABLE workflow_executions IS 'Records of workflow execution instances';
COMMENT ON TABLE workflow_step_executions IS 'Records of individual step executions within workflows'; 


-- ==================================================================
-- MIGRATION SOURCE: 20250705164211_fix_agent_workflows.sql
-- ==================================================================

ALTER TABLE agent_workflows DROP CONSTRAINT IF EXISTS agent_workflows_agent_id_fkey;
ALTER TABLE workflow_executions DROP CONSTRAINT IF EXISTS workflow_executions_agent_id_fkey;

ALTER TABLE agent_workflows 
ADD CONSTRAINT agent_workflows_agent_id_fkey 
FOREIGN KEY (agent_id) REFERENCES agents(agent_id) ON DELETE CASCADE;

ALTER TABLE workflow_executions 
ADD CONSTRAINT workflow_executions_agent_id_fkey 
FOREIGN KEY (agent_id) REFERENCES agents(agent_id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "Users can view workflows for their agents" ON agent_workflows;
DROP POLICY IF EXISTS "Users can create workflows for their agents" ON agent_workflows;
DROP POLICY IF EXISTS "Users can update workflows for their agents" ON agent_workflows;
DROP POLICY IF EXISTS "Users can delete workflows for their agents" ON agent_workflows;
DROP POLICY IF EXISTS "Users can view steps for their workflows" ON workflow_steps;
DROP POLICY IF EXISTS "Users can manage steps for their workflows" ON workflow_steps;
DROP POLICY IF EXISTS "Users can view executions for their workflows" ON workflow_executions;
DROP POLICY IF EXISTS "Users can view step executions for their workflows" ON workflow_step_executions;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ==================================================================
-- MIGRATION SOURCE: 20250706130554_simplify_workflow_steps.sql
-- ==================================================================

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'instruction' AND enumtypid = 'workflow_step_type'::regtype) THEN
        ALTER TYPE workflow_step_type ADD VALUE 'instruction';
    END IF;
END $$; 


-- ==================================================================
-- MIGRATION SOURCE: 20250708034613_add_steps_to_workflows.sql
-- ==================================================================

BEGIN;

-- Add steps column to agent_workflows table as flexible JSON
ALTER TABLE agent_workflows ADD COLUMN IF NOT EXISTS steps JSONB DEFAULT NULL;

-- Create index for steps column (GIN index for flexible JSON queries)
CREATE INDEX IF NOT EXISTS idx_agent_workflows_steps ON agent_workflows USING gin(steps);

UPDATE agent_workflows 
SET steps = (
    SELECT COALESCE(
        jsonb_agg(
            json_build_object(
                'id', ws.id,
                'name', ws.name,
                'description', ws.description,
                'type', ws.type,
                'config', ws.config,
                'conditions', ws.conditions,
                'step_order', ws.step_order
            ) ORDER BY ws.step_order
        ), 
        NULL
    )
    FROM workflow_steps ws 
    WHERE ws.workflow_id = agent_workflows.id
)
WHERE steps IS NULL;

-- Add comment to document the flexible nature
COMMENT ON COLUMN agent_workflows.steps IS 'Flexible JSON field for storing workflow steps. Structure can evolve over time without database migrations.';

COMMIT; 


-- ==================================================================
-- MIGRATION SOURCE: 20250723093053_fix_workflow_policy_conflicts.sql
-- ==================================================================

DROP POLICY IF EXISTS "Users can view workflows for their agents" ON agent_workflows;
DROP POLICY IF EXISTS "Users can create workflows for their agents" ON agent_workflows;
DROP POLICY IF EXISTS "Users can update workflows for their agents" ON agent_workflows;
DROP POLICY IF EXISTS "Users can delete workflows for their agents" ON agent_workflows;
DROP POLICY IF EXISTS "Service role can manage workflows" ON agent_workflows;

DROP POLICY IF EXISTS "Users can view steps for their workflows" ON workflow_steps;
DROP POLICY IF EXISTS "Users can create steps for their workflows" ON workflow_steps;
DROP POLICY IF EXISTS "Users can update steps for their workflows" ON workflow_steps;
DROP POLICY IF EXISTS "Users can delete steps for their workflows" ON workflow_steps;
DROP POLICY IF EXISTS "Users can manage steps for their workflows" ON workflow_steps;
DROP POLICY IF EXISTS "Service role can manage workflow steps" ON workflow_steps;

DROP POLICY IF EXISTS "Users can view executions for their workflows" ON workflow_executions;
DROP POLICY IF EXISTS "Service role can manage executions" ON workflow_executions;
DROP POLICY IF EXISTS "Service role can manage workflow executions" ON workflow_executions;

DROP POLICY IF EXISTS "Users can view step executions for their workflows" ON workflow_step_executions;
DROP POLICY IF EXISTS "Service role can manage step executions" ON workflow_step_executions;

DROP TRIGGER IF EXISTS update_agent_workflows_updated_at ON agent_workflows;
DROP TRIGGER IF EXISTS update_workflow_steps_updated_at ON workflow_steps;


-- ==================================================================
-- MIGRATION SOURCE: 20250726180605_remove_old_workflow_sys.sql
-- ==================================================================

BEGIN;

-- Remove old workflow execution and step tables
-- These are no longer needed since steps are now stored as JSON in agent_workflows.steps
-- and executions can be tracked differently if needed

-- Drop workflow step executions first (has foreign keys to other tables)
DROP TABLE IF EXISTS workflow_step_executions CASCADE;

-- Drop workflow executions 
DROP TABLE IF EXISTS workflow_executions CASCADE;

-- Drop workflow steps
DROP TABLE IF EXISTS workflow_steps CASCADE;

-- Drop the related enum types that are no longer needed
DROP TYPE IF EXISTS workflow_step_type CASCADE;
DROP TYPE IF EXISTS workflow_execution_status CASCADE;

-- Clean up any related indexes that might still exist
DROP INDEX IF EXISTS idx_workflow_steps_workflow_id CASCADE;
DROP INDEX IF EXISTS idx_workflow_steps_order CASCADE;
DROP INDEX IF EXISTS idx_workflow_executions_workflow_id CASCADE;
DROP INDEX IF EXISTS idx_workflow_executions_agent_id CASCADE;
DROP INDEX IF EXISTS idx_workflow_executions_status CASCADE;
DROP INDEX IF EXISTS idx_workflow_executions_started_at CASCADE;
DROP INDEX IF EXISTS idx_workflow_step_executions_execution_id CASCADE;
DROP INDEX IF EXISTS idx_workflow_step_executions_step_id CASCADE;

COMMIT;


-- ==================================================================
-- MIGRATION SOURCE: 20250728193819_fix_templates.sql
-- ==================================================================

-- Safe Templates Config Structure Migration for Production
-- This migration safely updates agent_templates to use the unified config structure
-- with proper existence checks for production environments

BEGIN;

-- Function to check if column exists
CREATE OR REPLACE FUNCTION column_exists(p_table_name text, p_column_name text) 
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = p_table_name 
        AND column_name = p_column_name
    );
END;
$$ LANGUAGE plpgsql;

-- Function to check if constraint exists
CREATE OR REPLACE FUNCTION constraint_exists(p_table_name text, p_constraint_name text) 
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE table_schema = 'public' 
        AND table_name = p_table_name 
        AND constraint_name = p_constraint_name
    );
END;
$$ LANGUAGE plpgsql;

-- Backup existing templates if not already done
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'agent_templates_backup') THEN
        CREATE TABLE agent_templates_backup AS SELECT * FROM agent_templates;
    END IF;
END
$$;

-- Add config column if it doesn't exist
DO $$
BEGIN
    IF NOT column_exists('agent_templates', 'config') THEN
        ALTER TABLE agent_templates ADD COLUMN config JSONB DEFAULT '{}'::jsonb;
    END IF;
END
$$;

-- Migrate data from old structure to new config structure (only if old columns exist)
DO $$
BEGIN
    -- Only migrate if we have old columns and config is empty
    IF column_exists('agent_templates', 'system_prompt') AND 
       column_exists('agent_templates', 'agentpress_tools') THEN
        
        UPDATE agent_templates 
        SET config = jsonb_build_object(
            'system_prompt', COALESCE(system_prompt, ''),
            'tools', jsonb_build_object(
                'agentpress', COALESCE(agentpress_tools, '{}'::jsonb),
                'mcp', '[]'::jsonb,
                'custom_mcp', COALESCE(
                    CASE 
                        WHEN column_exists('agent_templates', 'mcp_requirements') 
                        THEN mcp_requirements 
                        ELSE '[]'::jsonb 
                    END, 
                    '[]'::jsonb
                )
            ),
            'metadata', jsonb_build_object(
                'avatar', avatar,
                'avatar_color', avatar_color,
                'template_metadata', COALESCE(metadata, '{}'::jsonb)
            )
        )
        WHERE config = '{}'::jsonb OR config IS NULL;
    END IF;
END
$$;

-- Drop old columns if they exist
DO $$
BEGIN
    IF column_exists('agent_templates', 'system_prompt') THEN
        ALTER TABLE agent_templates DROP COLUMN system_prompt;
    END IF;
    
    IF column_exists('agent_templates', 'mcp_requirements') THEN
        ALTER TABLE agent_templates DROP COLUMN mcp_requirements;
    END IF;
    
    IF column_exists('agent_templates', 'agentpress_tools') THEN
        ALTER TABLE agent_templates DROP COLUMN agentpress_tools;
    END IF;
END
$$;

-- Add constraints if they don't exist
DO $$
BEGIN
    IF NOT constraint_exists('agent_templates', 'agent_templates_config_structure_check') THEN
        ALTER TABLE agent_templates ADD CONSTRAINT agent_templates_config_structure_check 
        CHECK (
            config ? 'system_prompt' AND 
            config ? 'tools' AND 
            config ? 'metadata'
        );
    END IF;
    
    IF NOT constraint_exists('agent_templates', 'agent_templates_tools_structure_check') THEN
        ALTER TABLE agent_templates ADD CONSTRAINT agent_templates_tools_structure_check 
        CHECK (
            config->'tools' ? 'agentpress' AND
            config->'tools' ? 'mcp' AND
            config->'tools' ? 'custom_mcp'
        );
    END IF;
END
$$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_agent_templates_creator_id ON agent_templates(creator_id);
CREATE INDEX IF NOT EXISTS idx_agent_templates_is_public ON agent_templates(is_public);
CREATE INDEX IF NOT EXISTS idx_agent_templates_marketplace_published_at ON agent_templates(marketplace_published_at);
CREATE INDEX IF NOT EXISTS idx_agent_templates_download_count ON agent_templates(download_count);
CREATE INDEX IF NOT EXISTS idx_agent_templates_tags ON agent_templates USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_agent_templates_created_at ON agent_templates(created_at);

-- Add config-specific indexes
CREATE INDEX IF NOT EXISTS idx_agent_templates_config_tools ON agent_templates USING gin((config->'tools'));
CREATE INDEX IF NOT EXISTS idx_agent_templates_config_agentpress ON agent_templates USING gin((config->'tools'->'agentpress'));

-- Add sanitization function for template creation
CREATE OR REPLACE FUNCTION sanitize_config_for_template(input_config JSONB)
RETURNS JSONB AS $$
DECLARE
    sanitized_config JSONB;
    custom_mcp_array JSONB;
    custom_mcp_item JSONB;
    sanitized_mcp JSONB;
    result_array JSONB := '[]'::jsonb;
BEGIN
    -- Start with the basic structure
    sanitized_config := jsonb_build_object(
        'system_prompt', COALESCE(input_config->>'system_prompt', ''),
        'tools', jsonb_build_object(
            'agentpress', COALESCE(input_config->'tools'->'agentpress', '{}'::jsonb),
            'mcp', COALESCE(input_config->'tools'->'mcp', '[]'::jsonb),
            'custom_mcp', '[]'::jsonb
        ),
        'metadata', jsonb_build_object(
            'avatar', input_config->'metadata'->>'avatar',
            'avatar_color', input_config->'metadata'->>'avatar_color'
        )
    );
    
    -- Get custom_mcp array safely
    custom_mcp_array := COALESCE(input_config->'tools'->'custom_mcp', '[]'::jsonb);
    
    -- Process each custom MCP item
    FOR custom_mcp_item IN SELECT jsonb_array_elements(custom_mcp_array)
    LOOP
        -- Create sanitized MCP item
        sanitized_mcp := jsonb_build_object(
            'name', custom_mcp_item->>'name',
            'type', custom_mcp_item->>'type',
            'display_name', COALESCE(custom_mcp_item->>'display_name', custom_mcp_item->>'name'),
            'enabledTools', COALESCE(custom_mcp_item->'enabledTools', '[]'::jsonb)
        );
        
        -- Add config based on type
        IF custom_mcp_item->>'type' = 'pipedream' THEN
            -- For pipedream, keep URL but remove profile_id from headers
            sanitized_mcp := jsonb_set(
                sanitized_mcp,
                '{config}',
                jsonb_build_object(
                    'url', custom_mcp_item->'config'->>'url',
                    'headers', COALESCE(custom_mcp_item->'config'->'headers', '{}'::jsonb) - 'profile_id'
                )
            );
        ELSE
            -- For other types (like http with secure URLs), remove all config
            sanitized_mcp := jsonb_set(sanitized_mcp, '{config}', '{}'::jsonb);
        END IF;
        
        -- Add to result array
        result_array := result_array || sanitized_mcp;
    END LOOP;
    
    -- Update sanitized config with cleaned custom_mcps
    sanitized_config := jsonb_set(
        sanitized_config,
        '{tools,custom_mcp}',
        result_array
    );
    
    RETURN sanitized_config;
END;
$$ LANGUAGE plpgsql;

-- Create function to increment download count
CREATE OR REPLACE FUNCTION increment_template_download_count(template_id_param UUID)
RETURNS void AS $$
BEGIN
    UPDATE agent_templates 
    SET download_count = download_count + 1,
        updated_at = NOW()
    WHERE template_id = template_id_param;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS if not already enabled
ALTER TABLE agent_templates ENABLE ROW LEVEL SECURITY;

-- Drop and recreate RLS policies to ensure they're current
DROP POLICY IF EXISTS "Users can view public templates or their own templates" ON agent_templates;
CREATE POLICY "Users can view public templates or their own templates" ON agent_templates
    FOR SELECT USING (
        is_public = true OR 
        creator_id = (auth.jwt() ->> 'sub')::uuid
    );

DROP POLICY IF EXISTS "Users can create their own templates" ON agent_templates;
CREATE POLICY "Users can create their own templates" ON agent_templates
    FOR INSERT WITH CHECK (creator_id = (auth.jwt() ->> 'sub')::uuid);

DROP POLICY IF EXISTS "Users can update their own templates" ON agent_templates;
CREATE POLICY "Users can update their own templates" ON agent_templates
    FOR UPDATE USING (creator_id = (auth.jwt() ->> 'sub')::uuid);

DROP POLICY IF EXISTS "Users can delete their own templates" ON agent_templates;
CREATE POLICY "Users can delete their own templates" ON agent_templates
    FOR DELETE USING (creator_id = (auth.jwt() ->> 'sub')::uuid);

-- Clean up helper functions
DROP FUNCTION IF EXISTS column_exists(text, text);
DROP FUNCTION IF EXISTS constraint_exists(text, text);

COMMIT; 


-- ==================================================================
-- MIGRATION SOURCE: 20250729110000_fix_pipedream_qualified_names.sql
-- ==================================================================

CREATE OR REPLACE FUNCTION fix_pipedream_qualified_names(config_data JSONB)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    updated_config JSONB := config_data;
    custom_mcps JSONB;
    mcp_item JSONB;
    fixed_mcps JSONB := '[]'::jsonb;
    app_slug TEXT;
BEGIN
    custom_mcps := config_data->'tools'->'custom_mcp';
    
    IF custom_mcps IS NOT NULL AND jsonb_typeof(custom_mcps) = 'array' THEN
        FOR mcp_item IN SELECT jsonb_array_elements(custom_mcps)
        LOOP
            IF mcp_item->>'type' = 'pipedream' THEN
                app_slug := mcp_item->'config'->'headers'->>'x-pd-app-slug';
                
                IF app_slug IS NOT NULL AND app_slug != '' THEN
                    mcp_item := jsonb_set(mcp_item, '{name}', to_jsonb(app_slug));
                END IF;
            END IF;
            
            fixed_mcps := fixed_mcps || mcp_item;
        END LOOP;
        
        updated_config := jsonb_set(updated_config, '{tools,custom_mcp}', fixed_mcps);
    END IF;
    
    RETURN updated_config;
END;
$$;

UPDATE agent_templates 
SET config = fix_pipedream_qualified_names(config)
WHERE config->'tools'->'custom_mcp' @> '[{"type": "pipedream"}]';

DROP FUNCTION fix_pipedream_qualified_names(JSONB); 


-- ==================================================================
-- MIGRATION SOURCE: 20250814184554_add_workflows_to_config.sql
-- ==================================================================

BEGIN;

CREATE OR REPLACE FUNCTION update_version_config_with_workflows(p_version_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_agent_id UUID;
    v_config JSONB;
    v_workflows JSONB;
BEGIN
    SELECT agent_id, config INTO v_agent_id, v_config
    FROM agent_versions
    WHERE version_id = p_version_id;
    
    IF v_config IS NULL THEN
        RETURN;
    END IF;
    
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', id,
                'name', name,
                'description', description,
                'status', status,
                'trigger_phrase', trigger_phrase,
                'is_default', is_default,
                'steps', steps,
                'created_at', created_at,
                'updated_at', updated_at
            ) ORDER BY created_at DESC
        ),
        '[]'::jsonb
    ) INTO v_workflows
    FROM agent_workflows
    WHERE agent_id = v_agent_id;
    
    v_config = jsonb_set(v_config, '{workflows}', v_workflows);
    
    UPDATE agent_versions
    SET config = v_config
    WHERE version_id = p_version_id;
    
END;
$$;

DO $$
DECLARE
    v_version RECORD;
    v_count INTEGER := 0;
    v_total INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_total FROM agent_versions WHERE config IS NOT NULL;
    
    RAISE NOTICE 'Starting to update % version configs with workflows', v_total;
    
    FOR v_version IN 
        SELECT version_id 
        FROM agent_versions 
        WHERE config IS NOT NULL
        AND (config->>'workflows') IS NULL
    LOOP
        PERFORM update_version_config_with_workflows(v_version.version_id);
        v_count := v_count + 1;
        
        IF v_count % 100 = 0 THEN
            RAISE NOTICE 'Processed % of % versions', v_count, v_total;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Completed updating % version configs with workflows', v_count;
END;
$$;

DROP FUNCTION IF EXISTS update_version_config_with_workflows(UUID);

COMMENT ON COLUMN agent_versions.config IS 'Unified configuration including system_prompt, tools, workflows, and metadata';

COMMIT; 


