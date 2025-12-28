# ROLLBACK & CORRECT GRANT
# This script:
# 1. Reverts all accounts back to 'none' tier
# 2. Grants ultra tier ONLY to actual system admins (users in user_roles table with admin/super_admin role)

$env:PGPASSWORD = "your-super-secret-and-long-postgres-password"

Write-Host "`n========================================" -ForegroundColor Red
Write-Host "ROLLBACK: Reverting All Ultra Tier Grants" -ForegroundColor Red
Write-Host "========================================`n" -ForegroundColor Red

# Step 1: Rollback - Reset all ultra tier accounts back to 'none'
Write-Host "[1/3] Rolling back ultra tier grants..." -ForegroundColor Yellow


psql -h localhost -p 5434 -U postgres -d postgres -c "
    UPDATE credit_accounts
    SET 
        tier = 'none',
        balance = 0.00,
        non_expiring_credits = 0.00,
        expiring_credits = 0.00,
        updated_at = NOW()
    WHERE tier = 'ultra';
" 2>&1 | Write-Host -ForegroundColor Gray

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "CORRECT GRANT: Ultra Tier to System Admins ONLY" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Step 2: Check if user_roles table exists and show current admins
Write-Host "[2/3] Checking for system admins in user_roles table..." -ForegroundColor Yellow

$adminsCheck = psql -h localhost -p 5434 -U postgres -d postgres -c "
    SELECT 
        ur.user_id,
        ur.role,
        a.name AS account_name,
        u.email
    FROM user_roles ur
    LEFT JOIN basejump.accounts a ON a.id = ur.user_id
    LEFT JOIN auth.users u ON u.id = ur.user_id
    WHERE ur.role IN ('admin', 'super_admin')
    ORDER BY ur.role, u.email;
" 2>&1

if ($adminsCheck -match "does not exist") {
    Write-Host "`nERROR: user_roles table does not exist!" -ForegroundColor Red
    Write-Host "No system admins defined in database." -ForegroundColor Red
    Write-Host "`nPlease specify which users should be admins.`n" -ForegroundColor Yellow
    exit 1
}

Write-Host $adminsCheck -ForegroundColor Green

# Step 3: Grant ultra tier ONLY to actual sys admins
Write-Host "`n[3/3] Granting ultra tier to system admins only..." -ForegroundColor Yellow

$result = psql -h localhost -p 5434 -U postgres -d postgres -c "
    -- Grant ultra tier to system admins
    UPDATE credit_accounts
    SET 
        tier = 'ultra',
        balance = 99999999.00,
        non_expiring_credits = 99999999.00,
        expiring_credits = 0.00,
        updated_at = NOW()
    WHERE account_id IN (
        SELECT user_id 
        FROM user_roles 
        WHERE role IN ('admin', 'super_admin')
    );

    -- Log the grants
    INSERT INTO credit_ledger (
        account_id,
        amount,
        balance_after,
        type,
        description
    )
    SELECT 
        ur.user_id,
        99999999.00,
        99999999.00,
        'admin_grant',
        'Ultra tier unlimited credits granted to system admin'
    FROM user_roles ur
    WHERE ur.role IN ('admin', 'super_admin')
    AND NOT EXISTS (
        SELECT 1 FROM credit_ledger cl 
        WHERE cl.account_id = ur.user_id 
        AND cl.description = 'Ultra tier unlimited credits granted to system admin'
        AND cl.created_at > NOW() - INTERVAL '1 minute'
    );
" 2>&1

Write-Host $result -ForegroundColor Green

#  Verify
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Verification" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

psql -h localhost -p 5434 -U postgres -d postgres -c "
    SELECT 
        u.email,
        ur.role AS system_role,
        ca.tier,
        ca.balance
    FROM user_roles ur
    JOIN auth.users u ON u.id = ur.user_id
    LEFT JOIN credit_accounts ca ON ca.account_id = ur.user_id
    WHERE ur.role IN ('admin', 'super_admin')
    ORDER BY ur.role, u.email;
" 2>&1 | ForEach-Object { Write-Host "  $_" -ForegroundColor Green }

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "Complete!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Green
