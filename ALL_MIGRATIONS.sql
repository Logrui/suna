
-- Migration: 20240414161707_basejump-setup.sql
/**
      ____                 _
     |  _ \               (_)
     | |_) | __ _ ___  ___ _ _   _ _ __ ___  _ __
     |  _ < / _` / __|/ _ \ | | | | '_ ` _ \| '_ \
     | |_) | (_| \__ \  __/ | |_| | | | | | | |_) |
     |____/ \__,_|___/\___| |\__,_|_| |_| |_| .__/
                         _/ |               | |
                        |__/                |_|

     Basejump is a starter kit for building SaaS products on top of Supabase.
     Learn more at https://usebasejump.com
 */


/**
  * -------------------------------------------------------
  * Section - Basejump schema setup and utility functions
  * -------------------------------------------------------
 */

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- revoke execution by default from public
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA PUBLIC REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;

-- Create basejump schema
CREATE SCHEMA IF NOT EXISTS basejump;
GRANT USAGE ON SCHEMA basejump to authenticated;
GRANT USAGE ON SCHEMA basejump to service_role;

/**
  * -------------------------------------------------------
  * Section - Enums
  * -------------------------------------------------------
 */

/**
 * Invitation types are either email or link. Email invitations are sent to
 * a single user and can only be claimed once.  Link invitations can be used multiple times
 * Both expire after 24 hours
 */
DO
$$
    BEGIN
        -- check it account_role already exists on basejump schema
        IF NOT EXISTS(SELECT 1
                      FROM pg_type t
                               JOIN pg_namespace n ON n.oid = t.typnamespace
                      WHERE t.typname = 'invitation_type'
                        AND n.nspname = 'basejump') THEN
            CREATE TYPE basejump.invitation_type AS ENUM ('one_time', '24_hour');
        end if;
    end;
$$;

/**
  * -------------------------------------------------------
  * Section - Basejump settings
  * -------------------------------------------------------
 */

CREATE TABLE IF NOT EXISTS basejump.config
(
    enable_team_accounts            boolean default true,
    enable_personal_account_billing boolean default true,
    enable_team_account_billing     boolean default true,
    billing_provider                text    default 'stripe'
);

-- create config row
INSERT INTO basejump.config (enable_team_accounts, enable_personal_account_billing, enable_team_account_billing)
VALUES (true, true, true);

-- enable select on the config table
GRANT SELECT ON basejump.config TO authenticated, service_role;

-- enable RLS on config
ALTER TABLE basejump.config
    ENABLE ROW LEVEL SECURITY;

create policy "Basejump settings can be read by authenticated users" on basejump.config
    for select
    to authenticated
    using (
    true
    );

/**
  * -------------------------------------------------------
  * Section - Basejump utility functions
  * -------------------------------------------------------
 */

/**
  basejump.get_config()
  Get the full config object to check basejump settings
  This is not accessible from the outside, so can only be used inside postgres functions
 */
CREATE OR REPLACE FUNCTION basejump.get_config()
    RETURNS json AS
$$
DECLARE
    result RECORD;
BEGIN
    SELECT * from basejump.config limit 1 into result;
    return row_to_json(result);
END;
$$ LANGUAGE plpgsql;

grant execute on function basejump.get_config() to authenticated, service_role;


/**
  basejump.is_set("field_name")
  Check a specific boolean config value
 */
CREATE OR REPLACE FUNCTION basejump.is_set(field_name text)
    RETURNS boolean AS
$$
DECLARE
    result BOOLEAN;
BEGIN
    execute format('select %I from basejump.config limit 1', field_name) into result;
    return result;
END;
$$ LANGUAGE plpgsql;

grant execute on function basejump.is_set(text) to authenticated;


/**
  * Automatic handling for maintaining created_at and updated_at timestamps
  * on tables
 */
CREATE OR REPLACE FUNCTION basejump.trigger_set_timestamps()
    RETURNS TRIGGER AS
$$
BEGIN
    if TG_OP = 'INSERT' then
        NEW.created_at = now();
        NEW.updated_at = now();
    else
        NEW.updated_at = now();
        NEW.created_at = OLD.created_at;
    end if;
    RETURN NEW;
END
$$ LANGUAGE plpgsql;


/**
  * Automatic handling for maintaining created_by and updated_by timestamps
  * on tables
 */
CREATE OR REPLACE FUNCTION basejump.trigger_set_user_tracking()
    RETURNS TRIGGER AS
$$
BEGIN
    if TG_OP = 'INSERT' then
        NEW.created_by = auth.uid();
        NEW.updated_by = auth.uid();
    else
        NEW.updated_by = auth.uid();
        NEW.created_by = OLD.created_by;
    end if;
    RETURN NEW;
END
$$ LANGUAGE plpgsql;

/**
  basejump.generate_token(length)
  Generates a secure token - used internally for invitation tokens
  but could be used elsewhere.  Check out the invitations table for more info on
  how it's used
 */
CREATE OR REPLACE FUNCTION basejump.generate_token(length int)
    RETURNS text AS
$$
select regexp_replace(replace(
                              replace(replace(replace(encode(extensions.gen_random_bytes(length)::bytea, 'base64'), '/', ''), '+',
                                              ''), '\', ''),
                              '=',
                              ''), E'[\\n\\r]+', '', 'g');
$$ LANGUAGE sql;

grant execute on function basejump.generate_token(int) to authenticated;


-- Migration: 20240414161947_basejump-accounts.sql
/**
      ____                 _
     |  _ \               (_)
     | |_) | __ _ ___  ___ _ _   _ _ __ ___  _ __
     |  _ < / _` / __|/ _ \ | | | | '_ ` _ \| '_ \
     | |_) | (_| \__ \  __/ | |_| | | | | | | |_) |
     |____/ \__,_|___/\___| |\__,_|_| |_| |_| .__/
                         _/ |               | |
                        |__/                |_|

     Basejump is a starter kit for building SaaS products on top of Supabase.
     Learn more at https://usebasejump.com
 */

/**
  * -------------------------------------------------------
  * Section - Accounts
  * -------------------------------------------------------
 */

/**
 * Account roles allow you to provide permission levels to users
 * when they're acting on an account.  By default, we provide
 * "owner" and "member".  The only distinction is that owners can
 * also manage billing and invite/remove account members.
 */
DO
$$
    BEGIN
        -- check it account_role already exists on basejump schema
        IF NOT EXISTS(SELECT 1
                      FROM pg_type t
                               JOIN pg_namespace n ON n.oid = t.typnamespace
                      WHERE t.typname = 'account_role'
                        AND n.nspname = 'basejump') THEN
            CREATE TYPE basejump.account_role AS ENUM ('owner', 'member');
        end if;
    end;
$$;

/**
 * Accounts are the primary grouping for most objects within
 * the system. They have many users, and all billing is connected to
 * an account.
 */
CREATE TABLE IF NOT EXISTS basejump.accounts
(
    id                    uuid unique                NOT NULL DEFAULT extensions.uuid_generate_v4(),
    -- defaults to the user who creates the account
    -- this user cannot be removed from an account without changing
    -- the primary owner first
    primary_owner_user_id uuid references auth.users not null default auth.uid(),
    -- Account name
    name                  text,
    slug                  text unique,
    personal_account      boolean                             default false not null,
    updated_at            timestamp with time zone,
    created_at            timestamp with time zone,
    created_by            uuid references auth.users,
    updated_by            uuid references auth.users,
    private_metadata      jsonb                               default '{}'::jsonb,
    public_metadata       jsonb                               default '{}'::jsonb,
    PRIMARY KEY (id)
);

-- constraint that conditionally allows nulls on the slug ONLY if personal_account is true
-- remove this if you want to ignore accounts slugs entirely
ALTER TABLE basejump.accounts
    ADD CONSTRAINT basejump_accounts_slug_null_if_personal_account_true CHECK (
            (personal_account = true AND slug is null)
            OR (personal_account = false AND slug is not null)
        );

-- Open up access to accounts
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE basejump.accounts TO authenticated, service_role;

/**
 * We want to protect some fields on accounts from being updated
 * Specifically the primary owner user id and account id.
 * primary_owner_user_id should be updated using the dedicated function
 */
CREATE OR REPLACE FUNCTION basejump.protect_account_fields()
    RETURNS TRIGGER AS
$$
BEGIN
    IF current_user IN ('authenticated', 'anon') THEN
        -- these are protected fields that users are not allowed to update themselves
        -- platform admins should be VERY careful about updating them as well.
        if NEW.id <> OLD.id
            OR NEW.personal_account <> OLD.personal_account
            OR NEW.primary_owner_user_id <> OLD.primary_owner_user_id
        THEN
            RAISE EXCEPTION 'You do not have permission to update this field';
        end if;
    end if;

    RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- trigger to protect account fields
CREATE TRIGGER basejump_protect_account_fields
    BEFORE UPDATE
    ON basejump.accounts
    FOR EACH ROW
EXECUTE FUNCTION basejump.protect_account_fields();

-- convert any character in the slug that's not a letter, number, or dash to a dash on insert/update for accounts
CREATE OR REPLACE FUNCTION basejump.slugify_account_slug()
    RETURNS TRIGGER AS
$$
BEGIN
    if NEW.slug is not null then
        NEW.slug = lower(regexp_replace(NEW.slug, '[^a-zA-Z0-9-]+', '-', 'g'));
    end if;

    RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- trigger to slugify the account slug
CREATE TRIGGER basejump_slugify_account_slug
    BEFORE INSERT OR UPDATE
    ON basejump.accounts
    FOR EACH ROW
EXECUTE FUNCTION basejump.slugify_account_slug();

-- enable RLS for accounts
alter table basejump.accounts
    enable row level security;

-- protect the timestamps
CREATE TRIGGER basejump_set_accounts_timestamp
    BEFORE INSERT OR UPDATE
    ON basejump.accounts
    FOR EACH ROW
EXECUTE PROCEDURE basejump.trigger_set_timestamps();

-- set the user tracking
CREATE TRIGGER basejump_set_accounts_user_tracking
    BEFORE INSERT OR UPDATE
    ON basejump.accounts
    FOR EACH ROW
EXECUTE PROCEDURE basejump.trigger_set_user_tracking();

/**
  * Account users are the users that are associated with an account.
  * They can be invited to join the account, and can have different roles.
  * The system does not enforce any permissions for roles, other than restricting
  * billing and account membership to only owners
 */
create table if not exists basejump.account_user
(
    -- id of the user in the account
    user_id      uuid references auth.users on delete cascade        not null,
    -- id of the account the user is in
    account_id   uuid references basejump.accounts on delete cascade not null,
    -- role of the user in the account
    account_role basejump.account_role                               not null,
    constraint account_user_pkey primary key (user_id, account_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE basejump.account_user TO authenticated, service_role;


-- enable RLS for account_user
alter table basejump.account_user
    enable row level security;

/**
  * When an account gets created, we want to insert the current user as the first
  * owner
 */
create or replace function basejump.add_current_user_to_new_account()
    returns trigger
    language plpgsql
    security definer
    set search_path = public
as
$$
begin
    if new.primary_owner_user_id = auth.uid() then
        insert into basejump.account_user (account_id, user_id, account_role)
        values (NEW.id, auth.uid(), 'owner');
    end if;
    return NEW;
end;
$$;

-- trigger the function whenever a new account is created
CREATE TRIGGER basejump_add_current_user_to_new_account
    AFTER INSERT
    ON basejump.accounts
    FOR EACH ROW
EXECUTE FUNCTION basejump.add_current_user_to_new_account();

/**
  * When a user signs up, we need to create a personal account for them
  * and add them to the account_user table so they can act on it
 */
create or replace function basejump.run_new_user_setup()
    returns trigger
    language plpgsql
    security definer
    set search_path = public
as
$$
declare
    first_account_id    uuid;
    generated_user_name text;
begin

    -- first we setup the user profile
    -- TODO: see if we can get the user's name from the auth.users table once we learn how oauth works
    if new.email IS NOT NULL then
        generated_user_name := split_part(new.email, '@', 1);
    end if;
    -- create the new users's personal account
    insert into basejump.accounts (name, primary_owner_user_id, personal_account, id)
    values (generated_user_name, NEW.id, true, NEW.id)
    returning id into first_account_id;

    -- add them to the account_user table so they can act on it
    insert into basejump.account_user (account_id, user_id, account_role)
    values (first_account_id, NEW.id, 'owner');

    return NEW;
end;
$$;

-- trigger the function every time a user is created
create trigger on_auth_user_created
    after insert
    on auth.users
    for each row
execute procedure basejump.run_new_user_setup();

/**
  * -------------------------------------------------------
  * Section - Account permission utility functions
  * -------------------------------------------------------
  * These functions are stored on the basejump schema, and useful for things like
  * generating RLS policies
 */

/**
  * Returns true if the current user has the pass in role on the passed in account
  * If no role is sent, will return true if the user is a member of the account
  * NOTE: This is an inefficient function when used on large query sets. You should reach for the get_accounts_with_role and lookup
  * the account ID in those cases.
 */
create or replace function basejump.has_role_on_account(account_id uuid, account_role basejump.account_role default null)
    returns boolean
    language sql
    security definer
    set search_path = public
as
$$
select exists(
               select 1
               from basejump.account_user wu
               where wu.user_id = auth.uid()
                 and wu.account_id = has_role_on_account.account_id
                 and (
                           wu.account_role = has_role_on_account.account_role
                       or has_role_on_account.account_role is null
                   )
           );
$$;

grant execute on function basejump.has_role_on_account(uuid, basejump.account_role) to authenticated, anon, public, service_role;


/**
  * Returns account_ids that the current user is a member of. If you pass in a role,
  * it'll only return accounts that the user is a member of with that role.
  */
create or replace function basejump.get_accounts_with_role(passed_in_role basejump.account_role default null)
    returns setof uuid
    language sql
    security definer
    set search_path = public
as
$$
select account_id
from basejump.account_user wu
where wu.user_id = auth.uid()
  and (
            wu.account_role = passed_in_role
        or passed_in_role is null
    );
$$;

grant execute on function basejump.get_accounts_with_role(basejump.account_role) to authenticated;

/**
  * -------------------------
  * Section - RLS Policies
  * -------------------------
  * This is where we define access to tables in the basejump schema
 */

create policy "users can view their own account_users" on basejump.account_user
    for select
    to authenticated
    using (
    user_id = auth.uid()
    );

create policy "users can view their teammates" on basejump.account_user
    for select
    to authenticated
    using (
    basejump.has_role_on_account(account_id) = true
    );

create policy "Account users can be deleted by owners except primary account owner" on basejump.account_user
    for delete
    to authenticated
    using (
        (basejump.has_role_on_account(account_id, 'owner') = true)
        AND
        user_id != (select primary_owner_user_id
                    from basejump.accounts
                    where account_id = accounts.id)
    );

create policy "Accounts are viewable by members" on basejump.accounts
    for select
    to authenticated
    using (
    basejump.has_role_on_account(id) = true
    );

-- Primary owner should always have access to the account
create policy "Accounts are viewable by primary owner" on basejump.accounts
    for select
    to authenticated
    using (
    primary_owner_user_id = auth.uid()
    );

create policy "Team accounts can be created by any user" on basejump.accounts
    for insert
    to authenticated
    with check (
            basejump.is_set('enable_team_accounts') = true
        and personal_account = false
    );


create policy "Accounts can be edited by owners" on basejump.accounts
    for update
    to authenticated
    using (
    basejump.has_role_on_account(id, 'owner') = true
    );

/**
  * -------------------------------------------------------
  * Section - Public functions
  * -------------------------------------------------------
  * Each of these functions exists in the public name space because they are accessible
  * via the API.  it is the primary way developers can interact with Basejump accounts
 */

/**
* Returns the account_id for a given account slug
*/

create or replace function public.get_account_id(slug text)
    returns uuid
    language sql
as
$$
select id
from basejump.accounts
where slug = get_account_id.slug;
$$;

grant execute on function public.get_account_id(text) to authenticated, service_role;

/**
 * Returns the current user's role within a given account_id
*/
create or replace function public.current_user_account_role(account_id uuid)
    returns jsonb
    language plpgsql
as
$$
DECLARE
    response jsonb;
BEGIN

    select jsonb_build_object(
                   'account_role', wu.account_role,
                   'is_primary_owner', a.primary_owner_user_id = auth.uid(),
                   'is_personal_account', a.personal_account
               )
    into response
    from basejump.account_user wu
             join basejump.accounts a on a.id = wu.account_id
    where wu.user_id = auth.uid()
      and wu.account_id = current_user_account_role.account_id;

    -- if the user is not a member of the account, throw an error
    if response ->> 'account_role' IS NULL then
        raise exception 'Not found';
    end if;

    return response;
END
$$;

grant execute on function public.current_user_account_role(uuid) to authenticated;

/**
  * Let's you update a users role within an account if you are an owner of that account
  **/
create or replace function public.update_account_user_role(account_id uuid, user_id uuid,
                                                           new_account_role basejump.account_role,
                                                           make_primary_owner boolean default false)
    returns void
    security definer
    set search_path = public
    language plpgsql
as
$$
declare
    is_account_owner         boolean;
    is_account_primary_owner boolean;
    changing_primary_owner   boolean;
begin
    -- check if the user is an owner, and if they are, allow them to update the role
    select basejump.has_role_on_account(update_account_user_role.account_id, 'owner') into is_account_owner;

    if not is_account_owner then
        raise exception 'You must be an owner of the account to update a users role';
    end if;

    -- check if the user being changed is the primary owner, if so its not allowed
    select primary_owner_user_id = auth.uid(), primary_owner_user_id = update_account_user_role.user_id
    into is_account_primary_owner, changing_primary_owner
    from basejump.accounts
    where id = update_account_user_role.account_id;

    if changing_primary_owner = true and is_account_primary_owner = false then
        raise exception 'You must be the primary owner of the account to change the primary owner';
    end if;

    update basejump.account_user au
    set account_role = new_account_role
    where au.account_id = update_account_user_role.account_id
      and au.user_id = update_account_user_role.user_id;

    if make_primary_owner = true then
        -- first we see if the current user is the owner, only they can do this
        if is_account_primary_owner = false then
            raise exception 'You must be the primary owner of the account to change the primary owner';
        end if;

        update basejump.accounts
        set primary_owner_user_id = update_account_user_role.user_id
        where id = update_account_user_role.account_id;
    end if;
end;
$$;

grant execute on function public.update_account_user_role(uuid, uuid, basejump.account_role, boolean) to authenticated;

/**
  Returns the current user's accounts
 */
create or replace function public.get_accounts()
    returns json
    language sql
as
$$
select coalesce(json_agg(
                        json_build_object(
                                'account_id', wu.account_id,
                                'account_role', wu.account_role,
                                'is_primary_owner', a.primary_owner_user_id = auth.uid(),
                                'name', a.name,
                                'slug', a.slug,
                                'personal_account', a.personal_account,
                                'created_at', a.created_at,
                                'updated_at', a.updated_at
                            )
                    ), '[]'::json)
from basejump.account_user wu
         join basejump.accounts a on a.id = wu.account_id
where wu.user_id = auth.uid();
$$;

grant execute on function public.get_accounts() to authenticated;

/**
  Returns a specific account that the current user has access to
 */
create or replace function public.get_account(account_id uuid)
    returns json
    language plpgsql
as
$$
BEGIN
    -- check if the user is a member of the account or a service_role user
    if current_user IN ('anon', 'authenticated') and
       (select current_user_account_role(get_account.account_id) ->> 'account_role' IS NULL) then
        raise exception 'You must be a member of an account to access it';
    end if;


    return (select json_build_object(
                           'account_id', a.id,
                           'account_role', wu.account_role,
                           'is_primary_owner', a.primary_owner_user_id = auth.uid(),
                           'name', a.name,
                           'slug', a.slug,
                           'personal_account', a.personal_account,
                           'billing_enabled', case
                                                  when a.personal_account = true then
                                                      config.enable_personal_account_billing
                                                  else
                                                      config.enable_team_account_billing
                               end,
                           'billing_status', bs.status,
                           'created_at', a.created_at,
                           'updated_at', a.updated_at,
                           'metadata', a.public_metadata
                       )
            from basejump.accounts a
                     left join basejump.account_user wu on a.id = wu.account_id and wu.user_id = auth.uid()
                     join basejump.config config on true
                     left join (select bs.account_id, status
                                from basejump.billing_subscriptions bs
                                where bs.account_id = get_account.account_id
                                order by created desc
                                limit 1) bs on bs.account_id = a.id
            where a.id = get_account.account_id);
END;
$$;

grant execute on function public.get_account(uuid) to authenticated, service_role;

/**
  Returns a specific account that the current user has access to
 */
create or replace function public.get_account_by_slug(slug text)
    returns json
    language plpgsql
as
$$
DECLARE
    internal_account_id uuid;
BEGIN
    select a.id
    into internal_account_id
    from basejump.accounts a
    where a.slug IS NOT NULL
      and a.slug = get_account_by_slug.slug;

    return public.get_account(internal_account_id);
END;
$$;

grant execute on function public.get_account_by_slug(text) to authenticated;

/**
  Returns the personal account for the current user
 */
create or replace function public.get_personal_account()
    returns json
    language plpgsql
as
$$
BEGIN
    return public.get_account(auth.uid());
END;
$$;

grant execute on function public.get_personal_account() to authenticated;

/**
  * Create an account
 */
create or replace function public.create_account(slug text default null, name text default null)
    returns json
    language plpgsql
as
$$
DECLARE
    new_account_id uuid;
BEGIN
    insert into basejump.accounts (slug, name)
    values (create_account.slug, create_account.name)
    returning id into new_account_id;

    return public.get_account(new_account_id);
EXCEPTION
    WHEN unique_violation THEN
        raise exception 'An account with that unique ID already exists';
END;
$$;

grant execute on function public.create_account(slug text, name text) to authenticated;

/**
  Update an account with passed in info. None of the info is required except for account ID.
  If you don't pass in a value for a field, it will not be updated.
  If you set replace_meta to true, the metadata will be replaced with the passed in metadata.
  If you set replace_meta to false, the metadata will be merged with the passed in metadata.
 */
create or replace function public.update_account(account_id uuid, slug text default null, name text default null,
                                                 public_metadata jsonb default null,
                                                 replace_metadata boolean default false)
    returns json
    language plpgsql
as
$$
BEGIN

    -- check if postgres role is service_role
    if current_user IN ('anon', 'authenticated') and
       not (select current_user_account_role(update_account.account_id) ->> 'account_role' = 'owner') then
        raise exception 'Only account owners can update an account';
    end if;

    update basejump.accounts accounts
    set slug            = coalesce(update_account.slug, accounts.slug),
        name            = coalesce(update_account.name, accounts.name),
        public_metadata = case
                              when update_account.public_metadata is null then accounts.public_metadata -- do nothing
                              when accounts.public_metadata IS NULL then update_account.public_metadata -- set metadata
                              when update_account.replace_metadata
                                  then update_account.public_metadata -- replace metadata
                              else accounts.public_metadata || update_account.public_metadata end -- merge metadata
    where accounts.id = update_account.account_id;

    return public.get_account(account_id);
END;
$$;

grant execute on function public.update_account(uuid, text, text, jsonb, boolean) to authenticated, service_role;

/**
  Returns a list of current account members. Only account owners can access this function.
  It's a security definer because it requries us to lookup personal_accounts for existing members so we can
  get their names.
 */
create or replace function public.get_account_members(account_id uuid, results_limit integer default 50,
                                                      results_offset integer default 0)
    returns json
    language plpgsql
    security definer
    set search_path = basejump
as
$$
BEGIN

    -- only account owners can access this function
    if (select public.current_user_account_role(get_account_members.account_id) ->> 'account_role' <> 'owner') then
        raise exception 'Only account owners can access this function';
    end if;

    return (select json_agg(
                           json_build_object(
                                   'user_id', wu.user_id,
                                   'account_role', wu.account_role,
                                   'name', p.name,
                                   'email', u.email,
                                   'is_primary_owner', a.primary_owner_user_id = wu.user_id
                               )
                       )
            from basejump.account_user wu
                     join basejump.accounts a on a.id = wu.account_id
                     join basejump.accounts p on p.primary_owner_user_id = wu.user_id and p.personal_account = true
                     join auth.users u on u.id = wu.user_id
            where wu.account_id = get_account_members.account_id
            limit coalesce(get_account_members.results_limit, 50) offset coalesce(get_account_members.results_offset, 0));
END;
$$;

grant execute on function public.get_account_members(uuid, integer, integer) to authenticated;

/**
  Allows an owner of the account to remove any member other than the primary owner
 */

create or replace function public.remove_account_member(account_id uuid, user_id uuid)
    returns void
    language plpgsql
as
$$
BEGIN
    -- only account owners can access this function
    if basejump.has_role_on_account(remove_account_member.account_id, 'owner') <> true then
        raise exception 'Only account owners can access this function';
    end if;

    delete
    from basejump.account_user wu
    where wu.account_id = remove_account_member.account_id
      and wu.user_id = remove_account_member.user_id;
END;
$$;

grant execute on function public.remove_account_member(uuid, uuid) to authenticated;


-- Migration: 20240414162100_basejump-invitations.sql
/**
  * -------------------------------------------------------
  * Section - Invitations
  * -------------------------------------------------------
 */

/**
  * Invitations are sent to users to join a account
  * They pre-define the role the user should have once they join
 */
create table if not exists basejump.invitations
(
    -- the id of the invitation
    id                 uuid unique                                              not null default extensions.uuid_generate_v4(),
    -- what role should invitation accepters be given in this account
    account_role       basejump.account_role                                    not null,
    -- the account the invitation is for
    account_id         uuid references basejump.accounts (id) on delete cascade not null,
    -- unique token used to accept the invitation
    token              text unique                                              not null default basejump.generate_token(30),
    -- who created the invitation
    invited_by_user_id uuid references auth.users                               not null,
    -- account name. filled in by a trigger
    account_name       text,
    -- when the invitation was last updated
    updated_at         timestamp with time zone,
    -- when the invitation was created
    created_at         timestamp with time zone,
    -- what type of invitation is this
    invitation_type    basejump.invitation_type                                 not null,
    primary key (id)
);

-- Open up access to invitations
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE basejump.invitations TO authenticated, service_role;

-- manage timestamps
CREATE TRIGGER basejump_set_invitations_timestamp
    BEFORE INSERT OR UPDATE
    ON basejump.invitations
    FOR EACH ROW
EXECUTE FUNCTION basejump.trigger_set_timestamps();

/**
  * This funciton fills in account info and inviting user email
  * so that the recipient can get more info about the invitation prior to
  * accepting.  It allows us to avoid complex permissions on accounts
 */
CREATE OR REPLACE FUNCTION basejump.trigger_set_invitation_details()
    RETURNS TRIGGER AS
$$
BEGIN
    NEW.invited_by_user_id = auth.uid();
    NEW.account_name = (select name from basejump.accounts where id = NEW.account_id);
    RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER basejump_trigger_set_invitation_details
    BEFORE INSERT
    ON basejump.invitations
    FOR EACH ROW
EXECUTE FUNCTION basejump.trigger_set_invitation_details();

-- enable RLS on invitations
alter table basejump.invitations
    enable row level security;

/**
  * -------------------------
  * Section - RLS Policies
  * -------------------------
  * This is where we define access to tables in the basejump schema
 */

 create policy "Invitations viewable by account owners" on basejump.invitations
    for select
    to authenticated
    using (
            created_at > (now() - interval '24 hours')
        and
            basejump.has_role_on_account(account_id, 'owner') = true
    );


create policy "Invitations can be created by account owners" on basejump.invitations
    for insert
    to authenticated
    with check (
    -- team accounts should be enabled
            basejump.is_set('enable_team_accounts') = true
        -- this should not be a personal account
        and (SELECT personal_account
             FROM basejump.accounts
             WHERE id = account_id) = false
        -- the inserting user should be an owner of the account
        and
            (basejump.has_role_on_account(account_id, 'owner') = true)
    );

create policy "Invitations can be deleted by account owners" on basejump.invitations
    for delete
    to authenticated
    using (
    basejump.has_role_on_account(account_id, 'owner') = true
    );



/**
  * -------------------------------------------------------
  * Section - Public functions
  * -------------------------------------------------------
  * Each of these functions exists in the public name space because they are accessible
  * via the API.  it is the primary way developers can interact with Basejump accounts
 */


/**
  Returns a list of currently active invitations for a given account
 */

create or replace function public.get_account_invitations(account_id uuid, results_limit integer default 25,
                                                          results_offset integer default 0)
    returns json
    language plpgsql
as
$$
BEGIN
    -- only account owners can access this function
    if (select public.current_user_account_role(get_account_invitations.account_id) ->> 'account_role' <> 'owner') then
        raise exception 'Only account owners can access this function';
    end if;

    return (select json_agg(
                           json_build_object(
                                   'account_role', i.account_role,
                                   'created_at', i.created_at,
                                   'invitation_type', i.invitation_type,
                                   'invitation_id', i.id
                               )
                       )
            from basejump.invitations i
            where i.account_id = get_account_invitations.account_id
              and i.created_at > now() - interval '24 hours'
            limit coalesce(get_account_invitations.results_limit, 25) offset coalesce(get_account_invitations.results_offset, 0));
END;
$$;

grant execute on function public.get_account_invitations(uuid, integer, integer) to authenticated;


/**
  * Allows a user to accept an existing invitation and join a account
  * This one exists in the public schema because we want it to be called
  * using the supabase rpc method
 */
create or replace function public.accept_invitation(lookup_invitation_token text)
    returns jsonb
    language plpgsql
    security definer set search_path = public, basejump
as
$$
declare
    lookup_account_id       uuid;
    declare new_member_role basejump.account_role;
    lookup_account_slug     text;
begin
    select i.account_id, i.account_role, a.slug
    into lookup_account_id, new_member_role, lookup_account_slug
    from basejump.invitations i
             join basejump.accounts a on a.id = i.account_id
    where i.token = lookup_invitation_token
      and i.created_at > now() - interval '24 hours';

    if lookup_account_id IS NULL then
        raise exception 'Invitation not found';
    end if;

    if lookup_account_id is not null then
        -- we've validated the token is real, so grant the user access
        insert into basejump.account_user (account_id, user_id, account_role)
        values (lookup_account_id, auth.uid(), new_member_role);
        -- email types of invitations are only good for one usage
        delete from basejump.invitations where token = lookup_invitation_token and invitation_type = 'one_time';
    end if;
    return json_build_object('account_id', lookup_account_id, 'account_role', new_member_role, 'slug',
                             lookup_account_slug);
EXCEPTION
    WHEN unique_violation THEN
        raise exception 'You are already a member of this account';
end;
$$;

grant execute on function public.accept_invitation(text) to authenticated;


/**
  * Allows a user to lookup an existing invitation and join a account
  * This one exists in the public schema because we want it to be called
  * using the supabase rpc method
 */
create or replace function public.lookup_invitation(lookup_invitation_token text)
    returns json
    language plpgsql
    security definer set search_path = public, basejump
as
$$
declare
    name              text;
    invitation_active boolean;
begin
    select account_name,
           case when id IS NOT NULL then true else false end as active
    into name, invitation_active
    from basejump.invitations
    where token = lookup_invitation_token
      and created_at > now() - interval '24 hours'
    limit 1;
    return json_build_object('active', coalesce(invitation_active, false), 'account_name', name);
end;
$$;

grant execute on function public.lookup_invitation(text) to authenticated;


/**
  Allows a user to create a new invitation if they are an owner of an account
 */
create or replace function public.create_invitation(account_id uuid, account_role basejump.account_role,
                                                    invitation_type basejump.invitation_type)
    returns json
    language plpgsql
as
$$
declare
    new_invitation basejump.invitations;
begin
    insert into basejump.invitations (account_id, account_role, invitation_type, invited_by_user_id)
    values (account_id, account_role, invitation_type, auth.uid())
    returning * into new_invitation;

    return json_build_object('token', new_invitation.token);
end
$$;

grant execute on function public.create_invitation(uuid, basejump.account_role, basejump.invitation_type) to authenticated;

/**
  Allows an owner to delete an existing invitation
 */

create or replace function public.delete_invitation(invitation_id uuid)
    returns void
    language plpgsql
as
$$
begin
    -- verify account owner for the invitation
    if basejump.has_role_on_account(
               (select account_id from basejump.invitations where id = delete_invitation.invitation_id), 'owner') <>
       true then
        raise exception 'Only account owners can delete invitations';
    end if;

    delete from basejump.invitations where id = delete_invitation.invitation_id;
end
$$;

grant execute on function public.delete_invitation(uuid) to authenticated;


-- Migration: 20240414162131_basejump-billing.sql
/**
  * -------------------------------------------------------
  * Section - Billing
  * -------------------------------------------------------
 */

/**
* Subscription Status
* Tracks the current status of the account subscription
*/
DO
$$
    BEGIN
        IF NOT EXISTS(SELECT 1
                      FROM pg_type t
                               JOIN pg_namespace n ON n.oid = t.typnamespace
                      WHERE t.typname = 'subscription_status'
                        AND n.nspname = 'basejump') THEN
            create type basejump.subscription_status as enum (
                'trialing',
                'active',
                'canceled',
                'incomplete',
                'incomplete_expired',
                'past_due',
                'unpaid'
                );
        end if;
    end;
$$;


/**
 * Billing customer
 * This is a private table that contains a mapping of user IDs to your billing providers IDs
 */
create table if not exists basejump.billing_customers
(
    -- UUID from auth.users
    account_id uuid references basejump.accounts (id) on delete cascade not null,
    -- The user's customer ID in Stripe. User must not be able to update this.
    id         text primary key,
    -- The email address the customer wants to use for invoicing
    email      text,
    -- The active status of a customer
    active     boolean,
    -- The billing provider the customer is using
    provider   text
);

-- Open up access to billing_customers
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE basejump.billing_customers TO service_role;
GRANT SELECT ON TABLE basejump.billing_customers TO authenticated;


-- enable RLS for billing_customers
alter table
    basejump.billing_customers
    enable row level security;

/**
  * Billing subscriptions
  * This is a private table that contains a mapping of account IDs to your billing providers subscription IDs
 */
create table if not exists basejump.billing_subscriptions
(
    -- Subscription ID from Stripe, e.g. sub_1234.
    id                   text primary key,
    account_id           uuid references basejump.accounts (id) on delete cascade          not null,
    billing_customer_id  text references basejump.billing_customers (id) on delete cascade not null,
    -- The status of the subscription object, one of subscription_status type above.
    status               basejump.subscription_status,
    -- Set of key-value pairs, used to store additional information about the object in a structured format.
    metadata             jsonb,
    -- ID of the price that created this subscription.
    price_id             text,
    plan_name            text,
    -- Quantity multiplied by the unit amount of the price creates the amount of the subscription. Can be used to charge multiple seats.
    quantity             integer,
    -- If true the subscription has been canceled by the user and will be deleted at the end of the billing period.
    cancel_at_period_end boolean,
    -- Time at which the subscription was created.
    created              timestamp with time zone default timezone('utc' :: text, now())   not null,
    -- Start of the current period that the subscription has been invoiced for.
    current_period_start timestamp with time zone default timezone('utc' :: text, now())   not null,
    -- End of the current period that the subscription has been invoiced for. At the end of this period, a new invoice will be created.
    current_period_end   timestamp with time zone default timezone('utc' :: text, now())   not null,
    -- If the subscription has ended, the timestamp of the date the subscription ended.
    ended_at             timestamp with time zone default timezone('utc' :: text, now()),
    -- A date in the future at which the subscription will automatically get canceled.
    cancel_at            timestamp with time zone default timezone('utc' :: text, now()),
    -- If the subscription has been canceled, the date of that cancellation. If the subscription was canceled with `cancel_at_period_end`, `canceled_at` will still reflect the date of the initial cancellation request, not the end of the subscription period when the subscription is automatically moved to a canceled state.
    canceled_at          timestamp with time zone default timezone('utc' :: text, now()),
    -- If the subscription has a trial, the beginning of that trial.
    trial_start          timestamp with time zone default timezone('utc' :: text, now()),
    -- If the subscription has a trial, the end of that trial.
    trial_end            timestamp with time zone default timezone('utc' :: text, now()),
    provider             text
);

-- Open up access to billing_subscriptions
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE basejump.billing_subscriptions TO service_role;
GRANT SELECT ON TABLE basejump.billing_subscriptions TO authenticated;

-- enable RLS for billing_subscriptions
alter table
    basejump.billing_subscriptions
    enable row level security;

/**
  * -------------------------
  * Section - RLS Policies
  * -------------------------
  * This is where we define access to tables in the basejump schema
 */

create policy "Can only view own billing customer data." on basejump.billing_customers for
    select
    using (
    basejump.has_role_on_account(account_id) = true
    );


create policy "Can only view own billing subscription data." on basejump.billing_subscriptions for
    select
    using (
    basejump.has_role_on_account(account_id) = true
    );

/**
  * -------------------------------------------------------
  * Section - Public functions
  * -------------------------------------------------------
  * Each of these functions exists in the public name space because they are accessible
  * via the API.  it is the primary way developers can interact with Basejump accounts
 */


/**
  * Returns the current billing status for an account
 */
CREATE OR REPLACE FUNCTION public.get_account_billing_status(account_id uuid)
    RETURNS jsonb
    security definer
    set search_path = public, basejump
AS
$$
DECLARE
    result      jsonb;
    role_result jsonb;
BEGIN
    select public.current_user_account_role(get_account_billing_status.account_id) into role_result;

    select jsonb_build_object(
                   'account_id', get_account_billing_status.account_id,
                   'billing_subscription_id', s.id,
                   'billing_enabled', case
                                          when a.personal_account = true then config.enable_personal_account_billing
                                          else config.enable_team_account_billing end,
                   'billing_status', s.status,
                   'billing_customer_id', c.id,
                   'billing_provider', config.billing_provider,
                   'billing_email',
                   coalesce(c.email, u.email) -- if we don't have a customer email, use the user's email as a fallback
               )
    into result
    from basejump.accounts a
             join auth.users u on u.id = a.primary_owner_user_id
             left join basejump.billing_subscriptions s on s.account_id = a.id
             left join basejump.billing_customers c on c.account_id = coalesce(s.account_id, a.id)
             join basejump.config config on true
    where a.id = get_account_billing_status.account_id
    order by s.created desc
    limit 1;

    return result || role_result;
END;
$$ LANGUAGE plpgsql;

grant execute on function public.get_account_billing_status(uuid) to authenticated;

/**
  * Allow service accounts to upsert the billing data for an account
 */
CREATE OR REPLACE FUNCTION public.service_role_upsert_customer_subscription(account_id uuid,
                                                                            customer jsonb default null,
                                                                            subscription jsonb default null)
    RETURNS void AS
$$
BEGIN
    -- if the customer is not null, upsert the data into billing_customers, only upsert fields that are present in the jsonb object
    if customer is not null then
        insert into basejump.billing_customers (id, account_id, email, provider)
        values (customer ->> 'id', service_role_upsert_customer_subscription.account_id, customer ->> 'billing_email',
                (customer ->> 'provider'))
        on conflict (id) do update
            set email = customer ->> 'billing_email';
    end if;

    -- if the subscription is not null, upsert the data into billing_subscriptions, only upsert fields that are present in the jsonb object
    if subscription is not null then
        insert into basejump.billing_subscriptions (id, account_id, billing_customer_id, status, metadata, price_id,
                                                    quantity, cancel_at_period_end, created, current_period_start,
                                                    current_period_end, ended_at, cancel_at, canceled_at, trial_start,
                                                    trial_end, plan_name, provider)
        values (subscription ->> 'id', service_role_upsert_customer_subscription.account_id,
                subscription ->> 'billing_customer_id', (subscription ->> 'status')::basejump.subscription_status,
                subscription -> 'metadata',
                subscription ->> 'price_id', (subscription ->> 'quantity')::int,
                (subscription ->> 'cancel_at_period_end')::boolean,
                (subscription ->> 'created')::timestamptz, (subscription ->> 'current_period_start')::timestamptz,
                (subscription ->> 'current_period_end')::timestamptz, (subscription ->> 'ended_at')::timestamptz,
                (subscription ->> 'cancel_at')::timestamptz,
                (subscription ->> 'canceled_at')::timestamptz, (subscription ->> 'trial_start')::timestamptz,
                (subscription ->> 'trial_end')::timestamptz,
                subscription ->> 'plan_name', (subscription ->> 'provider'))
        on conflict (id) do update
            set billing_customer_id  = subscription ->> 'billing_customer_id',
                status               = (subscription ->> 'status')::basejump.subscription_status,
                metadata             = subscription -> 'metadata',
                price_id             = subscription ->> 'price_id',
                quantity             = (subscription ->> 'quantity')::int,
                cancel_at_period_end = (subscription ->> 'cancel_at_period_end')::boolean,
                current_period_start = (subscription ->> 'current_period_start')::timestamptz,
                current_period_end   = (subscription ->> 'current_period_end')::timestamptz,
                ended_at             = (subscription ->> 'ended_at')::timestamptz,
                cancel_at            = (subscription ->> 'cancel_at')::timestamptz,
                canceled_at          = (subscription ->> 'canceled_at')::timestamptz,
                trial_start          = (subscription ->> 'trial_start')::timestamptz,
                trial_end            = (subscription ->> 'trial_end')::timestamptz,
                plan_name            = subscription ->> 'plan_name';
    end if;
end;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.service_role_upsert_customer_subscription(uuid, jsonb, jsonb) TO service_role;


-- Migration: 20250409211903_basejump-configure.sql
UPDATE basejump.config SET enable_team_accounts = TRUE;
UPDATE basejump.config SET enable_personal_account_billing = TRUE;
UPDATE basejump.config SET enable_team_account_billing = TRUE;



-- Migration: 20250409212058_initial.sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create devices table first
CREATE TABLE public.devices (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    account_id UUID NOT NULL,
    name TEXT,
    last_seen TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    is_online BOOLEAN DEFAULT FALSE,
    CONSTRAINT fk_account FOREIGN KEY (account_id) REFERENCES basejump.accounts(id) ON DELETE CASCADE
);

-- Create recordings table
CREATE TABLE public.recordings (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    account_id UUID NOT NULL,
    device_id UUID NOT NULL,
    preprocessed_file_path TEXT,
    meta JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    name TEXT,
    ui_annotated BOOLEAN DEFAULT FALSE,
    a11y_file_path TEXT,
    audio_file_path TEXT,
    action_annotated BOOLEAN DEFAULT FALSE,
    raw_data_file_path TEXT,
    metadata_file_path TEXT,
    action_training_file_path TEXT,
    CONSTRAINT fk_account FOREIGN KEY (account_id) REFERENCES basejump.accounts(id) ON DELETE CASCADE,
    CONSTRAINT fk_device FOREIGN KEY (device_id) REFERENCES public.devices(id) ON DELETE CASCADE
);

-- Create indexes for foreign keys
CREATE INDEX idx_recordings_account_id ON public.recordings(account_id);
CREATE INDEX idx_recordings_device_id ON public.recordings(device_id);
CREATE INDEX idx_devices_account_id ON public.devices(account_id);

-- Add RLS policies (optional, can be customized as needed)
ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for devices
CREATE POLICY "Account members can delete their own devices"
    ON public.devices FOR DELETE
    USING (basejump.has_role_on_account(account_id));

CREATE POLICY "Account members can insert their own devices"
    ON public.devices FOR INSERT
    WITH CHECK (basejump.has_role_on_account(account_id));

CREATE POLICY "Account members can only access their own devices"
    ON public.devices FOR ALL
    USING (basejump.has_role_on_account(account_id));

CREATE POLICY "Account members can update their own devices"
    ON public.devices FOR UPDATE
    USING (basejump.has_role_on_account(account_id));

CREATE POLICY "Account members can view their own devices"
    ON public.devices FOR SELECT
    USING (basejump.has_role_on_account(account_id));

-- Create RLS policies for recordings
CREATE POLICY "Account members can delete their own recordings"
    ON public.recordings FOR DELETE
    USING (basejump.has_role_on_account(account_id));

CREATE POLICY "Account members can insert their own recordings"
    ON public.recordings FOR INSERT
    WITH CHECK (basejump.has_role_on_account(account_id));

CREATE POLICY "Account members can only access their own recordings"
    ON public.recordings FOR ALL
    USING (basejump.has_role_on_account(account_id));

CREATE POLICY "Account members can update their own recordings"
    ON public.recordings FOR UPDATE
    USING (basejump.has_role_on_account(account_id));

CREATE POLICY "Account members can view their own recordings"
    ON public.recordings FOR SELECT
    USING (basejump.has_role_on_account(account_id));

-- Note: For threads and messages, you might want different RLS policies
-- depending on your application's requirements


-- Also drop the old function signature
DROP FUNCTION IF EXISTS transfer_device(UUID, UUID, TEXT);


CREATE OR REPLACE FUNCTION transfer_device(
  device_id UUID,      -- Parameter remains UUID
  new_account_id UUID, -- Changed parameter name and implies new ownership target
  device_name TEXT DEFAULT NULL
)
RETURNS SETOF devices AS $$
DECLARE
  device_exists BOOLEAN;
  updated_device devices;
BEGIN
  -- Check if a device with the specified UUID exists
  SELECT EXISTS (
    SELECT 1 FROM devices WHERE id = device_id
  ) INTO device_exists;

  IF device_exists THEN
    -- Device exists: update its account ownership and last_seen timestamp
    UPDATE devices
    SET
      account_id = new_account_id, -- Update account_id instead of user_id
      name = COALESCE(device_name, name),
      last_seen = NOW()
    WHERE id = device_id
    RETURNING * INTO updated_device;

    RETURN NEXT updated_device;
  ELSE
    -- Device doesn't exist; return nothing so the caller can handle creation
    RETURN;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission so that authenticated users can call this function
-- Updated function signature
GRANT EXECUTE ON FUNCTION transfer_device(UUID, UUID, TEXT) TO authenticated;




-- Create the ui_grounding bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('ui_grounding', 'ui_grounding', false)
ON CONFLICT (id) DO NOTHING; -- Avoid error if bucket already exists

-- Create the ui_grounding_trajs bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('ui_grounding_trajs', 'ui_grounding_trajs', false)
ON CONFLICT (id) DO NOTHING; -- Avoid error if bucket already exists

-- Create the recordings bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('recordings', 'recordings', false, null, null) -- Set file size limit and mime types as needed
ON CONFLICT (id) DO NOTHING; -- Avoid error if bucket already exists


-- RLS policies for the 'recordings' bucket
-- Allow members to view files in accounts they belong to
CREATE POLICY "Account members can select recording files"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'recordings' AND
        (storage.foldername(name))[1]::uuid IN (SELECT basejump.get_accounts_with_role())
    );

-- Allow members to insert files into accounts they belong to
CREATE POLICY "Account members can insert recording files"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'recordings' AND
        (storage.foldername(name))[1]::uuid IN (SELECT basejump.get_accounts_with_role())
    );

-- Allow members to update files in accounts they belong to
CREATE POLICY "Account members can update recording files"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'recordings' AND
        (storage.foldername(name))[1]::uuid IN (SELECT basejump.get_accounts_with_role())
    );

-- Allow members to delete files from accounts they belong to
-- Consider restricting this further, e.g., to 'owner' role if needed:
-- (storage.foldername(name))[1]::uuid IN (SELECT basejump.get_accounts_with_role('owner'))
CREATE POLICY "Account members can delete recording files"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'recordings' AND
        (storage.foldername(name))[1]::uuid IN (SELECT basejump.get_accounts_with_role())
    );



-- Migration: 20250416133920_agentpress_schema.sql
-- AGENTPRESS SCHEMA:
-- Create projects table
CREATE TABLE projects (
    project_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    account_id UUID NOT NULL REFERENCES basejump.accounts(id) ON DELETE CASCADE,
    sandbox JSONB DEFAULT '{}'::jsonb,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create threads table
CREATE TABLE threads (
    thread_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES basejump.accounts(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create messages table
CREATE TABLE messages (
    message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES threads(thread_id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    is_llm_message BOOLEAN NOT NULL DEFAULT TRUE,
    content JSONB NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create agent_runs table
CREATE TABLE agent_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES threads(thread_id),
    status TEXT NOT NULL DEFAULT 'running',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    responses JSONB NOT NULL DEFAULT '[]'::jsonb, -- TO BE REMOVED, NOT USED 
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_threads_updated_at
    BEFORE UPDATE ON threads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at
    BEFORE UPDATE ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_runs_updated_at
    BEFORE UPDATE ON agent_runs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for better query performance
CREATE INDEX idx_threads_created_at ON threads(created_at);
CREATE INDEX idx_threads_account_id ON threads(account_id);
CREATE INDEX idx_threads_project_id ON threads(project_id);
CREATE INDEX idx_agent_runs_thread_id ON agent_runs(thread_id);
CREATE INDEX idx_agent_runs_status ON agent_runs(status);
CREATE INDEX idx_agent_runs_created_at ON agent_runs(created_at);
CREATE INDEX idx_projects_account_id ON projects(account_id);
CREATE INDEX idx_projects_created_at ON projects(created_at);
CREATE INDEX idx_messages_thread_id ON messages(thread_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

-- Enable Row Level Security
ALTER TABLE threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Project policies
CREATE POLICY project_select_policy ON projects
    FOR SELECT
    USING (
        is_public = TRUE OR
        basejump.has_role_on_account(account_id) = true
    );

CREATE POLICY project_insert_policy ON projects
    FOR INSERT
    WITH CHECK (basejump.has_role_on_account(account_id) = true);

CREATE POLICY project_update_policy ON projects
    FOR UPDATE
    USING (basejump.has_role_on_account(account_id) = true);

CREATE POLICY project_delete_policy ON projects
    FOR DELETE
    USING (basejump.has_role_on_account(account_id) = true);

-- Thread policies based on project and account ownership
CREATE POLICY thread_select_policy ON threads
    FOR SELECT
    USING (
        basejump.has_role_on_account(account_id) = true OR 
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.project_id = threads.project_id
            AND (
                projects.is_public = TRUE OR
                basejump.has_role_on_account(projects.account_id) = true
            )
        )
    );

CREATE POLICY thread_insert_policy ON threads
    FOR INSERT
    WITH CHECK (
        basejump.has_role_on_account(account_id) = true OR 
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.project_id = threads.project_id
            AND basejump.has_role_on_account(projects.account_id) = true
        )
    );

CREATE POLICY thread_update_policy ON threads
    FOR UPDATE
    USING (
        basejump.has_role_on_account(account_id) = true OR 
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.project_id = threads.project_id
            AND basejump.has_role_on_account(projects.account_id) = true
        )
    );

CREATE POLICY thread_delete_policy ON threads
    FOR DELETE
    USING (
        basejump.has_role_on_account(account_id) = true OR 
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.project_id = threads.project_id
            AND basejump.has_role_on_account(projects.account_id) = true
        )
    );

-- Create policies for agent_runs based on thread ownership
CREATE POLICY agent_run_select_policy ON agent_runs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM threads
            LEFT JOIN projects ON threads.project_id = projects.project_id
            WHERE threads.thread_id = agent_runs.thread_id
            AND (
                projects.is_public = TRUE OR
                basejump.has_role_on_account(threads.account_id) = true OR 
                basejump.has_role_on_account(projects.account_id) = true
            )
        )
    );

CREATE POLICY agent_run_insert_policy ON agent_runs
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM threads
            LEFT JOIN projects ON threads.project_id = projects.project_id
            WHERE threads.thread_id = agent_runs.thread_id
            AND (
                basejump.has_role_on_account(threads.account_id) = true OR 
                basejump.has_role_on_account(projects.account_id) = true
            )
        )
    );

CREATE POLICY agent_run_update_policy ON agent_runs
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM threads
            LEFT JOIN projects ON threads.project_id = projects.project_id
            WHERE threads.thread_id = agent_runs.thread_id
            AND (
                basejump.has_role_on_account(threads.account_id) = true OR 
                basejump.has_role_on_account(projects.account_id) = true
            )
        )
    );

CREATE POLICY agent_run_delete_policy ON agent_runs
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM threads
            LEFT JOIN projects ON threads.project_id = projects.project_id
            WHERE threads.thread_id = agent_runs.thread_id
            AND (
                basejump.has_role_on_account(threads.account_id) = true OR 
                basejump.has_role_on_account(projects.account_id) = true
            )
        )
    );

-- Create message policies based on thread ownership
CREATE POLICY message_select_policy ON messages
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM threads
            LEFT JOIN projects ON threads.project_id = projects.project_id
            WHERE threads.thread_id = messages.thread_id
            AND (
                projects.is_public = TRUE OR
                basejump.has_role_on_account(threads.account_id) = true OR 
                basejump.has_role_on_account(projects.account_id) = true
            )
        )
    );

CREATE POLICY message_insert_policy ON messages
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM threads
            LEFT JOIN projects ON threads.project_id = projects.project_id
            WHERE threads.thread_id = messages.thread_id
            AND (
                basejump.has_role_on_account(threads.account_id) = true OR 
                basejump.has_role_on_account(projects.account_id) = true
            )
        )
    );

CREATE POLICY message_update_policy ON messages
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM threads
            LEFT JOIN projects ON threads.project_id = projects.project_id
            WHERE threads.thread_id = messages.thread_id
            AND (
                basejump.has_role_on_account(threads.account_id) = true OR 
                basejump.has_role_on_account(projects.account_id) = true
            )
        )
    );

CREATE POLICY message_delete_policy ON messages
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM threads
            LEFT JOIN projects ON threads.project_id = projects.project_id
            WHERE threads.thread_id = messages.thread_id
            AND (
                basejump.has_role_on_account(threads.account_id) = true OR 
                basejump.has_role_on_account(projects.account_id) = true
            )
        )
    );

-- Grant permissions to roles
GRANT ALL PRIVILEGES ON TABLE projects TO authenticated, service_role;
GRANT SELECT ON TABLE projects TO anon;
GRANT SELECT ON TABLE threads TO authenticated, anon, service_role;
GRANT SELECT ON TABLE messages TO authenticated, anon, service_role;
GRANT ALL PRIVILEGES ON TABLE agent_runs TO authenticated, service_role;

-- Create a function that matches the Python get_messages behavior
CREATE OR REPLACE FUNCTION get_llm_formatted_messages(p_thread_id UUID)
RETURNS JSONB
SECURITY DEFINER -- Changed to SECURITY DEFINER to allow service role access
LANGUAGE plpgsql
AS $$
DECLARE
    messages_array JSONB := '[]'::JSONB;
    has_access BOOLEAN;
    current_role TEXT;
    latest_summary_id UUID;
    latest_summary_time TIMESTAMP WITH TIME ZONE;
    is_project_public BOOLEAN;
BEGIN
    -- Get current role
    SELECT current_user INTO current_role;
    
    -- Check if associated project is public
    SELECT p.is_public INTO is_project_public
    FROM threads t
    LEFT JOIN projects p ON t.project_id = p.project_id
    WHERE t.thread_id = p_thread_id;
    
    -- Skip access check for service_role or public projects
    IF current_role = 'authenticated' AND NOT is_project_public THEN
        -- Check if thread exists and user has access
        SELECT EXISTS (
            SELECT 1 FROM threads t
            LEFT JOIN projects p ON t.project_id = p.project_id
            WHERE t.thread_id = p_thread_id
            AND (
                basejump.has_role_on_account(t.account_id) = true OR 
                basejump.has_role_on_account(p.account_id) = true
            )
        ) INTO has_access;
        
        IF NOT has_access THEN
            RAISE EXCEPTION 'Thread not found or access denied';
        END IF;
    END IF;

    -- Find the latest summary message if it exists
    SELECT message_id, created_at
    INTO latest_summary_id, latest_summary_time
    FROM messages
    WHERE thread_id = p_thread_id
    AND type = 'summary'
    AND is_llm_message = TRUE
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Log whether a summary was found (helpful for debugging)
    IF latest_summary_id IS NOT NULL THEN
        RAISE NOTICE 'Found latest summary message: id=%, time=%', latest_summary_id, latest_summary_time;
    ELSE
        RAISE NOTICE 'No summary message found for thread %', p_thread_id;
    END IF;

    -- Parse content if it's stored as a string and return proper JSON objects
    WITH parsed_messages AS (
        SELECT 
            message_id,
            CASE 
                WHEN jsonb_typeof(content) = 'string' THEN content::text::jsonb
                ELSE content
            END AS parsed_content,
            created_at,
            type
        FROM messages
        WHERE thread_id = p_thread_id
        AND is_llm_message = TRUE
        AND (
            -- Include the latest summary and all messages after it,
            -- or all messages if no summary exists
            latest_summary_id IS NULL 
            OR message_id = latest_summary_id 
            OR created_at > latest_summary_time
        )
        ORDER BY created_at
    )
    SELECT JSONB_AGG(parsed_content)
    INTO messages_array
    FROM parsed_messages;
    
    -- Handle the case when no messages are found
    IF messages_array IS NULL THEN
        RETURN '[]'::JSONB;
    END IF;
    
    RETURN messages_array;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_llm_formatted_messages TO authenticated, anon, service_role;


-- Migration: 20250417000000_workflow_system.sql
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


-- Migration: 20250418000000_workflow_flows.sql
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


-- Migration: 20250504123828_fix_thread_select_policy.sql
DROP POLICY IF EXISTS thread_select_policy ON threads;

CREATE POLICY thread_select_policy ON threads
FOR SELECT
USING (
    is_public IS TRUE
    OR basejump.has_role_on_account(account_id) = true
    OR EXISTS (
        SELECT 1 FROM projects
        WHERE projects.project_id = threads.project_id
        AND (
            projects.is_public IS TRUE
            OR basejump.has_role_on_account(projects.account_id) = true
        )
    )
);



-- Migration: 20250523133848_admin-view-access.sql
DROP POLICY IF EXISTS "Give read only access to internal users" ON threads;

CREATE POLICY "Give read only access to internal users" ON threads
FOR SELECT
USING (
    ((auth.jwt() ->> 'email'::text) ~~ '%@kortix.ai'::text)
);


DROP POLICY IF EXISTS "Give read only access to internal users" ON messages;

CREATE POLICY "Give read only access to internal users" ON messages
FOR SELECT
USING (
    ((auth.jwt() ->> 'email'::text) ~~ '%@kortix.ai'::text)
);


DROP POLICY IF EXISTS "Give read only access to internal users" ON projects;

CREATE POLICY "Give read only access to internal users" ON projects
FOR SELECT
USING (
    ((auth.jwt() ->> 'email'::text) ~~ '%@kortix.ai'::text)
);



-- Migration: 20250524062639_agents_table.sql
BEGIN;

-- Create agents table for storing agent configurations
CREATE TABLE IF NOT EXISTS agents (
    agent_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES basejump.accounts(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    system_prompt TEXT NOT NULL,
    configured_mcps JSONB DEFAULT '[]'::jsonb,
    agentpress_tools JSONB DEFAULT '{}'::jsonb,
    is_default BOOLEAN DEFAULT false,
    avatar VARCHAR(10),
    avatar_color VARCHAR(7),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance on agents table
CREATE INDEX IF NOT EXISTS idx_agents_account_id ON agents(account_id);
CREATE INDEX IF NOT EXISTS idx_agents_is_default ON agents(is_default);
CREATE INDEX IF NOT EXISTS idx_agents_created_at ON agents(created_at);

-- Add unique constraint to ensure only one default agent per account
CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_account_default ON agents(account_id, is_default) WHERE is_default = true;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_agents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at (drop first if exists to avoid conflicts)
DROP TRIGGER IF EXISTS trigger_agents_updated_at ON agents;
CREATE TRIGGER trigger_agents_updated_at
    BEFORE UPDATE ON agents
    FOR EACH ROW
    EXECUTE FUNCTION update_agents_updated_at();

-- Enable RLS on agents table
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS agents_select_own ON agents;
DROP POLICY IF EXISTS agents_insert_own ON agents;
DROP POLICY IF EXISTS agents_update_own ON agents;
DROP POLICY IF EXISTS agents_delete_own ON agents;

-- Policy for users to see their own agents
CREATE POLICY agents_select_own ON agents
    FOR SELECT
    USING (basejump.has_role_on_account(account_id));

-- Policy for users to insert their own agents
CREATE POLICY agents_insert_own ON agents
    FOR INSERT
    WITH CHECK (basejump.has_role_on_account(account_id, 'owner'));

-- Policy for users to update their own agents
CREATE POLICY agents_update_own ON agents
    FOR UPDATE
    USING (basejump.has_role_on_account(account_id, 'owner'));

-- Policy for users to delete their own agents (except default)
CREATE POLICY agents_delete_own ON agents
    FOR DELETE
    USING (basejump.has_role_on_account(account_id, 'owner') AND is_default = false);

-- NOTE: Default agent insertion has been removed per requirement

-- Add agent_id column to threads table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='threads' AND column_name='agent_id') THEN
        ALTER TABLE threads ADD COLUMN agent_id UUID REFERENCES agents(agent_id) ON DELETE SET NULL;
        CREATE INDEX idx_threads_agent_id ON threads(agent_id);
        COMMENT ON COLUMN threads.agent_id IS 'ID of the agent used for this conversation thread. If NULL, uses account default agent.';
    END IF;
END $$;

-- Update existing threads to leave agent_id NULL (no default agents inserted)
-- (Optional: if you prefer to leave existing threads with NULL agent_id, this step can be omitted.)
-- UPDATE threads 
-- SET agent_id = NULL
-- WHERE agent_id IS NULL;

COMMIT;



-- Migration: 20250525000000_agent_versioning.sql
BEGIN;

CREATE TABLE IF NOT EXISTS agent_versions (
    version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    version_name VARCHAR(50) NOT NULL,
    system_prompt TEXT NOT NULL,
    configured_mcps JSONB DEFAULT '[]'::jsonb,
    custom_mcps JSONB DEFAULT '[]'::jsonb,
    agentpress_tools JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES basejump.accounts(id),
    
    UNIQUE(agent_id, version_number),
    UNIQUE(agent_id, version_name)
);

-- Indexes for agent_versions
CREATE INDEX IF NOT EXISTS idx_agent_versions_agent_id ON agent_versions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_versions_version_number ON agent_versions(version_number);
CREATE INDEX IF NOT EXISTS idx_agent_versions_is_active ON agent_versions(is_active);
CREATE INDEX IF NOT EXISTS idx_agent_versions_created_at ON agent_versions(created_at);

-- Add current version tracking to agents table
ALTER TABLE agents ADD COLUMN IF NOT EXISTS current_version_id UUID REFERENCES agent_versions(version_id);
ALTER TABLE agents ADD COLUMN IF NOT EXISTS version_count INTEGER DEFAULT 1;

-- Add index for current version
CREATE INDEX IF NOT EXISTS idx_agents_current_version ON agents(current_version_id);

-- Add version tracking to threads (which version is being used in this thread)
ALTER TABLE threads ADD COLUMN IF NOT EXISTS agent_version_id UUID REFERENCES agent_versions(version_id);

-- Add index for thread version
CREATE INDEX IF NOT EXISTS idx_threads_agent_version ON threads(agent_version_id);

-- Track version changes and history
CREATE TABLE IF NOT EXISTS agent_version_history (
    history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,
    version_id UUID NOT NULL REFERENCES agent_versions(version_id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- 'created', 'updated', 'activated', 'deactivated'
    changed_by UUID REFERENCES basejump.accounts(id),
    change_description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for version history
CREATE INDEX IF NOT EXISTS idx_agent_version_history_agent_id ON agent_version_history(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_version_history_version_id ON agent_version_history(version_id);
CREATE INDEX IF NOT EXISTS idx_agent_version_history_created_at ON agent_version_history(created_at);

-- Update updated_at timestamp for agent_versions
CREATE OR REPLACE FUNCTION update_agent_versions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists, then create it
DROP TRIGGER IF EXISTS trigger_agent_versions_updated_at ON agent_versions;
CREATE TRIGGER trigger_agent_versions_updated_at
    BEFORE UPDATE ON agent_versions
    FOR EACH ROW
    EXECUTE FUNCTION update_agent_versions_updated_at();

-- Enable RLS on new tables
ALTER TABLE agent_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_version_history ENABLE ROW LEVEL SECURITY;

-- Policies for agent_versions
DROP POLICY IF EXISTS agent_versions_select_policy ON agent_versions;
CREATE POLICY agent_versions_select_policy ON agent_versions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM agents
            WHERE agents.agent_id = agent_versions.agent_id
            AND basejump.has_role_on_account(agents.account_id)
        )
    );

DROP POLICY IF EXISTS agent_versions_insert_policy ON agent_versions;
CREATE POLICY agent_versions_insert_policy ON agent_versions
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM agents
            WHERE agents.agent_id = agent_versions.agent_id
            AND basejump.has_role_on_account(agents.account_id, 'owner')
        )
    );

DROP POLICY IF EXISTS agent_versions_update_policy ON agent_versions;
CREATE POLICY agent_versions_update_policy ON agent_versions
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM agents
            WHERE agents.agent_id = agent_versions.agent_id
            AND basejump.has_role_on_account(agents.account_id, 'owner')
        )
    );

DROP POLICY IF EXISTS agent_versions_delete_policy ON agent_versions;
CREATE POLICY agent_versions_delete_policy ON agent_versions
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM agents
            WHERE agents.agent_id = agent_versions.agent_id
            AND basejump.has_role_on_account(agents.account_id, 'owner')
        )
    );

-- Policies for agent_version_history
DROP POLICY IF EXISTS agent_version_history_select_policy ON agent_version_history;
CREATE POLICY agent_version_history_select_policy ON agent_version_history
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM agents
            WHERE agents.agent_id = agent_version_history.agent_id
            AND basejump.has_role_on_account(agents.account_id)
        )
    );

DROP POLICY IF EXISTS agent_version_history_insert_policy ON agent_version_history;
CREATE POLICY agent_version_history_insert_policy ON agent_version_history
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM agents
            WHERE agents.agent_id = agent_version_history.agent_id
            AND basejump.has_role_on_account(agents.account_id, 'owner')
        )
    );

-- Function to migrate existing agents to versioned system
CREATE OR REPLACE FUNCTION migrate_agents_to_versioned()
RETURNS void
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
    v_agent RECORD;
    v_version_id UUID;
BEGIN
    -- For each existing agent, create a v1 version
    FOR v_agent IN SELECT * FROM agents WHERE current_version_id IS NULL
    LOOP
        -- Create v1 version with current agent data
        INSERT INTO agent_versions (
            agent_id,
            version_number,
            version_name,
            system_prompt,
            configured_mcps,
            custom_mcps,
            agentpress_tools,
            is_active,
            created_by
        ) VALUES (
            v_agent.agent_id,
            1,
            'v1',
            v_agent.system_prompt,
            v_agent.configured_mcps,
            '[]'::jsonb, -- agents table doesn't have custom_mcps column
            v_agent.agentpress_tools,
            TRUE,
            v_agent.account_id
        ) RETURNING version_id INTO v_version_id;
        
        -- Update agent with current version
        UPDATE agents 
        SET current_version_id = v_version_id,
            version_count = 1
        WHERE agent_id = v_agent.agent_id;
        
        -- Add history entry
        INSERT INTO agent_version_history (
            agent_id,
            version_id,
            action,
            changed_by,
            change_description
        ) VALUES (
            v_agent.agent_id,
            v_version_id,
            'created',
            v_agent.account_id,
            'Initial version created from existing agent'
        );
    END LOOP;
END;
$$;

-- Function to create a new version of an agent
CREATE OR REPLACE FUNCTION create_agent_version(
    p_agent_id UUID,
    p_system_prompt TEXT,
    p_configured_mcps JSONB DEFAULT '[]'::jsonb,
    p_custom_mcps JSONB DEFAULT '[]'::jsonb,
    p_agentpress_tools JSONB DEFAULT '{}'::jsonb,
    p_created_by UUID DEFAULT NULL
)
RETURNS UUID
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
    v_version_id UUID;
    v_version_number INTEGER;
    v_version_name VARCHAR(50);
BEGIN
    -- Check if user has permission
    IF NOT EXISTS (
        SELECT 1 FROM agents 
        WHERE agent_id = p_agent_id 
        AND basejump.has_role_on_account(account_id, 'owner')
    ) THEN
        RAISE EXCEPTION 'Agent not found or access denied';
    END IF;
    
    -- Get next version number
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_version_number
    FROM agent_versions
    WHERE agent_id = p_agent_id;
    
    -- Generate version name
    v_version_name := 'v' || v_version_number;
    
    -- Create new version
    INSERT INTO agent_versions (
        agent_id,
        version_number,
        version_name,
        system_prompt,
        configured_mcps,
        custom_mcps,
        agentpress_tools,
        is_active,
        created_by
    ) VALUES (
        p_agent_id,
        v_version_number,
        v_version_name,
        p_system_prompt,
        p_configured_mcps,
        p_custom_mcps,
        p_agentpress_tools,
        TRUE,
        p_created_by
    ) RETURNING version_id INTO v_version_id;
    
    -- Update agent version count
    UPDATE agents 
    SET version_count = v_version_number,
        current_version_id = v_version_id
    WHERE agent_id = p_agent_id;
    
    -- Add history entry
    INSERT INTO agent_version_history (
        agent_id,
        version_id,
        action,
        changed_by,
        change_description
    ) VALUES (
        p_agent_id,
        v_version_id,
        'created',
        p_created_by,
        'New version ' || v_version_name || ' created'
    );
    
    RETURN v_version_id;
END;
$$;

-- Function to switch agent to a different version
CREATE OR REPLACE FUNCTION switch_agent_version(
    p_agent_id UUID,
    p_version_id UUID,
    p_changed_by UUID DEFAULT NULL
)
RETURNS void
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Check if user has permission and version exists
    IF NOT EXISTS (
        SELECT 1 FROM agents a
        JOIN agent_versions av ON a.agent_id = av.agent_id
        WHERE a.agent_id = p_agent_id 
        AND av.version_id = p_version_id
        AND basejump.has_role_on_account(a.account_id, 'owner')
    ) THEN
        RAISE EXCEPTION 'Agent/version not found or access denied';
    END IF;
    
    -- Update current version
    UPDATE agents 
    SET current_version_id = p_version_id
    WHERE agent_id = p_agent_id;
    
    -- Add history entry
    INSERT INTO agent_version_history (
        agent_id,
        version_id,
        action,
        changed_by,
        change_description
    ) VALUES (
        p_agent_id,
        p_version_id,
        'activated',
        p_changed_by,
        'Switched to this version'
    );
END;
$$;

-- =====================================================
-- 9. RUN MIGRATION
-- =====================================================
-- Migrate existing agents to versioned system
SELECT migrate_agents_to_versioned();

COMMIT; 


-- Migration: 20250526000000_secure_mcp_credentials.sql
BEGIN;

-- =====================================================
-- SECURE MCP CREDENTIAL ARCHITECTURE MIGRATION
-- =====================================================
-- This migration implements a secure architecture where:
-- 1. Agent templates contain MCP requirements (no credentials)
-- 2. User credentials are stored encrypted separately
-- 3. Agent instances combine templates with user credentials at runtime

-- =====================================================
-- 1. AGENT TEMPLATES TABLE
-- =====================================================
-- Stores marketplace agent templates without any credentials
CREATE TABLE IF NOT EXISTS agent_templates (
    template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES basejump.accounts(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    system_prompt TEXT NOT NULL,
    mcp_requirements JSONB DEFAULT '[]'::jsonb, -- No credentials, just requirements
    agentpress_tools JSONB DEFAULT '{}'::jsonb,
    tags TEXT[] DEFAULT '{}',
    is_public BOOLEAN DEFAULT FALSE,
    marketplace_published_at TIMESTAMPTZ,
    download_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    avatar VARCHAR(10),
    avatar_color VARCHAR(7),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for agent_templates
CREATE INDEX IF NOT EXISTS idx_agent_templates_creator_id ON agent_templates(creator_id);
CREATE INDEX IF NOT EXISTS idx_agent_templates_is_public ON agent_templates(is_public);
CREATE INDEX IF NOT EXISTS idx_agent_templates_marketplace_published_at ON agent_templates(marketplace_published_at);
CREATE INDEX IF NOT EXISTS idx_agent_templates_download_count ON agent_templates(download_count);
CREATE INDEX IF NOT EXISTS idx_agent_templates_tags ON agent_templates USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_agent_templates_created_at ON agent_templates(created_at);
CREATE INDEX IF NOT EXISTS idx_agent_templates_metadata ON agent_templates USING gin(metadata);

-- =====================================================
-- 2. USER MCP CREDENTIALS TABLE
-- =====================================================
-- Stores encrypted MCP credentials per user
CREATE TABLE IF NOT EXISTS user_mcp_credentials (
    credential_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES basejump.accounts(id) ON DELETE CASCADE,
    mcp_qualified_name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    encrypted_config TEXT NOT NULL, -- Encrypted JSON config
    config_hash VARCHAR(64) NOT NULL, -- SHA-256 hash for integrity checking
    is_active BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one credential per user per MCP
    UNIQUE(account_id, mcp_qualified_name)
);

-- Indexes for user_mcp_credentials
CREATE INDEX IF NOT EXISTS idx_user_mcp_credentials_account_id ON user_mcp_credentials(account_id);
CREATE INDEX IF NOT EXISTS idx_user_mcp_credentials_mcp_name ON user_mcp_credentials(mcp_qualified_name);
CREATE INDEX IF NOT EXISTS idx_user_mcp_credentials_is_active ON user_mcp_credentials(is_active);
CREATE INDEX IF NOT EXISTS idx_user_mcp_credentials_last_used ON user_mcp_credentials(last_used_at);

-- =====================================================
-- 3. AGENT INSTANCES TABLE
-- =====================================================
-- Links templates with user credentials to create runnable agents
CREATE TABLE IF NOT EXISTS agent_instances (
    instance_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES agent_templates(template_id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES basejump.accounts(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    credential_mappings JSONB DEFAULT '{}'::jsonb, -- Maps MCP qualified_name to credential_id
    custom_system_prompt TEXT, -- Optional override of template system prompt
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    avatar VARCHAR(10),
    avatar_color VARCHAR(7),
    
    -- For backward compatibility, allow instances without templates (existing agents)
    CONSTRAINT check_template_or_legacy CHECK (
        template_id IS NOT NULL OR 
        (template_id IS NULL AND created_at < NOW()) -- Legacy agents
    )
);

-- Indexes for agent_instances
CREATE INDEX IF NOT EXISTS idx_agent_instances_template_id ON agent_instances(template_id);
CREATE INDEX IF NOT EXISTS idx_agent_instances_account_id ON agent_instances(account_id);
CREATE INDEX IF NOT EXISTS idx_agent_instances_is_active ON agent_instances(is_active);
CREATE INDEX IF NOT EXISTS idx_agent_instances_is_default ON agent_instances(is_default);
CREATE INDEX IF NOT EXISTS idx_agent_instances_created_at ON agent_instances(created_at);

-- Ensure only one default agent per account
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_instances_account_default 
ON agent_instances(account_id, is_default) WHERE is_default = true;

-- =====================================================
-- 4. CREDENTIAL USAGE TRACKING
-- =====================================================
-- Track when and how credentials are used for auditing
CREATE TABLE IF NOT EXISTS credential_usage_log (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credential_id UUID NOT NULL REFERENCES user_mcp_credentials(credential_id) ON DELETE CASCADE,
    instance_id UUID REFERENCES agent_instances(instance_id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL, -- 'connect', 'tool_call', 'disconnect'
    success BOOLEAN NOT NULL,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for credential_usage_log
CREATE INDEX IF NOT EXISTS idx_credential_usage_log_credential_id ON credential_usage_log(credential_id);
CREATE INDEX IF NOT EXISTS idx_credential_usage_log_instance_id ON credential_usage_log(instance_id);
CREATE INDEX IF NOT EXISTS idx_credential_usage_log_created_at ON credential_usage_log(created_at);
CREATE INDEX IF NOT EXISTS idx_credential_usage_log_action ON credential_usage_log(action);

-- =====================================================
-- 5. UPDATE TRIGGERS
-- =====================================================
-- Update triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS trigger_agent_templates_updated_at ON agent_templates;
CREATE TRIGGER trigger_agent_templates_updated_at
    BEFORE UPDATE ON agent_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_timestamp();

DROP TRIGGER IF EXISTS trigger_user_mcp_credentials_updated_at ON user_mcp_credentials;
CREATE TRIGGER trigger_user_mcp_credentials_updated_at
    BEFORE UPDATE ON user_mcp_credentials
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_timestamp();

DROP TRIGGER IF EXISTS trigger_agent_instances_updated_at ON agent_instances;
CREATE TRIGGER trigger_agent_instances_updated_at
    BEFORE UPDATE ON agent_instances
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_timestamp();

-- =====================================================
-- 6. ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on all new tables
ALTER TABLE agent_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_mcp_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE credential_usage_log ENABLE ROW LEVEL SECURITY;

-- Agent Templates Policies
DROP POLICY IF EXISTS agent_templates_select_policy ON agent_templates;
CREATE POLICY agent_templates_select_policy ON agent_templates
    FOR SELECT
    USING (
        is_public = true OR 
        basejump.has_role_on_account(creator_id)
    );

DROP POLICY IF EXISTS agent_templates_insert_policy ON agent_templates;
CREATE POLICY agent_templates_insert_policy ON agent_templates
    FOR INSERT
    WITH CHECK (basejump.has_role_on_account(creator_id, 'owner'));

DROP POLICY IF EXISTS agent_templates_update_policy ON agent_templates;
CREATE POLICY agent_templates_update_policy ON agent_templates
    FOR UPDATE
    USING (basejump.has_role_on_account(creator_id, 'owner'));

DROP POLICY IF EXISTS agent_templates_delete_policy ON agent_templates;
CREATE POLICY agent_templates_delete_policy ON agent_templates
    FOR DELETE
    USING (basejump.has_role_on_account(creator_id, 'owner'));

-- User MCP Credentials Policies (users can only access their own credentials)
DROP POLICY IF EXISTS user_mcp_credentials_select_policy ON user_mcp_credentials;
CREATE POLICY user_mcp_credentials_select_policy ON user_mcp_credentials
    FOR SELECT
    USING (basejump.has_role_on_account(account_id));

DROP POLICY IF EXISTS user_mcp_credentials_insert_policy ON user_mcp_credentials;
CREATE POLICY user_mcp_credentials_insert_policy ON user_mcp_credentials
    FOR INSERT
    WITH CHECK (basejump.has_role_on_account(account_id, 'owner'));

DROP POLICY IF EXISTS user_mcp_credentials_update_policy ON user_mcp_credentials;
CREATE POLICY user_mcp_credentials_update_policy ON user_mcp_credentials
    FOR UPDATE
    USING (basejump.has_role_on_account(account_id, 'owner'));

DROP POLICY IF EXISTS user_mcp_credentials_delete_policy ON user_mcp_credentials;
CREATE POLICY user_mcp_credentials_delete_policy ON user_mcp_credentials
    FOR DELETE
    USING (basejump.has_role_on_account(account_id, 'owner'));

-- Agent Instances Policies
DROP POLICY IF EXISTS agent_instances_select_policy ON agent_instances;
CREATE POLICY agent_instances_select_policy ON agent_instances
    FOR SELECT
    USING (basejump.has_role_on_account(account_id));

DROP POLICY IF EXISTS agent_instances_insert_policy ON agent_instances;
CREATE POLICY agent_instances_insert_policy ON agent_instances
    FOR INSERT
    WITH CHECK (basejump.has_role_on_account(account_id, 'owner'));

DROP POLICY IF EXISTS agent_instances_update_policy ON agent_instances;
CREATE POLICY agent_instances_update_policy ON agent_instances
    FOR UPDATE
    USING (basejump.has_role_on_account(account_id, 'owner'));

DROP POLICY IF EXISTS agent_instances_delete_policy ON agent_instances;
CREATE POLICY agent_instances_delete_policy ON agent_instances
    FOR DELETE
    USING (basejump.has_role_on_account(account_id, 'owner') AND is_default = false);

-- Credential Usage Log Policies
DROP POLICY IF EXISTS credential_usage_log_select_policy ON credential_usage_log;
CREATE POLICY credential_usage_log_select_policy ON credential_usage_log
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_mcp_credentials 
            WHERE user_mcp_credentials.credential_id = credential_usage_log.credential_id
            AND basejump.has_role_on_account(user_mcp_credentials.account_id)
        )
    );

DROP POLICY IF EXISTS credential_usage_log_insert_policy ON credential_usage_log;
CREATE POLICY credential_usage_log_insert_policy ON credential_usage_log
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_mcp_credentials 
            WHERE user_mcp_credentials.credential_id = credential_usage_log.credential_id
            AND basejump.has_role_on_account(user_mcp_credentials.account_id)
        )
    );

-- =====================================================
-- 7. HELPER FUNCTIONS
-- =====================================================

-- Function to create agent template from existing agent
CREATE OR REPLACE FUNCTION create_template_from_agent(
    p_agent_id UUID,
    p_creator_id UUID
)
RETURNS UUID
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
    v_template_id UUID;
    v_agent agents%ROWTYPE;
    v_mcp_requirements JSONB := '[]'::jsonb;
    v_mcp_config JSONB;
BEGIN
    -- Get the agent
    SELECT * INTO v_agent FROM agents WHERE agent_id = p_agent_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agent not found';
    END IF;
    
    -- Check ownership
    IF NOT basejump.has_role_on_account(v_agent.account_id, 'owner') THEN
        RAISE EXCEPTION 'Access denied';
    END IF;
    
    -- Extract MCP requirements (remove credentials)
    FOR v_mcp_config IN SELECT * FROM jsonb_array_elements(v_agent.configured_mcps)
    LOOP
        v_mcp_requirements := v_mcp_requirements || jsonb_build_object(
            'qualifiedName', v_mcp_config->>'qualifiedName',
            'name', v_mcp_config->>'name',
            'enabledTools', v_mcp_config->'enabledTools',
            'requiredConfig', (
                SELECT jsonb_agg(key) 
                FROM jsonb_object_keys(v_mcp_config->'config') AS key
            )
        );
    END LOOP;
    
    -- Create template
    INSERT INTO agent_templates (
        creator_id,
        name,
        description,
        system_prompt,
        mcp_requirements,
        agentpress_tools,
        tags,
        avatar,
        avatar_color
    ) VALUES (
        p_creator_id,
        v_agent.name,
        v_agent.description,
        v_agent.system_prompt,
        v_mcp_requirements,
        v_agent.agentpress_tools,
        v_agent.tags,
        v_agent.avatar,
        v_agent.avatar_color
    ) RETURNING template_id INTO v_template_id;
    
    RETURN v_template_id;
END;
$$;

-- Function to install template as agent instance
CREATE OR REPLACE FUNCTION install_template_as_instance(
    p_template_id UUID,
    p_account_id UUID,
    p_instance_name VARCHAR(255) DEFAULT NULL
)
RETURNS UUID
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
    v_instance_id UUID;
    v_template agent_templates%ROWTYPE;
    v_instance_name VARCHAR(255);
    v_credential_mappings JSONB := '{}'::jsonb;
    v_mcp_req JSONB;
    v_credential_id UUID;
BEGIN
    -- Get template
    SELECT * INTO v_template FROM agent_templates WHERE template_id = p_template_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Template not found';
    END IF;
    
    -- Check if template is public or user owns it
    IF NOT (v_template.is_public OR basejump.has_role_on_account(v_template.creator_id)) THEN
        RAISE EXCEPTION 'Access denied to template';
    END IF;
    
    -- Set instance name
    v_instance_name := COALESCE(p_instance_name, v_template.name || ' (from marketplace)');
    
    -- Build credential mappings
    FOR v_mcp_req IN SELECT * FROM jsonb_array_elements(v_template.mcp_requirements)
    LOOP
        -- Find user's credential for this MCP
        SELECT credential_id INTO v_credential_id
        FROM user_mcp_credentials
        WHERE account_id = p_account_id 
        AND mcp_qualified_name = (v_mcp_req->>'qualifiedName')
        AND is_active = true;
        
        IF v_credential_id IS NOT NULL THEN
            v_credential_mappings := v_credential_mappings || 
                jsonb_build_object(v_mcp_req->>'qualifiedName', v_credential_id);
        END IF;
    END LOOP;
    
    -- Create agent instance
    INSERT INTO agent_instances (
        template_id,
        account_id,
        name,
        description,
        credential_mappings,
        avatar,
        avatar_color
    ) VALUES (
        p_template_id,
        p_account_id,
        v_instance_name,
        v_template.description,
        v_credential_mappings,
        v_template.avatar,
        v_template.avatar_color
    ) RETURNING instance_id INTO v_instance_id;
    
    -- Update template download count
    UPDATE agent_templates 
    SET download_count = download_count + 1 
    WHERE template_id = p_template_id;
    
    RETURN v_instance_id;
END;
$$;

-- Function to get missing credentials for template
CREATE OR REPLACE FUNCTION get_missing_credentials_for_template(
    p_template_id UUID,
    p_account_id UUID
)
RETURNS TABLE (
    qualified_name VARCHAR(255),
    display_name VARCHAR(255),
    required_config TEXT[]
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (mcp_req->>'qualifiedName')::VARCHAR(255) as qualified_name,
        (mcp_req->>'name')::VARCHAR(255) as display_name,
        ARRAY(SELECT jsonb_array_elements_text(mcp_req->'requiredConfig')) as required_config
    FROM agent_templates t,
         jsonb_array_elements(t.mcp_requirements) as mcp_req
    WHERE t.template_id = p_template_id
    AND NOT EXISTS (
        SELECT 1 FROM user_mcp_credentials c
        WHERE c.account_id = p_account_id
        AND c.mcp_qualified_name = (mcp_req->>'qualifiedName')
        AND c.is_active = true
    );
END;
$$;

GRANT EXECUTE ON FUNCTION create_template_from_agent(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION install_template_as_instance(UUID, UUID, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION get_missing_credentials_for_template(UUID, UUID) TO authenticated;

GRANT ALL PRIVILEGES ON TABLE agent_templates TO authenticated, service_role;
GRANT ALL PRIVILEGES ON TABLE user_mcp_credentials TO authenticated, service_role;
GRANT ALL PRIVILEGES ON TABLE agent_instances TO authenticated, service_role;
GRANT ALL PRIVILEGES ON TABLE credential_usage_log TO authenticated, service_role;

COMMIT; 


-- Migration: 20250529125628_agent_marketplace.sql
BEGIN;

-- Add marketplace fields to agents table
ALTER TABLE agents ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS marketplace_published_at TIMESTAMPTZ;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS download_count INTEGER DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_agents_is_public ON agents(is_public);
CREATE INDEX IF NOT EXISTS idx_agents_marketplace_published_at ON agents(marketplace_published_at);
CREATE INDEX IF NOT EXISTS idx_agents_download_count ON agents(download_count);
CREATE INDEX IF NOT EXISTS idx_agents_tags ON agents USING gin(tags);

CREATE TABLE IF NOT EXISTS user_agent_library (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_account_id UUID NOT NULL REFERENCES basejump.accounts(id) ON DELETE CASCADE,
    original_agent_id UUID NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    is_favorite BOOLEAN DEFAULT false,
    
    UNIQUE(user_account_id, original_agent_id)
);

CREATE INDEX IF NOT EXISTS idx_user_agent_library_user_account ON user_agent_library(user_account_id);
CREATE INDEX IF NOT EXISTS idx_user_agent_library_original_agent ON user_agent_library(original_agent_id);
CREATE INDEX IF NOT EXISTS idx_user_agent_library_agent_id ON user_agent_library(agent_id);
CREATE INDEX IF NOT EXISTS idx_user_agent_library_added_at ON user_agent_library(added_at);

ALTER TABLE user_agent_library ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_agent_library_select_own ON user_agent_library;
DROP POLICY IF EXISTS user_agent_library_insert_own ON user_agent_library;
DROP POLICY IF EXISTS user_agent_library_update_own ON user_agent_library;
DROP POLICY IF EXISTS user_agent_library_delete_own ON user_agent_library;

CREATE POLICY user_agent_library_select_own ON user_agent_library
    FOR SELECT
    USING (basejump.has_role_on_account(user_account_id));

CREATE POLICY user_agent_library_insert_own ON user_agent_library
    FOR INSERT
    WITH CHECK (basejump.has_role_on_account(user_account_id));

CREATE POLICY user_agent_library_update_own ON user_agent_library
    FOR UPDATE
    USING (basejump.has_role_on_account(user_account_id));

CREATE POLICY user_agent_library_delete_own ON user_agent_library
    FOR DELETE
    USING (basejump.has_role_on_account(user_account_id));

DROP POLICY IF EXISTS agents_select_marketplace ON agents;
CREATE POLICY agents_select_marketplace ON agents
    FOR SELECT
    USING (
        is_public = true OR
        basejump.has_role_on_account(account_id)
    );

CREATE OR REPLACE FUNCTION publish_agent_to_marketplace(p_agent_id UUID)
RETURNS void
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM agents 
        WHERE agent_id = p_agent_id 
        AND basejump.has_role_on_account(account_id, 'owner')
    ) THEN
        RAISE EXCEPTION 'Agent not found or access denied';
    END IF;
    
    UPDATE agents 
    SET 
        is_public = true,
        marketplace_published_at = NOW()
    WHERE agent_id = p_agent_id;
END;
$$;

CREATE OR REPLACE FUNCTION unpublish_agent_from_marketplace(p_agent_id UUID)
RETURNS void
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM agents 
        WHERE agent_id = p_agent_id 
        AND basejump.has_role_on_account(account_id, 'owner')
    ) THEN
        RAISE EXCEPTION 'Agent not found or access denied';
    END IF;
    
    UPDATE agents 
    SET 
        is_public = false,
        marketplace_published_at = NULL
    WHERE agent_id = p_agent_id;
END;
$$;

-- Drop existing functions to avoid conflicts
DROP FUNCTION IF EXISTS add_agent_to_library(UUID);
DROP FUNCTION IF EXISTS add_agent_to_library(UUID, UUID);

CREATE OR REPLACE FUNCTION add_agent_to_library(
    p_original_agent_id UUID,
    p_user_account_id UUID
)
RETURNS UUID
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
    v_new_agent_id UUID;
    v_original_agent agents%ROWTYPE;
BEGIN
    SELECT * INTO v_original_agent
    FROM agents 
    WHERE agent_id = p_original_agent_id AND is_public = true;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agent not found or not public';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM user_agent_library 
        WHERE user_account_id = p_user_account_id 
        AND original_agent_id = p_original_agent_id
    ) THEN
        RAISE EXCEPTION 'Agent already in your library';
    END IF;
    
    INSERT INTO agents (
        account_id,
        name,
        description,
        system_prompt,
        configured_mcps,
        agentpress_tools,
        is_default,
        is_public,
        tags,
        avatar,
        avatar_color
    ) VALUES (
        p_user_account_id,
        v_original_agent.name || ' (from marketplace)',
        v_original_agent.description,
        v_original_agent.system_prompt,
        v_original_agent.configured_mcps,
        v_original_agent.agentpress_tools,
        false,
        false,
        v_original_agent.tags,
        v_original_agent.avatar,
        v_original_agent.avatar_color
    ) RETURNING agent_id INTO v_new_agent_id;
    
    INSERT INTO user_agent_library (
        user_account_id,
        original_agent_id,
        agent_id
    ) VALUES (
        p_user_account_id,
        p_original_agent_id,
        v_new_agent_id
    );
    
    UPDATE agents 
    SET download_count = download_count + 1 
    WHERE agent_id = p_original_agent_id;
    
    RETURN v_new_agent_id;
END;
$$;

-- Drop existing function to avoid type conflicts
DROP FUNCTION IF EXISTS get_marketplace_agents(INTEGER, INTEGER, TEXT, TEXT[]);

CREATE OR REPLACE FUNCTION get_marketplace_agents(
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0,
    p_search TEXT DEFAULT NULL,
    p_tags TEXT[] DEFAULT NULL
)
RETURNS TABLE (
    agent_id UUID,
    name VARCHAR(255),
    description TEXT,
    system_prompt TEXT,
    configured_mcps JSONB,
    agentpress_tools JSONB,
    tags TEXT[],
    download_count INTEGER,
    marketplace_published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    creator_name TEXT,
    avatar TEXT,
    avatar_color TEXT
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.agent_id,
        a.name,
        a.description,
        a.system_prompt,
        a.configured_mcps,
        a.agentpress_tools,
        a.tags,
        a.download_count,
        a.marketplace_published_at,
        a.created_at,
        COALESCE(acc.name, 'Anonymous')::TEXT as creator_name,
        a.avatar::TEXT,
        a.avatar_color::TEXT
    FROM agents a
    LEFT JOIN basejump.accounts acc ON a.account_id = acc.id
    WHERE a.is_public = true
    AND (p_search IS NULL OR 
         a.name ILIKE '%' || p_search || '%' OR 
         a.description ILIKE '%' || p_search || '%')
    AND (p_tags IS NULL OR a.tags && p_tags)
    ORDER BY a.marketplace_published_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION publish_agent_to_marketplace TO authenticated;
GRANT EXECUTE ON FUNCTION unpublish_agent_from_marketplace TO authenticated;
GRANT EXECUTE ON FUNCTION add_agent_to_library(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_marketplace_agents(INTEGER, INTEGER, TEXT, TEXT[]) TO authenticated, anon;
GRANT ALL PRIVILEGES ON TABLE user_agent_library TO authenticated, service_role;

COMMIT; 


-- Migration: 20250601000000_add_thread_metadata.sql
-- Add metadata column to threads table to store additional context
ALTER TABLE threads ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Create index for metadata queries
CREATE INDEX IF NOT EXISTS idx_threads_metadata ON threads USING GIN (metadata);

-- Comment on the column
COMMENT ON COLUMN threads.metadata IS 'Stores additional thread context like agent builder mode and target agent';

-- Add agent_id to messages table to support per-message agent selection
ALTER TABLE messages ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES agents(agent_id) ON DELETE SET NULL;

-- Create index for message agent queries
CREATE INDEX IF NOT EXISTS idx_messages_agent_id ON messages(agent_id);

-- Comment on the new column
COMMENT ON COLUMN messages.agent_id IS 'ID of the agent that generated this message. For user messages, this represents the agent that should respond to this message.';

-- Make thread agent_id nullable to allow agent-agnostic threads
-- This is already nullable from the existing migration, but we'll add a comment
COMMENT ON COLUMN threads.agent_id IS 'Optional default agent for the thread. If NULL, agent can be selected per message.'; 


-- Migration: 20250602000000_add_custom_mcps_column.sql
BEGIN;

ALTER TABLE agents ADD COLUMN IF NOT EXISTS custom_mcps JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_agents_custom_mcps ON agents USING GIN (custom_mcps);

COMMENT ON COLUMN agents.custom_mcps IS 'Stores custom MCP server configurations added by users (JSON or SSE endpoints)';

COMMIT; 


-- Migration: 20250607000000_fix_encrypted_config_column.sql
BEGIN;

-- Fix encrypted_config column type to store base64 strings properly
-- Change from BYTEA to TEXT to avoid encoding issues

-- Only proceed if the table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_mcp_credentials') THEN
        DELETE FROM user_mcp_credentials;
        ALTER TABLE user_mcp_credentials 
        ALTER COLUMN encrypted_config TYPE TEXT;
    END IF;
END $$;

COMMIT; 


-- Migration: 20250618000000_credential_profiles.sql
BEGIN;

CREATE TABLE user_mcp_credential_profiles (
    profile_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL,
    mcp_qualified_name TEXT NOT NULL,
    profile_name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    encrypted_config TEXT NOT NULL,
    config_hash TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(account_id, mcp_qualified_name, profile_name),
    CONSTRAINT fk_credential_profiles_account 
        FOREIGN KEY (account_id) 
        REFERENCES auth.users(id) 
        ON DELETE CASCADE
);

CREATE INDEX idx_credential_profiles_account_mcp 
    ON user_mcp_credential_profiles(account_id, mcp_qualified_name);

CREATE INDEX idx_credential_profiles_account_active 
    ON user_mcp_credential_profiles(account_id, is_active) 
    WHERE is_active = true;

CREATE INDEX idx_credential_profiles_default 
    ON user_mcp_credential_profiles(account_id, mcp_qualified_name, is_default) 
    WHERE is_default = true;

ALTER TABLE user_mcp_credential_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY credential_profiles_user_access 
    ON user_mcp_credential_profiles 
    FOR ALL 
    USING (auth.uid() = account_id);

ALTER TABLE workflows 
ADD COLUMN mcp_credential_mappings JSONB DEFAULT '{}';

COMMENT ON COLUMN workflows.mcp_credential_mappings IS 
'JSON mapping of MCP qualified names to credential profile IDs. Example: {"github": "profile_id_123", "slack": "profile_id_456"}';

-- Migrate existing credentials if the table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_mcp_credentials') THEN
        INSERT INTO user_mcp_credential_profiles (
            account_id,
            mcp_qualified_name,
            profile_name,
            display_name,
            encrypted_config,
            config_hash,
            is_active,
            is_default,
            created_at,
            updated_at,
            last_used_at
        )
        SELECT 
            account_id,
            mcp_qualified_name,
            'Default' as profile_name,
            COALESCE(display_name, mcp_qualified_name) as display_name,
            encrypted_config,
            config_hash,
            is_active,
            true as is_default,
            created_at,
            updated_at,
            last_used_at
        FROM user_mcp_credentials
        WHERE is_active = true;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION ensure_single_default_profile()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_default = true THEN
        UPDATE user_mcp_credential_profiles 
        SET is_default = false, updated_at = NOW()
        WHERE account_id = NEW.account_id 
          AND mcp_qualified_name = NEW.mcp_qualified_name 
          AND profile_id != NEW.profile_id
          AND is_default = true;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ensure_single_default_profile
    BEFORE INSERT OR UPDATE ON user_mcp_credential_profiles
    FOR EACH ROW
    EXECUTE FUNCTION ensure_single_default_profile();

CREATE OR REPLACE FUNCTION update_credential_profile_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_credential_profile_timestamp
    BEFORE UPDATE ON user_mcp_credential_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_credential_profile_timestamp();

COMMIT; 


-- Migration: 20250624065047_secure_credentials.sql
BEGIN;

-- =====================================================
-- SECURE MCP CREDENTIAL ARCHITECTURE MIGRATION
-- =====================================================
-- This migration implements a secure architecture where:
-- 1. Agent templates contain MCP requirements (no credentials)
-- 2. User credentials are stored encrypted separately
-- 3. Agent instances combine templates with user credentials at runtime

-- =====================================================
-- 1. AGENT TEMPLATES TABLE
-- =====================================================
-- Stores marketplace agent templates without any credentials
CREATE TABLE IF NOT EXISTS agent_templates (
    template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES basejump.accounts(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    system_prompt TEXT NOT NULL,
    mcp_requirements JSONB DEFAULT '[]'::jsonb, -- No credentials, just requirements
    agentpress_tools JSONB DEFAULT '{}'::jsonb,
    tags TEXT[] DEFAULT '{}',
    is_public BOOLEAN DEFAULT FALSE,
    marketplace_published_at TIMESTAMPTZ,
    download_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    avatar VARCHAR(10),
    avatar_color VARCHAR(7),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for agent_templates
CREATE INDEX IF NOT EXISTS idx_agent_templates_creator_id ON agent_templates(creator_id);
CREATE INDEX IF NOT EXISTS idx_agent_templates_is_public ON agent_templates(is_public);
CREATE INDEX IF NOT EXISTS idx_agent_templates_marketplace_published_at ON agent_templates(marketplace_published_at);
CREATE INDEX IF NOT EXISTS idx_agent_templates_download_count ON agent_templates(download_count);
CREATE INDEX IF NOT EXISTS idx_agent_templates_tags ON agent_templates USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_agent_templates_created_at ON agent_templates(created_at);
CREATE INDEX IF NOT EXISTS idx_agent_templates_metadata ON agent_templates USING gin(metadata);

-- =====================================================
-- 2. USER MCP CREDENTIALS TABLE
-- =====================================================
-- Stores encrypted MCP credentials per user
CREATE TABLE IF NOT EXISTS user_mcp_credentials (
    credential_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES basejump.accounts(id) ON DELETE CASCADE,
    mcp_qualified_name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    encrypted_config TEXT NOT NULL, -- Encrypted JSON config
    config_hash VARCHAR(64) NOT NULL, -- SHA-256 hash for integrity checking
    is_active BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one credential per user per MCP
    UNIQUE(account_id, mcp_qualified_name)
);

-- Indexes for user_mcp_credentials
CREATE INDEX IF NOT EXISTS idx_user_mcp_credentials_account_id ON user_mcp_credentials(account_id);
CREATE INDEX IF NOT EXISTS idx_user_mcp_credentials_mcp_name ON user_mcp_credentials(mcp_qualified_name);
CREATE INDEX IF NOT EXISTS idx_user_mcp_credentials_is_active ON user_mcp_credentials(is_active);
CREATE INDEX IF NOT EXISTS idx_user_mcp_credentials_last_used ON user_mcp_credentials(last_used_at);

-- =====================================================
-- 3. AGENT INSTANCES TABLE
-- =====================================================
-- Links templates with user credentials to create runnable agents
CREATE TABLE IF NOT EXISTS agent_instances (
    instance_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES agent_templates(template_id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES basejump.accounts(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    credential_mappings JSONB DEFAULT '{}'::jsonb, -- Maps MCP qualified_name to credential_id
    custom_system_prompt TEXT, -- Optional override of template system prompt
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    avatar VARCHAR(10),
    avatar_color VARCHAR(7),
    
    -- For backward compatibility, allow instances without templates (existing agents)
    CONSTRAINT check_template_or_legacy CHECK (
        template_id IS NOT NULL OR 
        (template_id IS NULL AND created_at < NOW()) -- Legacy agents
    )
);

-- Indexes for agent_instances
CREATE INDEX IF NOT EXISTS idx_agent_instances_template_id ON agent_instances(template_id);
CREATE INDEX IF NOT EXISTS idx_agent_instances_account_id ON agent_instances(account_id);
CREATE INDEX IF NOT EXISTS idx_agent_instances_is_active ON agent_instances(is_active);
CREATE INDEX IF NOT EXISTS idx_agent_instances_is_default ON agent_instances(is_default);
CREATE INDEX IF NOT EXISTS idx_agent_instances_created_at ON agent_instances(created_at);

-- Ensure only one default agent per account
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_instances_account_default 
ON agent_instances(account_id, is_default) WHERE is_default = true;

-- =====================================================
-- 4. CREDENTIAL USAGE TRACKING
-- =====================================================
-- Track when and how credentials are used for auditing
CREATE TABLE IF NOT EXISTS credential_usage_log (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credential_id UUID NOT NULL REFERENCES user_mcp_credentials(credential_id) ON DELETE CASCADE,
    instance_id UUID REFERENCES agent_instances(instance_id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL, -- 'connect', 'tool_call', 'disconnect'
    success BOOLEAN NOT NULL,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for credential_usage_log
CREATE INDEX IF NOT EXISTS idx_credential_usage_log_credential_id ON credential_usage_log(credential_id);
CREATE INDEX IF NOT EXISTS idx_credential_usage_log_instance_id ON credential_usage_log(instance_id);
CREATE INDEX IF NOT EXISTS idx_credential_usage_log_created_at ON credential_usage_log(created_at);
CREATE INDEX IF NOT EXISTS idx_credential_usage_log_action ON credential_usage_log(action);

-- =====================================================
-- 5. UPDATE TRIGGERS
-- =====================================================
-- Update triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS trigger_agent_templates_updated_at ON agent_templates;
CREATE TRIGGER trigger_agent_templates_updated_at
    BEFORE UPDATE ON agent_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_timestamp();

DROP TRIGGER IF EXISTS trigger_user_mcp_credentials_updated_at ON user_mcp_credentials;
CREATE TRIGGER trigger_user_mcp_credentials_updated_at
    BEFORE UPDATE ON user_mcp_credentials
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_timestamp();

DROP TRIGGER IF EXISTS trigger_agent_instances_updated_at ON agent_instances;
CREATE TRIGGER trigger_agent_instances_updated_at
    BEFORE UPDATE ON agent_instances
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_timestamp();

-- =====================================================
-- 6. ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on all new tables
ALTER TABLE agent_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_mcp_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE credential_usage_log ENABLE ROW LEVEL SECURITY;

-- Agent Templates Policies
DROP POLICY IF EXISTS agent_templates_select_policy ON agent_templates;
CREATE POLICY agent_templates_select_policy ON agent_templates
    FOR SELECT
    USING (
        is_public = true OR 
        basejump.has_role_on_account(creator_id)
    );

DROP POLICY IF EXISTS agent_templates_insert_policy ON agent_templates;
CREATE POLICY agent_templates_insert_policy ON agent_templates
    FOR INSERT
    WITH CHECK (basejump.has_role_on_account(creator_id, 'owner'));

DROP POLICY IF EXISTS agent_templates_update_policy ON agent_templates;
CREATE POLICY agent_templates_update_policy ON agent_templates
    FOR UPDATE
    USING (basejump.has_role_on_account(creator_id, 'owner'));

DROP POLICY IF EXISTS agent_templates_delete_policy ON agent_templates;
CREATE POLICY agent_templates_delete_policy ON agent_templates
    FOR DELETE
    USING (basejump.has_role_on_account(creator_id, 'owner'));

-- User MCP Credentials Policies (users can only access their own credentials)
DROP POLICY IF EXISTS user_mcp_credentials_select_policy ON user_mcp_credentials;
CREATE POLICY user_mcp_credentials_select_policy ON user_mcp_credentials
    FOR SELECT
    USING (basejump.has_role_on_account(account_id));

DROP POLICY IF EXISTS user_mcp_credentials_insert_policy ON user_mcp_credentials;
CREATE POLICY user_mcp_credentials_insert_policy ON user_mcp_credentials
    FOR INSERT
    WITH CHECK (basejump.has_role_on_account(account_id, 'owner'));

DROP POLICY IF EXISTS user_mcp_credentials_update_policy ON user_mcp_credentials;
CREATE POLICY user_mcp_credentials_update_policy ON user_mcp_credentials
    FOR UPDATE
    USING (basejump.has_role_on_account(account_id, 'owner'));

DROP POLICY IF EXISTS user_mcp_credentials_delete_policy ON user_mcp_credentials;
CREATE POLICY user_mcp_credentials_delete_policy ON user_mcp_credentials
    FOR DELETE
    USING (basejump.has_role_on_account(account_id, 'owner'));

-- Agent Instances Policies
DROP POLICY IF EXISTS agent_instances_select_policy ON agent_instances;
CREATE POLICY agent_instances_select_policy ON agent_instances
    FOR SELECT
    USING (basejump.has_role_on_account(account_id));

DROP POLICY IF EXISTS agent_instances_insert_policy ON agent_instances;
CREATE POLICY agent_instances_insert_policy ON agent_instances
    FOR INSERT
    WITH CHECK (basejump.has_role_on_account(account_id, 'owner'));

DROP POLICY IF EXISTS agent_instances_update_policy ON agent_instances;
CREATE POLICY agent_instances_update_policy ON agent_instances
    FOR UPDATE
    USING (basejump.has_role_on_account(account_id, 'owner'));

DROP POLICY IF EXISTS agent_instances_delete_policy ON agent_instances;
CREATE POLICY agent_instances_delete_policy ON agent_instances
    FOR DELETE
    USING (basejump.has_role_on_account(account_id, 'owner') AND is_default = false);

-- Credential Usage Log Policies
DROP POLICY IF EXISTS credential_usage_log_select_policy ON credential_usage_log;
CREATE POLICY credential_usage_log_select_policy ON credential_usage_log
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_mcp_credentials 
            WHERE user_mcp_credentials.credential_id = credential_usage_log.credential_id
            AND basejump.has_role_on_account(user_mcp_credentials.account_id)
        )
    );

DROP POLICY IF EXISTS credential_usage_log_insert_policy ON credential_usage_log;
CREATE POLICY credential_usage_log_insert_policy ON credential_usage_log
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_mcp_credentials 
            WHERE user_mcp_credentials.credential_id = credential_usage_log.credential_id
            AND basejump.has_role_on_account(user_mcp_credentials.account_id)
        )
    );

-- =====================================================
-- 7. HELPER FUNCTIONS
-- =====================================================

-- Function to create agent template from existing agent
CREATE OR REPLACE FUNCTION create_template_from_agent(
    p_agent_id UUID,
    p_creator_id UUID
)
RETURNS UUID
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
    v_template_id UUID;
    v_agent agents%ROWTYPE;
    v_mcp_requirements JSONB := '[]'::jsonb;
    v_mcp_config JSONB;
BEGIN
    -- Get the agent
    SELECT * INTO v_agent FROM agents WHERE agent_id = p_agent_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agent not found';
    END IF;
    
    -- Check ownership
    IF NOT basejump.has_role_on_account(v_agent.account_id, 'owner') THEN
        RAISE EXCEPTION 'Access denied';
    END IF;
    
    -- Extract MCP requirements (remove credentials)
    FOR v_mcp_config IN SELECT * FROM jsonb_array_elements(v_agent.configured_mcps)
    LOOP
        v_mcp_requirements := v_mcp_requirements || jsonb_build_object(
            'qualifiedName', v_mcp_config->>'qualifiedName',
            'name', v_mcp_config->>'name',
            'enabledTools', v_mcp_config->'enabledTools',
            'requiredConfig', (
                SELECT jsonb_agg(key) 
                FROM jsonb_object_keys(v_mcp_config->'config') AS key
            )
        );
    END LOOP;
    
    -- Create template
    INSERT INTO agent_templates (
        creator_id,
        name,
        description,
        system_prompt,
        mcp_requirements,
        agentpress_tools,
        tags,
        avatar,
        avatar_color
    ) VALUES (
        p_creator_id,
        v_agent.name,
        v_agent.description,
        v_agent.system_prompt,
        v_mcp_requirements,
        v_agent.agentpress_tools,
        v_agent.tags,
        v_agent.avatar,
        v_agent.avatar_color
    ) RETURNING template_id INTO v_template_id;
    
    RETURN v_template_id;
END;
$$;

-- Function to install template as agent instance
CREATE OR REPLACE FUNCTION install_template_as_instance(
    p_template_id UUID,
    p_account_id UUID,
    p_instance_name VARCHAR(255) DEFAULT NULL
)
RETURNS UUID
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
    v_instance_id UUID;
    v_template agent_templates%ROWTYPE;
    v_instance_name VARCHAR(255);
    v_credential_mappings JSONB := '{}'::jsonb;
    v_mcp_req JSONB;
    v_credential_id UUID;
BEGIN
    -- Get template
    SELECT * INTO v_template FROM agent_templates WHERE template_id = p_template_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Template not found';
    END IF;
    
    -- Check if template is public or user owns it
    IF NOT (v_template.is_public OR basejump.has_role_on_account(v_template.creator_id)) THEN
        RAISE EXCEPTION 'Access denied to template';
    END IF;
    
    -- Set instance name
    v_instance_name := COALESCE(p_instance_name, v_template.name || ' (from marketplace)');
    
    -- Build credential mappings
    FOR v_mcp_req IN SELECT * FROM jsonb_array_elements(v_template.mcp_requirements)
    LOOP
        -- Find user's credential for this MCP
        SELECT credential_id INTO v_credential_id
        FROM user_mcp_credentials
        WHERE account_id = p_account_id 
        AND mcp_qualified_name = (v_mcp_req->>'qualifiedName')
        AND is_active = true;
        
        IF v_credential_id IS NOT NULL THEN
            v_credential_mappings := v_credential_mappings || 
                jsonb_build_object(v_mcp_req->>'qualifiedName', v_credential_id);
        END IF;
    END LOOP;
    
    -- Create agent instance
    INSERT INTO agent_instances (
        template_id,
        account_id,
        name,
        description,
        credential_mappings,
        avatar,
        avatar_color
    ) VALUES (
        p_template_id,
        p_account_id,
        v_instance_name,
        v_template.description,
        v_credential_mappings,
        v_template.avatar,
        v_template.avatar_color
    ) RETURNING instance_id INTO v_instance_id;
    
    -- Update template download count
    UPDATE agent_templates 
    SET download_count = download_count + 1 
    WHERE template_id = p_template_id;
    
    RETURN v_instance_id;
END;
$$;

-- Function to get missing credentials for template
CREATE OR REPLACE FUNCTION get_missing_credentials_for_template(
    p_template_id UUID,
    p_account_id UUID
)
RETURNS TABLE (
    qualified_name VARCHAR(255),
    display_name VARCHAR(255),
    required_config TEXT[]
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (mcp_req->>'qualifiedName')::VARCHAR(255) as qualified_name,
        (mcp_req->>'name')::VARCHAR(255) as display_name,
        ARRAY(SELECT jsonb_array_elements_text(mcp_req->'requiredConfig')) as required_config
    FROM agent_templates t,
         jsonb_array_elements(t.mcp_requirements) as mcp_req
    WHERE t.template_id = p_template_id
    AND NOT EXISTS (
        SELECT 1 FROM user_mcp_credentials c
        WHERE c.account_id = p_account_id
        AND c.mcp_qualified_name = (mcp_req->>'qualifiedName')
        AND c.is_active = true
    );
END;
$$;

GRANT EXECUTE ON FUNCTION create_template_from_agent(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION install_template_as_instance(UUID, UUID, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION get_missing_credentials_for_template(UUID, UUID) TO authenticated;

GRANT ALL PRIVILEGES ON TABLE agent_templates TO authenticated, service_role;
GRANT ALL PRIVILEGES ON TABLE user_mcp_credentials TO authenticated, service_role;
GRANT ALL PRIVILEGES ON TABLE agent_instances TO authenticated, service_role;
GRANT ALL PRIVILEGES ON TABLE credential_usage_log TO authenticated, service_role;

COMMIT; 


-- Migration: 20250624093857_knowledge_base.sql
BEGIN;

CREATE TABLE IF NOT EXISTS knowledge_base_entries (
    entry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES threads(thread_id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES basejump.accounts(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    content TEXT NOT NULL,
    content_tokens INTEGER, -- Token count for content management
    
    usage_context VARCHAR(100) DEFAULT 'always', -- 'always', 'on_request', 'contextual'
    
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_accessed_at TIMESTAMPTZ,

    CONSTRAINT kb_entries_valid_usage_context CHECK (
        usage_context IN ('always', 'on_request', 'contextual')
    ),
    CONSTRAINT kb_entries_content_not_empty CHECK (
        content IS NOT NULL AND LENGTH(TRIM(content)) > 0
    )
);


CREATE TABLE IF NOT EXISTS knowledge_base_usage_log (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id UUID NOT NULL REFERENCES knowledge_base_entries(entry_id) ON DELETE CASCADE,
    thread_id UUID NOT NULL REFERENCES threads(thread_id) ON DELETE CASCADE,

    usage_type VARCHAR(50) NOT NULL, -- 'context_injection', 'manual_reference'
    tokens_used INTEGER, -- How many tokens were used
    
    -- Timestamps
    used_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kb_entries_thread_id ON knowledge_base_entries(thread_id);
CREATE INDEX IF NOT EXISTS idx_kb_entries_account_id ON knowledge_base_entries(account_id);
CREATE INDEX IF NOT EXISTS idx_kb_entries_is_active ON knowledge_base_entries(is_active);
CREATE INDEX IF NOT EXISTS idx_kb_entries_usage_context ON knowledge_base_entries(usage_context);
CREATE INDEX IF NOT EXISTS idx_kb_entries_created_at ON knowledge_base_entries(created_at);

CREATE INDEX IF NOT EXISTS idx_kb_usage_entry_id ON knowledge_base_usage_log(entry_id);
CREATE INDEX IF NOT EXISTS idx_kb_usage_thread_id ON knowledge_base_usage_log(thread_id);
CREATE INDEX IF NOT EXISTS idx_kb_usage_used_at ON knowledge_base_usage_log(used_at);

ALTER TABLE knowledge_base_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY kb_entries_user_access ON knowledge_base_entries
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM threads t
            LEFT JOIN projects p ON t.project_id = p.project_id
            WHERE t.thread_id = knowledge_base_entries.thread_id
            AND (
                basejump.has_role_on_account(t.account_id) = true OR 
                basejump.has_role_on_account(p.account_id) = true OR
                basejump.has_role_on_account(knowledge_base_entries.account_id) = true
            )
        )
    );

CREATE POLICY kb_usage_log_user_access ON knowledge_base_usage_log
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM threads t
            LEFT JOIN projects p ON t.project_id = p.project_id
            WHERE t.thread_id = knowledge_base_usage_log.thread_id
            AND (
                basejump.has_role_on_account(t.account_id) = true OR 
                basejump.has_role_on_account(p.account_id) = true
            )
        )
    );

CREATE OR REPLACE FUNCTION get_thread_knowledge_base(
    p_thread_id UUID,
    p_include_inactive BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
    entry_id UUID,
    name VARCHAR(255),
    description TEXT,
    content TEXT,
    usage_context VARCHAR(100),
    is_active BOOLEAN,
    created_at TIMESTAMPTZ
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        kbe.entry_id,
        kbe.name,
        kbe.description,
        kbe.content,
        kbe.usage_context,
        kbe.is_active,
        kbe.created_at
    FROM knowledge_base_entries kbe
    WHERE kbe.thread_id = p_thread_id
    AND (p_include_inactive OR kbe.is_active = TRUE)
    ORDER BY kbe.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION get_knowledge_base_context(
    p_thread_id UUID,
    p_max_tokens INTEGER DEFAULT 4000
)
RETURNS TEXT
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
    context_text TEXT := '';
    entry_record RECORD;
    current_tokens INTEGER := 0;
    estimated_tokens INTEGER;
BEGIN
    FOR entry_record IN
        SELECT 
            name,
            description,
            content,
            content_tokens
        FROM knowledge_base_entries
        WHERE thread_id = p_thread_id
        AND is_active = TRUE
        AND usage_context IN ('always', 'contextual')
        ORDER BY created_at DESC
    LOOP
        estimated_tokens := COALESCE(entry_record.content_tokens, LENGTH(entry_record.content) / 4);
        
        IF current_tokens + estimated_tokens > p_max_tokens THEN
            EXIT;
        END IF;
        
        context_text := context_text || E'\n\n## Knowledge Base: ' || entry_record.name || E'\n';
        
        IF entry_record.description IS NOT NULL AND entry_record.description != '' THEN
            context_text := context_text || entry_record.description || E'\n\n';
        END IF;
        
        context_text := context_text || entry_record.content;
        
        current_tokens := current_tokens + estimated_tokens;
        
        INSERT INTO knowledge_base_usage_log (entry_id, thread_id, usage_type, tokens_used)
        SELECT entry_id, p_thread_id, 'context_injection', estimated_tokens
        FROM knowledge_base_entries
        WHERE thread_id = p_thread_id AND name = entry_record.name
        LIMIT 1;
    END LOOP;
    
    RETURN CASE 
        WHEN context_text = '' THEN NULL
        ELSE E'# KNOWLEDGE BASE CONTEXT\n\nThe following information is from your knowledge base and should be used as reference when responding to the user:' || context_text
    END;
END;
$$;

CREATE OR REPLACE FUNCTION update_kb_entry_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    IF NEW.content != OLD.content THEN
        NEW.content_tokens = LENGTH(NEW.content) / 4;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_kb_entries_updated_at
    BEFORE UPDATE ON knowledge_base_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_kb_entry_timestamp();

CREATE OR REPLACE FUNCTION calculate_kb_entry_tokens()
RETURNS TRIGGER AS $$
BEGIN
    NEW.content_tokens = LENGTH(NEW.content) / 4;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_kb_entries_calculate_tokens
    BEFORE INSERT ON knowledge_base_entries
    FOR EACH ROW
    EXECUTE FUNCTION calculate_kb_entry_tokens();

GRANT ALL PRIVILEGES ON TABLE knowledge_base_entries TO authenticated, service_role;
GRANT ALL PRIVILEGES ON TABLE knowledge_base_usage_log TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION get_thread_knowledge_base TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_knowledge_base_context TO authenticated, service_role;

COMMENT ON TABLE knowledge_base_entries IS 'Stores manual knowledge base entries for threads, similar to ChatGPT custom instructions';
COMMENT ON TABLE knowledge_base_usage_log IS 'Logs when and how knowledge base entries are used';

COMMENT ON FUNCTION get_thread_knowledge_base IS 'Retrieves all knowledge base entries for a specific thread';
COMMENT ON FUNCTION get_knowledge_base_context IS 'Generates knowledge base context text for agent prompts';

COMMIT;


-- Migration: 20250626092143_agent_agnostic_thread.sql
-- Migration: Make threads agent-agnostic with proper agent versioning support
-- This migration enables per-message agent selection with version tracking

BEGIN;

-- Add agent version tracking to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES agents(agent_id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS agent_version_id UUID REFERENCES agent_versions(version_id) ON DELETE SET NULL;

-- Create indexes for message agent queries
CREATE INDEX IF NOT EXISTS idx_messages_agent_id ON messages(agent_id);
CREATE INDEX IF NOT EXISTS idx_messages_agent_version_id ON messages(agent_version_id);

-- Comments on the new columns
COMMENT ON COLUMN messages.agent_id IS 'ID of the agent that generated this message. For user messages, this represents the agent that should respond to this message.';
COMMENT ON COLUMN messages.agent_version_id IS 'Specific version of the agent used for this message. This is the actual configuration that was active.';

-- Update comment on thread agent_id to reflect new agent-agnostic approach
COMMENT ON COLUMN threads.agent_id IS 'Optional default agent for the thread. If NULL, agent can be selected per message. Threads are now agent-agnostic.';

-- Add agent version tracking to agent_runs
ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES agents(agent_id) ON DELETE SET NULL;
ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS agent_version_id UUID REFERENCES agent_versions(version_id) ON DELETE SET NULL;

-- Create indexes for agent run queries
CREATE INDEX IF NOT EXISTS idx_agent_runs_agent_id ON agent_runs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_agent_version_id ON agent_runs(agent_version_id);

-- Comments on the agent_runs columns
COMMENT ON COLUMN agent_runs.agent_id IS 'ID of the agent used for this specific agent run.';
COMMENT ON COLUMN agent_runs.agent_version_id IS 'Specific version of the agent used for this run. This tracks the exact configuration.';

COMMIT; 


-- Migration: 20250626114642_kortix_team_agents.sql
-- Migration: Add is_kortix_team field to agent_templates
-- This migration adds support for marking templates as Kortix team templates

BEGIN;

-- Add is_kortix_team column to agent_templates table
ALTER TABLE agent_templates ADD COLUMN IF NOT EXISTS is_kortix_team BOOLEAN DEFAULT false;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_agent_templates_is_kortix_team ON agent_templates(is_kortix_team);

-- Add comment
COMMENT ON COLUMN agent_templates.is_kortix_team IS 'Indicates if this template is created by the Kortix team (official templates)';

COMMIT; 


-- Migration: 20250630070510_agent_triggers.sql
-- Agent Triggers System Migration
-- This migration creates tables for the agent trigger system

BEGIN;

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum for trigger types
DO $$ BEGIN
    CREATE TYPE agent_trigger_type AS ENUM ('telegram', 'slack', 'webhook', 'schedule', 'email', 'github', 'discord', 'teams');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Agent triggers table
CREATE TABLE IF NOT EXISTS agent_triggers (
    trigger_id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,
    trigger_type agent_trigger_type NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger events log table for auditing
CREATE TABLE IF NOT EXISTS trigger_events (
    event_id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    trigger_id UUID NOT NULL REFERENCES agent_triggers(trigger_id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,
    trigger_type agent_trigger_type NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    success BOOLEAN NOT NULL,
    should_execute_agent BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Custom trigger providers table for dynamic provider definitions
CREATE TABLE IF NOT EXISTS custom_trigger_providers (
    provider_id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    trigger_type VARCHAR(50) NOT NULL,
    provider_class TEXT, -- Full import path for custom providers
    config_schema JSONB DEFAULT '{}'::jsonb,
    webhook_enabled BOOLEAN DEFAULT FALSE,
    webhook_config JSONB,
    response_template JSONB,
    field_mappings JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES basejump.accounts(id)
);

-- OAuth installations table for storing OAuth integration data
CREATE TABLE IF NOT EXISTS oauth_installations (
    installation_id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    trigger_id UUID NOT NULL REFERENCES agent_triggers(trigger_id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL, -- slack, discord, teams, etc.
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_in INTEGER,
    scope TEXT,
    provider_data JSONB DEFAULT '{}'::jsonb, -- Provider-specific data like workspace info
    installed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_triggers_agent_id ON agent_triggers(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_triggers_trigger_type ON agent_triggers(trigger_type);
CREATE INDEX IF NOT EXISTS idx_agent_triggers_is_active ON agent_triggers(is_active);
CREATE INDEX IF NOT EXISTS idx_agent_triggers_created_at ON agent_triggers(created_at);

CREATE INDEX IF NOT EXISTS idx_trigger_events_trigger_id ON trigger_events(trigger_id);
CREATE INDEX IF NOT EXISTS idx_trigger_events_agent_id ON trigger_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_trigger_events_timestamp ON trigger_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_trigger_events_success ON trigger_events(success);

CREATE INDEX IF NOT EXISTS idx_custom_trigger_providers_trigger_type ON custom_trigger_providers(trigger_type);
CREATE INDEX IF NOT EXISTS idx_custom_trigger_providers_is_active ON custom_trigger_providers(is_active);

CREATE INDEX IF NOT EXISTS idx_oauth_installations_trigger_id ON oauth_installations(trigger_id);
CREATE INDEX IF NOT EXISTS idx_oauth_installations_provider ON oauth_installations(provider);
CREATE INDEX IF NOT EXISTS idx_oauth_installations_installed_at ON oauth_installations(installed_at);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_agent_triggers_updated_at 
    BEFORE UPDATE ON agent_triggers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_custom_trigger_providers_updated_at 
    BEFORE UPDATE ON custom_trigger_providers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oauth_installations_updated_at 
    BEFORE UPDATE ON oauth_installations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS on all tables
ALTER TABLE agent_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE trigger_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_trigger_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_installations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for agent_triggers
-- Users can only see triggers for agents they own
CREATE POLICY agent_triggers_select_policy ON agent_triggers
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM agents
            WHERE agents.agent_id = agent_triggers.agent_id
            AND basejump.has_role_on_account(agents.account_id)
        )
    );

CREATE POLICY agent_triggers_insert_policy ON agent_triggers
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM agents
            WHERE agents.agent_id = agent_triggers.agent_id
            AND basejump.has_role_on_account(agents.account_id, 'owner')
        )
    );

CREATE POLICY agent_triggers_update_policy ON agent_triggers
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM agents
            WHERE agents.agent_id = agent_triggers.agent_id
            AND basejump.has_role_on_account(agents.account_id, 'owner')
        )
    );

CREATE POLICY agent_triggers_delete_policy ON agent_triggers
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM agents
            WHERE agents.agent_id = agent_triggers.agent_id
            AND basejump.has_role_on_account(agents.account_id, 'owner')
        )
    );

-- RLS Policies for trigger_events
-- Users can see events for triggers on agents they own
CREATE POLICY trigger_events_select_policy ON trigger_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM agents
            WHERE agents.agent_id = trigger_events.agent_id
            AND basejump.has_role_on_account(agents.account_id)
        )
    );

-- Service role can insert trigger events
CREATE POLICY trigger_events_insert_policy ON trigger_events
    FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- RLS Policies for custom_trigger_providers
-- All authenticated users can view active custom providers
CREATE POLICY custom_trigger_providers_select_policy ON custom_trigger_providers
    FOR SELECT USING (is_active = true);

-- Only users can create custom providers for their account
CREATE POLICY custom_trigger_providers_insert_policy ON custom_trigger_providers
    FOR INSERT WITH CHECK (basejump.has_role_on_account(created_by));

-- Only creator can update their custom providers
CREATE POLICY custom_trigger_providers_update_policy ON custom_trigger_providers
    FOR UPDATE USING (basejump.has_role_on_account(created_by, 'owner'));

-- Only creator can delete their custom providers
CREATE POLICY custom_trigger_providers_delete_policy ON custom_trigger_providers
    FOR DELETE USING (basejump.has_role_on_account(created_by, 'owner'));

-- RLS Policies for oauth_installations
-- Users can see OAuth installations for triggers on agents they own
CREATE POLICY oauth_installations_select_policy ON oauth_installations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM agent_triggers
            JOIN agents ON agents.agent_id = agent_triggers.agent_id
            WHERE agent_triggers.trigger_id = oauth_installations.trigger_id
            AND basejump.has_role_on_account(agents.account_id)
        )
    );

-- Service role can insert/update/delete OAuth installations
CREATE POLICY oauth_installations_insert_policy ON oauth_installations
    FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY oauth_installations_update_policy ON oauth_installations
    FOR UPDATE USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY oauth_installations_delete_policy ON oauth_installations
    FOR DELETE USING (auth.jwt() ->> 'role' = 'service_role');

-- Grant permissions
GRANT ALL PRIVILEGES ON TABLE agent_triggers TO authenticated, service_role;
GRANT ALL PRIVILEGES ON TABLE trigger_events TO service_role;
GRANT SELECT ON TABLE trigger_events TO authenticated;
GRANT ALL PRIVILEGES ON TABLE custom_trigger_providers TO authenticated, service_role;
GRANT ALL PRIVILEGES ON TABLE oauth_installations TO service_role;
GRANT SELECT ON TABLE oauth_installations TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE agent_triggers IS 'Stores trigger configurations for agents';
COMMENT ON TABLE trigger_events IS 'Audit log of trigger events and their results';
COMMENT ON TABLE custom_trigger_providers IS 'Custom trigger provider definitions for dynamic loading';
COMMENT ON TABLE oauth_installations IS 'OAuth integration data for triggers (tokens, workspace info, etc.)';

COMMENT ON COLUMN agent_triggers.config IS 'Provider-specific configuration including credentials and settings';
COMMENT ON COLUMN trigger_events.metadata IS 'Additional event data and processing results';
COMMENT ON COLUMN custom_trigger_providers.provider_class IS 'Full Python import path for custom provider classes';
COMMENT ON COLUMN custom_trigger_providers.field_mappings IS 'Maps webhook fields to execution variables using dot notation';
COMMENT ON COLUMN oauth_installations.provider_data IS 'Provider-specific data like workspace info, bot details, etc.';

COMMIT; 


-- Migration: 20250701082739_agent_knowledge_base.sql
BEGIN;

-- Create separate table for agent-specific knowledge base entries
CREATE TABLE IF NOT EXISTS agent_knowledge_base_entries (
    entry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES basejump.accounts(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    content TEXT NOT NULL,
    content_tokens INTEGER, -- Token count for content management
    
    usage_context VARCHAR(100) DEFAULT 'always', -- 'always', 'on_request', 'contextual'
    
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_accessed_at TIMESTAMPTZ,

    CONSTRAINT agent_kb_entries_valid_usage_context CHECK (
        usage_context IN ('always', 'on_request', 'contextual')
    ),
    CONSTRAINT agent_kb_entries_content_not_empty CHECK (
        content IS NOT NULL AND LENGTH(TRIM(content)) > 0
    )
);

-- Create usage log table for agent knowledge base
CREATE TABLE IF NOT EXISTS agent_knowledge_base_usage_log (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id UUID NOT NULL REFERENCES agent_knowledge_base_entries(entry_id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,

    usage_type VARCHAR(50) NOT NULL, -- 'context_injection', 'manual_reference'
    tokens_used INTEGER, -- How many tokens were used
    
    -- Timestamps
    used_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_kb_entries_agent_id ON agent_knowledge_base_entries(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_kb_entries_account_id ON agent_knowledge_base_entries(account_id);
CREATE INDEX IF NOT EXISTS idx_agent_kb_entries_is_active ON agent_knowledge_base_entries(is_active);
CREATE INDEX IF NOT EXISTS idx_agent_kb_entries_usage_context ON agent_knowledge_base_entries(usage_context);
CREATE INDEX IF NOT EXISTS idx_agent_kb_entries_created_at ON agent_knowledge_base_entries(created_at);

CREATE INDEX IF NOT EXISTS idx_agent_kb_usage_entry_id ON agent_knowledge_base_usage_log(entry_id);
CREATE INDEX IF NOT EXISTS idx_agent_kb_usage_agent_id ON agent_knowledge_base_usage_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_kb_usage_used_at ON agent_knowledge_base_usage_log(used_at);

-- Enable RLS
ALTER TABLE agent_knowledge_base_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_knowledge_base_usage_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for agent knowledge base entries
CREATE POLICY agent_kb_entries_user_access ON agent_knowledge_base_entries
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM agents a
            WHERE a.agent_id = agent_knowledge_base_entries.agent_id
            AND basejump.has_role_on_account(a.account_id) = true
        )
    );

-- Create RLS policies for agent knowledge base usage log
CREATE POLICY agent_kb_usage_log_user_access ON agent_knowledge_base_usage_log
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM agents a
            WHERE a.agent_id = agent_knowledge_base_usage_log.agent_id
            AND basejump.has_role_on_account(a.account_id) = true
        )
    );

-- Function to get agent knowledge base entries
CREATE OR REPLACE FUNCTION get_agent_knowledge_base(
    p_agent_id UUID,
    p_include_inactive BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
    entry_id UUID,
    name VARCHAR(255),
    description TEXT,
    content TEXT,
    usage_context VARCHAR(100),
    is_active BOOLEAN,
    content_tokens INTEGER,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        akbe.entry_id,
        akbe.name,
        akbe.description,
        akbe.content,
        akbe.usage_context,
        akbe.is_active,
        akbe.content_tokens,
        akbe.created_at,
        akbe.updated_at
    FROM agent_knowledge_base_entries akbe
    WHERE akbe.agent_id = p_agent_id
    AND (p_include_inactive OR akbe.is_active = TRUE)
    ORDER BY akbe.created_at DESC;
END;
$$;

-- Function to get agent knowledge base context for prompts
CREATE OR REPLACE FUNCTION get_agent_knowledge_base_context(
    p_agent_id UUID,
    p_max_tokens INTEGER DEFAULT 4000
)
RETURNS TEXT
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
    context_text TEXT := '';
    entry_record RECORD;
    current_tokens INTEGER := 0;
    estimated_tokens INTEGER;
    agent_name TEXT;
BEGIN
    -- Get agent name for context header
    SELECT name INTO agent_name FROM agents WHERE agent_id = p_agent_id;
    
    FOR entry_record IN
        SELECT 
            entry_id,
            name,
            description,
            content,
            content_tokens
        FROM agent_knowledge_base_entries
        WHERE agent_id = p_agent_id
        AND is_active = TRUE
        AND usage_context IN ('always', 'contextual')
        ORDER BY created_at DESC
    LOOP
        estimated_tokens := COALESCE(entry_record.content_tokens, LENGTH(entry_record.content) / 4);
        
        IF current_tokens + estimated_tokens > p_max_tokens THEN
            EXIT;
        END IF;
        
        context_text := context_text || E'\n\n## ' || entry_record.name || E'\n';
        
        IF entry_record.description IS NOT NULL AND entry_record.description != '' THEN
            context_text := context_text || entry_record.description || E'\n\n';
        END IF;
        
        context_text := context_text || entry_record.content;
        
        current_tokens := current_tokens + estimated_tokens;
        
        -- Log usage for agent knowledge base
        INSERT INTO agent_knowledge_base_usage_log (entry_id, agent_id, usage_type, tokens_used)
        VALUES (entry_record.entry_id, p_agent_id, 'context_injection', estimated_tokens);
    END LOOP;
    
    RETURN CASE 
        WHEN context_text = '' THEN NULL
        ELSE E'# AGENT KNOWLEDGE BASE\n\nThe following is your specialized knowledge base. Use this information as context when responding:' || context_text
    END;
END;
$$;

-- Function to get combined knowledge base context (agent + thread)
CREATE OR REPLACE FUNCTION get_combined_knowledge_base_context(
    p_thread_id UUID,
    p_agent_id UUID DEFAULT NULL,
    p_max_tokens INTEGER DEFAULT 4000
)
RETURNS TEXT
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
    context_text TEXT := '';
    agent_context TEXT := '';
    thread_context TEXT := '';
    total_tokens INTEGER := 0;
    agent_tokens INTEGER := 0;
    thread_tokens INTEGER := 0;
BEGIN
    -- Get agent-specific context if agent_id is provided
    IF p_agent_id IS NOT NULL THEN
        agent_context := get_agent_knowledge_base_context(p_agent_id, p_max_tokens / 2);
        IF agent_context IS NOT NULL THEN
            agent_tokens := LENGTH(agent_context) / 4;
            total_tokens := agent_tokens;
        END IF;
    END IF;
    
    -- Get thread-specific context with remaining tokens
    thread_context := get_knowledge_base_context(p_thread_id, p_max_tokens - total_tokens);
    IF thread_context IS NOT NULL THEN
        thread_tokens := LENGTH(thread_context) / 4;
        total_tokens := total_tokens + thread_tokens;
    END IF;
    
    -- Combine contexts
    IF agent_context IS NOT NULL AND thread_context IS NOT NULL THEN
        context_text := agent_context || E'\n\n' || thread_context;
    ELSIF agent_context IS NOT NULL THEN
        context_text := agent_context;
    ELSIF thread_context IS NOT NULL THEN
        context_text := thread_context;
    END IF;
    
    RETURN context_text;
END;
$$;

-- Create triggers for automatic token calculation and timestamp updates
CREATE OR REPLACE FUNCTION update_agent_kb_entry_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    IF NEW.content != OLD.content THEN
        NEW.content_tokens = LENGTH(NEW.content) / 4;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_agent_kb_entries_updated_at
    BEFORE UPDATE ON agent_knowledge_base_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_agent_kb_entry_timestamp();

CREATE OR REPLACE FUNCTION calculate_agent_kb_entry_tokens()
RETURNS TRIGGER AS $$
BEGIN
    NEW.content_tokens = LENGTH(NEW.content) / 4;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_agent_kb_entries_calculate_tokens
    BEFORE INSERT ON agent_knowledge_base_entries
    FOR EACH ROW
    EXECUTE FUNCTION calculate_agent_kb_entry_tokens();

-- Grant permissions
GRANT ALL PRIVILEGES ON TABLE agent_knowledge_base_entries TO authenticated, service_role;
GRANT ALL PRIVILEGES ON TABLE agent_knowledge_base_usage_log TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION get_agent_knowledge_base TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_agent_knowledge_base_context TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_combined_knowledge_base_context TO authenticated, service_role;

-- Add comments
COMMENT ON TABLE agent_knowledge_base_entries IS 'Stores knowledge base entries specific to individual agents';
COMMENT ON TABLE agent_knowledge_base_usage_log IS 'Logs when and how agent knowledge base entries are used';

COMMENT ON FUNCTION get_agent_knowledge_base IS 'Retrieves all knowledge base entries for a specific agent';
COMMENT ON FUNCTION get_agent_knowledge_base_context IS 'Generates agent-specific knowledge base context text for prompts';
COMMENT ON FUNCTION get_combined_knowledge_base_context IS 'Generates combined agent and thread knowledge base context';

COMMIT; 


-- Migration: 20250701083536_agent_kb_files.sql
BEGIN;

-- Add source type and file metadata to agent knowledge base entries
ALTER TABLE agent_knowledge_base_entries 
ADD COLUMN source_type VARCHAR(50) DEFAULT 'manual' CHECK (source_type IN ('manual', 'file', 'git_repo', 'zip_extracted'));

ALTER TABLE agent_knowledge_base_entries 
ADD COLUMN source_metadata JSONB DEFAULT '{}';

ALTER TABLE agent_knowledge_base_entries 
ADD COLUMN file_path TEXT;

ALTER TABLE agent_knowledge_base_entries 
ADD COLUMN file_size BIGINT;

ALTER TABLE agent_knowledge_base_entries 
ADD COLUMN file_mime_type VARCHAR(255);

ALTER TABLE agent_knowledge_base_entries 
ADD COLUMN extracted_from_zip_id UUID REFERENCES agent_knowledge_base_entries(entry_id) ON DELETE CASCADE;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_agent_kb_entries_source_type ON agent_knowledge_base_entries(source_type);
CREATE INDEX IF NOT EXISTS idx_agent_kb_entries_extracted_from_zip ON agent_knowledge_base_entries(extracted_from_zip_id);

-- Create table for tracking file processing jobs
CREATE TABLE IF NOT EXISTS agent_kb_file_processing_jobs (
    job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES basejump.accounts(id) ON DELETE CASCADE,
    
    job_type VARCHAR(50) NOT NULL CHECK (job_type IN ('file_upload', 'zip_extraction', 'git_clone')),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    
    source_info JSONB NOT NULL, -- Contains file path, git URL, etc.
    result_info JSONB DEFAULT '{}', -- Processing results, error messages, etc.
    
    entries_created INTEGER DEFAULT 0,
    total_files INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    error_message TEXT
);

-- Create indexes for file processing jobs
CREATE INDEX IF NOT EXISTS idx_agent_kb_jobs_agent_id ON agent_kb_file_processing_jobs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_kb_jobs_status ON agent_kb_file_processing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_agent_kb_jobs_created_at ON agent_kb_file_processing_jobs(created_at);

-- Enable RLS for new table
ALTER TABLE agent_kb_file_processing_jobs ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for file processing jobs
CREATE POLICY agent_kb_jobs_user_access ON agent_kb_file_processing_jobs
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM agents a
            WHERE a.agent_id = agent_kb_file_processing_jobs.agent_id
            AND basejump.has_role_on_account(a.account_id) = true
        )
    );

-- Function to get file processing jobs for an agent
CREATE OR REPLACE FUNCTION get_agent_kb_processing_jobs(
    p_agent_id UUID,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    job_id UUID,
    job_type VARCHAR(50),
    status VARCHAR(50),
    source_info JSONB,
    result_info JSONB,
    entries_created INTEGER,
    total_files INTEGER,
    created_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        akj.job_id,
        akj.job_type,
        akj.status,
        akj.source_info,
        akj.result_info,
        akj.entries_created,
        akj.total_files,
        akj.created_at,
        akj.completed_at,
        akj.error_message
    FROM agent_kb_file_processing_jobs akj
    WHERE akj.agent_id = p_agent_id
    ORDER BY akj.created_at DESC
    LIMIT p_limit;
END;
$$;

-- Function to create a file processing job
CREATE OR REPLACE FUNCTION create_agent_kb_processing_job(
    p_agent_id UUID,
    p_account_id UUID,
    p_job_type VARCHAR(50),
    p_source_info JSONB
)
RETURNS UUID
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
    new_job_id UUID;
BEGIN
    INSERT INTO agent_kb_file_processing_jobs (
        agent_id,
        account_id,
        job_type,
        source_info
    ) VALUES (
        p_agent_id,
        p_account_id,
        p_job_type,
        p_source_info
    ) RETURNING job_id INTO new_job_id;
    
    RETURN new_job_id;
END;
$$;

-- Function to update job status
CREATE OR REPLACE FUNCTION update_agent_kb_job_status(
    p_job_id UUID,
    p_status VARCHAR(50),
    p_result_info JSONB DEFAULT NULL,
    p_entries_created INTEGER DEFAULT NULL,
    p_total_files INTEGER DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL
)
RETURNS VOID
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE agent_kb_file_processing_jobs 
    SET 
        status = p_status,
        result_info = COALESCE(p_result_info, result_info),
        entries_created = COALESCE(p_entries_created, entries_created),
        total_files = COALESCE(p_total_files, total_files),
        error_message = p_error_message,
        started_at = CASE WHEN p_status = 'processing' AND started_at IS NULL THEN NOW() ELSE started_at END,
        completed_at = CASE WHEN p_status IN ('completed', 'failed') THEN NOW() ELSE completed_at END
    WHERE job_id = p_job_id;
END;
$$;

-- Grant permissions
GRANT ALL PRIVILEGES ON TABLE agent_kb_file_processing_jobs TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_agent_kb_processing_jobs TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION create_agent_kb_processing_job TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION update_agent_kb_job_status TO authenticated, service_role;

-- Add comments
COMMENT ON TABLE agent_kb_file_processing_jobs IS 'Tracks file upload, extraction, and git cloning jobs for agent knowledge bases';
COMMENT ON FUNCTION get_agent_kb_processing_jobs IS 'Retrieves processing jobs for an agent';
COMMENT ON FUNCTION create_agent_kb_processing_job IS 'Creates a new file processing job';
COMMENT ON FUNCTION update_agent_kb_job_status IS 'Updates the status and results of a processing job';

COMMIT; 


-- Migration: 20250705155923_rollback_workflows.sql
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



-- Migration: 20250705161610_agent_workflows.sql
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


-- Migration: 20250705164211_fix_agent_workflows.sql
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



-- Migration: 20250706130554_simplify_workflow_steps.sql
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'instruction' AND enumtypid = 'workflow_step_type'::regtype) THEN
        ALTER TYPE workflow_step_type ADD VALUE 'instruction';
    END IF;
END $$; 


-- Migration: 20250706130555_set_instruction_default.sql
UPDATE workflow_steps SET type = 'instruction';

ALTER TABLE workflow_steps 
ALTER COLUMN type SET DEFAULT 'instruction';

COMMENT ON COLUMN workflow_steps.type IS 'Step type - defaults to instruction. All steps are now simple instructions with optional tool configuration.';
COMMENT ON COLUMN workflow_steps.config IS 'Step configuration including optional tool_name and tool-specific settings'; 


-- Migration: 20250707140000_add_agent_run_metadata.sql
-- Migration: Add streaming parameters to agent_runs table
-- This migration adds a metadata field to track the exact parameters 
-- used for each agent run

BEGIN;

-- Add metadata column to agent_runs table for streaming configuration
ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Create index for metadata queries (useful for filtering by model, etc.)
CREATE INDEX IF NOT EXISTS idx_agent_runs_metadata ON agent_runs USING GIN (metadata);

-- Add comment to document the metadata column
COMMENT ON COLUMN agent_runs.metadata IS 'Streaming and configuration parameters for this agent run (model_name, enable_thinking, reasoning_effort, etc.)';

COMMIT; 


-- Migration: 20250708034613_add_steps_to_workflows.sql
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


-- Migration: 20250708123910_cleanup_db.sql
BEGIN;

DROP TABLE IF EXISTS workflow_flows CASCADE;
DROP TABLE IF EXISTS workflow_execution_logs CASCADE;
DROP TABLE IF EXISTS workflow_variables CASCADE;
DROP TABLE IF EXISTS webhook_registrations CASCADE;
DROP TABLE IF EXISTS scheduled_jobs CASCADE;
DROP TABLE IF EXISTS triggers CASCADE;
DROP TABLE IF EXISTS agent_instances CASCADE;
DROP TABLE IF EXISTS oauth_installations CASCADE;
DROP TABLE IF EXISTS credential_usage_log CASCADE;
DROP TABLE IF EXISTS user_agent_library CASCADE;

DROP TABLE IF EXISTS workflow_templates CASCADE;
DROP TABLE IF EXISTS workflows CASCADE;

DROP TYPE IF EXISTS connection_type CASCADE;
DROP TYPE IF EXISTS node_type CASCADE;
DROP TYPE IF EXISTS trigger_type CASCADE;
DROP TYPE IF EXISTS execution_status CASCADE;
DROP TYPE IF EXISTS workflow_status CASCADE;

DROP TABLE IF EXISTS user_mcp_credentials CASCADE;

ALTER TABLE agents ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}'::jsonb;

UPDATE agents 
SET config = jsonb_build_object(
    'system_prompt', COALESCE(system_prompt, ''),
    'tools', jsonb_build_object(
        'agentpress', (
            SELECT jsonb_object_agg(
                key, 
                (value->>'enabled')::boolean
            )
            FROM jsonb_each(COALESCE(agentpress_tools, '{}'::jsonb))
            WHERE value IS NOT NULL AND value != 'null'::jsonb
        ),
        'mcp', COALESCE(configured_mcps, '[]'::jsonb),
        'custom_mcp', COALESCE(custom_mcps, '[]'::jsonb)
    ),
    'metadata', jsonb_build_object(
        'avatar', avatar,
        'avatar_color', avatar_color
    )
)
WHERE config = '{}'::jsonb OR config IS NULL;

ALTER TABLE agent_versions ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}'::jsonb;

UPDATE agent_versions 
SET config = jsonb_build_object(
    'system_prompt', COALESCE(system_prompt, ''),
    'tools', jsonb_build_object(
        'agentpress', (
            SELECT jsonb_object_agg(
                key, 
                (value->>'enabled')::boolean
            )
            FROM jsonb_each(COALESCE(agentpress_tools, '{}'::jsonb))
            WHERE value IS NOT NULL AND value != 'null'::jsonb
        ),
        'mcp', COALESCE(configured_mcps, '[]'::jsonb),
        'custom_mcp', COALESCE(custom_mcps, '[]'::jsonb)
    )
)
WHERE config = '{}'::jsonb OR config IS NULL;

ALTER TABLE agent_versions ADD COLUMN IF NOT EXISTS change_description TEXT;
ALTER TABLE agent_versions ADD COLUMN IF NOT EXISTS previous_version_id UUID REFERENCES agent_versions(version_id);

DROP TABLE IF EXISTS agent_version_history CASCADE;

ALTER TABLE agent_triggers ADD COLUMN IF NOT EXISTS execution_type VARCHAR(50) DEFAULT 'agent' CHECK (execution_type IN ('agent', 'workflow'));
ALTER TABLE agent_triggers ADD COLUMN IF NOT EXISTS workflow_id UUID REFERENCES agent_workflows(id) ON DELETE SET NULL;

ALTER TABLE trigger_events ADD COLUMN IF NOT EXISTS workflow_execution_id UUID REFERENCES workflow_executions(id) ON DELETE SET NULL;

COMMENT ON COLUMN agents.system_prompt IS 'DEPRECATED: Use config->>system_prompt instead';
COMMENT ON COLUMN agents.configured_mcps IS 'DEPRECATED: Use config->>tools->>mcp instead';
COMMENT ON COLUMN agents.agentpress_tools IS 'DEPRECATED: Use config->>tools->>agentpress instead';
COMMENT ON COLUMN agents.custom_mcps IS 'DEPRECATED: Use config->>tools->>custom_mcp instead';
COMMENT ON COLUMN agents.avatar IS 'DEPRECATED: Use config->>metadata->>avatar instead';
COMMENT ON COLUMN agents.avatar_color IS 'DEPRECATED: Use config->>metadata->>avatar_color instead';

COMMENT ON COLUMN agent_versions.system_prompt IS 'DEPRECATED: Use config->>system_prompt instead';
COMMENT ON COLUMN agent_versions.configured_mcps IS 'DEPRECATED: Use config->>tools->>mcp instead';
COMMENT ON COLUMN agent_versions.agentpress_tools IS 'DEPRECATED: Use config->>tools->>agentpress instead';
COMMENT ON COLUMN agent_versions.custom_mcps IS 'DEPRECATED: Use config->>tools->>custom_mcp instead';

CREATE OR REPLACE FUNCTION get_agent_config(p_agent_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_agent RECORD;
    v_config JSONB;
BEGIN
    SELECT * INTO v_agent FROM agents WHERE agent_id = p_agent_id;
    
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    
    IF v_agent.config IS NOT NULL AND v_agent.config != '{}'::jsonb THEN
        RETURN v_agent.config;
    END IF;
    
    v_config := jsonb_build_object(
        'system_prompt', COALESCE(v_agent.system_prompt, ''),
        'tools', jsonb_build_object(
            'agentpress', (
                SELECT jsonb_object_agg(
                    key, 
                    (value->>'enabled')::boolean
                )
                FROM jsonb_each(COALESCE(v_agent.agentpress_tools, '{}'::jsonb))
                WHERE value IS NOT NULL AND value != 'null'::jsonb
            ),
            'mcp', COALESCE(v_agent.configured_mcps, '[]'::jsonb),
            'custom_mcp', COALESCE(v_agent.custom_mcps, '[]'::jsonb)
        ),
        'metadata', jsonb_build_object(
            'avatar', v_agent.avatar,
            'avatar_color', v_agent.avatar_color
        )
    );
    
    RETURN v_config;
END;
$$;

GRANT EXECUTE ON FUNCTION get_agent_config(UUID) TO authenticated, service_role;

COMMENT ON TABLE agent_workflows IS 'Agent workflows - step-by-step task execution';
COMMENT ON TABLE workflow_steps IS 'Individual steps within an agent workflow';
COMMENT ON TABLE workflow_executions IS 'Execution history of agent workflows';
COMMENT ON TABLE workflow_step_executions IS 'Detailed execution logs for each workflow step';

COMMENT ON COLUMN agents.config IS 'Unified configuration object containing all agent settings';
COMMENT ON COLUMN agent_versions.config IS 'Versioned configuration snapshot';

COMMENT ON COLUMN agents.is_default IS 'Whether this agent is the default for the account (only one allowed per account)';
COMMENT ON COLUMN agent_triggers.execution_type IS 'Whether trigger executes an agent conversation or a workflow';

COMMIT; 


-- Migration: 20250722031718_agent_metadata.sql
BEGIN;

ALTER TABLE agents ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_agents_metadata ON agents USING gin(metadata);

CREATE INDEX IF NOT EXISTS idx_agents_suna_default 
ON agents((metadata->>'is_suna_default')) 
WHERE metadata->>'is_suna_default' = 'true';

CREATE INDEX IF NOT EXISTS idx_agents_centrally_managed 
ON agents((metadata->>'centrally_managed')) 
WHERE metadata->>'centrally_managed' = 'true';

CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_suna_default_unique 
ON agents(account_id) 
WHERE metadata->>'is_suna_default' = 'true';

COMMENT ON COLUMN agents.metadata IS 'Stores additional agent metadata including:
- is_suna_default: boolean - Whether this is the official Suna default agent
- centrally_managed: boolean - Whether this agent is managed centrally by Suna
- management_version: string - Version identifier for central management
- restrictions: object - What editing restrictions apply to this agent
- installation_date: timestamp - When this agent was installed
- last_central_update: timestamp - Last time centrally managed updates were applied';

CREATE OR REPLACE FUNCTION is_suna_default_agent(agent_row agents)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    RETURN COALESCE((agent_row.metadata->>'is_suna_default')::boolean, false);
END;
$$;

CREATE OR REPLACE FUNCTION is_centrally_managed_agent(agent_row agents)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE  
AS $$
BEGIN
    RETURN COALESCE((agent_row.metadata->>'centrally_managed')::boolean, false);
END;
$$;

CREATE OR REPLACE FUNCTION get_agent_restrictions(agent_row agents)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    RETURN COALESCE(agent_row.metadata->'restrictions', '{}'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION is_suna_default_agent(agents) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION is_centrally_managed_agent(agents) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_agent_restrictions(agents) TO authenticated, service_role;

DROP POLICY IF EXISTS agents_update_own ON agents;

CREATE POLICY agents_update_own ON agents
    FOR UPDATE
    USING (
        basejump.has_role_on_account(account_id, 'owner') 
        AND (
            NOT COALESCE((metadata->>'is_suna_default')::boolean, false)
            OR 
            (
                COALESCE((metadata->>'is_suna_default')::boolean, false) = true
            )
        )
    );

DROP POLICY IF EXISTS agents_delete_own ON agents;

CREATE POLICY agents_delete_own ON agents
    FOR DELETE
    USING (
        basejump.has_role_on_account(account_id, 'owner') 
        AND is_default = false 
        AND NOT COALESCE((metadata->>'is_suna_default')::boolean, false)
    );

COMMIT;


-- Migration: 20250722034729_default_agent.sql
BEGIN;

-- Create RPC function to find Suna default agent for an account
CREATE OR REPLACE FUNCTION find_suna_default_agent_for_account(p_account_id UUID)
RETURNS TABLE (
    agent_id UUID,
    account_id UUID,
    name VARCHAR(255),
    description TEXT,
    system_prompt TEXT,
    configured_mcps JSONB,
    custom_mcps JSONB,
    agentpress_tools JSONB,
    is_default BOOLEAN,
    avatar VARCHAR(10),
    avatar_color VARCHAR(7),
    metadata JSONB,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    is_active BOOLEAN,
    is_public BOOLEAN,
    marketplace_published_at TIMESTAMPTZ,
    download_count INTEGER,
    tags TEXT[],
    current_version_id UUID,
    version_count INTEGER
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.agent_id,
        a.account_id,
        a.name,
        a.description,
        a.system_prompt,
        a.configured_mcps,
        a.custom_mcps,
        a.agentpress_tools,
        a.is_default,
        a.avatar,
        a.avatar_color,
        a.metadata,
        a.created_at,
        a.updated_at,
        true as is_active,
        COALESCE(a.is_public, false) as is_public,
        a.marketplace_published_at,
        COALESCE(a.download_count, 0) as download_count,
        COALESCE(a.tags, '{}') as tags,
        a.current_version_id,
        COALESCE(a.version_count, 1) as version_count
    FROM agents a
    WHERE a.account_id = p_account_id 
    AND COALESCE((a.metadata->>'is_suna_default')::boolean, false) = true
    ORDER BY a.created_at DESC
    LIMIT 1;
END;
$$;

-- Create function to get all Suna default agents
CREATE OR REPLACE FUNCTION get_all_suna_default_agents()
RETURNS TABLE (
    agent_id UUID,
    account_id UUID,
    name VARCHAR(255),
    description TEXT,
    system_prompt TEXT,
    configured_mcps JSONB,
    custom_mcps JSONB,
    agentpress_tools JSONB,
    is_default BOOLEAN,
    avatar VARCHAR(10),
    avatar_color VARCHAR(7),
    metadata JSONB,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    is_active BOOLEAN,
    management_version TEXT,
    centrally_managed BOOLEAN
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.agent_id,
        a.account_id,
        a.name,
        a.description,
        a.system_prompt,
        a.configured_mcps,
        a.custom_mcps,
        a.agentpress_tools,
        a.is_default,
        a.avatar,
        a.avatar_color,
        a.metadata,
        a.created_at,
        a.updated_at,
        true as is_active,
        a.metadata->>'management_version' as management_version,
        COALESCE((a.metadata->>'centrally_managed')::boolean, false) as centrally_managed
    FROM agents a
    WHERE COALESCE((a.metadata->>'is_suna_default')::boolean, false) = true
    ORDER BY a.created_at DESC;
END;
$$;

-- Create function to count agents by management version
CREATE OR REPLACE FUNCTION count_suna_agents_by_version(p_version TEXT)
RETURNS INTEGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
    agent_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO agent_count
    FROM agents a
    WHERE COALESCE((a.metadata->>'is_suna_default')::boolean, false) = true
    AND a.metadata->>'management_version' = p_version;
    
    RETURN COALESCE(agent_count, 0);
END;
$$;

-- Create function to get Suna default agent statistics
CREATE OR REPLACE FUNCTION get_suna_default_agent_stats()
RETURNS TABLE (
    total_agents INTEGER,
    active_agents INTEGER,
    inactive_agents INTEGER,
    version_distribution JSONB,
    creation_dates JSONB
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
    total_count INTEGER;
    active_count INTEGER;
    inactive_count INTEGER;
    version_stats JSONB;
    creation_stats JSONB;
BEGIN
    -- Get total count
    SELECT COUNT(*) INTO total_count
    FROM agents a
    WHERE COALESCE((a.metadata->>'is_suna_default')::boolean, false) = true;
    
    -- Get active count (all Suna agents are considered active)
    SELECT COUNT(*) INTO active_count
    FROM agents a
    WHERE COALESCE((a.metadata->>'is_suna_default')::boolean, false) = true;
    
    -- Calculate inactive count
    inactive_count := total_count - active_count;
    
    -- Get version distribution
    SELECT jsonb_object_agg(
        COALESCE(a.metadata->>'management_version', 'unknown'),
        version_count
    ) INTO version_stats
    FROM (
        SELECT 
            COALESCE(a.metadata->>'management_version', 'unknown') as version,
            COUNT(*) as version_count
        FROM agents a
        WHERE COALESCE((a.metadata->>'is_suna_default')::boolean, false) = true
        GROUP BY COALESCE(a.metadata->>'management_version', 'unknown')
    ) version_data;
    
    -- Get creation date distribution (by month)
    SELECT jsonb_object_agg(
        creation_month,
        month_count
    ) INTO creation_stats
    FROM (
        SELECT 
            TO_CHAR(a.created_at, 'YYYY-MM') as creation_month,
            COUNT(*) as month_count
        FROM agents a
        WHERE COALESCE((a.metadata->>'is_suna_default')::boolean, false) = true
        GROUP BY TO_CHAR(a.created_at, 'YYYY-MM')
        ORDER BY creation_month DESC
        LIMIT 12  -- Last 12 months
    ) creation_data;
    
    RETURN QUERY
    SELECT 
        total_count,
        active_count,
        inactive_count,
        COALESCE(version_stats, '{}'::jsonb),
        COALESCE(creation_stats, '{}'::jsonb);
END;
$$;

-- Create function to find agents needing updates to a specific version
CREATE OR REPLACE FUNCTION find_suna_agents_needing_update(p_target_version TEXT)
RETURNS TABLE (
    agent_id UUID,
    account_id UUID,
    name VARCHAR(255),
    current_version TEXT,
    last_central_update TIMESTAMPTZ
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.agent_id,
        a.account_id,
        a.name,
        COALESCE(a.metadata->>'management_version', 'unknown') as current_version,
        (a.metadata->>'last_central_update')::timestamptz as last_central_update
    FROM agents a
    WHERE COALESCE((a.metadata->>'is_suna_default')::boolean, false) = true
    AND COALESCE((a.metadata->>'centrally_managed')::boolean, false) = true
    AND (
        a.metadata->>'management_version' IS NULL 
        OR a.metadata->>'management_version' != p_target_version
    )
    ORDER BY a.created_at ASC;
END;
$$;

-- Grant permissions to the functions
GRANT EXECUTE ON FUNCTION find_suna_default_agent_for_account(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_all_suna_default_agents() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION count_suna_agents_by_version(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_suna_default_agent_stats() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION find_suna_agents_needing_update(TEXT) TO authenticated, service_role;

COMMIT; 


-- Migration: 20250723055703_nullable_system_prompt.sql
ALTER TABLE agents 
ALTER COLUMN system_prompt DROP NOT NULL;

UPDATE agents 
SET system_prompt = NULL 
WHERE metadata->>'is_suna_default' = 'true'; 


-- Migration: 20250723093053_fix_workflow_policy_conflicts.sql
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



-- Migration: 20250723175911_cleanup_agents_table.sql
-- Config Single Source of Truth Migration
-- This migration removes all deprecated columns and makes config the only source of agent configuration

BEGIN;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- First, ensure all agents and agent_versions have proper config data
-- by running a final migration of legacy data to config if needed

-- Update ALL agents to ensure config has proper structure
UPDATE agents 
SET config = jsonb_build_object(
    'system_prompt', COALESCE(
        CASE 
            WHEN config ? 'system_prompt' THEN config->>'system_prompt'
            ELSE system_prompt
        END, 
        ''
    ),
    'tools', COALESCE(
        CASE 
            WHEN config ? 'tools' THEN config->'tools'
            ELSE jsonb_build_object(
                'agentpress', (
                    SELECT jsonb_object_agg(
                        key, 
                        (value->>'enabled')::boolean
                    )
                    FROM jsonb_each(COALESCE(agentpress_tools, '{}'::jsonb))
                    WHERE value IS NOT NULL AND value != 'null'::jsonb
                ),
                'mcp', COALESCE(configured_mcps, '[]'::jsonb),
                'custom_mcp', COALESCE(custom_mcps, '[]'::jsonb)
            )
        END,
        jsonb_build_object(
            'agentpress', '{}'::jsonb,
            'mcp', '[]'::jsonb,
            'custom_mcp', '[]'::jsonb
        )
    ),
    'metadata', COALESCE(
        CASE 
            WHEN config ? 'metadata' THEN config->'metadata'
            ELSE jsonb_build_object(
                'avatar', avatar,
                'avatar_color', avatar_color
            )
        END,
        jsonb_build_object(
            'avatar', null,
            'avatar_color', null
        )
    )
);

-- Update ALL agent_versions to ensure config has proper structure
UPDATE agent_versions 
SET config = jsonb_build_object(
    'system_prompt', COALESCE(
        CASE 
            WHEN config ? 'system_prompt' THEN config->>'system_prompt'
            ELSE system_prompt
        END, 
        ''
    ),
    'tools', COALESCE(
        CASE 
            WHEN config ? 'tools' THEN config->'tools'
            ELSE jsonb_build_object(
                'agentpress', (
                    SELECT jsonb_object_agg(
                        key, 
                        (value->>'enabled')::boolean
                    )
                    FROM jsonb_each(COALESCE(agentpress_tools, '{}'::jsonb))
                    WHERE value IS NOT NULL AND value != 'null'::jsonb
                ),
                'mcp', COALESCE(configured_mcps, '[]'::jsonb),
                'custom_mcp', COALESCE(custom_mcps, '[]'::jsonb)
            )
        END,
        jsonb_build_object(
            'agentpress', '{}'::jsonb,
            'mcp', '[]'::jsonb,
            'custom_mcp', '[]'::jsonb
        )
    )
);

-- Drop the deprecated columns from agents table
ALTER TABLE agents DROP COLUMN IF EXISTS system_prompt;
ALTER TABLE agents DROP COLUMN IF EXISTS configured_mcps;
ALTER TABLE agents DROP COLUMN IF EXISTS agentpress_tools;
ALTER TABLE agents DROP COLUMN IF EXISTS custom_mcps;
ALTER TABLE agents DROP COLUMN IF EXISTS avatar;
ALTER TABLE agents DROP COLUMN IF EXISTS avatar_color;

-- Drop the deprecated columns from agent_versions table
ALTER TABLE agent_versions DROP COLUMN IF EXISTS system_prompt;
ALTER TABLE agent_versions DROP COLUMN IF EXISTS configured_mcps;
ALTER TABLE agent_versions DROP COLUMN IF EXISTS agentpress_tools;
ALTER TABLE agent_versions DROP COLUMN IF EXISTS custom_mcps;

-- Update the get_agent_config function to only use config field
CREATE OR REPLACE FUNCTION get_agent_config(p_agent_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_agent RECORD;
BEGIN
    SELECT * INTO v_agent FROM agents WHERE agent_id = p_agent_id;
    
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    
    -- Now config is the only source of truth
    RETURN COALESCE(v_agent.config, '{}'::jsonb);
END;
$$;

-- Create a function to get agent version config
CREATE OR REPLACE FUNCTION get_agent_version_config(p_version_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_version RECORD;
BEGIN
    SELECT * INTO v_version FROM agent_versions WHERE version_id = p_version_id;
    
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    
    -- Config is the only source of truth for versions too
    RETURN COALESCE(v_version.config, '{}'::jsonb);
END;
$$;

-- Grant permissions on the new function
GRANT EXECUTE ON FUNCTION get_agent_version_config(UUID) TO authenticated, service_role;

-- Add helpful comments
COMMENT ON COLUMN agents.config IS 'Single source of truth for all agent configuration including system_prompt, tools, and metadata';
COMMENT ON COLUMN agent_versions.config IS 'Single source of truth for versioned agent configuration';
COMMENT ON COLUMN agents.metadata IS 'Agent metadata including is_suna_default, centrally_managed flags, and restrictions - crucial for default agent functionality';

-- Ensure config is never null
ALTER TABLE agents ALTER COLUMN config SET NOT NULL;
ALTER TABLE agents ALTER COLUMN config SET DEFAULT '{}'::jsonb;

ALTER TABLE agent_versions ALTER COLUMN config SET NOT NULL;
ALTER TABLE agent_versions ALTER COLUMN config SET DEFAULT '{}'::jsonb;

-- Create optimized indexes for efficient config queries
CREATE INDEX IF NOT EXISTS idx_agents_config_system_prompt ON agents USING gin((config->>'system_prompt') gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_agents_config_tools ON agents USING gin((config->'tools'));
CREATE INDEX IF NOT EXISTS idx_agent_versions_config_system_prompt ON agent_versions USING gin((config->>'system_prompt') gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_agent_versions_config_tools ON agent_versions USING gin((config->'tools'));

-- Add constraints to ensure config has basic structure
ALTER TABLE agents ADD CONSTRAINT agents_config_structure_check 
CHECK (
    config ? 'system_prompt' AND 
    config ? 'tools' AND 
    config ? 'metadata'
);

ALTER TABLE agent_versions ADD CONSTRAINT agent_versions_config_structure_check 
CHECK (
    config ? 'system_prompt' AND 
    config ? 'tools'
);

COMMIT; 


-- Migration: 20250723181204_restore_avatar_columns.sql
BEGIN;

ALTER TABLE agents ADD COLUMN IF NOT EXISTS avatar VARCHAR(10);
ALTER TABLE agents ADD COLUMN IF NOT EXISTS avatar_color VARCHAR(7);

UPDATE agents 
SET 
    avatar = config->'metadata'->>'avatar',
    avatar_color = config->'metadata'->>'avatar_color'
WHERE 
    config ? 'metadata' AND 
    (config->'metadata' ? 'avatar' OR config->'metadata' ? 'avatar_color');

CREATE INDEX IF NOT EXISTS idx_agents_avatar ON agents(avatar);
CREATE INDEX IF NOT EXISTS idx_agents_avatar_color ON agents(avatar_color);

COMMENT ON COLUMN agents.avatar IS 'Agent avatar emoji';
COMMENT ON COLUMN agents.avatar_color IS 'Agent avatar background color (hex)';

COMMIT; 


-- Migration: 20250726174310_rem-devices-tables-responses_col.sql
-- Migration: Remove recordings, devices tables and responses field from agent_runs
-- This migration cleans up unused tables and fields

BEGIN;

-- Drop recordings table first (has foreign key to devices)
DROP TABLE IF EXISTS public.recordings CASCADE;

-- Drop devices table
DROP TABLE IF EXISTS public.devices CASCADE;

-- Remove responses column from agent_runs table
ALTER TABLE agent_runs DROP COLUMN IF EXISTS responses;

COMMIT; 


-- Migration: 20250726180605_remove_old_workflow_sys.sql
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



-- Migration: 20250726184725_cleanup_schema_1.sql
-- Remove unused tables from schema cleanup
-- Drop dependent tables first, then main tables with CASCADE to handle any remaining dependencies
DROP TABLE IF EXISTS knowledge_base_usage_log CASCADE;
DROP TABLE IF EXISTS knowledge_base_entries CASCADE;
DROP TABLE IF EXISTS trigger_events CASCADE;
DROP TABLE IF EXISTS custom_trigger_providers CASCADE;



-- Migration: 20250726200404_remove_agent_cols_from_threads.sql
-- Migration: Remove agent_id and agent_version_id from threads table
-- This makes threads truly agent-agnostic - agent selection is handled only through agent/initiate and agent/start endpoints

BEGIN;

-- Drop indexes first
DROP INDEX IF EXISTS idx_threads_agent_id;
DROP INDEX IF EXISTS idx_threads_agent_version;

-- Remove agent_id column from threads table
ALTER TABLE threads DROP COLUMN IF EXISTS agent_id;

-- Remove agent_version_id column from threads table  
ALTER TABLE threads DROP COLUMN IF EXISTS agent_version_id;

-- Update comment to reflect that threads are now completely agent-agnostic
COMMENT ON TABLE threads IS 'Conversation threads - completely agent-agnostic. Agent selection handled via /agent/initiate and /agent/start endpoints.';

COMMIT; 


-- Migration: 20250726223759_move_agent_fields_to_metadata.sql
-- Migration: Move agent_id and agent_version_id from dedicated columns to metadata
-- This improves storage efficiency by only storing agent info for assistant messages where it's relevant

BEGIN;

-- Step 1: Update existing messages to move agent info to metadata
-- Only update messages that have agent_id or agent_version_id set
UPDATE messages 
SET metadata = jsonb_set(
    jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{agent_id}',
        to_jsonb(agent_id)
    ),
    '{agent_version_id}',
    to_jsonb(agent_version_id)
)
WHERE agent_id IS NOT NULL OR agent_version_id IS NOT NULL;

-- Step 2: Drop indexes on the columns we're about to remove
DROP INDEX IF EXISTS idx_messages_agent_id;
DROP INDEX IF EXISTS idx_messages_agent_version_id;

-- Step 3: Drop the dedicated agent columns
ALTER TABLE messages DROP COLUMN IF EXISTS agent_id;
ALTER TABLE messages DROP COLUMN IF EXISTS agent_version_id;

-- Step 4: Add comment explaining the new structure
COMMENT ON COLUMN messages.metadata IS 'JSONB metadata including agent_id and agent_version_id for assistant messages, and other message-specific data';

COMMIT; 


-- Migration: 20250726224819_reverse_move_agent_fields_to_metadata.sql
-- Reverse Migration: Move agent_id and agent_version_id back from metadata to dedicated columns
-- This reverses the changes made in 20250726223759_move_agent_fields_to_metadata.sql

BEGIN;

-- Step 1: Add back the dedicated agent columns with proper foreign key constraints
ALTER TABLE messages ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES agents(agent_id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS agent_version_id UUID REFERENCES agent_versions(version_id) ON DELETE SET NULL;

-- Step 2: Extract agent info from metadata and populate the dedicated columns
-- Only update messages that have agent info in metadata
UPDATE messages 
SET 
    agent_id = CASE 
        WHEN metadata ? 'agent_id' THEN (metadata->>'agent_id')::UUID 
        ELSE NULL 
    END,
    agent_version_id = CASE 
        WHEN metadata ? 'agent_version_id' THEN (metadata->>'agent_version_id')::UUID 
        ELSE NULL 
    END
WHERE metadata ? 'agent_id' OR metadata ? 'agent_version_id';

-- Step 3: Remove agent fields from metadata
UPDATE messages 
SET metadata = metadata - 'agent_id' - 'agent_version_id'
WHERE metadata ? 'agent_id' OR metadata ? 'agent_version_id';

-- Step 4: Recreate the indexes on the agent columns
CREATE INDEX IF NOT EXISTS idx_messages_agent_id ON messages(agent_id);
CREATE INDEX IF NOT EXISTS idx_messages_agent_version_id ON messages(agent_version_id);

-- Step 5: Update the comment to reflect the original structure
COMMENT ON COLUMN messages.metadata IS 'JSONB metadata for message-specific data (agent info stored in dedicated columns)';

COMMIT; 


-- Migration: 20250728193819_fix_templates.sql
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


-- Migration: 20250729094718_cleanup_agents_table.sql
BEGIN;

CREATE TABLE IF NOT EXISTS agents_backup_cleanup_20250729 AS 
SELECT * FROM agents;

ALTER TABLE agents DROP COLUMN IF EXISTS marketplace_published_at;
ALTER TABLE agents DROP COLUMN IF EXISTS download_count;

ALTER TABLE agents DROP COLUMN IF EXISTS config;

DROP INDEX IF EXISTS idx_agents_marketplace_published_at;
DROP INDEX IF EXISTS idx_agents_download_count;
DROP INDEX IF EXISTS idx_agents_config;

ALTER TABLE agents DROP CONSTRAINT IF EXISTS agents_config_structure_check;

COMMIT; 


-- Migration: 20250729105030_fix_agentpress_tools_sanitization.sql
CREATE OR REPLACE FUNCTION sanitize_config_for_template(input_config JSONB)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    sanitized_config JSONB;
    custom_mcp_array JSONB;
    custom_mcp_item JSONB;
    sanitized_mcp JSONB;
    result_array JSONB := '[]'::jsonb;
    agentpress_tools JSONB := '{}'::jsonb;
    tool_name TEXT;
    tool_config JSONB;
BEGIN
    IF input_config->'tools'->'agentpress' IS NOT NULL THEN
        FOR tool_name IN SELECT jsonb_object_keys(input_config->'tools'->'agentpress')
        LOOP
            tool_config := input_config->'tools'->'agentpress'->tool_name;
            
            IF jsonb_typeof(tool_config) = 'boolean' THEN
                agentpress_tools := jsonb_set(agentpress_tools, ARRAY[tool_name], tool_config);
            ELSIF jsonb_typeof(tool_config) = 'object' AND tool_config ? 'enabled' THEN
                agentpress_tools := jsonb_set(agentpress_tools, ARRAY[tool_name], tool_config->'enabled');
            ELSE
                agentpress_tools := jsonb_set(agentpress_tools, ARRAY[tool_name], 'false'::jsonb);
            END IF;
        END LOOP;
    END IF;

    sanitized_config := jsonb_build_object(
        'system_prompt', COALESCE(input_config->>'system_prompt', ''),
        'tools', jsonb_build_object(
            'agentpress', agentpress_tools,
            'mcp', COALESCE(input_config->'tools'->'mcp', '[]'::jsonb),
            'custom_mcp', '[]'::jsonb
        ),
        'metadata', jsonb_build_object(
            'avatar', input_config->'metadata'->>'avatar',
            'avatar_color', input_config->'metadata'->>'avatar_color'
        )
    );
    
    custom_mcp_array := COALESCE(input_config->'tools'->'custom_mcp', '[]'::jsonb);
    
    FOR custom_mcp_item IN SELECT jsonb_array_elements(custom_mcp_array)
    LOOP
        sanitized_mcp := jsonb_build_object(
            'name', custom_mcp_item->>'name',
            'type', custom_mcp_item->>'type',
            'display_name', COALESCE(custom_mcp_item->>'display_name', custom_mcp_item->>'name'),
            'enabledTools', COALESCE(custom_mcp_item->'enabledTools', '[]'::jsonb)
        );
        
        IF custom_mcp_item->>'type' = 'pipedream' THEN
            sanitized_mcp := jsonb_set(
                sanitized_mcp,
                '{config}',
                jsonb_build_object(
                    'url', custom_mcp_item->'config'->>'url',
                    'headers', COALESCE(custom_mcp_item->'config'->'headers', '{}'::jsonb) - 'profile_id'
                )
            );
        ELSE
            sanitized_mcp := jsonb_set(sanitized_mcp, '{config}', '{}'::jsonb);
        END IF;
        
        result_array := result_array || sanitized_mcp;
    END LOOP;
    
    sanitized_config := jsonb_set(
        sanitized_config,
        '{tools,custom_mcp}',
        result_array
    );
    
    RETURN sanitized_config;
END;
$$; 


-- Migration: 20250729110000_fix_pipedream_qualified_names.sql
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


-- Migration: 20250729120000_api_keys.sql
BEGIN;

-- =====================================================
-- API KEYS TABLE MIGRATION (CORRECTED VERSION)
-- =====================================================
-- Streamlined API keys table for high-performance authentication

-- Enum for API key status
DO $$ BEGIN
    CREATE TYPE api_key_status AS ENUM ('active', 'revoked', 'expired');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create API keys table
CREATE TABLE IF NOT EXISTS api_keys (
    key_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    public_key VARCHAR(64) NOT NULL UNIQUE,
    secret_key_hash VARCHAR(64) NOT NULL,
    account_id UUID NOT NULL REFERENCES basejump.accounts(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status api_key_status DEFAULT 'active',
    expires_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Essential constraints
    CONSTRAINT api_keys_title_not_empty CHECK (LENGTH(TRIM(title)) > 0),
    CONSTRAINT api_keys_public_key_format CHECK (public_key ~ '^pk_[a-zA-Z0-9]{32}$')
);

-- Essential indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_keys_account_id ON api_keys(account_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_public_key ON api_keys(public_key);

-- Enable RLS
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- RLS policy with explicit schema qualification (avoids basejump function issues)
CREATE POLICY "Users can manage their own API keys" ON api_keys
    FOR ALL USING (
        account_id IN (
            SELECT wu.account_id 
            FROM basejump.account_user wu 
            WHERE wu.user_id = auth.uid()
        )
    );

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON api_keys TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON api_keys TO service_role;

COMMIT; 


-- Migration: 20250808120000_supabase_cron.sql
-- Enable Supabase Cron and HTTP extensions and provide helper RPCs
-- This migration replaces QStash-based scheduling with Supabase Cron

BEGIN;

-- Enable required extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Helper function to schedule an HTTP POST via Supabase Cron
-- Overwrites existing job with the same name
CREATE OR REPLACE FUNCTION public.schedule_trigger_http(
    job_name text,
    schedule text,
    url text,
    headers jsonb DEFAULT '{}'::jsonb,
    body jsonb DEFAULT '{}'::jsonb,
    timeout_ms integer DEFAULT 8000
) RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    job_id bigint;
    sql_text text;
    headers_fixed jsonb;
    body_fixed jsonb;
BEGIN
    -- Unschedule any existing jobs with the same name
    PERFORM cron.unschedule(j.jobid)
    FROM cron.job j
    WHERE j.jobname = job_name;

    -- Normalize headers/body in case callers pass JSON strings instead of objects
    headers_fixed := COALESCE(
        CASE
            WHEN headers IS NULL THEN '{}'::jsonb
            WHEN jsonb_typeof(headers) = 'object' THEN headers
            WHEN jsonb_typeof(headers) = 'string' THEN (
                -- Remove surrounding quotes then unescape to get raw JSON text, finally cast to jsonb
                replace(replace(trim(both '"' from headers::text), '\\"', '"'), '\\\\', '\\')
            )::jsonb
            ELSE '{}'::jsonb
        END,
        '{}'::jsonb
    );

    body_fixed := COALESCE(
        CASE
            WHEN body IS NULL THEN '{}'::jsonb
            WHEN jsonb_typeof(body) = 'object' THEN body
            WHEN jsonb_typeof(body) = 'string' THEN (
                replace(replace(trim(both '"' from body::text), '\\"', '"'), '\\\\', '\\')
            )::jsonb
            ELSE body
        END,
        '{}'::jsonb
    );

    -- Build the SQL snippet to be executed by pg_cron
    sql_text := format(
        $sql$select net.http_post(
            url := %L,
            headers := %L::jsonb,
            body := %L::jsonb,
            timeout_milliseconds := %s
        );$sql$,
        url,
        headers_fixed::text,
        body_fixed::text,
        timeout_ms
    );

    job_id := cron.schedule(job_name, schedule, sql_text);
    RETURN job_id;
END;
$$;

-- Helper to unschedule by job name
CREATE OR REPLACE FUNCTION public.unschedule_job_by_name(job_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM cron.unschedule(j.jobid)
    FROM cron.job j
    WHERE j.jobname = job_name;
END;
$$;

-- Grant execute to service role (backend uses service role key)
GRANT EXECUTE ON FUNCTION public.schedule_trigger_http(text, text, text, jsonb, jsonb, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.unschedule_job_by_name(text) TO service_role;

COMMIT;



-- Migration: 20250811133931_agent_profile_pic.sql
BEGIN;

ALTER TABLE agents ADD COLUMN IF NOT EXISTS profile_image_url TEXT;
ALTER TABLE agent_templates ADD COLUMN IF NOT EXISTS profile_image_url TEXT;

UPDATE agents
SET profile_image_url = COALESCE(profile_image_url, (metadata->>'profile_image_url'))
WHERE profile_image_url IS NULL AND metadata ? 'profile_image_url';

UPDATE agent_templates
SET profile_image_url = COALESCE(profile_image_url, (metadata->>'profile_image_url'))
WHERE profile_image_url IS NULL AND metadata ? 'profile_image_url';

COMMIT;



-- Migration: 20250811135257_supabase_pic_bucket.sql
BEGIN;

INSERT INTO storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
VALUES (
    'agent-profile-images',
    'agent-profile-images', 
    true,
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']::text[],
    5242880
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can upload agent profile images" ON storage.objects;
DROP POLICY IF EXISTS "Agent profile images are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete agent profile images" ON storage.objects;

CREATE POLICY "Users can upload agent profile images" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'agent-profile-images' 
    AND auth.role() = 'authenticated'
);

CREATE POLICY "Agent profile images are publicly readable" ON storage.objects
FOR SELECT USING (bucket_id = 'agent-profile-images');

CREATE POLICY "Users can delete agent profile images" ON storage.objects
FOR DELETE USING (
    bucket_id = 'agent-profile-images' 
    AND auth.role() = 'authenticated'
);

COMMIT; 


-- Migration: 20250814133850_mark_kortix_team_templates.sql
-- Migration: Mark Kortix team templates
-- This migration marks templates created by the Kortix team as official

BEGIN;

-- Update templates to mark as Kortix team based on specific criteria
-- You can adjust the WHERE clause based on your actual Kortix team account IDs or template names

-- Option 1: Mark templates by specific names that are known Kortix team templates
UPDATE agent_templates
SET is_kortix_team = true
WHERE name IN (
    'Sheets Agent',
    'Slides Agent', 
    'Data Analyst',
    'Web Dev Agent',
    'Research Assistant',
    'Code Review Agent',
    'Documentation Writer',
    'API Testing Agent'
) AND is_public = true;

-- Option 2: Mark templates by creator_id if you know the Kortix team account IDs
-- Uncomment and modify with actual Kortix team account IDs
-- UPDATE agent_templates
-- SET is_kortix_team = true
-- WHERE creator_id IN (
--     'kortix-team-account-id-1',
--     'kortix-team-account-id-2'
-- );

-- Option 3: Mark templates that have specific metadata indicating they're official
UPDATE agent_templates
SET is_kortix_team = true
WHERE metadata->>'is_suna_default' = 'true'
   OR metadata->>'is_official' = 'true';

-- Log the update
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Marked % templates as Kortix team templates', updated_count;
END $$;




-- Migration: 20250814145041_project_realtime_updates.sql
-- Migration: Enable realtime updates for projects table
-- This migration enables realtime subscriptions for the projects table

BEGIN;

-- Enable realtime for projects table
ALTER PUBLICATION supabase_realtime ADD TABLE projects;

COMMIT;


-- Migration: 20250814184554_add_workflows_to_config.sql
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


-- Migration: 20250818180950_topup_credits.sql
CREATE TABLE IF NOT EXISTS public.credit_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount_dollars DECIMAL(10, 2) NOT NULL CHECK (amount_dollars > 0),
    stripe_payment_intent_id TEXT UNIQUE,
    stripe_charge_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    CONSTRAINT credit_purchases_amount_positive CHECK (amount_dollars > 0)
);

CREATE TABLE IF NOT EXISTS public.credit_balance (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    balance_dollars DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (balance_dollars >= 0),
    total_purchased DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (total_purchased >= 0),
    total_used DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (total_used >= 0),
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS public.credit_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount_dollars DECIMAL(10, 2) NOT NULL CHECK (amount_dollars > 0),
    thread_id UUID REFERENCES public.threads(thread_id) ON DELETE SET NULL,
    message_id UUID REFERENCES public.messages(message_id) ON DELETE SET NULL,
    description TEXT,
    usage_type TEXT DEFAULT 'token_overage' CHECK (usage_type IN ('token_overage', 'manual_deduction', 'adjustment')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    subscription_tier TEXT,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_credit_purchases_user_id ON public.credit_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_purchases_status ON public.credit_purchases(status);
CREATE INDEX IF NOT EXISTS idx_credit_purchases_created_at ON public.credit_purchases(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_purchases_stripe_payment_intent ON public.credit_purchases(stripe_payment_intent_id);

CREATE INDEX IF NOT EXISTS idx_credit_usage_user_id ON public.credit_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_usage_created_at ON public.credit_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_usage_thread_id ON public.credit_usage(thread_id);

ALTER TABLE public.credit_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_balance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own credit purchases" ON public.credit_purchases;
DROP POLICY IF EXISTS "Service role can manage all credit purchases" ON public.credit_purchases;
DROP POLICY IF EXISTS "Users can view their own credit balance" ON public.credit_balance;
DROP POLICY IF EXISTS "Service role can manage all credit balances" ON public.credit_balance;
DROP POLICY IF EXISTS "Users can view their own credit usage" ON public.credit_usage;
DROP POLICY IF EXISTS "Service role can manage all credit usage" ON public.credit_usage;

CREATE POLICY "Users can view their own credit purchases" ON public.credit_purchases
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all credit purchases" ON public.credit_purchases
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can view their own credit balance" ON public.credit_balance
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all credit balances" ON public.credit_balance
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can view their own credit usage" ON public.credit_usage
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all credit usage" ON public.credit_usage
    FOR ALL USING (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.add_credits(
    p_user_id UUID,
    p_amount DECIMAL,
    p_purchase_id UUID DEFAULT NULL
)
RETURNS DECIMAL
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_balance DECIMAL;
BEGIN
    INSERT INTO public.credit_balance (user_id, balance_dollars, total_purchased)
    VALUES (p_user_id, p_amount, p_amount)
    ON CONFLICT (user_id) DO UPDATE
    SET 
        balance_dollars = credit_balance.balance_dollars + p_amount,
        total_purchased = credit_balance.total_purchased + p_amount,
        last_updated = NOW()
    RETURNING balance_dollars INTO new_balance;
    
    RETURN new_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.use_credits(
    p_user_id UUID,
    p_amount DECIMAL,
    p_description TEXT DEFAULT NULL,
    p_thread_id UUID DEFAULT NULL,
    p_message_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_balance DECIMAL;
    success BOOLEAN := FALSE;
BEGIN
    SELECT balance_dollars INTO current_balance
    FROM public.credit_balance
    WHERE user_id = p_user_id
    FOR UPDATE;
    
    IF current_balance IS NOT NULL AND current_balance >= p_amount THEN
        UPDATE public.credit_balance
        SET 
            balance_dollars = balance_dollars - p_amount,
            total_used = total_used + p_amount,
            last_updated = NOW()
        WHERE user_id = p_user_id;
        
        INSERT INTO public.credit_usage (
            user_id, 
            amount_dollars, 
            description, 
            thread_id, 
            message_id,
            usage_type
        )
        VALUES (
            p_user_id, 
            p_amount, 
            p_description, 
            p_thread_id, 
            p_message_id,
            'token_overage'
        );
        
        success := TRUE;
    END IF;
    
    RETURN success;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_credit_balance(p_user_id UUID)
RETURNS DECIMAL
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    balance DECIMAL;
BEGIN
    SELECT balance_dollars INTO balance
    FROM public.credit_balance
    WHERE user_id = p_user_id;
    
    RETURN COALESCE(balance, 0);
END;
$$;

GRANT SELECT ON public.credit_purchases TO authenticated;
GRANT SELECT ON public.credit_balance TO authenticated;
GRANT SELECT ON public.credit_usage TO authenticated;

GRANT ALL ON public.credit_purchases TO service_role;
GRANT ALL ON public.credit_balance TO service_role;
GRANT ALL ON public.credit_usage TO service_role;

GRANT EXECUTE ON FUNCTION public.add_credits TO service_role;
GRANT EXECUTE ON FUNCTION public.use_credits TO service_role;
GRANT EXECUTE ON FUNCTION public.get_credit_balance TO authenticated, service_role; 


-- Migration: 20250818221332_rem_combined_kb_context.sql
BEGIN;

-- Remove the combined knowledge base context function since only agent-based knowledge base exists
DROP FUNCTION IF EXISTS get_combined_knowledge_base_context(UUID, UUID, INTEGER);

-- Remove the thread-based knowledge base context function as well - only keeping agent-based
DROP FUNCTION IF EXISTS get_knowledge_base_context(UUID, INTEGER);

-- Drop the existing agent knowledge base context function with token limiting
DROP FUNCTION IF EXISTS get_agent_knowledge_base_context(UUID, INTEGER);

-- Simplify the agent knowledge base context function by removing token limiting
CREATE OR REPLACE FUNCTION get_agent_knowledge_base_context(
    p_agent_id UUID
)
RETURNS TEXT
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
    context_text TEXT := '';
    entry_record RECORD;
BEGIN
    FOR entry_record IN
        SELECT 
            entry_id,
            name,
            description,
            content
        FROM agent_knowledge_base_entries
        WHERE agent_id = p_agent_id
        AND is_active = TRUE
        AND usage_context IN ('always', 'contextual')
        ORDER BY created_at DESC
    LOOP
        context_text := context_text || E'\n\n## ' || entry_record.name || E'\n';
        
        IF entry_record.description IS NOT NULL AND entry_record.description != '' THEN
            context_text := context_text || entry_record.description || E'\n\n';
        END IF;
        
        context_text := context_text || entry_record.content;
        
        -- Log usage for agent knowledge base (without token counting)
        INSERT INTO agent_knowledge_base_usage_log (entry_id, agent_id, usage_type)
        VALUES (entry_record.entry_id, p_agent_id, 'context_injection');
    END LOOP;
    
    RETURN CASE 
        WHEN context_text = '' THEN NULL
        ELSE E'# AGENT KNOWLEDGE BASE\n\nThe following is your specialized knowledge base. Use this information as context when responding:' || context_text
    END;
END;
$$;

-- Update comments to clarify that agent-based is the only knowledge base function
COMMENT ON FUNCTION get_agent_knowledge_base_context IS 'Generates agent-specific knowledge base context text for prompts - simplified without token limiting';

COMMIT;



-- Migration: 20250819233248_template_share_links.sql
BEGIN;

CREATE TABLE IF NOT EXISTS template_share_links (
    share_id VARCHAR(12) PRIMARY KEY,
    template_id UUID NOT NULL REFERENCES agent_templates(template_id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES basejump.accounts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    views_count INTEGER DEFAULT 0,
    last_viewed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_template_share_links_template_id ON template_share_links(template_id);
CREATE INDEX IF NOT EXISTS idx_template_share_links_created_by ON template_share_links(created_by);
CREATE INDEX IF NOT EXISTS idx_template_share_links_created_at ON template_share_links(created_at DESC);

ALTER TABLE template_share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Share links are publicly viewable" 
    ON template_share_links FOR SELECT
    USING (true);

CREATE POLICY "Template creators can create share links" 
    ON template_share_links FOR INSERT
    WITH CHECK (
        created_by = auth.uid() 
        AND EXISTS (
            SELECT 1 FROM agent_templates 
            WHERE template_id = template_share_links.template_id 
            AND creator_id = auth.uid()
        )
    );

CREATE POLICY "Share link creators can update their links" 
    ON template_share_links FOR UPDATE
    USING (created_by = auth.uid());

CREATE POLICY "Share link creators can delete their links" 
    ON template_share_links FOR DELETE
    USING (created_by = auth.uid());

COMMIT; 


-- Migration: 20250821051025_find_user_by_email.sql
BEGIN;

CREATE OR REPLACE FUNCTION public.get_user_account_by_email(email_input text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    account_data json;
BEGIN
    SELECT json_build_object(
        'id', a.id,
        'name', a.name,
        'slug', a.slug,
        'primary_owner_user_id', a.primary_owner_user_id
    ) INTO account_data
    FROM auth.users u
    JOIN basejump.accounts a ON a.primary_owner_user_id = u.id
    WHERE LOWER(u.email) = LOWER(email_input)
      AND a.personal_account = true
    LIMIT 1;

    RETURN account_data;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_account_by_email(text) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_user_account_by_email(text) IS 'Gets user account by email address. Used by admin scripts to install Suna agents.';

COMMIT; 


-- Migration: 20250821093710_agent_file_upload.sql
BEGIN;

CREATE TABLE IF NOT EXISTS public.file_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID,
    thread_id UUID REFERENCES public.threads(thread_id) ON DELETE CASCADE,
    agent_id UUID REFERENCES public.agents(agent_id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES basejump.accounts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    bucket_name VARCHAR(255) NOT NULL,
    storage_path TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    content_type VARCHAR(255),
    signed_url TEXT,
    url_expires_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT file_uploads_bucket_name_check CHECK (bucket_name IN ('file-uploads', 'browser-screenshots')),
    CONSTRAINT file_uploads_file_size_check CHECK (file_size > 0),
    CONSTRAINT file_uploads_original_filename_check CHECK (LENGTH(TRIM(original_filename)) > 0)
);

ALTER TABLE public.file_uploads ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_file_uploads_updated_at ON public.file_uploads;
CREATE TRIGGER update_file_uploads_updated_at
    BEFORE UPDATE ON public.file_uploads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_file_uploads_account_id ON public.file_uploads(account_id);
CREATE INDEX IF NOT EXISTS idx_file_uploads_thread_id ON public.file_uploads(thread_id);
CREATE INDEX IF NOT EXISTS idx_file_uploads_agent_id ON public.file_uploads(agent_id);
CREATE INDEX IF NOT EXISTS idx_file_uploads_created_at ON public.file_uploads(created_at);

INSERT INTO storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
VALUES (
    'file-uploads',
    'file-uploads', 
    false,
    NULL,
    52428800
)
ON CONFLICT (id) DO UPDATE SET public = false;

ALTER TABLE public.file_uploads 
ADD CONSTRAINT file_uploads_user_storage_unique 
UNIQUE(user_id, bucket_name, storage_path);

CREATE INDEX IF NOT EXISTS idx_file_uploads_user_id ON public.file_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_file_uploads_expires ON public.file_uploads(url_expires_at) WHERE url_expires_at IS NOT NULL;

DROP POLICY IF EXISTS "Authenticated users can upload to file-uploads" ON storage.objects;
DROP POLICY IF EXISTS "file-uploads are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete from file-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Users can update file-uploads" ON storage.objects;

CREATE POLICY "Users can upload to file-uploads" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'file-uploads' 
    AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can view their own files in file-uploads" ON storage.objects
FOR SELECT USING (
    bucket_id = 'file-uploads' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own files in file-uploads" ON storage.objects
FOR DELETE USING (
    bucket_id = 'file-uploads' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update their own files in file-uploads" ON storage.objects
FOR UPDATE USING (
    bucket_id = 'file-uploads' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can view their own file uploads" ON public.file_uploads;
DROP POLICY IF EXISTS "Users can create their own file uploads" ON public.file_uploads;
DROP POLICY IF EXISTS "Users can update their own file uploads" ON public.file_uploads;
DROP POLICY IF EXISTS "Users can delete their own file uploads" ON public.file_uploads;

CREATE POLICY "Users can view their own file uploads" ON public.file_uploads
FOR SELECT USING (
    user_id = auth.uid()
    OR basejump.has_role_on_account(account_id) = true
);

CREATE POLICY "Users can create their own file uploads" ON public.file_uploads
FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND basejump.has_role_on_account(account_id) = true
);

CREATE POLICY "Users can update their own file uploads" ON public.file_uploads
FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own file uploads" ON public.file_uploads
FOR DELETE USING (user_id = auth.uid());


COMMENT ON COLUMN public.file_uploads.user_id IS 'The authenticated user who owns the file';
COMMENT ON COLUMN public.file_uploads.signed_url IS 'Temporary signed URL for secure file access';
COMMENT ON COLUMN public.file_uploads.url_expires_at IS 'Expiration time for the signed URL';

COMMIT; 


-- Migration: 20250824065328_icon_profile.sql
BEGIN;

ALTER TABLE agents 
ADD COLUMN IF NOT EXISTS icon_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS icon_color VARCHAR(7) DEFAULT '#000000',
ADD COLUMN IF NOT EXISTS icon_background VARCHAR(7) DEFAULT '#F3F4F6';

ALTER TABLE agent_templates
ADD COLUMN IF NOT EXISTS icon_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS icon_color VARCHAR(7) DEFAULT '#000000',
ADD COLUMN IF NOT EXISTS icon_background VARCHAR(7) DEFAULT '#F3F4F6';

CREATE INDEX IF NOT EXISTS idx_agents_icon_name ON agents(icon_name) WHERE icon_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agent_templates_icon_name ON agent_templates(icon_name) WHERE icon_name IS NOT NULL;

COMMENT ON COLUMN agents.icon_name IS 'Optional: Lucide React icon name for agent profile (used when profile_image_url is not set)';
COMMENT ON COLUMN agents.icon_color IS 'Optional: Hex color for the icon (e.g., #000000)';
COMMENT ON COLUMN agents.icon_background IS 'Optional: Hex background color for the icon container';

COMMENT ON COLUMN agent_templates.icon_name IS 'Optional: Lucide React icon name for template profile (used when profile_image_url is not set)';
COMMENT ON COLUMN agent_templates.icon_color IS 'Optional: Hex color for the icon (e.g., #000000)';
COMMENT ON COLUMN agent_templates.icon_background IS 'Optional: Hex background color for the icon container';

COMMIT;


-- Migration: 20250829051455_google_oauth_tokens.sql
create extension if not exists "pg_net" with schema "public" version '0.14.0';

create table "public"."google_oauth_tokens" (
    "created_at" timestamp with time zone not null default now(),
    "user_id" uuid,
    "encrypted_token" text,
    "token_hash" text,
    "expires_at" timestamp with time zone,
    "updated_at" timestamp with time zone default now(),
    "id" uuid not null default gen_random_uuid()
);


alter table "public"."google_oauth_tokens" enable row level security;

CREATE UNIQUE INDEX google_oauth_tokens_pkey ON public.google_oauth_tokens USING btree (id);

CREATE UNIQUE INDEX google_oauth_tokens_user_id_key ON public.google_oauth_tokens USING btree (user_id);

alter table "public"."google_oauth_tokens" add constraint "google_oauth_tokens_pkey" PRIMARY KEY using index "google_oauth_tokens_pkey";

alter table "public"."google_oauth_tokens" add constraint "google_oauth_tokens_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) not valid;

alter table "public"."google_oauth_tokens" validate constraint "google_oauth_tokens_user_id_fkey";

alter table "public"."google_oauth_tokens" add constraint "google_oauth_tokens_user_id_key" UNIQUE using index "google_oauth_tokens_user_id_key";

grant delete on table "public"."google_oauth_tokens" to "anon";

grant insert on table "public"."google_oauth_tokens" to "anon";

grant references on table "public"."google_oauth_tokens" to "anon";

grant select on table "public"."google_oauth_tokens" to "anon";

grant trigger on table "public"."google_oauth_tokens" to "anon";

grant truncate on table "public"."google_oauth_tokens" to "anon";

grant update on table "public"."google_oauth_tokens" to "anon";

grant delete on table "public"."google_oauth_tokens" to "authenticated";

grant insert on table "public"."google_oauth_tokens" to "authenticated";

grant references on table "public"."google_oauth_tokens" to "authenticated";

grant select on table "public"."google_oauth_tokens" to "authenticated";

grant trigger on table "public"."google_oauth_tokens" to "authenticated";

grant truncate on table "public"."google_oauth_tokens" to "authenticated";

grant update on table "public"."google_oauth_tokens" to "authenticated";

grant delete on table "public"."google_oauth_tokens" to "service_role";

grant insert on table "public"."google_oauth_tokens" to "service_role";

grant references on table "public"."google_oauth_tokens" to "service_role";

grant select on table "public"."google_oauth_tokens" to "service_role";

grant trigger on table "public"."google_oauth_tokens" to "service_role";

grant truncate on table "public"."google_oauth_tokens" to "service_role";

grant update on table "public"."google_oauth_tokens" to "service_role";

create policy "service_role_only"
on "public"."google_oauth_tokens"
as permissive
for all
to service_role
using ((auth.role() = 'service_role'::text))
with check ((auth.role() = 'service_role'::text));






-- Migration: 20250830014327_rem_template_share_links.sql
BEGIN;

-- Remove the template_share_links table as we now use direct template ID URLs for sharing
-- This simplifies the sharing system and removes unnecessary complexity

DROP TABLE IF EXISTS template_share_links CASCADE;

COMMIT;



-- Migration: 20250901030240_security.sql
-- Remove the problematic GRANT that bypasses RLS
REVOKE SELECT ON TABLE projects FROM anon;
REVOKE SELECT ON TABLE threads FROM anon;
REVOKE SELECT ON TABLE messages FROM anon;


-- Migration: 20250905102908_user_roles.sql
CREATE TYPE user_role AS ENUM ('user', 'admin', 'super_admin');

CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'user',
    granted_by UUID REFERENCES auth.users(id),
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_user_roles_role ON user_roles(role);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own role" ON user_roles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all roles" ON user_roles
    FOR ALL USING (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.check_user_role(required_role user_role)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid()
        AND (
            (required_role = 'user' AND role IN ('user', 'admin', 'super_admin')) OR
            (required_role = 'admin' AND role IN ('admin', 'super_admin')) OR
            (required_role = 'super_admin' AND role = 'super_admin')
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.grant_user_role(
    target_user_id UUID,
    new_role user_role
) RETURNS BOOLEAN AS $$
DECLARE
    granter_role user_role;
BEGIN
    SELECT role INTO granter_role FROM user_roles WHERE user_id = auth.uid();
    
    IF granter_role IS NULL OR 
       (new_role = 'super_admin' AND granter_role != 'super_admin') OR
       (granter_role = 'admin' AND new_role NOT IN ('user', 'admin')) THEN
        RETURN FALSE;
    END IF;
    
    INSERT INTO user_roles (user_id, role, granted_by)
    VALUES (target_user_id, new_role, auth.uid())
    ON CONFLICT (user_id) DO UPDATE
    SET role = new_role, granted_by = auth.uid(), granted_at = NOW();
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 


-- Migration: 20250905102928_credit_system_refactor.sql
CREATE TABLE IF NOT EXISTS credit_accounts (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    balance DECIMAL(12, 4) NOT NULL DEFAULT 0 CHECK (balance >= 0),
    lifetime_granted DECIMAL(12, 4) NOT NULL DEFAULT 0,
    lifetime_purchased DECIMAL(12, 4) NOT NULL DEFAULT 0,
    lifetime_used DECIMAL(12, 4) NOT NULL DEFAULT 0,
    last_grant_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS credit_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount DECIMAL(12, 4) NOT NULL,
    balance_after DECIMAL(12, 4) NOT NULL,
    type TEXT NOT NULL CHECK (type IN (
        'tier_grant', 'purchase', 'admin_grant', 'promotional',
        'usage', 'refund', 'adjustment', 'expired'
    )),
    description TEXT,
    reference_id UUID,
    reference_type TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS credit_grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tier_price_id TEXT,
    amount DECIMAL(12, 4) NOT NULL CHECK (amount > 0),
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_credit_ledger_user_id ON credit_ledger(user_id, created_at DESC);
CREATE INDEX idx_credit_ledger_type ON credit_ledger(type);
CREATE INDEX idx_credit_ledger_reference ON credit_ledger(reference_id, reference_type);
CREATE INDEX idx_credit_grants_user_period ON credit_grants(user_id, period_start, period_end);

ALTER TABLE credit_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credit account" ON credit_accounts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role manages credit accounts" ON credit_accounts
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can view own ledger" ON credit_ledger
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role manages ledger" ON credit_ledger
    FOR ALL USING (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION deduct_credits(
    p_user_id UUID,
    p_amount DECIMAL,
    p_description TEXT,
    p_reference_id UUID DEFAULT NULL,
    p_reference_type TEXT DEFAULT NULL
) RETURNS TABLE (success BOOLEAN, new_balance DECIMAL, transaction_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_balance DECIMAL;
    v_new_balance DECIMAL;
    v_transaction_id UUID;
BEGIN
    SELECT balance INTO v_balance
    FROM credit_accounts
    WHERE user_id = p_user_id
    FOR UPDATE;
    
    IF v_balance IS NULL OR v_balance < p_amount THEN
        RETURN QUERY SELECT FALSE, COALESCE(v_balance, 0::DECIMAL), NULL::UUID;
        RETURN;
    END IF;
    
    v_new_balance := v_balance - p_amount;
    
    UPDATE credit_accounts
    SET balance = v_new_balance,
        lifetime_used = lifetime_used + p_amount,
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    INSERT INTO credit_ledger (
        user_id, amount, balance_after, type, description,
        reference_id, reference_type
    ) VALUES (
        p_user_id, -p_amount, v_new_balance, 'usage', p_description,
        p_reference_id, p_reference_type
    ) RETURNING id INTO v_transaction_id;
    
    RETURN QUERY SELECT TRUE, v_new_balance, v_transaction_id;
END;
$$;

CREATE OR REPLACE FUNCTION add_credits(
    p_user_id UUID,
    p_amount DECIMAL,
    p_type TEXT,
    p_description TEXT,
    p_created_by UUID DEFAULT NULL
) RETURNS DECIMAL
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_balance DECIMAL;
BEGIN
    INSERT INTO credit_accounts (user_id, balance, lifetime_granted)
    VALUES (p_user_id, p_amount, CASE WHEN p_type IN ('tier_grant', 'admin_grant') THEN p_amount ELSE 0 END)
    ON CONFLICT (user_id) DO UPDATE
    SET balance = credit_accounts.balance + p_amount,
        lifetime_granted = credit_accounts.lifetime_granted + 
            CASE WHEN p_type IN ('tier_grant', 'admin_grant') THEN p_amount ELSE 0 END,
        lifetime_purchased = credit_accounts.lifetime_purchased +
            CASE WHEN p_type = 'purchase' THEN p_amount ELSE 0 END,
        updated_at = NOW()
    RETURNING balance INTO v_new_balance;
    
    INSERT INTO credit_ledger (
        user_id, amount, balance_after, type, description, created_by
    ) VALUES (
        p_user_id, p_amount, v_new_balance, p_type, p_description, p_created_by
    );
    
    RETURN v_new_balance;
END;
$$; 


-- Migration: 20250905102947_admin_actions_log.sql
CREATE TABLE IF NOT EXISTS admin_actions_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL REFERENCES auth.users(id),
    action_type TEXT NOT NULL,
    target_user_id UUID REFERENCES auth.users(id),
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_admin_actions_admin ON admin_actions_log(admin_user_id, created_at DESC);
CREATE INDEX idx_admin_actions_target ON admin_actions_log(target_user_id, created_at DESC);
CREATE INDEX idx_admin_actions_type ON admin_actions_log(action_type, created_at DESC);

ALTER TABLE admin_actions_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view logs" ON admin_actions_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "Service role manages logs" ON admin_actions_log
    FOR ALL USING (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION migrate_user_to_credits(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_subscription RECORD;
    v_tier_credits DECIMAL;
    v_already_migrated BOOLEAN;
BEGIN
    SELECT EXISTS(SELECT 1 FROM credit_accounts WHERE user_id = p_user_id) INTO v_already_migrated;
    
    IF v_already_migrated THEN
        RETURN TRUE;
    END IF;
    
    SELECT bs.price_id, bs.current_period_start, bs.current_period_end
    INTO v_subscription
    FROM basejump.billing_subscriptions bs
    WHERE bs.account_id = p_user_id
    AND bs.status = 'active'
    ORDER BY bs.created DESC
    LIMIT 1;
    
    v_tier_credits := CASE 
        WHEN v_subscription.price_id LIKE '%tier_2_20%' THEN 25
        WHEN v_subscription.price_id LIKE '%tier_6_50%' THEN 55
        WHEN v_subscription.price_id LIKE '%tier_12_100%' THEN 105
        WHEN v_subscription.price_id LIKE '%tier_25_200%' THEN 205
        WHEN v_subscription.price_id LIKE '%tier_50_400%' THEN 405
        WHEN v_subscription.price_id LIKE '%tier_125_800%' THEN 805
        WHEN v_subscription.price_id LIKE '%tier_200_1000%' THEN 1005
        ELSE 5
    END;
    
    INSERT INTO credit_accounts (user_id, balance, lifetime_granted)
    VALUES (p_user_id, v_tier_credits, v_tier_credits);
    
    INSERT INTO credit_ledger (
        user_id, amount, balance_after, type, description
    ) VALUES (
        p_user_id, v_tier_credits, v_tier_credits, 'tier_grant', 
        'Initial migration credit grant'
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 


-- Migration: 20250905103000_add_last_grant_date.sql
ALTER TABLE credit_accounts 
ADD COLUMN IF NOT EXISTS last_grant_date TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_credit_accounts_last_grant ON credit_accounts(last_grant_date);

CREATE OR REPLACE FUNCTION grant_tier_credits(
    p_user_id UUID,
    p_amount DECIMAL,
    p_tier VARCHAR
) RETURNS BOOLEAN AS $$
DECLARE
    v_new_balance DECIMAL;
    v_period_start TIMESTAMPTZ;
    v_period_end TIMESTAMPTZ;
BEGIN
    UPDATE credit_accounts 
    SET balance = balance + p_amount,
        last_grant_date = NOW()
    WHERE user_id = p_user_id
    RETURNING balance INTO v_new_balance;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    INSERT INTO credit_ledger (user_id, amount, balance_after, type, description)
    VALUES (p_user_id, p_amount, v_new_balance, 'credit', 'Monthly ' || p_tier || ' tier credit grant');
    
    v_period_start := date_trunc('month', NOW());
    v_period_end := v_period_start + INTERVAL '1 month';
    
    INSERT INTO credit_grants (user_id, amount, tier, period_start, period_end)
    VALUES (p_user_id, p_amount, p_tier, v_period_start, v_period_end);
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 


-- Migration: 20250905103100_fix_credit_schema.sql
-- Fix credit_accounts table by adding missing columns
ALTER TABLE credit_accounts 
ADD COLUMN IF NOT EXISTS tier VARCHAR(50) DEFAULT 'free';

ALTER TABLE credit_accounts 
ADD COLUMN IF NOT EXISTS last_grant_date TIMESTAMPTZ;

-- Add missing indexes
CREATE INDEX IF NOT EXISTS idx_credit_accounts_tier ON credit_accounts(tier);
CREATE INDEX IF NOT EXISTS idx_credit_accounts_last_grant ON credit_accounts(last_grant_date);

-- Create the missing add_credits function
CREATE OR REPLACE FUNCTION add_credits(
    p_user_id UUID,
    p_amount DECIMAL,
    p_description TEXT DEFAULT 'Credit added'
) RETURNS DECIMAL AS $$
DECLARE
    v_new_balance DECIMAL;
BEGIN
    -- Insert or update credit account
    INSERT INTO credit_accounts (user_id, balance, tier)
    VALUES (p_user_id, p_amount, 'free')
    ON CONFLICT (user_id) 
    DO UPDATE SET balance = credit_accounts.balance + p_amount
    RETURNING balance INTO v_new_balance;
    
    INSERT INTO credit_ledger (user_id, amount, balance_after, type, description)
    VALUES (p_user_id, p_amount, v_new_balance, 'admin_grant', p_description);
    
    RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER TABLE credit_grants
ADD COLUMN IF NOT EXISTS tier VARCHAR(50);

CREATE OR REPLACE FUNCTION grant_tier_credits(
    p_user_id UUID,
    p_amount DECIMAL,
    p_tier VARCHAR
) RETURNS BOOLEAN AS $$
DECLARE
    v_new_balance DECIMAL;
    v_period_start TIMESTAMPTZ;
    v_period_end TIMESTAMPTZ;
BEGIN
    UPDATE credit_accounts 
    SET balance = balance + p_amount,
        last_grant_date = NOW(),
        tier = p_tier
    WHERE user_id = p_user_id
    RETURNING balance INTO v_new_balance;
    
    IF NOT FOUND THEN
        INSERT INTO credit_accounts (user_id, balance, tier, last_grant_date)
        VALUES (p_user_id, p_amount, p_tier, NOW())
        RETURNING balance INTO v_new_balance;
    END IF;
    
    INSERT INTO credit_ledger (user_id, amount, balance_after, type, description)
    VALUES (p_user_id, p_amount, v_new_balance, 'tier_grant', 'Monthly ' || p_tier || ' tier credit grant');
    
    v_period_start := date_trunc('month', NOW());
    v_period_end := v_period_start + INTERVAL '1 month';
    
    INSERT INTO credit_grants (user_id, amount, tier, period_start, period_end)
    VALUES (p_user_id, p_amount, p_tier, v_period_start, v_period_end);
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 


-- Migration: 20250905103200_update_credit_functions_types.sql
CREATE OR REPLACE FUNCTION add_credits(
    p_user_id UUID,
    p_amount DECIMAL,
    p_description TEXT DEFAULT 'Credit added'
) RETURNS DECIMAL AS $$
DECLARE
    v_new_balance DECIMAL;
BEGIN
    INSERT INTO credit_accounts (user_id, balance, tier)
    VALUES (p_user_id, p_amount, 'free')
    ON CONFLICT (user_id) 
    DO UPDATE SET balance = credit_accounts.balance + p_amount
    RETURNING balance INTO v_new_balance;
    
    INSERT INTO credit_ledger (user_id, amount, balance_after, type, description)
    VALUES (p_user_id, p_amount, v_new_balance, 'admin_grant', p_description);
    
    RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION grant_tier_credits(
    p_user_id UUID,
    p_amount DECIMAL,
    p_tier VARCHAR
) RETURNS BOOLEAN AS $$
DECLARE
    v_new_balance DECIMAL;
    v_period_start TIMESTAMPTZ;
    v_period_end TIMESTAMPTZ;
BEGIN
    UPDATE credit_accounts 
    SET balance = balance + p_amount,
        last_grant_date = NOW(),
        tier = p_tier
    WHERE user_id = p_user_id
    RETURNING balance INTO v_new_balance;
    
    IF NOT FOUND THEN
        INSERT INTO credit_accounts (user_id, balance, tier, last_grant_date)
        VALUES (p_user_id, p_amount, p_tier, NOW())
        RETURNING balance INTO v_new_balance;
    END IF;
    
    INSERT INTO credit_ledger (user_id, amount, balance_after, type, description)
    VALUES (p_user_id, p_amount, v_new_balance, 'tier_grant', 'Monthly ' || p_tier || ' tier credit grant');
    
    v_period_start := date_trunc('month', NOW());
    v_period_end := v_period_start + INTERVAL '1 month';
    
    INSERT INTO credit_grants (user_id, amount, tier, period_start, period_end)
    VALUES (p_user_id, p_amount, p_tier, v_period_start, v_period_end);
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 


-- Migration: 20250905103300_add_tier_upgrade_type.sql
BEGIN;

ALTER TABLE credit_ledger 
DROP CONSTRAINT IF EXISTS credit_ledger_type_check;

ALTER TABLE credit_ledger 
ADD CONSTRAINT credit_ledger_type_check 
CHECK (type IN ('admin_grant', 'tier_grant', 'tier_upgrade', 'purchase', 'usage', 'refund', 'adjustment', 'expiration'));

COMMIT; 


-- Migration: 20250905104000_auto_create_free_tier.sql
BEGIN;

SET LOCAL lock_timeout = '30s';

CREATE OR REPLACE FUNCTION initialize_free_tier_credits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_initial_credits DECIMAL := 5.0;
    v_transaction_id UUID;
    v_rowcount INT;
BEGIN
    IF NEW.personal_account = TRUE THEN
        INSERT INTO public.credit_accounts (
            user_id,
            balance,
            tier,
            last_grant_date
        ) VALUES (
            NEW.id,
            v_initial_credits,
            'free',
            NOW()
        )
        ON CONFLICT (user_id) DO NOTHING;

        GET DIAGNOSTICS v_rowcount = ROW_COUNT;
        IF v_rowcount > 0 THEN
            INSERT INTO public.credit_ledger (
                user_id,
                amount,
                balance_after,
                type,
                description
            ) VALUES (
                NEW.id,
                v_initial_credits,
                v_initial_credits,
                'tier_grant',
                'Welcome to Suna! Free tier initial credits'
            ) RETURNING id INTO v_transaction_id;
            
            RAISE LOG 'Created free tier credits for new user %: % credits', NEW.id, v_initial_credits;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_create_free_tier_on_account ON basejump.accounts;

CREATE TRIGGER auto_create_free_tier_on_account
    AFTER INSERT ON basejump.accounts
    FOR EACH ROW
    EXECUTE FUNCTION initialize_free_tier_credits();

DO $$
DECLARE
    account_record RECORD;
    v_initial_credits DECIMAL := 5.0;
    v_created_count INTEGER := 0;
BEGIN
    FOR account_record IN 
        SELECT a.id, a.created_at
        FROM basejump.accounts a
        LEFT JOIN public.credit_accounts ca ON ca.user_id = a.id
        WHERE a.personal_account = TRUE
        AND ca.user_id IS NULL
    LOOP
        INSERT INTO public.credit_accounts (
            user_id,
            balance,
            tier,
            last_grant_date
        ) VALUES (
            account_record.id,
            v_initial_credits,
            'free',
            account_record.created_at
        );
        
        INSERT INTO public.credit_ledger (
            user_id,
            amount,
            balance_after,
            type,
            description,
            created_at
        ) VALUES (
            account_record.id,
            v_initial_credits,
            v_initial_credits,
            'tier_grant',
            'Free tier initial credits (backfilled)',
            account_record.created_at
        );
        
        v_created_count := v_created_count + 1;
    END LOOP;
    
    IF v_created_count > 0 THEN
        RAISE NOTICE 'Created free tier credits for % existing users', v_created_count;
    END IF;
END;
$$;

COMMIT;



-- Migration: 20250905181836_track_billing_cycle.sql
BEGIN;

ALTER TABLE credit_accounts 
ADD COLUMN IF NOT EXISTS billing_cycle_anchor TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS next_credit_grant TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_credit_accounts_next_grant 
ON credit_accounts(next_credit_grant) 
WHERE next_credit_grant IS NOT NULL;

CREATE OR REPLACE FUNCTION calculate_next_billing_date(
    anchor_date TIMESTAMPTZ,
    from_date TIMESTAMPTZ DEFAULT NOW()
) RETURNS TIMESTAMPTZ AS $$
DECLARE
    months_diff INT;
    next_date TIMESTAMPTZ;
BEGIN
    IF anchor_date IS NULL THEN
        RETURN NULL;
    END IF;
    
    months_diff := EXTRACT(YEAR FROM from_date) * 12 + EXTRACT(MONTH FROM from_date) -
                   (EXTRACT(YEAR FROM anchor_date) * 12 + EXTRACT(MONTH FROM anchor_date));
    
    IF from_date < anchor_date THEN
        RETURN anchor_date;
    END IF;
    
    next_date := anchor_date + INTERVAL '1 month' * (months_diff + 1);
    
    IF EXTRACT(DAY FROM anchor_date) > EXTRACT(DAY FROM next_date) THEN
        next_date := date_trunc('month', next_date) + INTERVAL '1 month' - INTERVAL '1 day';
    END IF;
    
    RETURN next_date;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

UPDATE credit_accounts ca
SET 
    stripe_subscription_id = bs.id,
    billing_cycle_anchor = bs.created::timestamptz,
    next_credit_grant = CASE
        WHEN ca.last_grant_date IS NOT NULL 
            AND ca.last_grant_date > NOW() - INTERVAL '25 days'
        THEN calculate_next_billing_date(bs.created::timestamptz, ca.last_grant_date)
        ELSE calculate_next_billing_date(bs.created::timestamptz, NOW())
    END
FROM basejump.billing_subscriptions bs
WHERE bs.account_id = ca.user_id
  AND bs.status IN ('active', 'trialing');

DO $$
DECLARE
    migrated_count INT;
    users_with_recent_grants INT;
BEGIN
    SELECT COUNT(*) INTO migrated_count
    FROM credit_accounts 
    WHERE billing_cycle_anchor IS NOT NULL;
    
    SELECT COUNT(*) INTO users_with_recent_grants
    FROM credit_accounts
    WHERE last_grant_date > NOW() - INTERVAL '25 days'
      AND billing_cycle_anchor IS NOT NULL;
    
    RAISE NOTICE 'Migration complete: % users migrated to billing cycle system', migrated_count;
    RAISE NOTICE 'Users with recent grants (protected from double-crediting): %', users_with_recent_grants;
END $$;

COMMIT; 


-- Migration: 20250905181840_fix_duplicate_grant_columns.sql
BEGIN;

UPDATE credit_accounts 
SET last_grant_date = last_grant_at 
WHERE last_grant_date IS NULL AND last_grant_at IS NOT NULL;

ALTER TABLE credit_accounts 
DROP COLUMN IF EXISTS last_grant_at;

ALTER TABLE credit_accounts 
ADD COLUMN IF NOT EXISTS last_grant_date TIMESTAMPTZ;

DROP INDEX IF EXISTS idx_credit_accounts_last_grant;
CREATE INDEX idx_credit_accounts_last_grant ON credit_accounts(last_grant_date);

CREATE OR REPLACE FUNCTION grant_tier_credits(
    p_user_id UUID,
    p_tier TEXT,
    p_amount DECIMAL
) RETURNS BOOLEAN AS $$
DECLARE
    v_balance DECIMAL;
BEGIN
    SELECT balance INTO v_balance
    FROM credit_accounts
    WHERE user_id = p_user_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        INSERT INTO credit_accounts (user_id, balance, tier, last_grant_date)
        VALUES (p_user_id, p_amount, p_tier, NOW());
    ELSE
        UPDATE credit_accounts
        SET 
            balance = balance + p_amount,
            tier = p_tier,
            last_grant_date = NOW(),
            updated_at = NOW()
        WHERE user_id = p_user_id;
    END IF;
    
    INSERT INTO credit_grants (user_id, amount, tier, granted_at)
    VALUES (p_user_id, p_amount, p_tier, NOW());
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON COLUMN credit_accounts.last_grant_date IS 'Timestamp of the last credit grant to this account';

COMMIT; 


-- Migration: 20250906100512_remove_redundant_stuff.sql
-- Migration: Remove redundant billing data sources
-- ================================================
-- This migration removes unused tables to simplify the billing architecture:
-- 1. credit_grants - Not used in production
-- 2. billing_subscriptions - Replaced by credit_accounts.stripe_subscription_id
--
-- IMPORTANT: Run this migration AFTER verifying all users have credit_accounts entries

BEGIN;

DROP TABLE IF EXISTS credit_grants CASCADE;

CREATE INDEX IF NOT EXISTS idx_credit_accounts_user_id ON credit_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_accounts_tier ON credit_accounts(tier);
CREATE INDEX IF NOT EXISTS idx_credit_accounts_stripe_subscription_id ON credit_accounts(stripe_subscription_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'credit_accounts' 
        AND column_name = 'stripe_subscription_id'
    ) THEN
        ALTER TABLE credit_accounts 
        ADD COLUMN stripe_subscription_id TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'credit_accounts' 
        AND column_name = 'billing_cycle_anchor'
    ) THEN
        ALTER TABLE credit_accounts 
        ADD COLUMN billing_cycle_anchor TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'credit_accounts' 
        AND column_name = 'next_credit_grant'
    ) THEN
        ALTER TABLE credit_accounts 
        ADD COLUMN next_credit_grant TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'credit_accounts' 
        AND column_name = 'last_grant_date'
    ) THEN
        ALTER TABLE credit_accounts 
        ADD COLUMN last_grant_date TIMESTAMPTZ;
    END IF;
END $$;

COMMIT; 


-- Migration: 20250907165633_fix_add_credits_balance.sql
DROP FUNCTION IF EXISTS add_credits(UUID, DECIMAL, TEXT, BOOLEAN, TIMESTAMPTZ);
CREATE OR REPLACE FUNCTION add_credits(
    p_user_id UUID,
    p_amount DECIMAL,
    p_description TEXT DEFAULT 'Credit added',
    p_is_expiring BOOLEAN DEFAULT true,
    p_expires_at TIMESTAMPTZ DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_new_expiring DECIMAL;
    v_new_non_expiring DECIMAL;
    v_new_total DECIMAL;
BEGIN
    IF p_is_expiring THEN
        INSERT INTO credit_accounts (user_id, expiring_credits, non_expiring_credits, balance, tier)
        VALUES (p_user_id, p_amount, 0, p_amount, 'free')
        ON CONFLICT (user_id) 
        DO UPDATE SET 
            expiring_credits = credit_accounts.expiring_credits + p_amount,
            balance = (credit_accounts.expiring_credits + p_amount) + credit_accounts.non_expiring_credits,
            updated_at = NOW()
        RETURNING expiring_credits, non_expiring_credits, balance 
        INTO v_new_expiring, v_new_non_expiring, v_new_total;
    ELSE
        INSERT INTO credit_accounts (user_id, expiring_credits, non_expiring_credits, balance, tier)
        VALUES (p_user_id, 0, p_amount, p_amount, 'free')
        ON CONFLICT (user_id) 
        DO UPDATE SET 
            non_expiring_credits = credit_accounts.non_expiring_credits + p_amount,
            balance = credit_accounts.expiring_credits + (credit_accounts.non_expiring_credits + p_amount),
            updated_at = NOW()
        RETURNING expiring_credits, non_expiring_credits, balance 
        INTO v_new_expiring, v_new_non_expiring, v_new_total;
    END IF;
    
    INSERT INTO credit_ledger (
        user_id, amount, balance_after, type, description, is_expiring, expires_at
    )
    VALUES (
        p_user_id, p_amount, v_new_total, 
        CASE WHEN p_is_expiring THEN 'tier_grant' ELSE 'purchase' END,
        p_description, p_is_expiring, p_expires_at
    );
    
    RETURN jsonb_build_object(
        'expiring_credits', v_new_expiring,
        'non_expiring_credits', v_new_non_expiring,
        'total_balance', v_new_total
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION add_credits(UUID, DECIMAL, TEXT, BOOLEAN, TIMESTAMPTZ) TO service_role; 


-- Migration: 20250907165658_ensure_credit_schema.sql
ALTER TABLE credit_accounts 
ADD COLUMN IF NOT EXISTS expiring_credits DECIMAL(12, 4) NOT NULL DEFAULT 0 CHECK (expiring_credits >= 0),
ADD COLUMN IF NOT EXISTS non_expiring_credits DECIMAL(12, 4) NOT NULL DEFAULT 0 CHECK (non_expiring_credits >= 0);

ALTER TABLE credit_ledger
ADD COLUMN IF NOT EXISTS is_expiring BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_credit_ledger_expiry ON credit_ledger(user_id, is_expiring, expires_at);

CREATE OR REPLACE VIEW credit_breakdown AS
SELECT 
    ca.user_id,
    ca.tier,
    ca.expiring_credits,
    ca.non_expiring_credits,
    ca.balance as total_balance,
    ca.expiring_credits + ca.non_expiring_credits as calculated_total,
    ca.updated_at,
    ca.next_credit_grant,
    CASE 
        WHEN ca.expiring_credits > 0 AND ca.non_expiring_credits > 0 THEN 'mixed'
        WHEN ca.expiring_credits > 0 THEN 'expiring_only'
        WHEN ca.non_expiring_credits > 0 THEN 'non_expiring_only'
        ELSE 'no_credits'
    END as credit_type
FROM credit_accounts ca;

GRANT SELECT ON credit_breakdown TO authenticated;

COMMENT ON COLUMN credit_accounts.expiring_credits IS 'Credits from subscription plans that expire at billing cycle end';
COMMENT ON COLUMN credit_accounts.non_expiring_credits IS 'Credits from topup purchases that never expire';
COMMENT ON COLUMN credit_ledger.is_expiring IS 'Whether this credit transaction involves expiring credits';
COMMENT ON COLUMN credit_ledger.expires_at IS 'When these credits expire (NULL for non-expiring)'; 


-- Migration: 20250907165659_backfill_credits.sql
CREATE OR REPLACE FUNCTION temp_calculate_credit_split(p_user_id UUID)
RETURNS TABLE(expiring_amount DECIMAL, non_expiring_amount DECIMAL) AS $$
DECLARE
    v_total_purchases DECIMAL := 0;
    v_total_tier_grants DECIMAL := 0;
    v_total_usage DECIMAL := 0;
    v_current_balance DECIMAL;
BEGIN
    SELECT balance INTO v_current_balance
    FROM credit_accounts
    WHERE user_id = p_user_id;
    
    SELECT 
        COALESCE(SUM(CASE 
            WHEN type = 'purchase' AND amount > 0 THEN amount
            WHEN description ILIKE '%purchased%' AND amount > 0 THEN amount
            ELSE 0
        END), 0),
        COALESCE(SUM(CASE 
            WHEN type IN ('tier_grant', 'tier_upgrade', 'subscription_renewal') AND amount > 0 THEN amount
            ELSE 0
        END), 0),
        COALESCE(SUM(CASE 
            WHEN type = 'usage' AND amount < 0 THEN ABS(amount)
            ELSE 0
        END), 0)
    INTO v_total_purchases, v_total_tier_grants, v_total_usage
    FROM credit_ledger
    WHERE user_id = p_user_id;
    
    IF v_total_usage > v_total_tier_grants THEN
        expiring_amount := 0;
        non_expiring_amount := GREATEST(0, v_total_purchases - (v_total_usage - v_total_tier_grants));
    ELSE
        expiring_amount := v_total_tier_grants - v_total_usage;
        non_expiring_amount := v_total_purchases;
    END IF;
    
    IF (expiring_amount + non_expiring_amount) > v_current_balance THEN
        IF (expiring_amount + non_expiring_amount) > 0 THEN
            DECLARE
                v_scale DECIMAL;
            BEGIN
                v_scale := v_current_balance / (expiring_amount + non_expiring_amount);
                expiring_amount := expiring_amount * v_scale;
                non_expiring_amount := non_expiring_amount * v_scale;
            END;
        END IF;
    END IF;
    
    expiring_amount := ROUND(expiring_amount, 2);
    non_expiring_amount := ROUND(non_expiring_amount, 2);
    
    IF (expiring_amount + non_expiring_amount) != v_current_balance THEN
        IF expiring_amount > 0 THEN
            expiring_amount := expiring_amount + (v_current_balance - (expiring_amount + non_expiring_amount));
        ELSE
            non_expiring_amount := non_expiring_amount + (v_current_balance - (expiring_amount + non_expiring_amount));
        END IF;
    END IF;
    
    RETURN QUERY SELECT expiring_amount, non_expiring_amount;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    r RECORD;
    v_expiring DECIMAL;
    v_non_expiring DECIMAL;
    v_updated_count INTEGER := 0;
BEGIN
    FOR r IN 
        SELECT user_id, balance, tier
        FROM credit_accounts
        WHERE balance > 0
    LOOP
        SELECT expiring_amount, non_expiring_amount
        INTO v_expiring, v_non_expiring
        FROM temp_calculate_credit_split(r.user_id);
        
        UPDATE credit_accounts
        SET 
            expiring_credits = v_expiring,
            non_expiring_credits = v_non_expiring
        WHERE user_id = r.user_id;
        
        v_updated_count := v_updated_count + 1;
    END LOOP;
    
    RAISE NOTICE 'Migration completed. Updated % users', v_updated_count;
END;
$$;

UPDATE credit_ledger
SET is_expiring = false
WHERE type = 'purchase' 
   OR description ILIKE '%purchased%';

UPDATE credit_ledger
SET is_expiring = true
WHERE type IN ('tier_grant', 'tier_upgrade', 'subscription_renewal');

DROP FUNCTION IF EXISTS temp_calculate_credit_split(UUID);

DO $$
DECLARE
    v_total_users INTEGER;
    v_users_with_expiring INTEGER;
    v_users_with_non_expiring INTEGER;
    v_total_expiring DECIMAL;
    v_total_non_expiring DECIMAL;
BEGIN
    SELECT 
        COUNT(*),
        COUNT(CASE WHEN expiring_credits > 0 THEN 1 END),
        COUNT(CASE WHEN non_expiring_credits > 0 THEN 1 END),
        COALESCE(SUM(expiring_credits), 0),
        COALESCE(SUM(non_expiring_credits), 0)
    INTO v_total_users, v_users_with_expiring, v_users_with_non_expiring, 
         v_total_expiring, v_total_non_expiring
    FROM credit_accounts;
    
    RAISE NOTICE 'Backfill Summary:';
    RAISE NOTICE '  Total users: %', v_total_users;
    RAISE NOTICE '  Users with expiring credits: %', v_users_with_expiring;
    RAISE NOTICE '  Users with non-expiring credits: %', v_users_with_non_expiring;
    RAISE NOTICE '  Total expiring credits: $%', v_total_expiring;
    RAISE NOTICE '  Total non-expiring credits: $%', v_total_non_expiring;
END;
$$; 


-- Migration: 20250907231409_remove_credit_functions.sql
DROP FUNCTION IF EXISTS get_available_credits(UUID);
DROP FUNCTION IF EXISTS add_credits(UUID, DECIMAL, TEXT, BOOLEAN, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS use_credits(UUID, DECIMAL, TEXT, UUID, UUID);
DROP FUNCTION IF EXISTS reset_expiring_credits(UUID, DECIMAL, TEXT);

DROP FUNCTION IF EXISTS add_credits(UUID, DECIMAL, TEXT);
DROP FUNCTION IF EXISTS use_credits(UUID, DECIMAL, TEXT, UUID, UUID);

DROP FUNCTION IF EXISTS temp_calculate_credit_split(UUID);
DROP FUNCTION IF EXISTS calculate_existing_credit_split(UUID);

COMMENT ON TABLE credit_accounts IS 'Credit management is now handled in Python code (billing.credit_manager) instead of database functions for better maintainability'; 


-- Migration: 20250908082540_drop_credit_breakdown.sql
DROP VIEW IF EXISTS credit_breakdown CASCADE;



-- Migration: 20250908082546_rename_user_id_to_account_id_billing.sql
ALTER TABLE credit_accounts RENAME COLUMN user_id TO account_id;

ALTER TABLE credit_ledger RENAME COLUMN user_id TO account_id;

ALTER TABLE credit_purchases RENAME COLUMN user_id TO account_id;

ALTER TABLE credit_balance RENAME COLUMN user_id TO account_id;

ALTER TABLE credit_usage RENAME COLUMN user_id TO account_id;

DROP INDEX IF EXISTS idx_credit_ledger_user_id;
CREATE INDEX IF NOT EXISTS idx_credit_ledger_account_id ON credit_ledger(account_id, created_at DESC);

DROP INDEX IF EXISTS idx_credit_purchases_user_id;
CREATE INDEX IF NOT EXISTS idx_credit_purchases_account_id ON credit_purchases(account_id);

DROP INDEX IF EXISTS idx_credit_accounts_user_id;
CREATE INDEX IF NOT EXISTS idx_credit_accounts_account_id ON credit_accounts(account_id);

DROP INDEX IF EXISTS idx_credit_balance_user_id;
CREATE INDEX IF NOT EXISTS idx_credit_balance_account_id ON credit_balance(account_id);

DROP INDEX IF EXISTS idx_credit_usage_user_id;
CREATE INDEX IF NOT EXISTS idx_credit_usage_account_id ON credit_usage(account_id); 


-- Migration: 20250908104135_fix_credit_accunts_key.sql
ALTER TABLE credit_accounts 
DROP CONSTRAINT IF EXISTS credit_accounts_user_id_fkey;

ALTER TABLE credit_accounts 
ADD CONSTRAINT credit_accounts_account_id_fkey 
FOREIGN KEY (account_id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE; 


-- Migration: 20250908113955_free_trials.sql
BEGIN;

ALTER TABLE credit_accounts 
ADD COLUMN IF NOT EXISTS trial_status VARCHAR(20) DEFAULT 'none' 
  CHECK (trial_status IN ('none', 'active', 'expired', 'converted'));

ALTER TABLE credit_accounts 
ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;

ALTER TABLE credit_accounts 
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

ALTER TABLE credit_accounts 
ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);

ALTER TABLE credit_accounts 
ADD COLUMN IF NOT EXISTS is_grandfathered_free BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS trial_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    converted_to_paid BOOLEAN DEFAULT FALSE,
    stripe_checkout_session_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT one_trial_per_account UNIQUE(account_id)
);

CREATE INDEX IF NOT EXISTS idx_trial_history_account_id ON trial_history(account_id);
CREATE INDEX IF NOT EXISTS idx_credit_accounts_trial_status ON credit_accounts(trial_status) WHERE trial_status != 'none';

ALTER TABLE trial_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own trial history" ON trial_history
    FOR SELECT USING (auth.uid() = account_id);

COMMIT; 


-- Migration: 20250908115623_fix_signup.sql
CREATE OR REPLACE FUNCTION initialize_free_tier_credits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NEW.personal_account = TRUE THEN
        INSERT INTO public.credit_accounts (
            account_id,
            balance,
            tier,
            trial_status,
            last_grant_date
        ) VALUES (
            NEW.id,
            0.00,
            'none',
            'none',
            NOW()
        )
        ON CONFLICT (account_id) DO NOTHING;
        RAISE LOG 'Created account for new user % with no credits (must start trial)', NEW.id;
    END IF;
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error in initialize_free_tier_credits for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$; 


-- Migration: 20250908221821_add_cancelled_trial_status.sql
BEGIN;

ALTER TABLE credit_accounts 
DROP CONSTRAINT IF EXISTS credit_accounts_trial_status_check;

ALTER TABLE credit_accounts 
ADD CONSTRAINT credit_accounts_trial_status_check 
CHECK (trial_status IN ('none', 'active', 'expired', 'converted', 'cancelled'));

COMMIT; 



-- Migration: 20250909184956_last_invoice_tracking.sql
ALTER TABLE credit_accounts 
ADD COLUMN IF NOT EXISTS last_processed_invoice_id VARCHAR(255);


-- Migration: 20250910092227_optimise_user_search_indices.sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_billing_customers_email_gin 
    ON basejump.billing_customers 
    USING gin (lower(email) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_billing_customers_account_id 
    ON basejump.billing_customers (account_id);

CREATE INDEX IF NOT EXISTS idx_accounts_created_at_desc 
    ON basejump.accounts (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_credit_accounts_account_id 
    ON public.credit_accounts (account_id);

CREATE INDEX IF NOT EXISTS idx_credit_accounts_tier 
    ON public.credit_accounts (tier);

CREATE INDEX IF NOT EXISTS idx_agent_runs_created_at_desc 
    ON public.agent_runs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_threads_account_id 
    ON public.threads (account_id);

ANALYZE basejump.billing_customers;
ANALYZE basejump.accounts;
ANALYZE public.credit_accounts;
ANALYZE public.agent_runs;
ANALYZE public.threads; 



-- Migration: 20250910102751_fix_oauth_email_retrieval.sql
-- NOTE: This migration has been rolled back by 20250910103000_rollback_oauth_email_fix.sql
BEGIN;

CREATE OR REPLACE FUNCTION public.get_user_email(user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_email TEXT;
BEGIN
    SELECT email INTO user_email
    FROM auth.users
    WHERE id = user_id;
    
    IF user_email IS NULL THEN
        SELECT 
            COALESCE(
                raw_user_meta_data->>'email',
                raw_user_meta_data->>'user_email',
                email
            ) INTO user_email
        FROM auth.users
        WHERE id = user_id;
    END IF;
    
    RETURN user_email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_email(UUID) TO authenticated, service_role;

DO $$
DECLARE
    rec RECORD;
    user_email TEXT;
BEGIN
    FOR rec IN 
        SELECT bc.account_id, a.primary_owner_user_id
        FROM basejump.billing_customers bc
        JOIN basejump.accounts a ON bc.account_id = a.id
        WHERE bc.email IS NULL OR bc.email = ''
    LOOP
        user_email := public.get_user_email(rec.primary_owner_user_id);
        
        IF user_email IS NOT NULL THEN
            UPDATE basejump.billing_customers
            SET email = user_email
            WHERE account_id = rec.account_id;
            
            RAISE NOTICE 'Updated email for account %: %', rec.account_id, user_email;
        END IF;
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION basejump.ensure_billing_customer_email()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    user_email TEXT;
    owner_id UUID;
BEGIN
    IF NEW.email IS NULL OR NEW.email = '' THEN
        SELECT primary_owner_user_id INTO owner_id
        FROM basejump.accounts
        WHERE id = NEW.account_id;
        
        user_email := public.get_user_email(owner_id);
        
        IF user_email IS NOT NULL THEN
            NEW.email := user_email;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_billing_customer_email_trigger ON basejump.billing_customers;
CREATE TRIGGER ensure_billing_customer_email_trigger
    BEFORE INSERT OR UPDATE ON basejump.billing_customers
    FOR EACH ROW
    EXECUTE FUNCTION basejump.ensure_billing_customer_email();

COMMIT; 


-- Migration: 20250910103000_rollback_oauth_email_fix.sql
BEGIN;

DROP TRIGGER IF EXISTS ensure_billing_customer_email_trigger ON basejump.billing_customers;

DROP FUNCTION IF EXISTS basejump.ensure_billing_customer_email();

DROP FUNCTION IF EXISTS public.get_user_email(UUID);

COMMIT; 


-- Migration: 20250910105021_fix_oauth_email_retrieval.sql
BEGIN;

CREATE OR REPLACE FUNCTION public.get_user_email(user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_email TEXT;
BEGIN
    SELECT email INTO user_email
    FROM auth.users
    WHERE id = user_id;
    
    IF user_email IS NULL THEN
        SELECT 
            COALESCE(
                raw_user_meta_data->>'email',
                raw_user_meta_data->>'user_email',
                email
            ) INTO user_email
        FROM auth.users
        WHERE id = user_id;
    END IF;
    
    RETURN user_email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_email(UUID) TO authenticated, service_role;

DO $$
DECLARE
    rec RECORD;
    user_email TEXT;
BEGIN
    FOR rec IN 
        SELECT bc.account_id, a.primary_owner_user_id
        FROM basejump.billing_customers bc
        JOIN basejump.accounts a ON bc.account_id = a.id
        WHERE bc.email IS NULL OR bc.email = ''
    LOOP
        user_email := public.get_user_email(rec.primary_owner_user_id);
        
        IF user_email IS NOT NULL THEN
            UPDATE basejump.billing_customers
            SET email = user_email
            WHERE account_id = rec.account_id;
            
            RAISE NOTICE 'Updated email for account %: %', rec.account_id, user_email;
        END IF;
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION basejump.ensure_billing_customer_email()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    user_email TEXT;
    owner_id UUID;
BEGIN
    IF NEW.email IS NULL OR NEW.email = '' THEN
        SELECT primary_owner_user_id INTO owner_id
        FROM basejump.accounts
        WHERE id = NEW.account_id;
        
        user_email := public.get_user_email(owner_id);
        
        IF user_email IS NOT NULL THEN
            NEW.email := user_email;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_billing_customer_email_trigger ON basejump.billing_customers;
CREATE TRIGGER ensure_billing_customer_email_trigger
    BEFORE INSERT OR UPDATE ON basejump.billing_customers
    FOR EACH ROW
    EXECUTE FUNCTION basejump.ensure_billing_customer_email();

COMMIT; 


-- Migration: 20250916000000_new_knowledge_base.sql
BEGIN;

-- Drop old agent-specific knowledge base tables
DROP TABLE IF EXISTS agent_knowledge_base_usage_log CASCADE;
DROP TABLE IF EXISTS agent_kb_file_processing_jobs CASCADE;
DROP TABLE IF EXISTS agent_knowledge_base_entries CASCADE;
DROP TABLE IF EXISTS agent_knowledge_assignments CASCADE;

-- User-level knowledge base folders
CREATE TABLE IF NOT EXISTS knowledge_base_folders (
    folder_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES basejump.accounts(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT kb_folders_name_not_empty CHECK (LENGTH(TRIM(name)) > 0)
);

-- User-level knowledge base entries
CREATE TABLE IF NOT EXISTS knowledge_base_entries (
    entry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folder_id UUID NOT NULL REFERENCES knowledge_base_folders(folder_id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES basejump.accounts(id) ON DELETE CASCADE,
    
    filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL, -- S3 path: knowledge-base/{folder_id}/{entry_id}/{filename}
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(255),
    
    -- LLM-generated summary for context
    summary TEXT NOT NULL,
    
    -- When to use this entry
    usage_context VARCHAR(100) DEFAULT 'always' CHECK (usage_context IN ('always', 'on_request', 'contextual')),
    
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT kb_entries_filename_not_empty CHECK (LENGTH(TRIM(filename)) > 0),
    CONSTRAINT kb_entries_summary_not_empty CHECK (LENGTH(TRIM(summary)) > 0),
    CONSTRAINT kb_entries_file_size_positive CHECK (file_size > 0)
);

-- Agent assignments to specific knowledge base entries
CREATE TABLE IF NOT EXISTS agent_knowledge_entry_assignments (
    assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,
    entry_id UUID NOT NULL REFERENCES knowledge_base_entries(entry_id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES basejump.accounts(id) ON DELETE CASCADE,
    
    enabled BOOLEAN DEFAULT TRUE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(agent_id, entry_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_kb_folders_account_id ON knowledge_base_folders(account_id);
CREATE INDEX IF NOT EXISTS idx_kb_entries_folder_id ON knowledge_base_entries(folder_id);
CREATE INDEX IF NOT EXISTS idx_kb_entries_account_id ON knowledge_base_entries(account_id);
CREATE INDEX IF NOT EXISTS idx_kb_entry_assignments_agent_id ON agent_knowledge_entry_assignments(agent_id);
CREATE INDEX IF NOT EXISTS idx_kb_entry_assignments_entry_id ON agent_knowledge_entry_assignments(entry_id);

-- RLS
ALTER TABLE knowledge_base_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_knowledge_entry_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'kb_folders_account_access' AND tablename = 'knowledge_base_folders') THEN
        CREATE POLICY kb_folders_account_access ON knowledge_base_folders
            FOR ALL USING (basejump.has_role_on_account(account_id) = true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'kb_entries_account_access' AND tablename = 'knowledge_base_entries') THEN
        CREATE POLICY kb_entries_account_access ON knowledge_base_entries
            FOR ALL USING (basejump.has_role_on_account(account_id) = true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'kb_entry_assignments_account_access' AND tablename = 'agent_knowledge_entry_assignments') THEN
        CREATE POLICY kb_entry_assignments_account_access ON agent_knowledge_entry_assignments
            FOR ALL USING (basejump.has_role_on_account(account_id) = true);
    END IF;
END $$;

-- Functions
-- Drop the old version of the function first to avoid signature conflicts
DROP FUNCTION IF EXISTS get_agent_knowledge_base_context(UUID);
DROP FUNCTION IF EXISTS get_agent_knowledge_base_context(UUID, INTEGER);

CREATE OR REPLACE FUNCTION get_agent_knowledge_base_context(
    p_agent_id UUID,
    p_max_tokens INTEGER DEFAULT 4000
)
RETURNS TEXT
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
    context_text TEXT := '';
    entry_record RECORD;
    current_length INTEGER := 0;
    estimated_tokens INTEGER;
BEGIN
    FOR entry_record IN
        SELECT 
            kbe.filename,
            kbe.summary,
            kbf.name as folder_name
        FROM knowledge_base_entries kbe
        JOIN knowledge_base_folders kbf ON kbe.folder_id = kbf.folder_id
        JOIN agent_knowledge_entry_assignments akea ON kbe.entry_id = akea.entry_id
        WHERE akea.agent_id = p_agent_id
        AND akea.enabled = TRUE
        AND kbe.is_active = TRUE
        AND kbe.usage_context IN ('always', 'contextual')
        ORDER BY kbe.created_at DESC
    LOOP
        -- Rough token estimation: ~4 characters per token
        estimated_tokens := (current_length + LENGTH(entry_record.filename) + LENGTH(entry_record.summary) + 50) / 4;
        
        -- Stop if we'd exceed max tokens
        IF estimated_tokens > p_max_tokens THEN
            EXIT;
        END IF;
        
        context_text := context_text || E'\n\n## ' || entry_record.folder_name || '/' || entry_record.filename || E'\n';
        context_text := context_text || entry_record.summary;
        current_length := LENGTH(context_text);
    END LOOP;
    
    RETURN CASE 
        WHEN context_text = '' THEN NULL
        ELSE E'# KNOWLEDGE BASE\n\nThe following files are available in your knowledge base:' || context_text
    END;
END;
$$;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'kb_folders_updated_at') THEN
        CREATE TRIGGER kb_folders_updated_at
            BEFORE UPDATE ON knowledge_base_folders
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'kb_entries_updated_at') THEN
        CREATE TRIGGER kb_entries_updated_at
            BEFORE UPDATE ON knowledge_base_entries
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Permissions
GRANT ALL ON knowledge_base_folders TO authenticated, service_role;
GRANT ALL ON knowledge_base_entries TO authenticated, service_role;
GRANT ALL ON agent_knowledge_entry_assignments TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_agent_knowledge_base_context(UUID, INTEGER) TO authenticated, service_role;

COMMIT;


-- Migration: 20250919054418_add_icon_name.sql
create extension if not exists "pg_net" with schema "public" version '0.14.0';

alter table "public"."projects" add column if not exists "icon_name" text;





-- Migration: 20250923070217_commitment_tracking.sql
BEGIN;

ALTER TABLE credit_accounts 
ADD COLUMN IF NOT EXISTS commitment_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS commitment_start_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS commitment_end_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS commitment_price_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS can_cancel_after TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_credit_accounts_commitment 
ON credit_accounts(commitment_end_date) 
WHERE commitment_type IS NOT NULL;

CREATE OR REPLACE FUNCTION can_cancel_subscription(p_account_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_commitment_end_date TIMESTAMPTZ;
    v_commitment_type VARCHAR(50);
BEGIN
    SELECT commitment_end_date, commitment_type
    INTO v_commitment_end_date, v_commitment_type
    FROM credit_accounts
    WHERE account_id = p_account_id;

    IF v_commitment_type IS NULL OR v_commitment_end_date IS NULL THEN
        RETURN TRUE;
    END IF;
    
    IF NOW() >= v_commitment_end_date THEN
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TABLE IF NOT EXISTS commitment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    commitment_type VARCHAR(50),
    price_id VARCHAR(255),
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    stripe_subscription_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_commitment_history_account ON commitment_history(account_id);
CREATE INDEX IF NOT EXISTS idx_commitment_history_active ON commitment_history(end_date) WHERE cancelled_at IS NULL;

ALTER TABLE commitment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own commitment history" ON commitment_history
    FOR SELECT USING (auth.uid() = account_id);

CREATE POLICY "Service role can manage commitment history" ON commitment_history
    FOR ALL USING (auth.role() = 'service_role');

COMMIT;



-- Migration: 20250929124503_cleanup_agent_schema_icon.sql
BEGIN;

-- ============================================================================
-- AGENT SCHEMA CLEANUP MIGRATION
-- Remove outdated fields and consolidate icon system
-- ============================================================================

-- 1. Remove outdated fields from AGENTS table
ALTER TABLE agents 
    DROP COLUMN IF EXISTS avatar,
    DROP COLUMN IF EXISTS avatar_color,
    DROP COLUMN IF EXISTS profile_image_url;

-- 2. Remove outdated fields from AGENT_TEMPLATES table  
ALTER TABLE agent_templates
    DROP COLUMN IF EXISTS avatar,
    DROP COLUMN IF EXISTS avatar_color,
    DROP COLUMN IF EXISTS profile_image_url;

-- 3. Remove tags from AGENT_TEMPLATES (redundant with description)
-- Note: Keeping tags in agent_templates for now as they're used for marketplace filtering
-- Consider removing in future if description becomes primary categorization method

-- 4. Add constraints to ensure icon system integrity
ALTER TABLE agents 
    ADD CONSTRAINT agents_icon_color_format 
        CHECK (icon_color IS NULL OR icon_color ~ '^#[0-9A-Fa-f]{6}$'),
    ADD CONSTRAINT agents_icon_background_format 
        CHECK (icon_background IS NULL OR icon_background ~ '^#[0-9A-Fa-f]{6}$');

ALTER TABLE agent_templates
    ADD CONSTRAINT agent_templates_icon_color_format 
        CHECK (icon_color IS NULL OR icon_color ~ '^#[0-9A-Fa-f]{6}$'),
    ADD CONSTRAINT agent_templates_icon_background_format 
        CHECK (icon_background IS NULL OR icon_background ~ '^#[0-9A-Fa-f]{6}$');

-- 5. Update any NULL icon values to sensible defaults
UPDATE agents 
SET 
    icon_name = COALESCE(icon_name, 'brain'),
    icon_color = COALESCE(icon_color, '#000000'),
    icon_background = COALESCE(icon_background, '#F3F4F6')
WHERE icon_name IS NULL OR icon_color IS NULL OR icon_background IS NULL;

UPDATE agent_templates
SET 
    icon_name = COALESCE(icon_name, 'brain'),
    icon_color = COALESCE(icon_color, '#000000'), 
    icon_background = COALESCE(icon_background, '#F3F4F6')
WHERE icon_name IS NULL OR icon_color IS NULL OR icon_background IS NULL;

-- 6. Add NOT NULL constraints after setting defaults
ALTER TABLE agents 
    ALTER COLUMN icon_name SET NOT NULL,
    ALTER COLUMN icon_color SET NOT NULL,
    ALTER COLUMN icon_background SET NOT NULL;

ALTER TABLE agent_templates
    ALTER COLUMN icon_name SET NOT NULL,
    ALTER COLUMN icon_color SET NOT NULL, 
    ALTER COLUMN icon_background SET NOT NULL;

-- 7. Drop indexes on removed columns (if they exist)
DROP INDEX IF EXISTS idx_agents_avatar;
DROP INDEX IF EXISTS idx_agents_profile_image_url;
DROP INDEX IF EXISTS idx_agent_templates_profile_image_url;

-- 8. Update comments to reflect current state
COMMENT ON COLUMN agents.icon_name IS 'Lucide React icon name for agent visual representation';
COMMENT ON COLUMN agents.icon_color IS 'Hex color code for icon (format: #RRGGBB)';
COMMENT ON COLUMN agents.icon_background IS 'Hex color code for icon background (format: #RRGGBB)';

COMMENT ON COLUMN agent_templates.icon_name IS 'Lucide React icon name for template visual representation';
COMMENT ON COLUMN agent_templates.icon_color IS 'Hex color code for icon (format: #RRGGBB)';
COMMENT ON COLUMN agent_templates.icon_background IS 'Hex color code for icon background (format: #RRGGBB)';

COMMIT;



-- Migration: 20251005151459_remove_workflow_sys.sql
-- Remove Workflow System Migration
-- This migration removes all workflow/playbook tables and related database objects

-- Create backup of workflow tables before dropping
CREATE TABLE IF NOT EXISTS agent_workflows_backup AS SELECT * FROM agent_workflows;

-- Drop workflow tables (with CASCADE to handle foreign keys)
DROP TABLE IF EXISTS agent_workflows CASCADE;


-- Migration: 20251005160000_admin_roles_access.sql
-- Add admin role bypass to RLS policies
-- Admins from user_roles table can access all threads, messages, projects, and agent_runs

-- Update thread_select_policy to include admin check
DROP POLICY IF EXISTS thread_select_policy ON threads;
CREATE POLICY thread_select_policy ON threads
FOR SELECT
USING (
    is_public IS TRUE
    OR basejump.has_role_on_account(account_id) = true
    OR EXISTS (
        SELECT 1 FROM projects
        WHERE projects.project_id = threads.project_id
        AND (
            projects.is_public IS TRUE
            OR basejump.has_role_on_account(projects.account_id) = true
        )
    )
    OR EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'super_admin')
    )
);

-- Update message_select_policy to include admin check  
DROP POLICY IF EXISTS message_select_policy ON messages;
CREATE POLICY message_select_policy ON messages
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM threads
        WHERE threads.thread_id = messages.thread_id
        AND (
            threads.is_public IS TRUE
            OR threads.account_id = auth.uid()
            OR basejump.has_role_on_account(threads.account_id) = true
            OR EXISTS (
                SELECT 1 FROM projects
                WHERE projects.project_id = threads.project_id
                AND (
                    projects.is_public IS TRUE
                    OR basejump.has_role_on_account(projects.account_id) = true
                )
            )
        )
    )
    OR EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'super_admin')
    )
);

-- Update project_select_policy to include admin check
DROP POLICY IF EXISTS project_select_policy ON projects;
CREATE POLICY project_select_policy ON projects
FOR SELECT
USING (
    is_public = TRUE 
    OR basejump.has_role_on_account(account_id) = true
    OR EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'super_admin')
    )
);

-- Update agent_runs_select_policy to include admin check
DROP POLICY IF EXISTS agent_runs_select_policy ON agent_runs;
CREATE POLICY agent_runs_select_policy ON agent_runs
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM threads
        WHERE threads.thread_id = agent_runs.thread_id
        AND (
            threads.is_public = TRUE
            OR threads.account_id = auth.uid()
            OR basejump.has_role_on_account(threads.account_id) = true
            OR EXISTS (
                SELECT 1 FROM projects
                WHERE projects.project_id = threads.project_id
                AND (
                    projects.is_public = TRUE
                    OR basejump.has_role_on_account(projects.account_id) = true
                )
            )
        )
    )
    OR EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'super_admin')
    )
);



-- Migration: 20251006063545_add_template_examples.sql
BEGIN;

ALTER TABLE agent_templates
ADD COLUMN IF NOT EXISTS usage_examples JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_agent_templates_usage_examples 
ON agent_templates USING gin(usage_examples);

COMMENT ON COLUMN agent_templates.usage_examples IS 
'Example conversation demonstrating agent usage. Array of message objects with role (user/assistant), content, and optional tool_calls array';

COMMIT;



-- Migration: 20251006071200_add_usage_examples_to_agent_templates.sql
BEGIN;

ALTER TABLE agent_templates
ADD COLUMN IF NOT EXISTS usage_examples JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_agent_templates_usage_examples 
ON agent_templates USING gin(usage_examples);

COMMENT ON COLUMN agent_templates.usage_examples IS 
'Example conversation demonstrating agent usage. Array of message objects with role (user/assistant), content, and optional tool_calls array';

COMMIT;



-- Migration: 20251009203057_agent_categories.sql
BEGIN;

ALTER TABLE agent_templates
ADD COLUMN IF NOT EXISTS categories TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_agent_templates_categories 
ON agent_templates USING gin(categories);

COMMENT ON COLUMN agent_templates.categories IS 
'Categories for organizing agent templates in the marketplace. An agent template can belong to multiple categories.';

COMMIT;



-- Migration: 20251010145833_voice_agents.sql
CREATE TABLE IF NOT EXISTS public.vapi_calls (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    call_id TEXT NOT NULL UNIQUE,
    agent_id UUID REFERENCES public.agents(agent_id) ON DELETE SET NULL,
    thread_id UUID REFERENCES public.threads(thread_id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'ringing', 'in-progress', 'completed', 'ended', 'failed')),
    duration_seconds INTEGER,
    transcript JSONB,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vapi_calls_call_id ON public.vapi_calls(call_id);
CREATE INDEX IF NOT EXISTS idx_vapi_calls_thread_id ON public.vapi_calls(thread_id);
CREATE INDEX IF NOT EXISTS idx_vapi_calls_agent_id ON public.vapi_calls(agent_id);
CREATE INDEX IF NOT EXISTS idx_vapi_calls_created_at ON public.vapi_calls(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vapi_calls_status ON public.vapi_calls(status);

CREATE OR REPLACE FUNCTION public.update_vapi_calls_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_vapi_calls_updated_at
    BEFORE UPDATE ON public.vapi_calls
    FOR EACH ROW
    EXECUTE FUNCTION public.update_vapi_calls_updated_at();

COMMENT ON TABLE public.vapi_calls IS 'Stores Vapi AI voice call metadata and transcripts';
COMMENT ON COLUMN public.vapi_calls.call_id IS 'Unique identifier from Vapi API';
COMMENT ON COLUMN public.vapi_calls.agent_id IS 'Optional reference to the agent that initiated/handled the call';
COMMENT ON COLUMN public.vapi_calls.thread_id IS 'Optional reference to the conversation thread associated with this call';
COMMENT ON COLUMN public.vapi_calls.direction IS 'Call direction: inbound or outbound';
COMMENT ON COLUMN public.vapi_calls.status IS 'Current call status';
COMMENT ON COLUMN public.vapi_calls.duration_seconds IS 'Call duration in seconds';
COMMENT ON COLUMN public.vapi_calls.transcript IS 'JSON array of conversation transcript messages';




-- Migration: 20251010173052_vapi_real_time.sql
-- Enable Realtime for vapi_calls table
ALTER PUBLICATION supabase_realtime ADD TABLE vapi_calls;

-- Add RLS policies for vapi_calls
ALTER TABLE vapi_calls ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see calls from their own threads
CREATE POLICY "Users can view their own calls"
ON vapi_calls
FOR SELECT
USING (
  thread_id IN (
    SELECT thread_id
    FROM threads
    WHERE account_id = auth.uid()
  )
);

-- Policy: System can insert call records
CREATE POLICY "System can insert calls"
ON vapi_calls
FOR INSERT
WITH CHECK (true);

-- Policy: System can update call records
CREATE POLICY "System can update calls"
ON vapi_calls
FOR UPDATE
USING (true);

COMMENT ON POLICY "Users can view their own calls" ON vapi_calls IS 'Allow users to see calls associated with their threads';
COMMENT ON POLICY "System can insert calls" ON vapi_calls IS 'Allow system to create call records';
COMMENT ON POLICY "System can update calls" ON vapi_calls IS 'Allow system to update call status and transcripts';




-- Migration: 20251010185000_add_cost_column.sql
ALTER TABLE public.vapi_calls
ADD COLUMN IF NOT EXISTS cost DECIMAL(10, 6);

COMMENT ON COLUMN public.vapi_calls.cost IS 'Cost of the call in USD';



-- Migration: 20251013131022_billing_improvement.sql
BEGIN;

ALTER TABLE credit_ledger 
ADD COLUMN IF NOT EXISTS stripe_event_id VARCHAR(255);

ALTER TABLE credit_ledger 
ADD CONSTRAINT unique_stripe_event UNIQUE(stripe_event_id);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_stripe_event 
ON credit_ledger(stripe_event_id) 
WHERE stripe_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_credit_accounts_commitment 
ON credit_accounts(account_id, commitment_end_date) 
WHERE commitment_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_credit_accounts_expiry 
ON credit_accounts(account_id, next_credit_grant) 
WHERE expiring_credits > 0;

CREATE OR REPLACE FUNCTION cleanup_expired_credits() 
RETURNS TABLE(
    account_id UUID,
    credits_removed DECIMAL,
    new_balance DECIMAL
) 
SECURITY DEFINER
AS $$
DECLARE
    v_account RECORD;
    v_credits_to_remove DECIMAL;
    v_new_balance DECIMAL;
BEGIN
    FOR v_account IN 
        SELECT 
            ca.account_id,
            ca.expiring_credits,
            ca.non_expiring_credits,
            ca.balance,
            ca.next_credit_grant,
            ca.tier,
            ca.stripe_subscription_id
        FROM credit_accounts ca
        WHERE ca.expiring_credits > 0
        AND (
            (ca.tier IS NULL OR ca.tier = 'none') 
            OR (ca.stripe_subscription_id IS NULL AND ca.next_credit_grant < NOW() - INTERVAL '30 days')
        )
        AND (ca.trial_status IS NULL OR ca.trial_status NOT IN ('active'))
    LOOP
        v_credits_to_remove := v_account.expiring_credits;
        v_new_balance := v_account.non_expiring_credits;
        
        UPDATE credit_accounts
        SET 
            expiring_credits = 0,
            balance = v_new_balance,
            updated_at = NOW()
        WHERE account_id = v_account.account_id;
        
        INSERT INTO credit_ledger (
            account_id,
            amount,
            balance_after,
            type,
            description,
            is_expiring
        ) VALUES (
            v_account.account_id,
            -v_credits_to_remove,
            v_new_balance,
            'expired',
            'Cleanup of expired credits after subscription cancellation',
            true
        );
        
        account_id := v_account.account_id;
        credits_removed := v_credits_to_remove;
        new_balance := v_new_balance;
        RETURN NEXT;
    END LOOP;
    
    RETURN;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION reconcile_credit_balance(p_account_id UUID)
RETURNS TABLE(
    was_fixed BOOLEAN,
    old_balance DECIMAL,
    new_balance DECIMAL,
    difference DECIMAL
) 
SECURITY DEFINER
AS $$
DECLARE
    v_current RECORD;
    v_calculated_total DECIMAL;
    v_needs_fix BOOLEAN := FALSE;
BEGIN
    SELECT 
        balance,
        expiring_credits,
        non_expiring_credits
    INTO v_current
    FROM credit_accounts
    WHERE account_id = p_account_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Account not found: %', p_account_id;
    END IF;
    
    v_calculated_total := v_current.expiring_credits + v_current.non_expiring_credits;
    
    IF ABS(v_current.balance - v_calculated_total) > 0.01 THEN
        v_needs_fix := TRUE;
        
        UPDATE credit_accounts
        SET 
            balance = v_calculated_total,
            updated_at = NOW()
        WHERE account_id = p_account_id;
        
        INSERT INTO credit_ledger (
            account_id,
            amount,
            balance_after,
            type,
            description,
            metadata
        ) VALUES (
            p_account_id,
            v_calculated_total - v_current.balance,
            v_calculated_total,
            'adjustment',
            'Automatic balance reconciliation',
            jsonb_build_object(
                'old_balance', v_current.balance,
                'old_expiring', v_current.expiring_credits,
                'old_non_expiring', v_current.non_expiring_credits,
                'reconciled_at', NOW()
            )
        );
    END IF;
    
    was_fixed := v_needs_fix;
    old_balance := v_current.balance;
    new_balance := v_calculated_total;
    difference := v_calculated_total - v_current.balance;
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

UPDATE credit_accounts
SET commitment_end_date = commitment_start_date::timestamp + INTERVAL '1 year'
WHERE commitment_type = 'yearly_commitment'
AND commitment_end_date != commitment_start_date::timestamp + INTERVAL '1 year';

CREATE OR REPLACE VIEW billing_health_check AS
SELECT 
    'balance_discrepancies' as check_type,
    COUNT(*) as issue_count,
    jsonb_agg(jsonb_build_object(
        'account_id', account_id,
        'balance', balance,
        'calculated', expiring_credits + non_expiring_credits,
        'difference', balance - (expiring_credits + non_expiring_credits)
    )) as details
FROM credit_accounts
WHERE ABS(balance - (expiring_credits + non_expiring_credits)) > 0.01

UNION ALL

SELECT 
    'expired_credits_not_cleaned' as check_type,
    COUNT(*) as issue_count,
    jsonb_agg(jsonb_build_object(
        'account_id', account_id,
        'expiring_credits', expiring_credits,
        'tier', tier,
        'subscription_id', stripe_subscription_id,
        'next_grant', next_credit_grant
    )) as details
FROM credit_accounts
WHERE expiring_credits > 0
AND (
    (tier IS NULL OR tier = 'none')
    OR (stripe_subscription_id IS NULL AND next_credit_grant < NOW() - INTERVAL '30 days')
)
AND (trial_status IS NULL OR trial_status NOT IN ('active'))

UNION ALL

SELECT 
    'invalid_commitment_dates' as check_type,
    COUNT(*) as issue_count,
    jsonb_agg(jsonb_build_object(
        'account_id', account_id,
        'start_date', commitment_start_date,
        'end_date', commitment_end_date,
        'expected_end', commitment_start_date::timestamp + INTERVAL '1 year'
    )) as details
FROM credit_accounts
WHERE commitment_type = 'yearly_commitment'
AND commitment_end_date != commitment_start_date::timestamp + INTERVAL '1 year';

GRANT SELECT ON billing_health_check TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_credits() TO service_role;
GRANT EXECUTE ON FUNCTION reconcile_credit_balance(UUID) TO service_role;

COMMIT;



-- Migration: 20251014101934_renewal_tracking.sql
ALTER TABLE credit_accounts
ADD COLUMN IF NOT EXISTS last_renewal_period_start BIGINT;

CREATE INDEX IF NOT EXISTS idx_credit_accounts_last_renewal_period_start 
ON credit_accounts(last_renewal_period_start) 
WHERE last_renewal_period_start IS NOT NULL;

COMMENT ON COLUMN credit_accounts.last_renewal_period_start IS 
'Unix timestamp of the last renewal period start processed by invoice webhook. Used to prevent duplicate credit grants between invoice.payment_succeeded and subscription.updated webhooks.';



-- Migration: 20251014101936_fix_renewal_tracking.sql
UPDATE credit_accounts
SET last_renewal_period_start = NULL
WHERE last_renewal_period_start IS NOT NULL
  AND tier NOT IN ('free', 'none')
  AND last_grant_date IS NOT NULL
  AND DATE(to_timestamp(last_renewal_period_start)) = DATE(last_grant_date AT TIME ZONE 'UTC');

COMMENT ON COLUMN credit_accounts.last_renewal_period_start IS 'Unix timestamp of the last renewal period processed. Used to prevent double-crediting on renewals. Only set by invoice.payment_succeeded webhooks for subscription_cycle invoices, never for upgrades.';



-- Migration: 20251014101940_reset_renewal_tracking.sql
UPDATE credit_accounts
SET last_renewal_period_start = NULL
WHERE last_renewal_period_start IS NOT NULL;

COMMENT ON COLUMN credit_accounts.last_renewal_period_start IS 'Unix timestamp of the START of the next billing period for which credits have been granted. This is the period_end from the renewal invoice. Only set by invoice.payment_succeeded webhooks for subscription_cycle invoices.';



-- Migration: 20251015063309_billing_improvements_part1.sql
BEGIN;
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM credit_accounts
    WHERE ABS(balance - (expiring_credits + non_expiring_credits)) > 0.01;
    
    IF v_count > 0 THEN
        RAISE NOTICE 'Found % accounts with balance discrepancies, reconciling...', v_count;
        
        INSERT INTO credit_ledger (account_id, amount, balance_after, type, description, created_at)
        SELECT 
            account_id,
            (expiring_credits + non_expiring_credits) - balance as amount,
            expiring_credits + non_expiring_credits as balance_after,
            'adjustment' as type,
            'Automatic balance reconciliation during migration' as description,
            NOW() as created_at
        FROM credit_accounts
        WHERE ABS(balance - (expiring_credits + non_expiring_credits)) > 0.01;

        UPDATE credit_accounts
        SET balance = expiring_credits + non_expiring_credits,
            updated_at = NOW()
        WHERE ABS(balance - (expiring_credits + non_expiring_credits)) > 0.01;
        
        RAISE NOTICE 'Successfully reconciled % accounts', v_count;
    ELSE
        RAISE NOTICE 'No balance discrepancies found';
    END IF;
END $$;


ALTER TABLE credit_accounts 
DROP CONSTRAINT IF EXISTS check_no_negative_balance;
ALTER TABLE credit_accounts 
ADD CONSTRAINT check_no_negative_balance 
CHECK (balance >= 0);

ALTER TABLE credit_accounts 
DROP CONSTRAINT IF EXISTS check_no_negative_credits;
ALTER TABLE credit_accounts 
ADD CONSTRAINT check_no_negative_credits 
CHECK (expiring_credits >= 0 AND non_expiring_credits >= 0);

ALTER TABLE credit_accounts 
DROP CONSTRAINT IF EXISTS check_balance_consistency;
ALTER TABLE credit_accounts 
ADD CONSTRAINT check_balance_consistency 
CHECK (ABS(balance - (expiring_credits + non_expiring_credits)) < 0.01);

ALTER TABLE trial_history 
DROP CONSTRAINT IF EXISTS unique_account_trial;
ALTER TABLE trial_history 
ADD CONSTRAINT unique_account_trial 
UNIQUE(account_id);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_recent_ops 
ON credit_ledger(account_id, created_at DESC, amount, description);

CREATE INDEX IF NOT EXISTS idx_credit_accounts_commitment_active 
ON credit_accounts(account_id, commitment_end_date) 
WHERE commitment_type IS NOT NULL;

ALTER TABLE credit_ledger 
ADD COLUMN IF NOT EXISTS message_id UUID,
ADD COLUMN IF NOT EXISTS thread_id UUID,
ADD COLUMN IF NOT EXISTS reference_id UUID;

COMMIT;



-- Migration: 20251015063310_billing_improvements_part2.sql
BEGIN;

CREATE TABLE IF NOT EXISTS credit_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount_dollars DECIMAL(10, 2) NOT NULL,
    stripe_payment_intent_id VARCHAR(255) UNIQUE,
    stripe_session_id VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    error_message TEXT,
    reconciled_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_purchases_status ON credit_purchases(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_purchases_account ON credit_purchases(account_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL,
    action VARCHAR(255) NOT NULL,
    details JSONB DEFAULT '{}',
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_account ON audit_log(account_id, category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_category ON audit_log(category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_recent ON audit_log(created_at DESC);

GRANT SELECT ON billing_health_check TO service_role;
GRANT ALL ON credit_purchases TO service_role;
GRANT ALL ON audit_log TO service_role;

ALTER TABLE credit_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credit purchases" ON credit_purchases
    FOR SELECT USING (auth.uid() = account_id);

CREATE POLICY "Service role manages credit purchases" ON credit_purchases
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can view own audit log" ON audit_log
    FOR SELECT USING (auth.uid() = account_id);

CREATE POLICY "Service role manages audit log" ON audit_log
    FOR ALL USING (auth.role() = 'service_role');

COMMIT;



-- Migration: 20251015063430_critical_billing_fixes.sql
CREATE TABLE IF NOT EXISTS public.webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processing_started_at TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    payload JSONB,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_webhook_events_event_id ON public.webhook_events(event_id);
CREATE INDEX idx_webhook_events_created_at ON public.webhook_events(created_at DESC);
CREATE INDEX idx_webhook_events_status ON public.webhook_events(status) WHERE status IN ('pending', 'failed');

COMMENT ON TABLE public.webhook_events IS 'Tracks all Stripe webhook events for idempotency and debugging';

CREATE TABLE IF NOT EXISTS public.renewal_processing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL,
    period_start BIGINT NOT NULL,
    period_end BIGINT NOT NULL,
    subscription_id TEXT NOT NULL,
    processed_by TEXT NOT NULL CHECK (processed_by IN ('webhook_invoice', 'webhook_subscription', 'manual')),
    credits_granted NUMERIC(10, 2) NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    stripe_event_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(account_id, period_start)
);

CREATE INDEX idx_renewal_processing_account ON public.renewal_processing(account_id);
CREATE INDEX idx_renewal_processing_period ON public.renewal_processing(account_id, period_start);
CREATE INDEX idx_renewal_processing_subscription ON public.renewal_processing(subscription_id);

COMMENT ON TABLE public.renewal_processing IS 'Tracks renewal credit grants to prevent duplicates';

ALTER TABLE public.trial_history 
    DROP CONSTRAINT IF EXISTS unique_account_trial;

ALTER TABLE public.trial_history
    ADD CONSTRAINT unique_account_trial UNIQUE (account_id);

CREATE INDEX IF NOT EXISTS idx_trial_history_account_id ON public.trial_history(account_id);
CREATE INDEX IF NOT EXISTS idx_trial_history_started_at ON public.trial_history(started_at DESC);

CREATE TABLE IF NOT EXISTS public.refund_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL,
    stripe_refund_id TEXT UNIQUE NOT NULL,
    stripe_charge_id TEXT NOT NULL,
    stripe_payment_intent_id TEXT,
    amount_refunded NUMERIC(10, 2) NOT NULL,
    credits_deducted NUMERIC(10, 2) NOT NULL DEFAULT 0,
    refund_reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
    processed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_refund_history_account ON public.refund_history(account_id);
CREATE INDEX idx_refund_history_stripe_refund ON public.refund_history(stripe_refund_id);
CREATE INDEX idx_refund_history_status ON public.refund_history(status) WHERE status IN ('pending', 'failed');

COMMENT ON TABLE public.refund_history IS 'Tracks all refunds and associated credit deductions';

CREATE TABLE IF NOT EXISTS public.distributed_locks (
    lock_key TEXT PRIMARY KEY,
    holder_id TEXT NOT NULL,
    acquired_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_distributed_locks_expires ON public.distributed_locks(expires_at);

COMMENT ON TABLE public.distributed_locks IS 'Distributed locking for critical operations (fallback if Redis unavailable)';

CREATE OR REPLACE FUNCTION acquire_distributed_lock(
    p_lock_key TEXT,
    p_holder_id TEXT,
    p_timeout_seconds INTEGER DEFAULT 300
) RETURNS BOOLEAN AS $$
DECLARE
    v_expires_at TIMESTAMP WITH TIME ZONE;
    v_acquired BOOLEAN;
BEGIN
    v_expires_at := NOW() + (p_timeout_seconds || ' seconds')::INTERVAL;
    
    DELETE FROM public.distributed_locks 
    WHERE lock_key = p_lock_key AND expires_at < NOW();
    
    BEGIN
        INSERT INTO public.distributed_locks (lock_key, holder_id, expires_at)
        VALUES (p_lock_key, p_holder_id, v_expires_at);
        v_acquired := TRUE;
    EXCEPTION WHEN unique_violation THEN
        v_acquired := FALSE;
    END;
    
    RETURN v_acquired;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION release_distributed_lock(
    p_lock_key TEXT,
    p_holder_id TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM public.distributed_locks 
    WHERE lock_key = p_lock_key AND holder_id = p_holder_id;
    
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted > 0;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE public.credit_ledger
    ADD COLUMN IF NOT EXISTS processing_source TEXT,
    ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
    ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_credit_ledger_idempotency ON public.credit_ledger(idempotency_key) WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.credit_accounts
    ADD COLUMN IF NOT EXISTS last_reconciled_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS reconciliation_discrepancy NUMERIC(10, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS needs_reconciliation BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_credit_accounts_needs_reconciliation 
    ON public.credit_accounts(needs_reconciliation) WHERE needs_reconciliation = TRUE;

ALTER TABLE public.credit_purchases
    ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS reconciliation_attempts INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_reconciliation_attempt TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_credit_purchases_reconciled 
    ON public.credit_purchases(status, reconciled_at) 
    WHERE status = 'pending' AND reconciled_at IS NULL;

CREATE OR REPLACE FUNCTION cleanup_old_webhook_events() RETURNS INTEGER AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM public.webhook_events
    WHERE created_at < NOW() - INTERVAL '30 days'
      AND status = 'completed';
    
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_webhook_events IS 'Removes webhook events older than 30 days (completed only)';

ALTER TABLE public.credit_accounts
    DROP CONSTRAINT IF EXISTS check_balance_non_negative,
    ADD CONSTRAINT check_balance_non_negative CHECK (balance >= 0);

ALTER TABLE public.credit_accounts
    DROP CONSTRAINT IF EXISTS check_expiring_non_negative,
    ADD CONSTRAINT check_expiring_non_negative CHECK (expiring_credits >= 0);

ALTER TABLE public.credit_accounts
    DROP CONSTRAINT IF EXISTS check_non_expiring_non_negative,
    ADD CONSTRAINT check_non_expiring_non_negative CHECK (non_expiring_credits >= 0);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.renewal_processing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distributed_locks ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Service role full access on webhook_events" ON public.webhook_events
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on renewal_processing" ON public.renewal_processing
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on refund_history" ON public.refund_history
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on distributed_locks" ON public.distributed_locks
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can view own refund history" ON public.refund_history
    FOR SELECT USING (
        account_id IN (
            SELECT id FROM basejump.accounts 
            WHERE primary_owner_user_id = auth.uid()
        )
    );


DROP VIEW IF EXISTS public.billing_health_check CASCADE;

CREATE VIEW public.billing_health_check AS
SELECT 
    'webhook_processing_failures' as metric,
    COUNT(*) as value,
    NOW() as checked_at
FROM public.webhook_events
WHERE status = 'failed' AND created_at > NOW() - INTERVAL '24 hours'
UNION ALL
SELECT 
    'pending_reconciliations' as metric,
    COUNT(*) as value,
    NOW() as checked_at
FROM public.credit_purchases
WHERE status = 'pending' AND created_at > NOW() - INTERVAL '24 hours'
UNION ALL
SELECT 
    'trial_starts_today' as metric,
    COUNT(*) as value,
    NOW() as checked_at
FROM public.trial_history
WHERE started_at::date = CURRENT_DATE
UNION ALL
SELECT 
    'refunds_unprocessed' as metric,
    COUNT(*) as value,
    NOW() as checked_at
FROM public.refund_history
WHERE status = 'pending';

COMMENT ON VIEW public.billing_health_check IS 'Real-time billing system health metrics';

GRANT SELECT, INSERT, UPDATE ON public.webhook_events TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.renewal_processing TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.refund_history TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.distributed_locks TO service_role;
GRANT SELECT ON public.billing_health_check TO authenticated;

DO $$
BEGIN
    RAISE NOTICE 'P0 Critical Billing Fixes Migration Completed Successfully';
    RAISE NOTICE 'Tables created: webhook_events, renewal_processing, refund_history, distributed_locks';
    RAISE NOTICE 'Constraints added: unique_account_trial on trial_history';
    RAISE NOTICE 'Functions created: acquire_distributed_lock, release_distributed_lock, cleanup_old_webhook_events';
END $$;




-- Migration: 20251015063444_credit_transaction_functions.sql
CREATE OR REPLACE FUNCTION atomic_add_credits(
    p_account_id UUID,
    p_amount NUMERIC(10, 2),
    p_is_expiring BOOLEAN DEFAULT TRUE,
    p_description TEXT DEFAULT 'Credit added',
    p_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_type TEXT DEFAULT NULL,
    p_stripe_event_id TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_current_expiring NUMERIC(10, 2);
    v_current_non_expiring NUMERIC(10, 2);
    v_current_balance NUMERIC(10, 2);
    v_new_expiring NUMERIC(10, 2);
    v_new_non_expiring NUMERIC(10, 2);
    v_new_total NUMERIC(10, 2);
    v_tier TEXT;
    v_ledger_id UUID;
BEGIN
    IF p_stripe_event_id IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM public.credit_ledger 
            WHERE stripe_event_id = p_stripe_event_id
        ) THEN
            RETURN jsonb_build_object(
                'success', true,
                'message', 'Credit already added (duplicate prevented)',
                'duplicate_prevented', true
            );
        END IF;
    END IF;
    
    IF p_idempotency_key IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM public.credit_ledger 
            WHERE idempotency_key = p_idempotency_key
            AND created_at > NOW() - INTERVAL '1 hour'
        ) THEN
            RETURN jsonb_build_object(
                'success', true,
                'message', 'Credit already added (idempotent)',
                'duplicate_prevented', true
            );
        END IF;
    END IF;
    
    SELECT 
        expiring_credits, 
        non_expiring_credits, 
        balance, 
        tier
    INTO 
        v_current_expiring,
        v_current_non_expiring,
        v_current_balance,
        v_tier
    FROM public.credit_accounts
    WHERE account_id = p_account_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        v_current_expiring := 0;
        v_current_non_expiring := 0;
        v_current_balance := 0;
        v_tier := 'none';
        
        INSERT INTO public.credit_accounts (
            account_id, 
            expiring_credits, 
            non_expiring_credits, 
            balance, 
            tier
        ) VALUES (
            p_account_id,
            0,
            0,
            0,
            v_tier
        );
    END IF;
    
    IF p_is_expiring THEN
        v_new_expiring := v_current_expiring + p_amount;
        v_new_non_expiring := v_current_non_expiring;
    ELSE
        v_new_expiring := v_current_expiring;
        v_new_non_expiring := v_current_non_expiring + p_amount;
    END IF;
    
    v_new_total := v_new_expiring + v_new_non_expiring;
    
    UPDATE public.credit_accounts
    SET 
        expiring_credits = v_new_expiring,
        non_expiring_credits = v_new_non_expiring,
        balance = v_new_total,
        updated_at = NOW()
    WHERE account_id = p_account_id;
    
    INSERT INTO public.credit_ledger (
        account_id,
        amount,
        balance_after,
        type,
        description,
        is_expiring,
        expires_at,
        stripe_event_id,
        idempotency_key,
        processing_source
    ) VALUES (
        p_account_id,
        p_amount,
        v_new_total,
        COALESCE(p_type, CASE WHEN p_is_expiring THEN 'tier_grant' ELSE 'purchase' END),
        p_description,
        p_is_expiring,
        p_expires_at,
        p_stripe_event_id,
        p_idempotency_key,
        'atomic_function'
    ) RETURNING id INTO v_ledger_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'expiring_credits', v_new_expiring,
        'non_expiring_credits', v_new_non_expiring,
        'total_balance', v_new_total,
        'ledger_id', v_ledger_id
    );
END;
$$ LANGUAGE plpgsql;



-- Migration: 20251015063445_atomic_use_credits.sql
CREATE OR REPLACE FUNCTION atomic_use_credits(
    p_account_id UUID,
    p_amount NUMERIC(10, 2),
    p_description TEXT DEFAULT 'Credit usage',
    p_thread_id TEXT DEFAULT NULL,
    p_message_id TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_current_expiring NUMERIC(10, 2);
    v_current_non_expiring NUMERIC(10, 2);
    v_current_balance NUMERIC(10, 2);
    v_amount_from_expiring NUMERIC(10, 2);
    v_amount_from_non_expiring NUMERIC(10, 2);
    v_new_expiring NUMERIC(10, 2);
    v_new_non_expiring NUMERIC(10, 2);
    v_new_total NUMERIC(10, 2);
BEGIN
    SELECT 
        expiring_credits,
        non_expiring_credits,
        balance
    INTO 
        v_current_expiring,
        v_current_non_expiring,
        v_current_balance
    FROM public.credit_accounts
    WHERE account_id = p_account_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No credit account found',
            'required', p_amount,
            'available', 0
        );
    END IF;
    
    IF v_current_balance < p_amount THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Insufficient credits',
            'required', p_amount,
            'available', v_current_balance
        );
    END IF;
    
    IF v_current_expiring >= p_amount THEN
        v_amount_from_expiring := p_amount;
        v_amount_from_non_expiring := 0;
    ELSE
        v_amount_from_expiring := v_current_expiring;
        v_amount_from_non_expiring := p_amount - v_current_expiring;
    END IF;
    
    v_new_expiring := v_current_expiring - v_amount_from_expiring;
    v_new_non_expiring := v_current_non_expiring - v_amount_from_non_expiring;
    v_new_total := v_new_expiring + v_new_non_expiring;
    
    UPDATE public.credit_accounts
    SET 
        expiring_credits = v_new_expiring,
        non_expiring_credits = v_new_non_expiring,
        balance = v_new_total,
        updated_at = NOW()
    WHERE account_id = p_account_id;
    
    INSERT INTO public.credit_ledger (
        account_id,
        amount,
        balance_after,
        type,
        description,
        reference_id,
        metadata,
        processing_source
    ) VALUES (
        p_account_id,
        -p_amount,
        v_new_total,
        'usage',
        p_description,
        COALESCE(p_thread_id, p_message_id),
        jsonb_build_object(
            'thread_id', p_thread_id,
            'message_id', p_message_id,
            'from_expiring', v_amount_from_expiring,
            'from_non_expiring', v_amount_from_non_expiring
        ),
        'atomic_function'
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'amount_deducted', p_amount,
        'from_expiring', v_amount_from_expiring,
        'from_non_expiring', v_amount_from_non_expiring,
        'new_expiring', v_new_expiring,
        'new_non_expiring', v_new_non_expiring,
        'new_total', v_new_total
    );
END;
$$ LANGUAGE plpgsql;




-- Migration: 20251015063446_atomic_reset_credits.sql
CREATE OR REPLACE FUNCTION atomic_reset_expiring_credits(
    p_account_id UUID,
    p_new_credits NUMERIC(10, 2),
    p_description TEXT DEFAULT 'Monthly credit renewal',
    p_stripe_event_id TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_current_balance NUMERIC(10, 2);
    v_current_expiring NUMERIC(10, 2);
    v_current_non_expiring NUMERIC(10, 2);
    v_actual_non_expiring NUMERIC(10, 2);
    v_new_total NUMERIC(10, 2);
    v_expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
    SELECT 
        balance,
        expiring_credits,
        non_expiring_credits
    INTO 
        v_current_balance,
        v_current_expiring,
        v_current_non_expiring
    FROM public.credit_accounts
    WHERE account_id = p_account_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Account not found'
        );
    END IF;
    
    IF v_current_balance <= v_current_non_expiring THEN
        v_actual_non_expiring := v_current_balance;
    ELSE
        v_actual_non_expiring := v_current_non_expiring;
    END IF;
    
    v_new_total := p_new_credits + v_actual_non_expiring;
    
    v_expires_at := DATE_TRUNC('month', NOW() + INTERVAL '1 month') + INTERVAL '1 month';
    
    UPDATE public.credit_accounts
    SET 
        expiring_credits = p_new_credits,
        non_expiring_credits = v_actual_non_expiring,
        balance = v_new_total,
        updated_at = NOW()
    WHERE account_id = p_account_id;
    
    INSERT INTO public.credit_ledger (
        account_id,
        amount,
        balance_after,
        type,
        description,
        is_expiring,
        expires_at,
        stripe_event_id,
        metadata,
        processing_source
    ) VALUES (
        p_account_id,
        p_new_credits,
        v_new_total,
        'tier_grant',
        p_description,
        true,
        v_expires_at,
        p_stripe_event_id,
        jsonb_build_object(
            'renewal', true,
            'non_expiring_preserved', v_actual_non_expiring,
            'previous_balance', v_current_balance
        ),
        'atomic_function'
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'new_expiring', p_new_credits,
        'non_expiring', v_actual_non_expiring,
        'total_balance', v_new_total
    );
END;
$$ LANGUAGE plpgsql;




-- Migration: 20251015063447_grant_atomic_functions.sql
GRANT EXECUTE ON FUNCTION atomic_add_credits TO service_role;



-- Migration: 20251015063448_grant_use_credits.sql
GRANT EXECUTE ON FUNCTION atomic_use_credits TO service_role;



-- Migration: 20251015063449_grant_reset_credits.sql
GRANT EXECUTE ON FUNCTION atomic_reset_expiring_credits TO service_role;



-- Migration: 20251016061240_distributed_circuit_breaker.sql
CREATE TABLE IF NOT EXISTS circuit_breaker_state (
    circuit_name TEXT PRIMARY KEY,
    state TEXT NOT NULL CHECK (state IN ('closed', 'open', 'half_open')),
    failure_count INTEGER NOT NULL DEFAULT 0,
    last_failure_time TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_circuit_breaker_state_updated_at 
ON circuit_breaker_state(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_circuit_breaker_state_state 
ON circuit_breaker_state(state) 
WHERE state != 'closed';

COMMENT ON TABLE circuit_breaker_state IS 
'Distributed circuit breaker state shared across all backend instances. Prevents all instances from hammering external services when failures occur.';

COMMENT ON COLUMN circuit_breaker_state.circuit_name IS 
'Unique identifier for the circuit (e.g., stripe_api, external_api_name)';

COMMENT ON COLUMN circuit_breaker_state.state IS 
'Current circuit state: closed (normal), open (failing, blocking requests), half_open (testing recovery)';

COMMENT ON COLUMN circuit_breaker_state.failure_count IS 
'Number of consecutive failures. Reset to 0 on success or when circuit closes.';

COMMENT ON COLUMN circuit_breaker_state.last_failure_time IS 
'Timestamp of the most recent failure. Used to determine when to attempt recovery.';

INSERT INTO circuit_breaker_state (circuit_name, state, failure_count, last_failure_time)
VALUES ('stripe_api', 'closed', 0, NULL)
ON CONFLICT (circuit_name) DO NOTHING;

CREATE OR REPLACE FUNCTION cleanup_stale_circuit_breakers() RETURNS INTEGER AS $$
DECLARE
    v_reset_count INTEGER;
BEGIN
    UPDATE circuit_breaker_state
    SET 
        state = 'closed',
        failure_count = 0,
        last_failure_time = NULL,
        updated_at = NOW()
    WHERE 
        state IN ('open', 'half_open')
        AND updated_at < NOW() - INTERVAL '1 hour';
    
    GET DIAGNOSTICS v_reset_count = ROW_COUNT;
    
    IF v_reset_count > 0 THEN
        RAISE NOTICE 'Reset % stale circuit breaker(s)', v_reset_count;
    END IF;
    
    RETURN v_reset_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_stale_circuit_breakers IS 
'Automatically resets circuit breakers that have been stuck in OPEN/HALF_OPEN state for over 1 hour. Run periodically as a maintenance job.';

CREATE OR REPLACE VIEW v_circuit_breaker_status AS
SELECT 
    circuit_name,
    state,
    failure_count,
    last_failure_time,
    CASE 
        WHEN last_failure_time IS NOT NULL THEN 
            EXTRACT(EPOCH FROM (NOW() - last_failure_time)) 
        ELSE NULL 
    END AS seconds_since_failure,
    updated_at,
    CASE 
        WHEN state = 'open' AND last_failure_time IS NOT NULL THEN
            GREATEST(0, 60 - EXTRACT(EPOCH FROM (NOW() - last_failure_time)))
        ELSE NULL
    END AS seconds_until_retry,
    CASE
        WHEN state = 'closed' THEN 'âœ… Healthy'
        WHEN state = 'open' THEN 'ðŸ”´ OPEN - Blocking requests'
        WHEN state = 'half_open' THEN 'ðŸŸ¡ Testing recovery'
    END AS status_display
FROM circuit_breaker_state
ORDER BY 
    CASE state
        WHEN 'open' THEN 1
        WHEN 'half_open' THEN 2
        WHEN 'closed' THEN 3
    END,
    circuit_name;

COMMENT ON VIEW v_circuit_breaker_status IS 
'Human-readable view of circuit breaker status across all circuits. Use this for monitoring dashboards.';

CREATE OR REPLACE FUNCTION reset_circuit_breaker(p_circuit_name TEXT) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE circuit_breaker_state
    SET 
        state = 'closed',
        failure_count = 0,
        last_failure_time = NULL,
        updated_at = NOW()
    WHERE circuit_name = p_circuit_name;
    
    IF FOUND THEN
        RAISE NOTICE 'Reset circuit breaker: %', p_circuit_name;
        RETURN TRUE;
    ELSE
        RAISE NOTICE 'Circuit breaker not found: %', p_circuit_name;
        RETURN FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION reset_circuit_breaker IS 
'Manually reset a circuit breaker to CLOSED state. Use this for emergency recovery: SELECT reset_circuit_breaker(''stripe_api'');';

ALTER TABLE circuit_breaker_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to circuit breaker"
    ON circuit_breaker_state
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Authenticated users can read circuit breaker state"
    ON circuit_breaker_state
    FOR SELECT
    TO authenticated
    USING (true);

COMMENT ON POLICY "Service role has full access to circuit breaker" ON circuit_breaker_state IS
'Backend service needs full read/write access to update circuit state';

COMMENT ON POLICY "Authenticated users can read circuit breaker state" ON circuit_breaker_state IS
'Logged-in users can view circuit status for debugging (via admin API with proper auth checks)';

DO $$ 
BEGIN
    RAISE NOTICE 'âœ… Distributed Circuit Breaker Setup Complete:';
    RAISE NOTICE '   - circuit_breaker_state table created';
    RAISE NOTICE '   - stripe_api circuit initialized';
    RAISE NOTICE '   - Cleanup and monitoring functions added';
    RAISE NOTICE '   - RLS enabled with service_role access';
    RAISE NOTICE '';
    RAISE NOTICE 'ðŸ”’ DISTRIBUTED CIRCUIT BREAKER ACTIVE:';
    RAISE NOTICE '   â€¢ All backend instances now share circuit state';
    RAISE NOTICE '   â€¢ When one instance detects failures, ALL instances stop';
    RAISE NOTICE '   â€¢ Automatic recovery after 60 seconds';
    RAISE NOTICE '   â€¢ Manual reset: SELECT reset_circuit_breaker(''stripe_api'');';
    RAISE NOTICE '   â€¢ Monitor status: SELECT * FROM v_circuit_breaker_status;';
END $$;




-- Migration: 20251016114716_remove_billing_health_check.sql
DROP VIEW IF EXISTS public.billing_health_check CASCADE;

DO $$
BEGIN
    RAISE NOTICE 'âœ… Removed billing_health_check view';
END $$;



-- Migration: 20251016115107_add_trial_history_status.sql
ALTER TABLE public.trial_history 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' 
CHECK (status IN ('checkout_pending', 'checkout_created', 'checkout_failed', 'active', 'expired', 'converted', 'cancelled'));

ALTER TABLE public.trial_history 
ADD COLUMN IF NOT EXISTS error_message TEXT;

CREATE INDEX IF NOT EXISTS idx_trial_history_status 
ON public.trial_history(status) 
WHERE status IN ('checkout_pending', 'checkout_failed');

UPDATE public.trial_history 
SET status = 'active' 
WHERE status IS NULL;

COMMENT ON COLUMN public.trial_history.status IS 
'Trial checkout/activation status: checkout_pending (awaiting payment), checkout_created (Stripe session created), checkout_failed (error), active (trial running), expired (trial ended), converted (became paying customer), cancelled (trial cancelled)';

COMMENT ON COLUMN public.trial_history.error_message IS 
'Error details if checkout failed';

DO $$
BEGIN
    RAISE NOTICE 'âœ… Added status and error_message columns to trial_history table';
    RAISE NOTICE '   - status: tracks trial checkout and lifecycle state';
    RAISE NOTICE '   - error_message: stores checkout failure details';
    RAISE NOTICE '   - Index created for pending/failed checkout tracking';
END $$;



-- Migration: 20251016115145_add_renewal_period_column.sql
ALTER TABLE public.credit_accounts
    ADD COLUMN IF NOT EXISTS last_renewal_period_start BIGINT;

CREATE INDEX IF NOT EXISTS idx_credit_accounts_last_renewal_period 
    ON public.credit_accounts(account_id, last_renewal_period_start);




-- Migration: 20251016115146_atomic_grant_renewal_function.sql
CREATE OR REPLACE FUNCTION atomic_grant_renewal_credits(
    p_account_id UUID,
    p_period_start BIGINT,
    p_period_end BIGINT,
    p_credits NUMERIC(10, 2),
    p_processed_by TEXT,
    p_invoice_id TEXT DEFAULT NULL,
    p_stripe_event_id TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_already_processed BOOLEAN;
    v_existing_processor TEXT;
    v_current_non_expiring NUMERIC(10, 2);
    v_new_total NUMERIC(10, 2);
    v_expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM public.renewal_processing 
        WHERE account_id = p_account_id 
        AND period_start = p_period_start
    ), (
        SELECT processed_by FROM public.renewal_processing
        WHERE account_id = p_account_id
        AND period_start = p_period_start
        LIMIT 1
    ) INTO v_already_processed, v_existing_processor;
    
    IF v_already_processed THEN
        RAISE NOTICE '[ATOMIC RENEWAL] Period % already processed by % for account %', 
            p_period_start, v_existing_processor, p_account_id;
        
        RETURN jsonb_build_object(
            'success', false, 
            'reason', 'already_processed',
            'processed_by', v_existing_processor,
            'duplicate_prevented', true
        );
    END IF;
    
    INSERT INTO public.renewal_processing (
        account_id, 
        period_start, 
        period_end, 
        subscription_id,
        processed_by, 
        credits_granted, 
        stripe_event_id
    ) 
    SELECT 
        p_account_id,
        p_period_start,
        p_period_end,
        stripe_subscription_id,
        p_processed_by,
        p_credits,
        p_stripe_event_id
    FROM public.credit_accounts
    WHERE account_id = p_account_id;
    
    RAISE NOTICE '[ATOMIC RENEWAL] Marked period % as processing by % for account %',
        p_period_start, p_processed_by, p_account_id;
    
    SELECT non_expiring_credits 
    INTO v_current_non_expiring
    FROM public.credit_accounts
    WHERE account_id = p_account_id;
    
    v_current_non_expiring := COALESCE(v_current_non_expiring, 0);
    v_new_total := p_credits + v_current_non_expiring;
    
    v_expires_at := TO_TIMESTAMP(p_period_end);
    
    UPDATE public.credit_accounts 
    SET 
        expiring_credits = p_credits,
        balance = v_new_total,
        last_grant_date = TO_TIMESTAMP(p_period_start),
        next_credit_grant = TO_TIMESTAMP(p_period_end),
        last_processed_invoice_id = COALESCE(p_invoice_id, last_processed_invoice_id),
        last_renewal_period_start = p_period_start,
        updated_at = NOW()
    WHERE account_id = p_account_id;
    
    INSERT INTO public.credit_ledger (
        account_id,
        amount,
        balance_after,
        type,
        description,
        is_expiring,
        expires_at,
        stripe_event_id,
        processing_source
    ) VALUES (
        p_account_id,
        p_credits,
        v_new_total,
        'tier_grant',
        'Monthly renewal: ' || p_processed_by,
        true,
        v_expires_at,
        p_stripe_event_id,
        p_processed_by
    );
    
    RAISE NOTICE '[ATOMIC RENEWAL] Granted % credits to account %, new balance: %',
        p_credits, p_account_id, v_new_total;
    
    RETURN jsonb_build_object(
        'success', true,
        'credits_granted', p_credits,
        'new_balance', v_new_total,
        'expiring_credits', p_credits,
        'non_expiring_credits', v_current_non_expiring,
        'processed_by', p_processed_by
    );
    
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[ATOMIC RENEWAL] Error: % - %', SQLERRM, SQLSTATE;
    RETURN jsonb_build_object(
        'success', false,
        'reason', 'error',
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql;




-- Migration: 20251016115147_check_renewal_function.sql
CREATE OR REPLACE FUNCTION check_renewal_already_processed(
    p_account_id UUID,
    p_period_start BIGINT
) RETURNS JSONB AS $$
DECLARE
    v_existing_record RECORD;
BEGIN
    SELECT * INTO v_existing_record
    FROM public.renewal_processing
    WHERE account_id = p_account_id
    AND period_start = p_period_start;
    
    IF FOUND THEN
        RETURN jsonb_build_object(
            'already_processed', true,
            'processed_by', v_existing_record.processed_by,
            'processed_at', v_existing_record.processed_at,
            'credits_granted', v_existing_record.credits_granted
        );
    ELSE
        RETURN jsonb_build_object(
            'already_processed', false
        );
    END IF;
END;
$$ LANGUAGE plpgsql;



-- Migration: 20251016115148_grant_renewal_functions.sql
GRANT EXECUTE ON FUNCTION atomic_grant_renewal_credits TO service_role;




-- Migration: 20251016115149_grant_check_renewal.sql
GRANT EXECUTE ON FUNCTION check_renewal_already_processed TO service_role;




-- Migration: 20251016115153_fix_atomic_use_credits_uuid_cast.sql
CREATE OR REPLACE FUNCTION atomic_use_credits(
    p_account_id UUID,
    p_amount NUMERIC(10, 2),
    p_description TEXT DEFAULT 'Credit usage',
    p_thread_id TEXT DEFAULT NULL,
    p_message_id TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_current_expiring NUMERIC(10, 2);
    v_current_non_expiring NUMERIC(10, 2);
    v_current_balance NUMERIC(10, 2);
    v_amount_from_expiring NUMERIC(10, 2);
    v_amount_from_non_expiring NUMERIC(10, 2);
    v_new_expiring NUMERIC(10, 2);
    v_new_non_expiring NUMERIC(10, 2);
    v_new_total NUMERIC(10, 2);
BEGIN
    SELECT 
        expiring_credits,
        non_expiring_credits,
        balance
    INTO 
        v_current_expiring,
        v_current_non_expiring,
        v_current_balance
    FROM public.credit_accounts
    WHERE account_id = p_account_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No credit account found',
            'required', p_amount,
            'available', 0
        );
    END IF;
    
    IF v_current_balance < p_amount THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Insufficient credits',
            'required', p_amount,
            'available', v_current_balance
        );
    END IF;
    
    IF v_current_expiring >= p_amount THEN
        v_amount_from_expiring := p_amount;
        v_amount_from_non_expiring := 0;
    ELSE
        v_amount_from_expiring := v_current_expiring;
        v_amount_from_non_expiring := p_amount - v_current_expiring;
    END IF;
    
    v_new_expiring := v_current_expiring - v_amount_from_expiring;
    v_new_non_expiring := v_current_non_expiring - v_amount_from_non_expiring;
    v_new_total := v_new_expiring + v_new_non_expiring;
    
    UPDATE public.credit_accounts
    SET 
        expiring_credits = v_new_expiring,
        non_expiring_credits = v_new_non_expiring,
        balance = v_new_total,
        updated_at = NOW()
    WHERE account_id = p_account_id;
    
    INSERT INTO public.credit_ledger (
        account_id,
        amount,
        balance_after,
        type,
        description,
        reference_id,
        metadata,
        processing_source
    ) VALUES (
        p_account_id,
        -p_amount,
        v_new_total,
        'usage',
        p_description,
        CASE 
            WHEN COALESCE(p_thread_id, p_message_id) IS NOT NULL 
            THEN COALESCE(p_thread_id, p_message_id)::uuid
            ELSE NULL
        END,
        jsonb_build_object(
            'thread_id', p_thread_id,
            'message_id', p_message_id,
            'from_expiring', v_amount_from_expiring,
            'from_non_expiring', v_amount_from_non_expiring
        ),
        'atomic_function'
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'amount_deducted', p_amount,
        'from_expiring', v_amount_from_expiring,
        'from_non_expiring', v_amount_from_non_expiring,
        'new_expiring', v_new_expiring,
        'new_non_expiring', v_new_non_expiring,
        'new_total', v_new_total
    );
END;
$$ LANGUAGE plpgsql;



-- Migration: 20251019081308_add_payment_status.sql
ALTER TABLE public.credit_accounts 
    ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'active' 
        CHECK (payment_status IN ('active', 'failed', 'pending', 'past_due'));

ALTER TABLE public.credit_accounts 
    ADD COLUMN IF NOT EXISTS last_payment_failure TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.credit_accounts.payment_status IS 'Tracks the current payment status of the subscription';
COMMENT ON COLUMN public.credit_accounts.last_payment_failure IS 'Timestamp of the last payment failure';

CREATE INDEX IF NOT EXISTS idx_credit_accounts_payment_status 
    ON public.credit_accounts(payment_status) 
    WHERE payment_status != 'active';



