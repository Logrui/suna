$env:PGPASSWORD = "your-super-secret-and-long-postgres-password"

Write-Host "`nVerifying Ultra Tier Grants..." -ForegroundColor Cyan
Write-Host "==============================`n" -ForegroundColor Cyan

Write-Host "Accounts with ultra tier and their roles:" -ForegroundColor Yellow
psql -h localhost -p 5434 -U postgres -d postgres -c "SELECT a.name AS account_name, au.account_role, ca.tier, ca.balance FROM credit_accounts ca JOIN basejump.accounts a ON a.id = ca.account_id JOIN basejump.account_user au ON au.account_id = ca.account_id WHERE ca.tier = 'ultra' ORDER BY a.name;" 2>&1

Write-Host "`nSummary:" -ForegroundColor Yellow
Write-Host "Ultra tier accounts: " -NoNewline
psql -h localhost -p 5434 -U postgres -d postgres -t -c "SELECT COUNT(*) FROM credit_accounts WHERE tier = 'ultra';" 2>&1

Write-Host "Owner accounts: " -NoNewline
psql -h localhost -p 5434 -U postgres -d postgres -t -c "SELECT COUNT(DISTINCT account_id) FROM basejump.account_user WHERE account_role = 'owner';" 2>&1

Write-Host "Total accounts: " -NoNewline
psql -h localhost -p 5434 -U postgres -d postgres -t -c "SELECT COUNT(*) FROM credit_accounts;" 2>&1

Write-Host "`nNon-owner accounts with ultra tier (should be 0):" -ForegroundColor Red
psql -h localhost -p 5434 -U postgres -d postgres -c "SELECT a.name, au.account_role, ca.tier FROM credit_accounts ca JOIN basejump.accounts a ON a.id = ca.account_id JOIN basejump.account_user au ON au.account_id = ca.account_id WHERE ca.tier = 'ultra' AND au.account_role != 'owner';" 2>&1
