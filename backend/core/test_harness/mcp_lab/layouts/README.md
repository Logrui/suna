# Harness Layouts & State

This directory contains the JSON configuration and state files for the MCP Lab Harness.

## 📄 File Definitions

### 1. `local_lab.json`
**Purpose**: Primary configuration for the harness. Defines connected MCP servers and the mock user account.
- **Key Fields**: 
    - `account_id`: Mock user ID used for credential lookups.
    - `custom_mcp`: List of server objects containing `name`, `url`, and `type` (sse/http/json).

### 2. `secrets.json`
**Purpose**: Local storage for authentication tokens and API keys.
- **Security**: This file is **gitignored**.
- **Format**: Maps server names (from `local_lab.json`) to token objects containing `access_token`, `refresh_token`, etc.

### 3. `pending_auth.json`
**Purpose**: Transient state used during PKCE OAuth flows.
- **Content**: Stores the `code_verifier` needed to complete the token exchange after a user provides an authorization code.

---

## 🛠️ Maintenance
To reset the harness environment, you can safely delete `secrets.json` and `pending_auth.json`. The `local_lab.json` file should be kept to preserve your server list.
