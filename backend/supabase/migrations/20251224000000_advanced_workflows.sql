create table public.agent_workflows (
  id uuid not null default extensions.uuid_generate_v4 (),
  agent_id uuid not null,
  name character varying(255) not null,
  description text null,
  status public.agent_workflow_status null default 'draft'::agent_workflow_status,
  trigger_phrase character varying(255) null,
  is_default boolean null default false,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  steps jsonb null,
  mode public.workflow_mode not null default 'simple'::workflow_mode,
  graph_definition jsonb null,
  compiled_logic jsonb null,
  trigger_id uuid null,
  constraint agent_workflows_pkey primary key (id),
  constraint agent_workflows_agent_id_fkey foreign KEY (agent_id) references agents (agent_id) on delete CASCADE,
  constraint agent_workflows_trigger_id_fkey foreign KEY (trigger_id) references agent_triggers (trigger_id) on delete set null,
  constraint check_workflow_mode_valid check (
    (
      mode = any (
        array[
          'simple'::workflow_mode,
          'advanced'::workflow_mode,
          'advanced-legacy'::workflow_mode
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_agent_workflows_agent_id on public.agent_workflows using btree (agent_id) TABLESPACE pg_default;

create index IF not exists idx_agent_workflows_status on public.agent_workflows using btree (status) TABLESPACE pg_default;

create index IF not exists idx_agent_workflows_steps on public.agent_workflows using gin (steps) TABLESPACE pg_default;

create index IF not exists idx_agent_workflows_mode on public.agent_workflows using btree (mode) TABLESPACE pg_default;

create index IF not exists idx_agent_workflows_agent_mode on public.agent_workflows using btree (agent_id, mode) TABLESPACE pg_default;

create index IF not exists idx_agent_workflows_status_mode on public.agent_workflows using btree (status, mode) TABLESPACE pg_default;