# Deployment Report for Suna

This report outlines the deployment options for the Suna application (Frontend and Backend), focusing on stability, ease of use, and compatibility with your existing tech stack (Docker, Next.js, Python).

## 🏗️ Architecture Overview

Before deploying, it's crucial to understand the services that need to run.

### 1. Frontend (`frontend/`)
*   **Tech:** Next.js 15.
*   **Current State:** Configured for **Cloudflare Pages** (via `open-next` and `wrangler.toml`).
*   **Deployment Type:** Static/Edge or Docker Container.

### 2. Backend (`backend/`)
The backend is **not just a single API server**. It consists of two distinct processes that must run simultaneously:
*   **API Server:** FastAPI application serving the REST API (`api:app`).
*   **Background Worker:** Dramatiq worker processing agent tasks (`dramatiq backend.run_agent_background`). **Critically important for agent functionality.**
*   **Dependencies:**
    *   **Redis:** Required for communication between the API and Worker.
    *   **Supabase:** External PostgreSQL database.

---

## 🚀 Option 1: The "Cloud Native" Path (Recommended)
**Providers:** Cloudflare (Frontend) + Google Cloud Run (Backend)

This option leverages your existing Cloudflare setup for the frontend while using a robust, scalable container platform for the backend.

### **Frontend: Cloudflare Pages**
Your repository is already pre-configured for this.
1.  Connect your repo to Cloudflare Pages.
2.  **Build Command:** `npm run pages:build`
3.  **Build Output Directory:** `.open-next/cloudflare`
4.  **Environment Variables:** Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_BACKEND_URL`, etc.

### **Backend: Google Cloud Run**
Cloud Run is excellent for Docker containers. You will deploy **two services** (or one service and one "sidecar") sharing a Redis instance.

1.  **Redis:** Provision a managed Redis instance (Google Cloud Memorystore) or use a third-party Redis provider (Upstash, Redis Cloud).
2.  **Service A (API):**
    *   **Source:** Deploy `backend/Dockerfile`.
    *   **Command:** Default (`uv run gunicorn api:app ...`).
    *   **Env Vars:** `REDIS_HOST` (your redis ip), `DATABASE_URL`, `SUPABASE_URL`, etc.
3.  **Service B (Worker):**
    *   **Source:** Same `backend/Dockerfile`.
    *   **Command:** Override the default command to: `uv run dramatiq backend.run_agent_background`
    *   **Scaling:** Set "Minimum Instances" to 1 to ensure the worker is always listening for tasks.

---

## ⚡ Option 2: The "Easiest Integration" Path (PaaS)
**Providers:** Vercel (Frontend) + Railway or Render (Backend)

These platforms simplify the "API + Worker + Redis" trio significantly by managing the networking for you.

### **Frontend: Vercel**
1.  Import project to Vercel.
2.  Vercel automatically detects Next.js.
3.  Deploy. (Zero configuration mostly).

### **Backend: Railway / Render**
These platforms allow you to deploy the repo and select the `backend` folder.
1.  **Redis:** Add a Redis service with one click.
2.  **API Service:** Deploy from repo (Backend folder).
3.  **Worker Service:** Deploy from repo (Backend folder) again, but change the **Start Command** to `uv run dramatiq backend.run_agent_background`.
4.  **Linking:** These platforms automatically expose Redis variables to your services.

---

## 🛡️ Option 3: The "Backup" Path (VM + Docker Compose)
**Providers:** AWS EC2 / Google Compute Engine / DigitalOcean + Cloudflare Tunnel

Since you are already comfortable with Docker Compose and Cloudflare Tunnels, this is your reliable "backup" plan. It replicates your local setup on a remote server.

1.  **Provision a VM:** Ubuntu server (e.g., t3.medium on AWS or e2-medium on GCP).
2.  **Install Docker:** `curl -fsSL https://get.docker.com | sh`
3.  **Clone Repo:** `git clone ...`
4.  **Setup Env:** Create `.env` files in `backend/` and `frontend/`.
5.  **Run:** `docker compose up -d --build`
6.  **Cloudflare Tunnel:** Run `cloudflared` on the VM to expose the frontend port (3000) and backend port (8000) to the internet securely without opening firewall ports.

---

## 📝 Configuration Checklist

### Required Environment Variables (Backend)
Ensure these are set in your production environment:
*   `ENV_MODE`: `production`
*   `REDIS_HOST`: Hostname of your Redis instance.
*   `REDIS_PORT`: `6379`
*   `SUPABASE_URL`: Your Supabase project URL.
*   `SUPABASE_KEY`: Your Supabase Service Key.
*   `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`: Model keys.
*   `DATABASE_URL`: Connection string to postgres.

### Docker Commands (Reference)
*   **Build API:** `docker build -t suna-backend ./backend`
*   **Build Frontend:** `docker build -t suna-frontend ./frontend`
*   **Run Worker:** `docker run -e REDIS_HOST=... suna-backend uv run dramatiq backend.run_agent_background`
