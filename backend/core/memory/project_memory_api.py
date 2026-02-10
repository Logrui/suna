"""
Project Memory API — REST endpoints for managing project-scoped memories.

Mounted at /projects/{project_id}/memories
"""

from fastapi import APIRouter, HTTPException, Depends, Query, Path
from typing import Optional, List
from pydantic import BaseModel
from core.utils.auth_utils import verify_and_get_user_id_from_jwt
from core.utils.logger import logger
from core.services.supabase import DBConnection
from .project_memory_service import project_memory_service
from .models import MemoryType

router = APIRouter(prefix="/projects/{project_id}/memories", tags=["project-memories"])
db = DBConnection()


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class ProjectMemoryResponse(BaseModel):
    memory_id: str
    project_id: str
    content: str
    memory_type: str
    confidence_score: float
    source_thread_id: Optional[str] = None
    metadata: dict = {}
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ProjectMemoryListResponse(BaseModel):
    memories: List[ProjectMemoryResponse]
    total: int
    page: int
    limit: int
    pages: int


class CreateProjectMemoryRequest(BaseModel):
    content: str
    memory_type: str = "fact"
    confidence_score: float = 1.0
    metadata: dict = {}


class UpdateProjectMemoryRequest(BaseModel):
    content: Optional[str] = None
    memory_type: Optional[str] = None
    metadata: Optional[dict] = None


class ProjectMemoryStatsResponse(BaseModel):
    total_memories: int
    memories_by_type: dict
    oldest_memory: Optional[str] = None
    newest_memory: Optional[str] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _verify_project_ownership(user_id: str, project_id: str):
    """Verify that user_id owns the project (via account membership)."""
    await db.initialize()
    client = await db.client

    result = (
        await client.table("projects")
        .select("account_id")
        .eq("project_id", project_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Project not found")

    account_id = result.data[0]["account_id"]

    # Check if user is the primary owner or a member of the account
    owner_result = (
        await client.table("basejump.accounts")
        .select("id")
        .eq("id", account_id)
        .eq("primary_owner_user_id", user_id)
        .execute()
    )
    if owner_result.data:
        return account_id

    member_result = (
        await client.table("basejump.account_user")
        .select("account_id")
        .eq("account_id", account_id)
        .eq("user_id", user_id)
        .execute()
    )
    if member_result.data:
        return account_id

    raise HTTPException(status_code=403, detail="Access denied to this project")


def _to_response(item) -> ProjectMemoryResponse:
    return ProjectMemoryResponse(
        memory_id=item.memory_id,
        project_id=item.project_id,
        content=item.content,
        memory_type=item.memory_type.value if isinstance(item.memory_type, MemoryType) else item.memory_type,
        confidence_score=item.confidence_score,
        source_thread_id=item.source_thread_id,
        metadata=item.metadata or {},
        created_at=str(item.created_at) if item.created_at else None,
        updated_at=str(item.updated_at) if item.updated_at else None,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=ProjectMemoryListResponse)
async def list_project_memories(
    project_id: str = Path(...),
    user_id: str = Depends(verify_and_get_user_id_from_jwt),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    memory_type: Optional[str] = Query(None),
):
    """List memories for a project (paginated)."""
    account_id = await _verify_project_ownership(user_id, project_id)

    offset = (page - 1) * limit
    memories, total = await project_memory_service.list_memories(
        account_id=account_id,
        project_id=project_id,
        limit=limit,
        offset=offset,
        memory_type=memory_type,
    )

    pages = max(1, (total + limit - 1) // limit)

    return ProjectMemoryListResponse(
        memories=[_to_response(m) for m in memories],
        total=total,
        page=page,
        limit=limit,
        pages=pages,
    )


@router.post("", response_model=ProjectMemoryResponse, status_code=201)
async def create_project_memory(
    body: CreateProjectMemoryRequest,
    project_id: str = Path(...),
    user_id: str = Depends(verify_and_get_user_id_from_jwt),
):
    """Create a new project memory."""
    account_id = await _verify_project_ownership(user_id, project_id)

    # Validate memory_type
    try:
        MemoryType(body.memory_type)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid memory_type '{body.memory_type}'. Must be one of: {[t.value for t in MemoryType]}",
        )

    memory = await project_memory_service.create_memory(
        account_id=account_id,
        project_id=project_id,
        content=body.content,
        memory_type=body.memory_type,
        confidence_score=body.confidence_score,
        metadata=body.metadata,
    )

    return _to_response(memory)


@router.get("/stats", response_model=ProjectMemoryStatsResponse)
async def get_project_memory_stats(
    project_id: str = Path(...),
    user_id: str = Depends(verify_and_get_user_id_from_jwt),
):
    """Get statistics about project memories."""
    account_id = await _verify_project_ownership(user_id, project_id)
    stats = await project_memory_service.get_stats(account_id, project_id)
    return ProjectMemoryStatsResponse(**stats)


@router.get("/{memory_id}", response_model=ProjectMemoryResponse)
async def get_project_memory(
    project_id: str = Path(...),
    memory_id: str = Path(...),
    user_id: str = Depends(verify_and_get_user_id_from_jwt),
):
    """Get a single project memory."""
    account_id = await _verify_project_ownership(user_id, project_id)

    memory = await project_memory_service.get_memory(account_id, project_id, memory_id)
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")

    return _to_response(memory)


@router.put("/{memory_id}", response_model=ProjectMemoryResponse)
async def update_project_memory(
    body: UpdateProjectMemoryRequest,
    project_id: str = Path(...),
    memory_id: str = Path(...),
    user_id: str = Depends(verify_and_get_user_id_from_jwt),
):
    """Update a project memory."""
    account_id = await _verify_project_ownership(user_id, project_id)

    if body.memory_type is not None:
        try:
            MemoryType(body.memory_type)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid memory_type '{body.memory_type}'. Must be one of: {[t.value for t in MemoryType]}",
            )

    memory = await project_memory_service.update_memory(
        account_id=account_id,
        project_id=project_id,
        memory_id=memory_id,
        content=body.content,
        memory_type=body.memory_type,
        metadata=body.metadata,
    )

    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")

    return _to_response(memory)


@router.delete("/{memory_id}")
async def delete_project_memory(
    project_id: str = Path(...),
    memory_id: str = Path(...),
    user_id: str = Depends(verify_and_get_user_id_from_jwt),
):
    """Delete a single project memory."""
    account_id = await _verify_project_ownership(user_id, project_id)

    deleted = await project_memory_service.delete_memory(account_id, project_id, memory_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Memory not found")

    return {"status": "deleted", "memory_id": memory_id}


@router.delete("")
async def delete_all_project_memories(
    project_id: str = Path(...),
    user_id: str = Depends(verify_and_get_user_id_from_jwt),
    confirm: bool = Query(False),
):
    """Delete all memories for a project."""
    if not confirm:
        raise HTTPException(status_code=400, detail="Must pass confirm=true to delete all memories")

    account_id = await _verify_project_ownership(user_id, project_id)

    await project_memory_service.delete_all_memories(account_id, project_id)
    return {"status": "deleted", "project_id": project_id}
