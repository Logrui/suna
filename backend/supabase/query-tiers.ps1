# Query to find tier column and values in credit_accounts table
$env:PGPASSWORD = "your-super-secret-and-long-postgres-password"

Write-Host "Querying credit_accounts table structure..." -ForegroundColor Cyan

# Get table structure
$tableInfo = psql -h localhost -p 5434 -U postgres -d postgres -t -c "
    SELECT column_name, data_type, character_maximum_length, column_default
    FROM information_schema.columns 
    WHERE table_name = 'credit_accounts' 
    AND table_schema = 'public'
    AND column_name LIKE '%tier%'
    ORDER BY ordinal_position;
" 2>&1

Write-Host "`nTier-related columns in credit_accounts:" -ForegroundColor Yellow
$tableInfo | ForEach-Object { Write-Host $_ }

# Get distinct tier values
Write-Host "`nDistinct tier values in use:" -ForegroundColor Yellow
psql -h localhost -p 5434 -U postgres -d postgres -t -c "
    SELECT DISTINCT tier, COUNT(*) as count
    FROM credit_accounts 
    WHERE tier IS NOT NULL 
    GROUP BY tier 
    ORDER BY tier;
" 2>&1 | ForEach-Object { Write-Host $_ }
