# Suna Deployment & Image Publishing Automation Analysis

**Document Version:** 1.0  
**Date:** October 31, 2025  
**Status:** ✅ **Complete Analysis**  
**Scope:** GitHub Actions CI/CD, Docker image publishing, Daytona snapshot automation

---

## 🎯 Summary

**Q: Does the repo have automated image/snapshot publishing?**

**A: Partially. Here's what exists:**

| Component | Automated | Manual | Notes |
|-----------|-----------|--------|-------|
| **Backend/Frontend Docker build** | ✅ Yes (GitHub Actions) | - | Builds on push to main/PRODUCTION |
| **Push to GitHub Container Registry** | ✅ Yes (GitHub Actions) | - | Published to `ghcr.io` automatically |
| **Docker Hub publishing** | ❌ No | ✅ Required | Must do manually (which you just did!) |
| **Daytona snapshot creation** | ❌ No | ✅ Required | Manual via Daytona dashboard |
| **Local docker compose build** | ❌ No | ✅ Required | Manual: `docker compose build` |

**For your question about `docker compose up`:**
- ✗ No, running `docker compose up` does **NOT** automatically publish images
- ✓ It only builds locally and runs containers locally
- The automated publishing happens in GitHub Actions on pushes

---

## 📊 **Architecture: What Happens When**

```
┌─────────────────────────────────────────────────────────────────┐
│ GITHUB ACTIONS AUTOMATION (Trigger: push to main or PRODUCTION)  │
└─────────────────────────────────────────────────────────────────┘

Push to main branch
        │
        ▼
.github/workflows/docker-build.yml triggered
        │
        ├─ Build backend image
        ├─ Push to ghcr.io/suna-ai/suna-backend:latest
        ├─ Deploy to staging servers (if main branch)
        └─ Update ECS services (if PRODUCTION branch)

Push to PRODUCTION branch
        │
        ▼
Same as above PLUS:
        ├─ Deploy to production ECS cluster
        └─ Update live services


┌─────────────────────────────────────────────────────────────────┐
│ LOCAL DEVELOPMENT (Your machine)                                │
└─────────────────────────────────────────────────────────────────┘

docker compose up -d
        │
        ├─ Builds images locally (if not exists)
        ├─ Runs containers on your machine
        ├─ Does NOT push anywhere
        └─ Accessible at localhost:3000 and localhost:8000
```

---

## 🔍 **What's Currently Automated**

### **1. GitHub Actions: docker-build.yml**

**Triggers:**
- Push to `main` branch → Deploy to staging
- Push to `PRODUCTION` branch → Deploy to production
- Manual workflow dispatch
- Repository dispatch from `update-PROD.yml`

**What it does:**
```yaml
jobs:
  build-and-push:
    ├─ Checkout code
    ├─ Setup Docker Buildx (multi-platform support)
    ├─ Login to GitHub Container Registry (ghcr.io)
    ├─ Build backend image
    │   └─ Push to: ghcr.io/suna-ai/suna-backend:latest
    │            or ghcr.io/suna-ai/suna-backend:prod
    ├─ Deploy to staging (if main)
    │   ├─ SSH into staging server
    │   ├─ Git pull latest
    │   ├─ docker compose build
    │   └─ docker compose up -d
    └─ Deploy to production (if PRODUCTION)
        ├─ Configure AWS credentials
        ├─ Update ECS services
        └─ Force new deployment
```

**Image destinations:**
- Staging: `ghcr.io/suna-ai/suna-backend:latest`
- Production: `ghcr.io/suna-ai/suna-backend:prod`

### **2. GitHub Actions: update-PROD.yml**

**Trigger:**
- Manual workflow dispatch (on demand)

**What it does:**
```yaml
├─ Checkout PRODUCTION branch
├─ Rebase onto main
├─ Force push PRODUCTION
└─ Trigger docker-build.yml
    └─ Which then deploys to production
```

### **3. Setup Wizard: setup.py**

**What it does:**
- Collects Daytona API key
- **Prints instructions** for creating snapshot manually
- **Does NOT automate** snapshot creation

**Relevant code:**
```python
def collect_daytona_info(self):
    # Collects API key
    # Sets defaults (DAYTONA_SERVER_URL, DAYTONA_TARGET)
    
    print_warning(
        "IMPORTANT: You must create a Suna snapshot in Daytona for it to work properly."
    )
    print_info("Visit https://app.daytona.io/dashboard/snapshots")
    print_info("Create a snapshot with these exact settings:")
    print_info("   - Name: kortix/suna:0.1.3.23")
    # Waits for user to manually create it
    input("Press Enter to continue once you have created the snapshot...")
```

---

## ❌ **What's NOT Automated**

### **1. Sandbox Image to Docker Hub**

**Currently:**
- ✗ No workflow publishes sandbox image to Docker Hub
- ✗ Must be done manually (which you just did!)

**Location:**
- Source: `backend/core/sandbox/docker/Dockerfile`
- Built locally: `docker compose build`
- Pushed manually: `docker push notlogrui/suna:0.1.3.23`

### **2. Daytona Snapshot Creation**

**Currently:**
- ✗ No API integration with Daytona
- ✗ Must be created manually in dashboard
- ✗ No validation that snapshot exists

**Process:**
1. Build Docker image locally or in CI/CD
2. Push to registry (manual or CI/CD)
3. **Manually go to Daytona dashboard**
4. Create snapshot pointing to image
5. Publish

### **3. Daytona Snapshot Versioning**

**Currently:**
- ✗ No tracking of snapshot versions
- ✗ No CI/CD integration
- Manual updates required to:
  - `config.py` (SANDBOX_SNAPSHOT_NAME)
  - `docker-compose.yml` (image)
  - Daytona dashboard

---

## 🏗️ **Full Docker Image Publishing Pipeline**

```
┌──────────────────────────────────────────────────────────────┐
│ MAIN APPLICATION IMAGES (Backend/Frontend)                   │
└──────────────────────────────────────────────────────────────┘

Source Code in GitHub
        │ (push to main or PRODUCTION)
        ▼
GitHub Actions: docker-build.yml
        │
        ├─ docker build ./backend
        ├─ docker build ./frontend (in main docker-compose)
        │
        ▼
GitHub Container Registry (ghcr.io)
        │
        ├─ ghcr.io/suna-ai/suna-backend:latest (from main)
        ├─ ghcr.io/suna-ai/suna-backend:prod (from PRODUCTION)
        └─ ghcr.io/suna-ai/suna-frontend (frontend, in compose)
        │
        ▼
Deployed to:
        ├─ Staging servers (SSH deployment)
        ├─ Production ECS cluster (AWS)
        └─ Local docker compose (uses pre-built images)


┌──────────────────────────────────────────────────────────────┐
│ SANDBOX IMAGE (Agents execution environment)                 │
└──────────────────────────────────────────────────────────────┘

Dockerfile in backend/core/sandbox/docker/
        │
        ▼ (manual: docker compose build)
Local Docker build
        │
        ├─ Image: kortix/suna:0.1.3.23 (initial)
        ├─ Image: notlogrui/suna:0.1.3.23 (retagged)
        │
        ▼ (manual: docker push)
Docker Hub
        │
        ├─ docker.io/notlogrui/suna:0.1.3.23
        │
        ▼ (manual: Daytona dashboard)
Daytona Snapshot
        │
        └─ notlogrui/suna:0.1.3.23 (snapshot)
            ↓
        Used by agents when creating sandboxes
```

---

## 🚀 **Opportunities for Automation**

### **Option 1: Automate Sandbox Image Publishing (Medium Effort)**

Add GitHub Actions workflow to build and push sandbox image:

```yaml
name: Build and Publish Sandbox Image

on:
  push:
    paths:
      - 'backend/core/sandbox/docker/**'
      - '.github/workflows/sandbox-build.yml'
  workflow_dispatch:

jobs:
  build-sandbox:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_TOKEN }}
      - uses: docker/build-push-action@v5
        with:
          context: backend/core/sandbox/docker
          push: true
          tags: notlogrui/suna:0.1.3.23
```

**Benefits:**
- ✓ Automatic updates when dockerfile changes
- ✓ Always in sync with repository
- ✓ No manual push required

### **Option 2: Automate Daytona Snapshot Creation (High Effort)**

Use Daytona API to create snapshots programmatically:

```python
import requests

def create_daytona_snapshot():
    """Create snapshot in Daytona via API"""
    headers = {
        "Authorization": f"Bearer {DAYTONA_API_KEY}"
    }
    
    payload = {
        "name": "notlogrui/suna:0.1.3.23",
        "image_url": "docker.io/notlogrui/suna:0.1.3.23",
        # ... other config
    }
    
    response = requests.post(
        f"{DAYTONA_SERVER_URL}/snapshots",
        json=payload,
        headers=headers
    )
    return response.json()
```

**Benefits:**
- ✓ Fully automated pipeline
- ✓ No manual Daytona dashboard access
- ✓ Can be triggered after image push

**Challenges:**
- ✗ Daytona API may not support snapshot creation
- ✗ Would need to verify API availability
- ✗ More complex error handling

### **Option 3: Version Tracking (Low Effort)**

Track sandbox version in config and auto-update:

```python
# config.py
SANDBOX_VERSION = "0.1.3.23"
SANDBOX_USERNAME = "notlogrui"
SANDBOX_IMAGE_NAME = f"{SANDBOX_USERNAME}/suna:{SANDBOX_VERSION}"
SANDBOX_SNAPSHOT_NAME = f"{SANDBOX_USERNAME}/suna:{SANDBOX_VERSION}"
```

**Benefits:**
- ✓ Single source of truth
- ✓ Easy version bumps
- ✓ Less manual updates

---

## 📋 **Current State: What You Need to Do**

### **For Your Suna Setup**

**What's automatic:**
- ✓ Backend/frontend build on push (GitHub Actions)
- ✓ Push to ghcr.io (GitHub Actions)
- ✓ Staging/production deployment (GitHub Actions)

**What's manual:**
1. Build sandbox image: `docker compose build` (you did this ✓)
2. Push to Docker Hub: `docker push notlogrui/suna:0.1.3.23` (you did this ✓)
3. Create Daytona snapshot: Go to dashboard and create (you need to do this next)

**What's NOT involved:**
- ✗ `docker compose up` doesn't publish anything
- ✗ `docker compose up` only builds and runs locally
- ✗ Local sandbox image is NOT automatically published

---

## 🔄 **Workflow Summary**

### **Development Workflow**

```
1. Edit code
2. Push to main/PRODUCTION
3. GitHub Actions automatically:
   ├─ Builds backend image
   ├─ Pushes to ghcr.io
   ├─ Deploys to staging or production
   └─ Updates ECS services
4. You verify it works
```

### **Sandbox Updates Workflow**

```
1. Edit backend/core/sandbox/docker/Dockerfile
2. Build locally: docker compose build
3. Retag: docker tag kortix/suna:X notlogrui/suna:X
4. Push manually: docker push notlogrui/suna:X
5. Create snapshot in Daytona dashboard
6. Update config.py (if version changed)
7. Push config.py update to GitHub
8. GitHub Actions redeploys with new config
```

---

## ✅ **Next Action for You**

The **only remaining manual step** is:

```
1. Go to https://app.daytona.io/dashboard/snapshots
2. Create snapshot: notlogrui/suna:0.1.3.23
3. Point to: docker.io/notlogrui/suna:0.1.3.23
4. Publish
5. Test agent creation
```

After that, agents should work!

---

**Status:** ✅ Analysis complete  
**Automation Level:** Medium (main app automated, sandbox manual)  
**Next Step:** Create Daytona snapshot for your pushed image
