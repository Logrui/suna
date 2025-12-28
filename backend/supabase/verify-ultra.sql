-- Verification query: Check if ONLY owner accounts have ultra tier

-- Show all ultra tier accounts with their roles
SELECT 
    a.name AS account_name,
    au.account_role,
    ca.tier,
    ca.balance,
    ca.non_expiring_credits
FROM credit_accounts ca
JOIN basejump.accounts a ON a.id = ca.account_id
JOIN basejump.account_user au ON au.account_id = ca.account_id
WHERE ca.tier = 'ultra'
ORDER BY a.name;

-- Count verification
SELECT 
    'Ultra tier accounts' AS category,
    COUNT(*) AS count
FROM credit_accounts
WHERE tier = 'ultra'
UNION ALL
SELECT 
    'Owner role accounts' AS category,
    COUNT(DISTINCT account_id) AS count
FROM basejump.account_user
WHERE account_role = 'owner'
UNION ALL
SELECT 
    'Total credit accounts' AS category,
    COUNT(*) AS count
FROM credit_accounts;

-- Critical check: Ultra tier accounts that are NOT owners (should be 0)
SELECT 
    a.name AS account_name,
    au.account_role,
    ca.tier
FROM credit_accounts ca
JOIN basejump.accounts a ON a.id = ca.account_id
JOIN basejump.account_user au ON au.account_id = ca.account_id
WHERE ca.tier = 'ultra' 
AND au.account_role != 'owner';
