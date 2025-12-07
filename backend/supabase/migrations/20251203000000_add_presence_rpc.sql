-- Function to get active viewers of a thread
CREATE OR REPLACE FUNCTION get_thread_viewers(thread_id_param uuid)
RETURNS TABLE (
    account_id uuid,
    first_name text,
    last_name text,
    avatar_url text,
    last_seen timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT ON (ups.account_id)
        ups.account_id,
        (au.raw_user_meta_data->>'first_name')::text as first_name,
        (au.raw_user_meta_data->>'last_name')::text as last_name,
        (au.raw_user_meta_data->>'avatar_url')::text as avatar_url,
        ups.last_seen
    FROM user_presence_sessions ups
    JOIN auth.users au ON ups.account_id = au.id
    WHERE ups.active_thread_id = thread_id_param
    AND ups.last_seen > (now() - interval '5 minutes')
    ORDER BY ups.account_id, ups.last_seen DESC;
END;
$$;

-- Function to get active threads for a user
CREATE OR REPLACE FUNCTION get_account_active_threads(account_id_param uuid)
RETURNS TABLE (
    thread_id uuid,
    last_seen timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT ON (active_thread_id)
        active_thread_id as thread_id,
        last_seen
    FROM user_presence_sessions
    WHERE account_id = account_id_param
    AND active_thread_id IS NOT NULL
    AND last_seen > (now() - interval '5 minutes')
    ORDER BY active_thread_id, last_seen DESC;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_thread_viewers(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_thread_viewers(uuid) TO service_role;

GRANT EXECUTE ON FUNCTION get_account_active_threads(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_account_active_threads(uuid) TO service_role;
