
create table if not exists public.user_presence_sessions (
    session_id text not null primary key,
    account_id uuid not null references auth.users(id) on delete cascade,
    active_thread_id uuid references public.threads(id) on delete set null,
    last_seen timestamptz not null default now(),
    platform text not null default 'web',
    device_info jsonb default '{}'::jsonb,
    client_timestamp timestamptz,
    updated_at timestamptz not null default now(),
    created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.user_presence_sessions enable row level security;

-- Policies
create policy "Users can view their own presence sessions"
    on public.user_presence_sessions for select
    using (auth.uid() = account_id);

create policy "Users can insert their own presence sessions"
    on public.user_presence_sessions for insert
    with check (auth.uid() = account_id);

create policy "Users can update their own presence sessions"
    on public.user_presence_sessions for update
    using (auth.uid() = account_id);

create policy "Users can delete their own presence sessions"
    on public.user_presence_sessions for delete
    using (auth.uid() = account_id);

-- Indexes for performance
create index if not exists idx_user_presence_account_id on public.user_presence_sessions(account_id);
create index if not exists idx_user_presence_last_seen on public.user_presence_sessions(last_seen);
create index if not exists idx_user_presence_active_thread on public.user_presence_sessions(active_thread_id);

-- Function to clean up stale sessions (optional, can be called via cron or API)
create or replace function public.cleanup_stale_presence_sessions(stale_minutes int)
returns int
language plpgsql
security definer
as $$
declare
    deleted_count int;
begin
    delete from public.user_presence_sessions
    where last_seen < (now() - (stale_minutes || ' minutes')::interval);
    
    get diagnostics deleted_count = row_count;
    return deleted_count;
end;
$$;

-- Grant permissions
grant all on public.user_presence_sessions to postgres, service_role;
grant select, insert, update, delete on public.user_presence_sessions to authenticated;
