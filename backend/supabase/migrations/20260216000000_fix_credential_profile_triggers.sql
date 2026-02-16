-- Fix: Schema-qualify table references in credential profile trigger functions
--
-- The supabase_linter_fix migration (20251128073157) set search_path = '' on all
-- functions for security. However, the trigger functions for user_mcp_credential_profiles
-- reference the table without the 'public.' schema prefix. With an empty search_path,
-- PostgreSQL cannot resolve the unqualified table name, causing all INSERTs and UPDATEs
-- with is_default=true to fail with: "relation user_mcp_credential_profiles does not exist"
--
-- This migration recreates both trigger functions with fully schema-qualified table names.

BEGIN;

CREATE OR REPLACE FUNCTION public.ensure_single_default_profile()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_default = true THEN
        UPDATE public.user_mcp_credential_profiles
        SET is_default = false, updated_at = NOW()
        WHERE account_id = NEW.account_id
          AND mcp_qualified_name = NEW.mcp_qualified_name
          AND profile_id != NEW.profile_id
          AND is_default = true;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_credential_profile_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-apply the empty search_path (security hardening) now that table refs are qualified
ALTER FUNCTION public.ensure_single_default_profile() SET search_path = '';
ALTER FUNCTION public.update_credential_profile_timestamp() SET search_path = '';

COMMIT;
