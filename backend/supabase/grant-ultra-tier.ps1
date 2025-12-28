# Grant Ultra Tier with Unlimited Credits to Admin Accounts
# Simplified version that works with existing schema

$env:PGPASSWORD = "your-super-secret-and-long-postgres-password"

Write-Host "`nGranting Ultra Tier to Admin Accounts..." -ForegroundColor Cyan
Write-Host "=========================================`n" -ForegroundColor Cyan

# Update credit accounts for all account owners
Write-Host "Updating admin accounts to ultra tier..." -ForegroundColor Yellow

$result = psql -h localhost -p 5434 -U postgres -d postgres -c "
    -- Update existing credit accounts for admins
    UPDATE credit_accounts
    SET 
        tier = 'ultra',
        balance = 99999999.00,
        non_expiring_credits = 99999999.00,
        expiring_credits = 0.00,
        updated_at = NOW()
    WHERE account_id IN (
        SELECT DISTINCT account_id 
        FROM basejump.account_user 
        WHERE account_role = 'owner'
    );

    -- Insert credit ledger entries
    INSERT INTO credit_ledger (
        account_id,
        amount,
        balance_after,
        type,
        description
    )
    SELECT DISTINCT
        au.account_id,
        99999999.00,
        99999999.00,
        'admin_grant',
        'Ultra tier unlimited credits granted to admin account'
    FROM basejump.account_user au
    WHERE au.account_role = 'owner'
    AND NOT EXISTS (
        SELECT 1 FROM credit_ledger cl 
        WHERE cl.account_id = au.account_id 
        AND cl.description = 'Ultra tier unlimited credits granted to admin account'
        AND cl.created_at > NOW() - INTERVAL '1 minute'
    );
" 2>&1

Write-Host $result -ForegroundColor Green

# Verify the changes
Write-Host "`nVerifying ultra tier assignment..." -ForegroundColor Yellow

psql -h localhost -p 5434 -U postgres -d postgres -c "
    SELECT 
        a.name AS account_name,
        ca.tier,
        ca.balance,
        ca.non_expiring_credits
    FROM credit_accounts ca
    JOIN basejump.accounts a ON a.id = ca.account_id
    WHERE ca.tier = 'ultra'
    ORDER BY a.name;
" 2>&1 | ForEach-Object { Write-Host "  $_" -ForegroundColor Green }

Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host "Ultra tier assignment complete!" -ForegroundColor Green
Write-Host "==========================================`n" -ForegroundColor Cyan
