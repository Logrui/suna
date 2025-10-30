# File Storage & S3 Architecture in Suna Kortix

## Overview

Suna Kortix uses a **hybrid storage model**:
- **PostgreSQL** = Metadata, summaries, indexes
- **S3 (Supabase Storage)** = Binary files, documents, images

This separation provides optimal performance, cost, and scalability.

---

## What is S3 in Suna?

**S3 = Simple Storage Service** - the object storage protocol standard.

In Suna's context: **S3 is implemented via Supabase Storage**, which provides S3-compatible APIs for storing and retrieving binary files.

### Storage Architecture

```
Suna Application
       │
       ├──────────────────────────────┐
       │                              │
       ▼                              ▼
   PostgreSQL                    S3 (Supabase)
   (Metadata)                    (Binary Files)
   ├─ Filenames                  ├─ PDFs
   ├─ Summaries                  ├─ DOCX files
   ├─ S3 paths                   ├─ Images
   ├─ Embeddings                 ├─ Text files
   ├─ File metadata              └─ Video/Audio
   └─ Indexes
```

---

## File Processing Pipeline

### Complete Flow: From Upload to Storage

```
User Uploads PDF
       │
       ▼
┌────────────────────────────────────┐
│ Backend receives binary file       │
│ file_content = bytes (raw PDF)    │
└──────────┬─────────────────────────┘
           │
    ┌──────▼──────────────────────────┐
    │ PROCESS FILE (NOT STORED)       │
    │ 1. Extract text from PDF        │
    │    (using PyPDF2)               │
    │    PDF bytes → Plain text       │
    │    ↳ Discarded after use        │
    │                                 │
    │ 2. Generate LLM Summary         │
    │    (Try 3 models with fallback) │
    │    ↳ STORED in PostgreSQL       │
    └──────┬───────────────────────────┘
           │
    ┌──────▼───────────────────────────┐
    │ STORE ORIGINAL BINARY IN S3      │
    │ Path: knowledge-base/{folder}/{} │
    │        {entry}/{filename}        │
    │ Content: Exact copy of PDF       │
    │ ↳ STORED in S3 (preserved)      │
    └──────┬───────────────────────────┘
           │
    ┌──────▼───────────────────────────┐
    │ STORE METADATA IN POSTGRESQL    │
    │ • S3 path reference (string)    │
    │ • Filename                      │
    │ • File size                     │
    │ • MIME type                     │
    │ • LLM summary                   │
    │ ↳ STORED in PostgreSQL          │
    └──────┬───────────────────────────┘
           │
    ┌──────▼───────────────────────────┐
    │ INDEX WITH KB-FUSION (optional) │
    │ On first search only            │
    │ ↳ STORED in SQLite FTS5         │
    └─────────────────────────────────┘

STORAGE SUMMARY:
✅ Original PDF binary → S3 (preserved exactly)
✅ Extracted text → Memory (temporary, discarded)
✅ LLM summary → PostgreSQL (2-3 sentences)
✅ Metadata → PostgreSQL (references)
✅ Embeddings → SQLite FTS5 (for search)
```

---

## Binary Storage: Preserved or Processed?

**Answer: BOTH**

### Original Binary = Preserved Exactly

Files stored in S3 are **NOT converted or modified**:

```python
# Upload to S3
await client.storage.from_('file-uploads').upload(
    path="knowledge-base/folder_id/entry_id/document.pdf",
    file=file_content,           # ← Exact binary bytes
    file_options={"content-type": "application/pdf"}
)

# Retrieved from S3
file_bytes = await client.storage.from_('file-uploads').download(
    path="knowledge-base/folder_id/entry_id/document.pdf"
)
# ↑ Returns byte-for-byte identical content
```

### Processing = Temporary (Not Stored)

Text extraction is a one-time operation:

```python
# Extract text (temporary, discarded)
pdf_reader = PdfReader(io.BytesIO(file_content))
#                      └─ Binary PDF in memory
text_content = ""
for page in pdf_reader.pages:
    text_content += page.extract_text()
# ↑ Text extracted but NOT stored
# Used only to generate summary
```

---

## S3 Storage Structure

### Bucket Organization

```
Supabase Storage Buckets:
└── file-uploads/              ← Main bucket
    ├── knowledge-base/        ← KB documents
    │   ├── {account_id}/      ← Account isolation
    │   │   ├── {kb_folder_id}/
    │   │   │   ├── {entry_id_1}/
    │   │   │   │   ├── document.pdf       ← Original binary
    │   │   │   │   ├── research.docx      ← Original binary
    │   │   │   │   └── notes.txt          ← Original binary
    │   │   │   └── {entry_id_2}/
    │   │   │       └── whitepaper.pdf
    │   │   └── {thread_temp_kb}/  ← Temporary thread KB
    │   │       └── customer_order.pdf
    │
    ├── avatars/               ← User profile images
    │   ├── {user_id_1}/
    │   │   └── profile.jpg
    │   └── {user_id_2}/
    │       └── profile.jpg
    │
    └── images/                ← Uploaded images
        ├── {uuid_1}/
        │   └── screenshot.png
        └── {uuid_2}/
            └── diagram.jpg
```

### S3 Path Components

```
S3 Path: file-uploads/knowledge-base/kb_folder_123/entry_456/document.pdf
         └─ Bucket ─┘└─────────────── Object Key / Full Path ──────────┘

Breakdown:
├── file-uploads    = Bucket name
├── knowledge-base  = Document type
├── kb_folder_123   = Knowledge base folder ID
├── entry_456       = Entry ID (unique document)
└── document.pdf    = Actual filename
```

---

## Database Linkage

### PostgreSQL References S3

Files are linked via paths stored in PostgreSQL:

**File: `knowledge_base_entries` table**

```sql
CREATE TABLE knowledge_base_entries (
    entry_id UUID PRIMARY KEY,
    folder_id UUID NOT NULL,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,    -- ← S3 path reference
    file_size INT,
    mime_type TEXT,
    summary TEXT,               -- ← LLM summary
    metadata JSONB DEFAULT '{}', -- ← Additional metadata
    created_at TIMESTAMP
);

-- Example row:
{
    entry_id: "e1b2c3d4-5e6f-7g8h-9i0j-k1l2m3n4o5p6",
    folder_id: "f1a2b3c4-5d6e-7f8g-9h0i-j1k2l3m4n5o6",
    filename: "annual_report.pdf",
    file_path: "knowledge-base/f1a2b3c4/e1b2c3d4/annual_report.pdf",
    file_size: 2048576,
    mime_type: "application/pdf",
    summary: "This annual report details Q3 financial performance...",
    metadata: {
        thread_id: "abc123",         -- If thread KB
        is_thread_temp: false,       -- Temporary or permanent
        extracted_at: "2025-10-29..."
    }
}
```

### Data Retrieval Pattern

```
Need to access a file:
       │
       ▼
┌─────────────────────────────┐
│ Query PostgreSQL            │
│ SELECT file_path            │
│ FROM knowledge_base_entries │
│ WHERE entry_id = 'e1b2c3d4' │
└──────────┬──────────────────┘
           │ Returns: "knowledge-base/..."
           │
    ┌──────▼──────────────────┐
    │ Use path to download    │
    │ from S3                 │
    │                         │
    │ s3.download(file_path)  │
    └──────┬──────────────────┘
           │ Returns: original binary
           │
           ▼
    ┌──────────────────────┐
    │ Original file bytes  │
    │ Unchanged from       │
    │ original upload      │
    └──────────────────────┘
```

---

## S3 Operations in Suna

### Upload

```python
await client.storage.from_('file-uploads').upload(
    path="knowledge-base/folder_id/entry_id/file.pdf",
    file=binary_content,
    file_options={"content-type": "application/pdf"}
)
```

### Download

```python
file_bytes = await client.storage.from_('file-uploads').download(
    path="knowledge-base/folder_id/entry_id/file.pdf"
)
```

### Delete

```python
await client.storage.from_('file-uploads').remove(
    paths=["knowledge-base/folder_id/entry_id/file.pdf"]
)
```

### List Files

```python
files = await client.storage.from_('file-uploads').list(
    path="knowledge-base/folder_id"
)

for file in files:
    print(file.name, file.size, file.updated_at)
```

### Get Public URL

```python
public_url = client.storage.from_('file-uploads').get_public_url(
    path="knowledge-base/folder_id/entry_id/file.pdf"
)
# Returns: "https://your-project.supabase.co/storage/v1/object/public/..."
```

---

## S3 vs Database Storage

### When to Use Each

| Data Type | Best Storage | Reason |
|-----------|--------------|--------|
| **Large binaries** | S3 | Cheap per GB, scalable |
| **Text files** | S3 | Preserve original |
| **Images** | S3 | Efficient, CDN-accessible |
| **Metadata** | PostgreSQL | Fast queries, indexed |
| **Summaries** | PostgreSQL | Small size, searchable |
| **Embeddings** | PostgreSQL/SQLite | Required for indexing |
| **Structured data** | PostgreSQL | SQL queries needed |

### Storage Comparison

| Aspect | S3 | PostgreSQL |
|--------|----|-----------| 
| **Best for** | Large binary files | Structured data, indexes |
| **Cost** | $0.023/GB/month | $150-500/month (large) |
| **Speed** | ~100-200ms latency | Sub-millisecond |
| **Query** | Path-based only | Full SQL |
| **Limit** | Unlimited | Practical: 1GB+ = slow |
| **Use in Suna** | PDFs, images, binaries | Metadata, summaries, configs |

---

## Thread-Level Knowledge Base Storage

### Same Infrastructure, Scoped Access

Thread KBs use the **same S3 and PostgreSQL infrastructure** as global KBs, but with thread-level scoping:

```
Thread KB File Path:
s3://file-uploads/knowledge-base/{thread_temp_kb_folder_id}/
                  {entry_id}/{filename}

PostgreSQL Reference:
knowledge_base_entries.metadata:
├── thread_id: "abc123"    ← Links to thread
└── is_thread_temp: true   ← Marks as temporary
```

### Storage Locations for Thread KB

| Component | Location | Details |
|-----------|----------|---------|
| **File Content** | S3 | Same `knowledge-base/` path |
| **Metadata** | PostgreSQL | Same table, different folder ID |
| **KB Index** | SQLite FTS5 | Local to thread's KB folder |
| **Thread Link** | PostgreSQL `threads.metadata` | `attached_kb_folder_id` |

---

## Supabase Storage Details

### Authentication

```python
# S3 operations require authentication
# Uses SUPABASE_KEY
client.storage.from_('file-uploads').upload(...)
# ✅ Authenticated (requires valid JWT)
```

### Access Levels

```
Public Access:
├─ Anyone can read with public URL
└─ Use: Public documents, avatars

Private Access:
├─ Only authenticated users can read
└─ Use: Knowledge base, user documents

Row-Level Security (RLS):
├─ Users see only their own files
└─ Enforced by account_id isolation
```

### Account Isolation

```python
# Knowledge base paths include account_id for isolation
s3_path = f"knowledge-base/{account_id}/{folder_id}/{entry_id}/{filename}"
#                          └─────────────┘
#                        Account isolation
```

---

## Key Differences: Suna's Approach

### What Gets Stored Where

```
PRESERVED IN S3:
✅ Original PDF binary (exact copy)
✅ Original DOCX binary (exact copy)
✅ Original image files (exact copy)
✅ Original text files (exact copy)

EXTRACTED & STORED IN DATABASE:
✅ LLM summary (2-3 sentences)
✅ File metadata (size, type, name)
✅ S3 path reference (string)

TEMPORARY (NOT STORED):
❌ Extracted text from PDF
❌ Parsed DOCX content
❌ Intermediate processing
```

### Why This Design?

```
Benefit 1: ORIGINAL PRESERVATION
├─ Can re-extract if summarization changes
├─ Can swap embedding providers
└─ Audit trail: original document preserved

Benefit 2: EFFICIENT DATABASE
├─ Store summary (small), not raw text (large)
├─ Store references (string), not binary
└─ Keep database focused on metadata/indexes

Benefit 3: COST EFFECTIVE
├─ S3 cheap for binary archival
├─ PostgreSQL for fast queries
├─ SQLite for semantic index

Benefit 4: SCALABILITY
├─ Unlimited S3 storage
├─ Database stays manageable
└─ Can retrieve original anytime
```

---

## Configuration

### Environment Variables

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-key

# AWS S3 Direct (optional, if not using Supabase)
AWS_S3_BUCKET=suna-files
AWS_S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

---

## Summary

✅ **S3 = Supabase Storage** - Cloud object storage

✅ **Binary files are preserved** - Stored exactly as uploaded

✅ **Processed data is temporary** - Not stored (except summaries)

✅ **Summaries stored in DB** - Fast retrieval, small size

✅ **Original binaries in S3** - Safe for re-processing

✅ **Database stores references** - S3 paths as strings

✅ **Account scoped** - Isolation via account_id

✅ **Cost efficient** - S3 for binaries, DB for metadata
