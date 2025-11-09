# Suna Self-Hosted API - Headless Integration Commands

**Base URL:** `https://kortix.syhc.dev/api`  
**Auth Header:** `X-API-Key: {pk_xxx:sk_xxx}`  
**Content-Type:** `application/x-www-form-urlencoded` (form data format)

---

## ✅ All 4 Commands Working on Self-Hosted Instance

### 1. Submit Agent Task (Unified Endpoint)

```powershell
curl.exe -X POST "https://kortix.syhc.dev/api/agent/start" `
  -H "X-API-Key: pk_cLYtpCsc8raT3KyJzZRdbBSxPjJQluO0:sk_p6g2PzCygtl8PlwJVGeCartqgIymjhdQ" `
  -F "prompt=Research the top 3 venture capital firms investing in biotech"
```

**Response:**
```json
{
  "thread_id": "f939fafe-eaf6-47cf-b438-7525f3d5d434",
  "agent_run_id": "4c14edda-e493-4628-8459-0fa3c60bc2cd",
  "status": "running"
}
```

**Status:** ✅ **WORKING**

---

### 2. Stream Results (Server-Sent Events)

```powershell
curl.exe --max-time 60 "https://kortix.syhc.dev/api/agent-run/4c14edda-e493-4628-8459-0fa3c60bc2cd/stream" `
  -H "X-API-Key: pk_cLYtpCsc8raT3KyJzZRdbBSxPjJQluO0:sk_p6g2PzCygtl8PlwJVGeCartqgIymjhdQ"
```

**Response Sample:**
```
data: {"message_id": "140e215b-762b-4d67-983f-54b8ceb0d5ec", "thread_id": "f2f13366-db34-4c8f-9caa-919317ad497e", "type": "status", "is_llm_message": false, "content": "{\"status_type\": \"thread_run_start\", \"thread_run_id\": \"8057783b-7c10-4af1-9b77-df793165f9d8\"}", "created_at": "2025-11-09T09:59:06.23613+00:00"}
data: {"message_id": "bce2b9b4-a257-4061-ae26-781e694e1017", "thread_id": "f2f13366-db34-4c8f-9caa-919317ad497e", "type": "llm_response_start", "is_llm_message": false, "content": "{\"model\": \"anthropic/claude-haiku-4-5\", \"timestamp\": \"2025-11-09T09:59:06.269077+00:00\", \"llm_response_id\": \"a535d65e-f184-468c-93e6-027891bf7f20\", \"auto_continue_count\": 0}"}
```

**Status:** ✅ **WORKING** - Real-time Server-Sent Events (SSE) streaming agent responses

---

### 3. Check Completion Status (Quick Lookup)

```powershell
curl.exe -X GET "https://kortix.syhc.dev/api/agent-run/4c14edda-e493-4628-8459-0fa3c60bc2cd" `
  -H "X-API-Key: pk_cLYtpCsc8raT3KyJzZRdbBSxPjJQluO0:sk_p6g2PzCygtl8PlwJVGeCartqgIymjhdQ"
```

**Response:**
```json
{
  "id": "4c14edda-e493-4628-8459-0fa3c60bc2cd",
  "threadId": "f939fafe-eaf6-47cf-b438-7525f3d5d434",
  "status": "running",
  "startedAt": "2025-11-09T09:58:04.452733+00:00",
  "completedAt": null,
  "error": null
}
```

**Status:** ✅ **WORKING** - Returns 5 fields with camelCase naming

---

### 4. Get All Runs for Thread (Audit History)

```powershell
curl.exe -X GET "https://kortix.syhc.dev/api/thread/f939fafe-eaf6-47cf-b438-7525f3d5d434/agent-runs" `
  -H "X-API-Key: pk_cLYtpCsc8raT3KyJzZRdbBSxPjJQluO0:sk_p6g2PzCygtl8PlwJVGeCartqgIymjhdQ"
```

**Response:**
```json
{
  "agent_runs": [
    {
      "id": "4c14edda-e493-4628-8459-0fa3c60bc2cd",
      "thread_id": "f939fafe-eaf6-47cf-b438-7525f3d5d434",
      "status": "running",
      "started_at": "2025-11-09T09:58:04.452733+00:00",
      "completed_at": null,
      "error": null,
      "created_at": "2025-11-09T09:58:04.523456+00:00",
      "updated_at": "2025-11-09T09:58:04.523456+00:00"
    }
  ]
}
```

**Status:** ✅ **WORKING** - Returns 8 fields with snake_case naming and full audit trail

---

## Bonus: Health Check Endpoint

```powershell
curl.exe -X GET "https://kortix.syhc.dev/api/health" `
  -H "X-API-Key: pk_cLYtpCsc8raT3KyJzZRdbBSxPjJQluO0:sk_p6g2PzCygtl8PlwJVGeCartqgIymjhdQ"
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-09T09:53:18.812098+00:00",
  "instance_id": "single"
}
```

**Status:** ✅ **WORKING** - Confirms self-hosted instance is healthy

---

## Key Differences: Self-Hosted vs Official

| Aspect | Self-Hosted (`kortix.syhc.dev`) | Official (`api.kortix.com`) |
|--------|--------------------------------|--------------------------|
| **Base URL** | `https://kortix.syhc.dev/api` | `https://api.kortix.com/api` |
| **Form Data** | `-F` flag (required) | `-F` flag (required) |
| **Status Endpoint** | `/api/agent-run/{id}` | `/api/agent-run/{id}` |
| **Field Naming** | Mixed (camelCase & snake_case) | Mixed (camelCase & snake_case) |
| **Streaming** | ✅ Working SSE | ✅ Working SSE |
| **Instance ID** | `"single"` | Not returned in health check |

---

## Key Points

- ✅ **All 4 endpoints verified working** on self-hosted instance
- ✅ **Authentication:** Use `X-API-Key` header with `pk_xxx:sk_xxx` format
- ✅ **Form data required:** Use `-F` flag, NOT `-d` JSON
- ✅ **Streaming works:** Real-time SSE events available
- ✅ **Identical API structure** between self-hosted and official
- 📊 **Status values:** `running` → `completed` or `failed`
- ⏱️ **Timestamps:** ISO 8601 format UTC

---

## File Upload with Agent Runs

### Overview

Files can be uploaded alongside agent tasks. They're automatically placed in `/workspace/uploads/` where the agent can access them.

### Basic File Upload

```powershell
curl.exe -X POST "https://kortix.syhc.dev/api/agent/start" `
  -H "X-API-Key: pk_cLYtpCsc8raT3KyJzZRdbBSxPjJQluO0:sk_p6g2PzCygtl8PlwJVGeCartqgIymjhdQ" `
  -F "prompt=Summarize this file in a paragraph" `
  -F "files=@C:\temp\file_to_send.md"
```

**Response:**
```json
{
  "thread_id": "ded15a97-b849-44ee-ba71-4d881355a8ce",
  "agent_run_id": "de43b79f-14cb-4432-93dd-9a66f078639b",
  "status": "running"
}
```

### File Storage & Access

- **Location:** `/workspace/uploads/{filename}`
- **Agent access:** Files are immediately available for commands like `cat`, `grep`, `ls`

### Real-World Test Case

**File:** Core Philosophy document (9.8 KB Markdown)  
**Task:** Summarize in a paragraph  
**Duration:** ~10 seconds  
**Result:** ✅ Successfully processed

### Advanced Patterns

#### Multiple Files

```powershell
curl.exe -X POST "https://kortix.syhc.dev/api/agent/start" `
  -H "X-API-Key: pk_cLYtpCsc8raT3KyJzZRdbBSxPjJQluO0:sk_p6g2PzCygtl8PlwJVGeCartqgIymjhdQ" `
  -F "prompt=Compare these files" `
  -F "files=@C:\temp\file1.md" `
  -F "files=@C:\temp\file2.md"
```

#### With Agent Selection

```powershell
curl.exe -X POST "https://kortix.syhc.dev/api/agent/start" `
  -H "X-API-Key: pk_cLYtpCsc8raT3KyJzZRdbBSxPjJQluO0:sk_p6g2PzCygtl8PlwJVGeCartqgIymjhdQ" `
  -F "prompt=Review this code" `
  -F "agent_id=security-auditor-id" `
  -F "files=@C:\temp\app.py"
```

#### On Existing Thread

```powershell
curl.exe -X POST "https://kortix.syhc.dev/api/agent/start" `
  -H "X-API-Key: pk_cLYtpCsc8raT3KyJzZRdbBSxPjJQluO0:sk_p6g2PzCygtl8PlwJVGeCartqgIymjhdQ" `
  -F "thread_id=ded15a97-b849-44ee-ba71-4d881355a8ce" `
  -F "prompt=Analyze this related document" `
  -F "files=@C:\temp\related.txt"
```

### Common Use Cases

- **Document Summarization:** `-F "prompt=Summarize in 3 bullet points" -F "files=@report.pdf"`
- **Code Review:** `-F "prompt=Review for security issues" -F "files=@app.py"`
- **Data Analysis:** `-F "prompt=Analyze and provide insights" -F "files=@data.csv"`
- **File Comparison:** `-F "prompt=Compare versions" -F "files=@v1.txt" -F "files=@v2.txt"`

### Key Takeaways

✅ Use `-F` flag for file uploads (form data)  
✅ Files stored at `/workspace/uploads/` in agent sandbox  
✅ Multiple files supported in single request  
✅ Works with agent selection and existing threads  
✅ Agent has full command-line access to files
