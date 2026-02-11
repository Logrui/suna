"""
Railway Migration Runner
Applies pending SQL migrations to the Railway Postgres database.
Tracks applied migrations in a `_migrations` table.

Usage:
    python run_migrations.py                         # Uses DATABASE_URL env var
    python run_migrations.py --db-url "postgres://..." # Explicit connection string
"""

import asyncio
import hashlib
import os
import sys
import logging
from pathlib import Path

logger = logging.getLogger("migrations")
logging.basicConfig(level=logging.INFO, format="%(message)s")

MIGRATIONS_DIR = Path(__file__).parent / "supabase" / "migrations"

INIT_SQL = """
CREATE TABLE IF NOT EXISTS _migrations (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    checksum TEXT,
    applied_at TIMESTAMPTZ DEFAULT NOW()
);
"""


def get_database_url() -> str:
    """Build a direct Postgres connection URL from available env vars."""
    # 1. Prefer explicit connection strings (standard Railway/Supabase)
    # We prioritize DB_PRIVATE_CONNECTION_STRING which is explicitly set in your Railway Postgres service
    url = (
        os.environ.get("DATABASE_URL") or 
        os.environ.get("POSTGRES_URL") or 
        os.environ.get("DB_PRIVATE_CONNECTION_STRING") or 
        os.environ.get("DB_PUBLIC_CONNECTION_STRING")
    )
    if url:
        return url

    # 2. Fall back to constructing from components
    # Using the exact variable names identified in your Railway "Supabase Postgres" service
    host = (
        os.environ.get("POSTGRES_HOST") or 
        os.environ.get("DB_HOST") or 
        os.environ.get("SUPABASE_DB_HOST") or 
        "postgres-b4py.railway.internal"  # Internal DNS seen in your environment
    )
    port = (
        os.environ.get("POSTGRES_PORT") or 
        os.environ.get("DB_PORT") or 
        os.environ.get("SUPABASE_DB_PORT") or 
        "5432"
    )
    user = (
        os.environ.get("POSTGRES_USER") or 
        os.environ.get("DB_USER") or 
        os.environ.get("SUPABASE_DB_USER") or 
        "postgres"
    )
    password = (
        os.environ.get("POSTGRES_PASSWORD") or 
        os.environ.get("DB_PASSWORD") or 
        os.environ.get("DB_SUPERUSER_PASSWORD") or 
        os.environ.get("SUPABASE_DB_PASSWORD") or 
        ""
    )
    database = (
        os.environ.get("POSTGRES_DB") or 
        os.environ.get("DB_NAME") or 
        os.environ.get("SUPABASE_DB_NAME") or 
        "postgres"
    )

    if not password:
        logger.error("❌ No database password found. Ensure DB_PRIVATE_CONNECTION_STRING or POSTGRES_PASSWORD is set.")
        sys.exit(1)

    return f"postgresql://{user}:{password}@{host}:{port}/{database}"


async def run_migrations():
    try:
        import asyncpg
    except ImportError:
        logger.error("❌ asyncpg not installed. Install with: uv add asyncpg")
        sys.exit(1)

    db_url = get_database_url()
    # Mask password in logs
    safe_url = db_url.split("@")[-1] if "@" in db_url else db_url
    logger.info(f"🔌 Connecting to: ...@{safe_url}")

    try:
        conn = await asyncpg.connect(db_url)
    except Exception as e:
        logger.error(f"❌ Failed to connect to database: {e}")
        sys.exit(1)

    try:
        # 1. Ensure tracking table exists
        await conn.execute(INIT_SQL)

        # 2. Get already-applied migrations
        rows = await conn.fetch("SELECT name FROM _migrations")
        applied = {r["name"] for r in rows}
        logger.info(f"📋 {len(applied)} migrations already applied")

        # 3. Get local migration files
        if not MIGRATIONS_DIR.exists():
            logger.warning(f"⚠️  Migrations directory not found: {MIGRATIONS_DIR}")
            return

        migration_files = sorted(MIGRATIONS_DIR.glob("*.sql"))
        pending = [f for f in migration_files if f.name not in applied]

        if not pending:
            logger.info("✅ No pending migrations.")
            return

        logger.info(f"🚀 {len(pending)} pending migration(s) to apply:")
        for f in pending:
            logger.info(f"   → {f.name}")

        # 4. Apply each pending migration
        for sql_file in pending:
            name = sql_file.name
            sql = sql_file.read_text(encoding="utf-8")
            checksum = hashlib.md5(sql.encode()).hexdigest()

            logger.info(f"\n📄 Applying: {name}")
            try:
                await conn.execute(sql)
                await conn.execute(
                    "INSERT INTO _migrations (name, checksum) VALUES ($1, $2)",
                    name, checksum
                )
                logger.info(f"✅ Applied: {name}")
            except Exception as e:
                logger.error(f"❌ Failed to apply {name}: {e}")
                sys.exit(1)

        logger.info(f"\n🏁 Migration run complete. {len(pending)} migration(s) applied.")

    finally:
        await conn.close()


if __name__ == "__main__":
    # Support --db-url flag for manual runs
    if "--db-url" in sys.argv:
        idx = sys.argv.index("--db-url")
        if idx + 1 < len(sys.argv):
            os.environ["DATABASE_URL"] = sys.argv[idx + 1]

    asyncio.run(run_migrations())
