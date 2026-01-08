DO $$
DECLARE
    user_record RECORD;
    generated_user_name TEXT;
BEGIN
    FOR user_record IN SELECT id, email FROM auth.users LOOP
        -- Skip if account already exists
        IF NOT EXISTS (SELECT 1 FROM basejump.accounts WHERE id = user_record.id) THEN
            IF user_record.email IS NOT NULL THEN
                generated_user_name := split_part(user_record.email, '@', 1);
            ELSE
                generated_user_name := 'user_' || substr(user_record.id::text, 1, 8);
            END IF;

            -- Create personal account
            INSERT INTO basejump.accounts (name, primary_owner_user_id, personal_account, id)
            VALUES (generated_user_name, user_record.id, true, user_record.id);

            -- Ensure account_user entry exists
            IF NOT EXISTS (SELECT 1 FROM basejump.account_user WHERE user_id = user_record.id AND account_id = user_record.id) THEN
                INSERT INTO basejump.account_user (account_id, user_id, account_role)
                VALUES (user_record.id, user_record.id, 'owner');
            END IF;
        END IF;
    END LOOP;
END $$;
