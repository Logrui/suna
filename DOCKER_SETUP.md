# Docker Compose Setup Guide

## Prerequisites

Before running `docker compose up`, you need to configure environment variables.

## Environment Configuration

### Using `backend/.env` for Everything

Docker Compose is configured to load `backend/.env` for **both**:
1. Backend runtime environment
2. Frontend build-time environment variables

### Required Variables in `backend/.env`

Your `backend/.env` needs these frontend-specific variables **in addition** to the backend variables:

```env
# Frontend build-time variables (add these to your existing backend/.env)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000/v1
NEXT_PUBLIC_URL=http://localhost:9990
NEXT_PUBLIC_ENV_MODE=staging
```

**Note**: Yes, you'll have both `SUPABASE_URL` (for backend) and `NEXT_PUBLIC_SUPABASE_URL` (for frontend) in the same file. They should have the same values.

## Running the Stack

Once your `.env` file is configured:

```bash
# Build and start all services
docker compose up -d --build

# View logs
docker compose logs -f

# Stop all services
docker compose down
```

## Why Environment Variables Are Needed

The Next.js frontend requires Supabase credentials **during build time** to:
- Pre-render static pages
- Set up the Supabase client for SSR
- Enable proper type checking and validation

Without these variables, the Docker build will fail with:
```
Error: @supabase/ssr: Your project's URL and API key are required to create a Supabase client!
```

## Access URLs

- **Frontend**: http://localhost:9990
- **Backend API**: http://localhost:8000
- **Redis**: localhost:6379

## Troubleshooting

### Build fails with "Supabase URL and API key required"
- Ensure `backend/.env` file exists and contains frontend variables
- Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set in `backend/.env`
- Check that values don't have quotes or extra spaces

### Frontend can't connect to backend
- Ensure `NEXT_PUBLIC_BACKEND_URL` is set correctly
- For Docker Compose, use `http://localhost:8000/v1` (host networking)
- For production, use your actual backend URL
