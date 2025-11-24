# Suna Kortix File Upload & Processing Architecture

This document outlines the architecture, flow, and error handling for file uploads, image processing, and document viewing within Suna Kortix.

## 1. File Structure Map

Key components involved in file handling:

```
D:\Homelab\suna\
├── frontend\src\components\thread\tool-views\
│   ├── UploadFileToolView.tsx       # UI for generic file uploads
│   └── see-image-tool\              # UI for image viewing (Vision)
├── backend\core\tools\
│   ├── sb_upload_file_tool.py       # Backend: Secure file upload to Supabase
│   ├── sb_vision_tool.py            # Backend: Image compression & LLM context injection
│   ├── sb_document_parser.py        # Backend: Document text extraction (Chunkr AI)
│   └── sb_files_tool.py             # Backend: Standard filesystem operations
└── backend\core\sandbox\            # Sandbox environment where files originate
```

## 2. File Upload Flow (Generic)

This flow is used when an agent or user wants to persist a file from the sandbox to secure cloud storage.

**Tool:** `upload_file` (`SandboxUploadFileTool`)

1.  **Trigger:** Agent calls `upload_file(file_path)`.
2.  **Read:** Tool reads the file from the Daytona Sandbox (`/workspace/...`).
3.  **Validation:**
    *   File must exist.
    *   Size limit: **50MB**.
4.  **Storage:**
    *   File is uploaded to **Supabase Storage** (Bucket: `file-uploads`).
    *   Path: `{account_id}\{filename}_{timestamp}_{uuid}.{ext}`.
5.  **Security:**
    *   A **Signed URL** (valid for 24 hours) is generated.
    *   Upload metadata is logged to the `file_uploads` database table.
6.  **Response:** Returns a success message with the secure link to the agent.

### UI "Failed" State
The frontend (`UploadFileToolView.tsx`) parses the tool's *text output*.
*   **Condition:** If the output string contains the words "error" or "failed" (case-insensitive).
*   **Result:** UI displays "Upload Failed" badge, even if the HTTP request was successful (200 OK).

**Common Failure Causes:**
*   File larger than 50MB.
*   File path incorrect/not found in sandbox.
*   Supabase Storage connection or permission errors.

## 3. Image Viewing Flow (Vision / Multimodal)

This flow is used when an agent needs to "see" an image to analyze it.

**Tool:** `load_image` (`SandboxVisionTool`)

1.  **Trigger:** Agent calls `load_image(file_path)`.
2.  **Acquisition:**
    *   **Local:** Reads file from Sandbox.
    *   **Remote:** Downloads file from URL.
3.  **Processing & Compression:**
    *   **SVG:** Converted to PNG (via Sandbox Browser API or fallback `svglib`).
    *   **Resize:** Max dimensions **1920x1080**.
    *   **Format:** Converted to JPEG, PNG, GIF, or WebP.
    *   **Compression:** Quality 85 (JPEG) or Level 6 (PNG).
4.  **Validation:**
    *   Max Original Size: **10MB**.
    *   Max Compressed Size: **5MB**.
    *   Format Check: Must be supported by LLM (JPEG, PNG, GIF, WEBP).
5.  **Storage:**
    *   Processed image uploaded to **Supabase Storage** (Bucket: `image-uploads`).
    *   **Public URL** generated (required for LLM API access).
6.  **Context Injection (Multimodal):**
    *   A special message type `image_context` is injected into the thread.
    *   **Content:**
        ```json
        {
          "role": "user",
          "content": [
            {"type": "text", "text": "[Image loaded from 'path']"},
            {"type": "image_url", "image_url": {"url": "https://supabase.../image.jpg"}}
          ]
        }
        ```
    *   **Limit:** Hard limit of **3 images** in active context.

**Agent Interaction:**
*   The agent does *not* see raw bytes or text.
*   The agent receives the image natively via the LLM provider's **Vision API** (e.g., OpenAI/Anthropic multimodal endpoints).

## 4. Document Viewing Flow (Text Extraction)

This flow is used for PDFs, DOCX, etc., where "vision" is less effective than reading the text.

**Tool:** `parse_document` (`SandboxDocumentParserTool`)

1.  **Trigger:** Agent calls `parse_document(url)`.
2.  **Processing:**
    *   URL is sent to **Chunkr AI** service.
3.  **Extraction:**
    *   Service extracts text, structure (headings), and tables.
4.  **Context Injection:**
    *   The *text content* and structured summary are returned as the tool output.
    *   The agent "reads" the document as plain text in the conversation history.

## 5. Summary of Agent Capabilities

| File Type | Primary Method | Tool Used | How Agent "Sees" It |
| :--- | :--- | :--- | :--- |
| **Code / Text** | Read File | `read_file` | Raw text content |
| **Images** | Vision | `load_image` | Native Multimodal (Visual) |
| **PDF / Docs** | Parsing | `parse_document` | Extracted Text & Structure |
| **Any File** | Persistence | `upload_file` | Secure Download Link (Agent cannot see content, only link) |

## 6. Knowledge Base File Upload & Processing

This process describes how files are ingested into the permanent Knowledge Base (KB) for RAG (Retrieval-Augmented Generation).

**Endpoint:** `POST /api/knowledge-base/folders/{folder_id}/upload`

### 6.1. Upload Flow
1.  **Validation:**
    *   Checks file size (Max **50MB**).
    *   Checks total account storage limit (**100GB**).
    *   Validates and sanitizes filename (removes emojis, special chars).
    *   Checks for filename conflicts in target folder.
2.  **Storage:**
    *   Uploads raw file to **Supabase Storage** bucket `file-uploads`.
    *   Path: `knowledge-base/{folder_id}/{entry_id}/{sanitized_filename}`.
3.  **Processing (LLM):**
    *   **Text Extraction:** Extracts text from PDF, DOCX, TXT, MD, JSON, CSV, etc. (using `PyPDF2`, `python-docx`).
    *   **Smart Chunking:** If content > 1M tokens, chunks intelligently (Head + Key Middle Sections + Tail).
    *   **Summarization:** Calls LLM to generate a 2-3 sentence summary.
        *   **Priority 1:** `google/gemini-2.5-flash-lite` (1M context).
        *   **Priority 2:** `openrouter/google/gemini-2.5-flash-lite` (Fallback).
        *   **Priority 3:** `openai/gpt-5-mini` (400k context - Final Fallback).
    *   **Fallback:** If all LLMs fail, generates a static metadata summary (size, lines, type).
4.  **Persistence:**
    *   Saves entry to `knowledge_base_entries` table with:
        *   `file_path` (S3 reference)
        *   `summary` (LLM generated)
        *   `mime_type`
        *   `file_size`

### 6.2. Agent Interaction (RAG)
Agents do **not** see the full file content immediately.
1.  **Search:** Agent queries the KB.
2.  **Retrieval:** System matches query against **Summaries** and **Filenames**.
3.  **Context Injection:**
    *   If a match is found, the **Summary** and **Filename** are injected into context.
    *   Agent can then choose to:
        *   Read the full file (using `read_file` if it knows the path, though KB paths are abstracted).
        *   Use the summary to answer the user.

```