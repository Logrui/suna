# Kortix Browser Operator

## Overview
The **Kortix Browser Operator** is a powerful Chrome Extension that bridges your local browser to your Kortix AI Workers. It enables autonomous agents to perform complex web-based tasks (navigation, data extraction, form filling) directly from your personalized browser context, while providing a high-performance live stream of the agent's actions.

## Portability System
This extension is designed for complete portability. It uses a **Build-Time Domain Injection** system, meaning you can deploy your own instance of Kortix on any domain (e.g., `my-kortix.syhc.dev` or a local Cloudflare Tunnel), and the extension will automatically configure its security permissions and API endpoints to match your specific deployment.

### (1) Environment & Domain Setup
The extension requires two primary variables to be set during the build process. These variables define where the extension should look for your Kortix instance and where it has permission to run.

- `NEXT_PUBLIC_URL`: The full URL of your Kortix Frontend (e.g., `https://kortix.com`). This is used to allow the browser token bridge to work securely.
- `NEXT_PUBLIC_BACKEND_URL`: The API URL of your Kortix Backend (e.g., `https://api.kortix.com/v1`).

### (2) Self-Hosted (Windows / Cloudflare Tunnels)
If you are running Kortix locally or via a tunnel on a Windows machine, the easiest way to keep your extension in sync with your frontend configuration is to use a **Symbolic Link** (Symlink). This ensures that whenever you change your frontend environment variables, the extension is updated automatically.

**Setup Instructions:**
1. Open PowerShell as **Administrator**.
2. Navigate to the extension directory:
   ```powershell
   cd d:\Homelab\suna\packages\kortix-chrome-extension
   ```
3. Create a symlink to your frontend's environment file:
   ```powershell
   # This links the extension's environment to your existing frontend config
   cmd /c mklink .env ..\..\frontend\.env
   ```
4. Build the extension:
   ```bash
   npm run build
   ```
5. Load the `dist` folder into Chrome via `chrome://extensions` (Developer Mode).

### (3) Railway Deployment (Direct Download)
For cloud deployments, you can automate the entire build-and-serve process using the included `Dockerfile.railway`. This creates a dedicated "Download Server" for your users.

**Recommended Setup:**
1.  **Create a New Service** on Railway from your repo.
2.  Set the **Root Directory** to `packages/kortix-chrome-extension`.
3.  Set the **Dockerfile Path** to `Dockerfile.railway`.
4.  **Reference Variables**: Set the following variables (referencing your Frontend service):
    - `NEXT_PUBLIC_URL`: `${{Kortix Frontend.NEXT_PUBLIC_URL}}`
    - `NEXT_PUBLIC_BACKEND_URL`: `${{Kortix Frontend.NEXT_PUBLIC_BACKEND_URL}}`
5.  Railway will build the extension specifically for your domain and serve a landing page with the `.zip` download.

### (4) Manual Packing
If you need to generate a zip file manually for testing or and/or sharing:
```bash
npm run pack
```
The resulting zip will be located in the `out/` directory.

---
*Note: After any domain or environment variable change, the extension MUST be rebuilt and reloaded in Chrome to apply the new security policies and match patterns.*
