

# Suna Official API - Headless Integration Commands

**Base URL:** `https://api.kortix.com/api`  
**Auth Header:** `X-API-Key: {pk_xxx:sk_xxx}`

---

## 1. Submit Agent Task (Unified Endpoint)

```powershell
curl.exe -X POST "https://api.kortix.com/api/agent/start" `
  -H "X-API-Key: pk_6PkpkCmtaLM5N2YYc2WzIgre2qGO4kFZ:sk_5RYXxybe8Yxy5Rrsu535PPCNVKTF9XXY" `
  -F "prompt=Find me 50 venture capital firms in the united states that are actively investing, under \$1B in management and focus on biotech and healthcare"
```

**Response:**
```json
{
  "thread_id": "598f9dfe-a313-464c-b257-1da9856c3683",
  "agent_run_id": "e18c9755-9be8-46eb-894b-5cdfb2293ee2",
  "status": "running"
}
```

---

## 2. Stream Results (Server-Sent Events)

```powershell
curl.exe --max-time 60 "https://api.kortix.com/api/agent-run/e18c9755-9be8-46eb-894b-5cdfb2293ee2/stream" `
  -H "X-API-Key: pk_6PkpkCmtaLM5N2YYc2WzIgre2qGO4kFZ:sk_5RYXxybe8Yxy5Rrsu535PPCNVKTF9XXY"
```

Returns real-time SSE events with agent progress and responses.

---

## 3. Check Completion Status (Quick Lookup)

```powershell
curl.exe -X GET "https://api.kortix.com/api/agent-run/e18c9755-9be8-46eb-894b-5cdfb2293ee2" `
  -H "X-API-Key: pk_6PkpkCmtaLM5N2YYc2WzIgre2qGO4kFZ:sk_5RYXxybe8Yxy5Rrsu535PPCNVKTF9XXY"
```

**Response:**
```json
{
  "id": "e18c9755-9be8-46eb-894b-5cdfb2293ee2",
  "threadId": "598f9dfe-a313-464c-b257-1da9856c3683",
  "status": "completed",
  "startedAt": "2025-11-09T09:34:16.223232+00:00",
  "completedAt": "2025-11-09T09:38:04.188439+00:00",
  "error": null
}
```

---

## 4. Get All Runs for Thread (Audit History)

```powershell
curl.exe -X GET "https://api.kortix.com/api/thread/598f9dfe-a313-464c-b257-1da9856c3683/agent-runs" `
  -H "X-API-Key: pk_6PkpkCmtaLM5N2YYc2WzIgre2qGO4kFZ:sk_5RYXxybe8Yxy5Rrsu535PPCNVKTF9XXY"
```

**Response:**
```json
{
  "agent_runs": [
    {
      "id": "e18c9755-9be8-46eb-894b-5cdfb2293ee2",
      "thread_id": "598f9dfe-a313-464c-b257-1da9856c3683",
      "status": "completed",
      "started_at": "2025-11-09T09:34:16.223232+00:00",
      "completed_at": "2025-11-09T09:38:04.188439+00:00",
      "error": null,
      "created_at": "2025-11-09T09:34:16.334631+00:00",
      "updated_at": "2025-11-09T09:38:04.293597+00:00"
    }
  ]
}
```

---

## Key Points

- **Don't create threads manually** — `/agent/start` handles everything in one call
- **Use #1 for polling** — fastest completion check (5 fields)
- **Use #4 for audit** — full history with timestamps (8 fields)
- **Status values:** `running` → `completed` or `failed`
- **Naming convention:** #1 uses camelCase, #2-4 use snake_case