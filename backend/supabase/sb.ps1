# Supabase CLI Wrapper for Docker Instance
# Usage: .\sb.ps1 migration list
#        .\sb.ps1 db push
#        .\sb.ps1 db pull

# Set PostgreSQL environment variables
$env:PGSSLMODE = "disable"
$env:PGPASSWORD = "your-super-secret-and-long-postgres-password"
$env:PGHOST = "localhost"
$env:PGPORT = "5434"
$env:PGDATABASE = "postgres"
$env:PGUSER = "postgres"

# Build connection string
$DB_URL = "postgresql://postgres:your-super-secret-and-long-postgres-password@localhost:5434/postgres"

# Run supabase command with all passed arguments
supabase $args --db-url $DB_URL
