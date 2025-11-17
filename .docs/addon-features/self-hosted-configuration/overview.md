Minimally required modifications to Kortix Suna to self-host:


Modify: suna\backend\api.py

Add extend allowed_origins:

allowed_origins = ["https://www.kortix.com", "https://kortix.com", "https://www.suna.so", "https://suna.so"]
allow_origin_regex = None

# Add staging-specific origins
if config.ENV_MODE == EnvMode.LOCAL:
    allowed_origins.append("http://localhost:3000")
    allowed_origins.append("http://127.0.0.1:3000")

# Add staging-specific origins
if config.ENV_MODE == EnvMode.STAGING:
    allowed_origins.append("https://staging.suna.so")
    allowed_origins.append("http://localhost:3000")
    # Allow Vercel preview deployments for both legacy and new project names
    allow_origin_regex = r"https://(suna|kortixcom)-.*-prjcts\.vercel\.app"

# Add localhost for production mode local testing (for master password login)
if config.ENV_MODE == EnvMode.PRODUCTION:
    allowed_origins.append("http://localhost:3000")
    allowed_origins.append("http://127.0.0.1:3000")

# Add Cloudflare Tunnel domains for self-hosted deployments
allowed_origins.extend([
    "https://kortix.syhc.dev",          # Frontend via Cloudflare Tunnel
    "http://kong.[YOUR_DOMAIN]",      # Kong/Supabase via Cloudflare Tunnel (HTTP)
    "https://kong.[YOUR_DOMAIN]",     # Kong/Supabase via Cloudflare Tunnel (HTTPS, for future use)
])


Modify: suna\backend\pyproject.toml - fixes issues with redirecting from custom domain to suno.so

[project.urls]
homepage = "https://kortix.syhc.dev"
repository = "https://github.com/logrui/suna-community"
