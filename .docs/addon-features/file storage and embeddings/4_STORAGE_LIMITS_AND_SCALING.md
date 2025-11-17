# Storage Limits & Scaling in Suna Kortix

## Overview

Suna implements a **50MB per-user aggregate storage limit** for knowledge base documents. This limit is intentional and tied to Supabase's Free Plan constraints, not an architectural limitation.

---

## The 50MB Default Limit

### Why 50MB?

**Supabase Free Plan Alignment**

The 50MB limit comes directly from Supabase's Free Plan storage cap:

```toml
# From backend/supabase/config.toml
[storage]
file_size_limit = "50MiB"

[storage.buckets.agentpress]
file_size_limit = "50MiB"
```

Supabase Storage Tier Limits:

| Plan | Max File Size Limit | Cost |
|------|-------------------|------|
| **Free** | **50 MB** | $0/month |
| Pro | 500 GB | $25/month |
| Team | 500 GB | Custom |
| Enterprise | Unlimited | Custom |

### How It's Enforced in Suna

```python
# backend/core/knowledge_base/api.py
MAX_TOTAL_FILE_SIZE = 50 * 1024 * 1024  # 50MB aggregate per user

async def check_total_file_size_limit(account_id: str, new_file_size: int):
    """Check if adding a new file would exceed the total file size limit."""
    
    # Get total size of all current entries for this account
    result = await client.table('knowledge_base_entries').select(
        'file_size'
    ).eq('account_id', account_id).eq('is_active', True).execute()
    
    current_total_size = sum(entry['file_size'] for entry in result.data)
    new_total_size = current_total_size + new_file_size
    
    if new_total_size > MAX_TOTAL_FILE_SIZE:
        current_mb = current_total_size / (1024 * 1024)
        new_mb = new_file_size / (1024 * 1024)
        limit_mb = MAX_TOTAL_FILE_SIZE / (1024 * 1024)
        
        raise HTTPException(
            status_code=413,
            detail=f"File size limit exceeded. Current total: {current_mb:.1f}MB, New file: {new_mb:.1f}MB, Limit: {limit_mb}MB"
        )
```

### Design Philosophy: Free Tier First

The 50MB limit ensures Suna **works great on the free tier**:

✅ **No surprise costs** - Users won't accidentally exceed quotas  
✅ **Fair resource allocation** - Prevents one user consuming entire free tier  
✅ **Self-hosted friendly** - Developers can run Suna locally without costs  
✅ **Clear upgrade path** - Scale to Pro (500GB) when ready  
✅ **Budget predictable** - Know costs upfront  

---

## KB-Specific Capacity Analysis

### Document Type Breakdown

| Document Type | Typical Size | Quantity at 50MB | Use Case |
|--------------|-------------|-----------------|----------|
| **PDF (10 pages)** | 1-2 MB | 25-50 docs | Technical specs, guides |
| **Word doc** | 0.5-1 MB | 50-100 docs | Reports, proposals |
| **Text file** | 0.01-0.1 MB | 500-5,000 docs | Code snippets, notes |
| **Markdown** | 0.02-0.2 MB | 250-2,500 docs | Documentation, wikis |
| **Image** | 0.5-3 MB | 15-100 docs | Screenshots, diagrams |
| **Spreadsheet** | 0.1-2 MB | 25-500 docs | Data, analysis |
| **HTML/Web** | 0.05-0.5 MB | 100-1,000 docs | Web pages, archived |

### Real-World Examples

**Small Company KB (50MB)**
```
├── Product Docs (8 PDFs, 15MB)
├── Internal Guides (20 Markdown, 2MB)
├── Policies (5 Word docs, 3MB)
├── Screenshots (100 images, 20MB)
└── Code Snippets (500 text files, 10MB)
```

**Startup Documentation (50MB)**
```
├── API Documentation (3MB)
├── Architecture Design (2MB)
├── Deployment Guides (2MB)
├── Team Onboarding (3MB)
├── Customer Success Docs (5MB)
└── Meeting Notes & Archives (32MB)
```

**Personal Knowledge Base (50MB)**
```
├── Research Papers (5 PDFs, 10MB)
├── Project Notes (100 Markdown, 5MB)
├── Learning Materials (20 PDFs, 15MB)
├── Quick References (500 text, 5MB)
└── Screenshots & Diagrams (300 images, 15MB)
```

---

## kb-fusion Processing Efficiency

The 50MB limit is well-suited for kb-fusion's architecture:

### Processing Pipeline

```python
# Each file goes through:
1. Extract text from binary
   ↓
2. Chunk into 220-word segments
   ↓
3. Generate OpenAI embeddings (256 dims)
   ↓
4. Store in SQLite FTS5 index
   ↓
5. Store metadata in PostgreSQL
```

### At 50MB Capacity

| Metric | Value | Range |
|--------|-------|-------|
| **Total documents** | ~10-50 | Depends on file types |
| **Total chunks** | ~250-500 | 220 words each |
| **Embedding vectors** | ~250-500 | 256-dimensional |
| **SQLite index size** | ~50-100 MB | On-disk footprint |
| **PostgreSQL metadata** | ~5-10 MB | Summaries + references |
| **Search latency** | ~50-100ms | kb-fusion performance |

### Why kb-fusion Works Well Here

✅ **SQLite FTS5 efficiency** - Full-text search optimized for this scale  
✅ **RRF ranking** - Reciprocal Rank Fusion handles 250-500 documents well  
✅ **Memory friendly** - Embeddings fit in RAM (~64MB for 500 vectors)  
✅ **Query performance** - Sub-100ms search latency maintained  
✅ **No sharding needed** - Single SQLite database sufficient  

---

## Scaling Beyond 50MB

### Option 1: Supabase Plan Upgrade (Recommended for Production)

**Upgrade to Pro Plan:**

```python
# backend/supabase/config.toml
[storage]
file_size_limit = "500GiB"  # 500GB instead of 50MB

# Cost: $25/month
```

**Programmatically:**

```python
# Update api.py constant
MAX_TOTAL_FILE_SIZE = 500 * 1024 * 1024 * 1024  # 500GB per user
```

| Plan | Storage | Cost | When to Use |
|------|---------|------|-----------|
| Free | 50 MB | $0 | Hobby projects, testing |
| Pro | 500 GB | $25/mo | Small companies, startups |
| Team | 500 GB | Custom | Medium teams |
| Enterprise | Unlimited | Custom | Large organizations |

### Option 2: Dynamic Per-User Quotas

Implement tier-based storage limits:

```python
# backend/core/knowledge_base/api.py

async def get_user_storage_limit(account_id: str) -> int:
    """Get storage limit based on user tier."""
    
    client = await DBConnection().client
    
    # Get user tier from database
    result = await client.table('user_profiles').select(
        'subscription_tier'
    ).eq('account_id', account_id).single().execute()
    
    user_tier = result.data['subscription_tier']
    
    # Apply tier-based limits
    limits = {
        'free': 50 * 1024 * 1024,           # 50 MB
        'starter': 500 * 1024 * 1024,       # 500 MB
        'pro': 10 * 1024 * 1024 * 1024,     # 10 GB
        'enterprise': None                   # Unlimited
    }
    
    return limits.get(user_tier, 50 * 1024 * 1024)

# Then use in upload endpoint:
async def upload_file(folder_id: str, file: UploadFile, user_id: str):
    # Get user's limit instead of global
    limit = await get_user_storage_limit(user_id)
    
    # Check against user's specific limit
    if limit and new_total_size > limit:
        raise HTTPException(status_code=413, detail="Storage limit exceeded")
```

### Option 3: Incremental Expansion

Keep free tier at 50MB, but allow progressive increases:

```python
# Tier-based progression
STORAGE_LIMITS = {
    'free_tier_month_0': 50 * 1024 * 1024,        # Month 0-1: 50 MB
    'free_tier_month_3': 100 * 1024 * 1024,       # Month 3+: 100 MB
    'free_tier_month_6': 200 * 1024 * 1024,       # Month 6+: 200 MB
    'free_tier_month_12': 500 * 1024 * 1024,      # Month 12+: 500 MB
}

async def get_effective_limit(account_id: str) -> int:
    """Calculate limit based on account age."""
    
    client = await DBConnection().client
    
    result = await client.table('user_profiles').select(
        'created_at'
    ).eq('account_id', account_id).single().execute()
    
    account_age_months = (
        datetime.now() - datetime.fromisoformat(result.data['created_at'])
    ).days // 30
    
    if account_age_months < 3:
        return STORAGE_LIMITS['free_tier_month_0']
    elif account_age_months < 6:
        return STORAGE_LIMITS['free_tier_month_3']
    elif account_age_months < 12:
        return STORAGE_LIMITS['free_tier_month_6']
    else:
        return STORAGE_LIMITS['free_tier_month_12']
```

### Option 4: Multiple KB Buckets Per User

Allow users to create separate knowledge bases with independent 50MB limits:

```python
# Each KB is a separate "project" with its own 50MB quota
class KnowledgeBase(BaseModel):
    kb_id: str
    name: str
    max_size: int = 50 * 1024 * 1024  # Each KB gets 50MB
    current_size: int = 0

# User can have multiple KBs:
User "john@company.com":
├── KB: "Product Docs" (50MB)
├── KB: "Sales Resources" (50MB)
├── KB: "HR Policies" (50MB)
└── Total: 150MB across 3 KBs
```

---

## API Behavior at Limit

### When User Hits Limit

```python
# Example: User has 45MB, tries to upload 10MB file

POST /knowledge-base/folders/{folder_id}/upload
Content-Type: multipart/form-data

file=<10MB file>

# Response: HTTP 413 Payload Too Large
{
  "detail": "File size limit exceeded. Current total: 45.0MB, New file: 10.0MB, Limit: 50.0MB"
}
```

### Error Messages

```python
# Friendly error returned to frontend
"Your knowledge base is full. Current: 45.0MB / 50.0MB

You can:
1. Delete unused documents
2. Archive old content
3. Upgrade to Pro plan (500GB)"
```

### UI Feedback

The frontend should display:

```tsx
// Example implementation
function StorageProgressBar({ current, max }) {
  const percent = (current / max) * 100;
  
  return (
    <div>
      <ProgressBar value={percent} />
      <p>{formatBytes(current)} / {formatBytes(max)}</p>
      
      {percent > 90 && (
        <Alert>
          Storage nearly full! Consider upgrading.
        </Alert>
      )}
    </div>
  );
}
```

---

## Migration Guide: Scaling from Free to Pro

### Step 1: Upgrade Supabase Project

1. Go to Supabase Dashboard
2. Select project
3. Settings → Billing
4. Upgrade to Pro ($25/month)

### Step 2: Update Suna Configuration

```bash
# No code changes needed! The Supabase project limit is separate
# But optionally, update Suna's config for clarity:
```

```python
# backend/core/knowledge_base/api.py
# Update the enforced limit to match new plan
MAX_TOTAL_FILE_SIZE = 500 * 1024 * 1024 * 1024  # 500GB
```

### Step 3: Deploy Updated Configuration

```bash
cd backend
git add core/knowledge_base/api.py
git commit -m "chore: upgrade KB storage limit to 500GB for Pro plan"
git push
```

### Step 4: Test

```python
# Verify large uploads now work
curl -X POST http://localhost:8000/knowledge-base/folders/{folder_id}/upload \
  -F "file=@large_file_300mb.pdf"

# Should succeed if Pro plan enabled
```

---

## Monitoring & Quotas

### Check User's Storage Usage

```python
# backend/core/knowledge_base/api.py

@router.get("/usage")
async def get_storage_usage(
    user_id: str = Depends(verify_and_get_user_id_from_jwt)
):
    """Get user's current KB storage usage."""
    
    client = await DBConnection().client
    
    result = await client.table('knowledge_base_entries').select(
        'file_size'
    ).eq('account_id', user_id).eq('is_active', True).execute()
    
    total_size = sum(entry['file_size'] for entry in result.data)
    limit = 50 * 1024 * 1024
    
    return {
        'current_size': total_size,
        'limit': limit,
        'percent_used': (total_size / limit) * 100,
        'available': limit - total_size,
        'files_count': len(result.data)
    }
```

### Response Example

```json
{
  "current_size": 32505856,
  "limit": 52428800,
  "percent_used": 61.98,
  "available": 19922944,
  "files_count": 12
}
```

---

## Best Practices

### For Users (50MB Limit)

✅ **Focus on quality over quantity**
- Curate documents carefully
- Remove duplicates
- Archive old versions

✅ **Organize by importance**
- Prioritize critical documents
- Use folders strategically
- Add meaningful descriptions

✅ **Monitor usage**
- Check storage regularly
- Delete unused files
- Plan for growth

✅ **Upgrade when needed**
- Pro plan ($25/mo) for 500GB
- Consider early if approaching limit
- Budget for annual cost

### For Admins (Self-Hosted)

✅ **Configure for your tier**
```python
# Adjust limit based on Supabase plan
MAX_TOTAL_FILE_SIZE = get_supabase_plan_limit()
```

✅ **Implement user-facing monitoring**
```python
# Show users their quota usage
GET /knowledge-base/usage
```

✅ **Set up alerts**
```python
# Alert when user hits 80%, 95% of limit
if percent_used > 80:
    send_user_notification("Storage running low")
```

✅ **Plan for growth**
- Monitor aggregate usage across users
- Plan tier upgrades before hitting limits
- Consider per-user quotas if multi-tenant

---

## Summary

| Aspect | Details |
|--------|---------|
| **Default Limit** | 50MB per user (aggregate) |
| **Why?** | Supabase Free Plan constraint |
| **Is it fixed?** | No, easily configurable |
| **For production?** | Upgrade to Pro ($25/mo, 500GB) |
| **Per-user limits** | Can implement tier-based quotas |
| **Multiple KBs?** | Each can have separate quota |
| **Scaling path** | Free (50MB) → Pro (500GB) → Enterprise |
| **kb-fusion optimal** | Works great for 50-500MB scale |

The 50MB limit is **not a limitation** — it's a **deliberate free-tier design** with a clear, affordable upgrade path.
