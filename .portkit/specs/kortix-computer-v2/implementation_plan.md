# Portkit - Implementation Plan: Kortix Computer v2

## Status
*   **Source**: Upstream PRODUCTION `backend/core/sandbox/*`, `frontend/src/components/thread/kortix-computer/*`
| Upstream File | Local Destination | Strategy | Notes |
| :--- | :--- | :--- | :--- |
## 5. Verification Checklist
*   [ ] `backend/core/sandbox/api.py` compiles and does NOT import billing modules.
*   [ ] `KortixComputer.tsx` renders without `NextIntlClientProvider` error.
*   [ ] "Daytona Preview Warning" is NOT shown when opening VNC (Bypass check).
*   [ ] User can launch computer loop without "Insufficient Credits" error.
