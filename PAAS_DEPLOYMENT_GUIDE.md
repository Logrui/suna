# PaaS Deployment Guide: The "Easiest Integration" Path

This guide details how to deploy Suna using a **Platform-as-a-Service (PaaS)** approach. This method offloads infrastructure management (servers, networking, SSL) to the providers, allowing you to focus on the code.

**The Chosen Stack:**
*   **Frontend:** **Vercel** (Native support for Next.js, zero-config).
*   **Backend:** **Railway** (Excellent support for multi-service Python apps + Redis).
*   **Database:** **Existing Self-Hosted Supabase** (Connected via Cloudflare Tunnel).

---

## 🏗️ Architecture Overview

In this hybrid setup, your "compute" moves to the cloud, while your "data" stays on your local machine (or wherever your self-hosted Supabase lives).

```mermaid
graph TD
    User[User Browser] -->|HTTPS| Vercel[Frontend (Vercel)]
    Vercel -->|API Calls| RailwayAPI[Backend API (Railway)]

    subgraph Railway [Railway Project]
        RailwayAPI
        RailwayWorker[Background Worker (Railway)]
        RailwayRedis[(Managed Redis)]

        RailwayAPI -->|Read/Write| RailwayRedis
        RailwayWorker -->|Listen| RailwayRedis
    end

    subgraph Local [Your Local Server]
        Supabase[(Supabase / Kong)]
        CFTunnel[Cloudflare Tunnel]
    end

    RailwayAPI -->|HTTPS| CFTunnel
    RailwayWorker -->|HTTPS| CFTunnel
    CFTunnel --> Supabase
```

---

## 🛠️ Step 1: Prepare Your Database (Supabase)

Since you are keeping your self-hosted Supabase, the critical requirement is **connectivity**. The cloud services (Railway) must be able to reach your local Supabase instance.

**Requirements:**
1.  **Public URL:** You must have a stable public URL for your Supabase instance (e.g., `https://kong.kortix.syhc.dev`). This is likely already set up via your Cloudflare Tunnel.
2.  **Service Key:** Retrieve your `service_role` key (the "secret" key) from your Supabase setup. This is required for the Backend to perform admin tasks.
3.  **Anon Key:** Retrieve your `anon` key (public key) for the Frontend.

*Note: There is increased latency (cloud -> home tunnel -> cloud). For a production app, this is acceptable for a "backup" or "hobby" tier, but for high-performance production, you would eventually migrate Supabase to the cloud as well.*

---

## 🚂 Step 2: Configure the Backend (Railway)

We recommend **Railway** because it visually manages the relationship between the API, Worker, and Redis.

### 2.1. Create Project & Redis
1.  Log in to [Railway.app](https://railway.app/).
2.  Click **"New Project"** -> **"Provision Redis"**.
    *   This instantly gives you a Redis instance.
    *   Railway automatically provides a `REDIS_URL` variable.

### 2.2. Deploy the API Service
1.  Click **"New"** -> **"GitHub Repo"** -> Select your `suna` repo.
2.  Click the card to configure it **before** the build completes (or let it fail once).
3.  **Settings > General:**
    *   **Root Directory:** `/backend` (Important! Tell it to look in the backend folder).
4.  **Settings > Build:**
    *   It should auto-detect the `Dockerfile` in the `/backend` folder.
5.  **Variables:**
    *   `PORT`: `8000`
    *   `ENV_MODE`: `production`
    *   `REDIS_HOST`: Reference the Redis variable (usually `redis` or use the `${Redis.HOST}` variable reference).
    *   `REDIS_PORT`: `${Redis.PORT}`
    *   `SUPABASE_URL`: `https://kong.kortix.syhc.dev` (Your Tunnel URL).
    *   `SUPABASE_KEY`: Your **Service Role** key (starts with `ey...`).
    *   `DATABASE_URL`: Your Postgres connection string. *Note: You can expose your Postgres port via Tunnel OR use the Supabase HTTP API. The backend code uses `supabase-py` client (HTTP) mostly, but Prisma/DB connections need a direct TCP connection. If you haven't tunnelled port 5432, you might need to.*
        *   *Correction:* Suna primarily uses the Supabase HTTP Client (`supabase-js`/`supabase-py`). Direct DB access is less frequent but if used (e.g. Prisma), you need to tunnel the DB port or use a connection pooler. **For now, ensure `SUPABASE_URL` and `SUPABASE_KEY` are correct.**
6.  **Settings > Networking:**
    *   Generate a Domain (e.g., `suna-backend-production.up.railway.app`). You will need this for the Frontend.

### 2.3. Deploy the Background Worker
1.  Click **"New"** -> **"GitHub Repo"** -> Select `suna` repo **again**.
2.  Rename this service to "suna-worker".
3.  **Settings > General:**
    *   **Root Directory:** `/backend`
4.  **Settings > Service:**
    *   **Start Command:** `uv run dramatiq run_agent_background`
    *   *Note: This overrides the default Docker `CMD` which starts the API.*
5.  **Variables:**
    *   Copy all variables from the API service (REDIS, SUPABASE, Keys).
    *   Ensure it connects to the **same Redis instance**.

---

## ▲ Step 3: Configure the Frontend (Vercel)

Vercel is optimized for Next.js and will be the easiest frontend host.

1.  Log in to [Vercel](https://vercel.com).
2.  **"Add New..."** -> **"Project"** -> Import `suna` repo.
3.  **Configure Project:**
    *   **Framework Preset:** Next.js (Auto-detected).
    *   **Root Directory:** Edit this to select `frontend`.
4.  **Environment Variables:**
    *   `NEXT_PUBLIC_ENV_MODE`: `production`
    *   `NEXT_PUBLIC_BACKEND_URL`: The Railway API Domain (e.g., `https://suna-backend-production.up.railway.app`).
    *   `NEXT_PUBLIC_SUPABASE_URL`: `https://kong.kortix.syhc.dev` (Your Tunnel URL).
    *   `NEXT_PUBLIC_SUPABASE_PUBLIC_URL`: Same as above.
    *   `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your **Anon** key.
5.  **Deploy.**

---

## 📝 Configuration Reference Table

| Service | Variable Name | Value / Source |
| :--- | :--- | :--- |
| **Backend (Railway)** | `ENV_MODE` | `production` |
| | `REDIS_HOST` | Railway Redis Host |
| | `REDIS_PORT` | Railway Redis Port |
| | `SUPABASE_URL` | Your Cloudflare Tunnel URL |
| | `SUPABASE_KEY` | Supabase **Service Role** Key |
| | `OPENAI_API_KEY` | Your OpenAI Key |
| | `ANTHROPIC_API_KEY` | Your Anthropic Key |
| **Frontend (Vercel)** | `NEXT_PUBLIC_BACKEND_URL` | `https://<your-railway-app>.up.railway.app` |
| | `NEXT_PUBLIC_SUPABASE_URL` | Your Cloudflare Tunnel URL |
| | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase **Anon** Key |

## ⚠️ Important Considerations

1.  **Latency:** Every request from the frontend goes Vercel -> Railway -> Your Home (via Tunnel) -> Railway -> Vercel. Expect slightly slower response times than a purely local setup.
2.  **Tunnel Reliability:** If your home internet or the Cloudflare Tunnel goes down, your Cloud application will stop working.
3.  **Database Connection:** The Backend Python code uses `supabase-py` which operates over HTTPS. This works perfectly with Cloudflare Tunnels. However, if any part of the backend attempts to use a direct SQL connection (e.g. `psycopg2` or `Prisma`), that will **fail** unless you explicitly tunnel TCP port 5432 and allow external connections. *Based on the codebase analysis, `supabase-py` is the primary driver, so HTTP tunneling is sufficient.*
