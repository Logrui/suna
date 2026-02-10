"""
Project Memory Service — CRUD + semantic search for project-scoped memories.

Follows the same patterns as retrieval_service.py but scoped to a specific project.
"""

from typing import List, Dict, Any, Optional, Tuple
from core.utils.logger import logger
from core.utils.cache import Cache
from core.services.supabase import DBConnection
from .embedding_service import EmbeddingService
from .models import ProjectMemoryItem, MemoryType


class ProjectMemoryService:
    def __init__(self):
        self.embedding_service = EmbeddingService()
        self.db = DBConnection()
        self.cache_ttl = 60

    # -------------------------------------------------------------------------
    # CREATE
    # -------------------------------------------------------------------------
    async def create_memory(
        self,
        account_id: str,
        project_id: str,
        content: str,
        memory_type: str = "fact",
        confidence_score: float = 1.0,
        source_thread_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> ProjectMemoryItem:
        try:
            await self.db.initialize()
            client = await self.db.client

            # Generate embedding for semantic search
            embedding = None
            try:
                embedding = await self.embedding_service.embed_text(content)
            except Exception as e:
                logger.warning(f"Failed to generate embedding for project memory: {e}")

            row = {
                "account_id": account_id,
                "project_id": project_id,
                "content": content,
                "memory_type": memory_type,
                "confidence_score": confidence_score,
                "metadata": metadata or {},
            }
            if embedding:
                row["embedding"] = embedding
            if source_thread_id:
                row["source_thread_id"] = source_thread_id

            result = await client.table("user_project_memories").insert(row).execute()

            if not result.data:
                raise ValueError("Insert returned no data")

            created = result.data[0]
            await self._invalidate_cache(account_id, project_id)

            return ProjectMemoryItem(
                memory_id=created["memory_id"],
                account_id=account_id,
                project_id=project_id,
                content=created["content"],
                memory_type=MemoryType(created["memory_type"]),
                confidence_score=created["confidence_score"],
                source_thread_id=created.get("source_thread_id"),
                metadata=created.get("metadata", {}),
                created_at=created.get("created_at"),
                updated_at=created.get("updated_at"),
            )
        except Exception as e:
            logger.error(f"Error creating project memory: {e}")
            raise

    # -------------------------------------------------------------------------
    # READ — single
    # -------------------------------------------------------------------------
    async def get_memory(
        self, account_id: str, project_id: str, memory_id: str
    ) -> Optional[ProjectMemoryItem]:
        try:
            await self.db.initialize()
            client = await self.db.client

            result = (
                await client.table("user_project_memories")
                .select("*")
                .eq("memory_id", memory_id)
                .eq("account_id", account_id)
                .eq("project_id", project_id)
                .execute()
            )

            if not result.data:
                return None

            row = result.data[0]
            return self._row_to_item(row, account_id, project_id)
        except Exception as e:
            logger.error(f"Error getting project memory {memory_id}: {e}")
            raise

    # -------------------------------------------------------------------------
    # READ — list (paginated)
    # -------------------------------------------------------------------------
    async def list_memories(
        self,
        account_id: str,
        project_id: str,
        limit: int = 100,
        offset: int = 0,
        memory_type: Optional[str] = None,
    ) -> Tuple[List[ProjectMemoryItem], int]:
        try:
            await self.db.initialize()
            client = await self.db.client

            query = (
                client.table("user_project_memories")
                .select("*", count="exact")
                .eq("account_id", account_id)
                .eq("project_id", project_id)
            )
            if memory_type:
                query = query.eq("memory_type", memory_type)
            query = query.order("created_at", desc=True).range(offset, offset + limit - 1)

            result = await query.execute()

            items = [
                self._row_to_item(row, account_id, project_id)
                for row in (result.data or [])
            ]
            total = result.count or 0
            return items, total
        except Exception as e:
            logger.error(f"Error listing project memories: {e}")
            raise

    # -------------------------------------------------------------------------
    # UPDATE
    # -------------------------------------------------------------------------
    async def update_memory(
        self,
        account_id: str,
        project_id: str,
        memory_id: str,
        content: Optional[str] = None,
        memory_type: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Optional[ProjectMemoryItem]:
        try:
            await self.db.initialize()
            client = await self.db.client

            updates: Dict[str, Any] = {}
            if content is not None:
                updates["content"] = content
                # Regenerate embedding when content changes
                try:
                    updates["embedding"] = await self.embedding_service.embed_text(content)
                except Exception as e:
                    logger.warning(f"Failed to regenerate embedding: {e}")
            if memory_type is not None:
                updates["memory_type"] = memory_type
            if metadata is not None:
                updates["metadata"] = metadata

            if not updates:
                return await self.get_memory(account_id, project_id, memory_id)

            result = (
                await client.table("user_project_memories")
                .update(updates)
                .eq("memory_id", memory_id)
                .eq("account_id", account_id)
                .eq("project_id", project_id)
                .execute()
            )

            if not result.data:
                return None

            await self._invalidate_cache(account_id, project_id)
            return self._row_to_item(result.data[0], account_id, project_id)
        except Exception as e:
            logger.error(f"Error updating project memory {memory_id}: {e}")
            raise

    # -------------------------------------------------------------------------
    # DELETE — single
    # -------------------------------------------------------------------------
    async def delete_memory(self, account_id: str, project_id: str, memory_id: str) -> bool:
        try:
            await self.db.initialize()
            client = await self.db.client

            result = (
                await client.table("user_project_memories")
                .delete()
                .eq("memory_id", memory_id)
                .eq("account_id", account_id)
                .eq("project_id", project_id)
                .execute()
            )

            deleted = bool(result.data)
            if deleted:
                await self._invalidate_cache(account_id, project_id)
            return deleted
        except Exception as e:
            logger.error(f"Error deleting project memory {memory_id}: {e}")
            raise

    # -------------------------------------------------------------------------
    # DELETE — all for project
    # -------------------------------------------------------------------------
    async def delete_all_memories(self, account_id: str, project_id: str) -> bool:
        try:
            await self.db.initialize()
            client = await self.db.client

            await (
                client.table("user_project_memories")
                .delete()
                .eq("account_id", account_id)
                .eq("project_id", project_id)
                .execute()
            )
            await self._invalidate_cache(account_id, project_id)
            return True
        except Exception as e:
            logger.error(f"Error deleting all project memories: {e}")
            raise

    # -------------------------------------------------------------------------
    # SEARCH — semantic similarity
    # -------------------------------------------------------------------------
    async def search_memories(
        self,
        account_id: str,
        project_id: str,
        query_text: str,
        limit: int = 10,
        similarity_threshold: float = 0.1,
    ) -> List[ProjectMemoryItem]:
        try:
            cache_key = f"project_memories:search:{account_id}:{project_id}:{hash(query_text)}"
            cached = await Cache.get(cache_key)
            if cached:
                return [self._dict_to_item(m) for m in cached]

            await self.db.initialize()
            client = await self.db.client

            # Quick count check
            count_result = (
                await client.table("user_project_memories")
                .select("memory_id", count="exact")
                .eq("account_id", account_id)
                .eq("project_id", project_id)
                .execute()
            )
            if (count_result.count or 0) == 0:
                return []

            query_embedding = await self.embedding_service.embed_text(query_text)

            result = await client.rpc(
                "search_project_memories_by_similarity",
                {
                    "p_account_id": account_id,
                    "p_project_id": project_id,
                    "p_query_embedding": query_embedding,
                    "p_limit": limit,
                    "p_similarity_threshold": similarity_threshold,
                },
            ).execute()

            memories = []
            for row in result.data or []:
                memory = ProjectMemoryItem(
                    memory_id=row["memory_id"],
                    account_id=account_id,
                    project_id=project_id,
                    content=row["content"],
                    memory_type=MemoryType(row["memory_type"]),
                    confidence_score=row["confidence_score"],
                    metadata=row.get("metadata", {}),
                    created_at=row.get("created_at"),
                )
                memories.append(memory)

            await Cache.set(
                cache_key,
                [self._item_to_dict(m) for m in memories],
                ttl=self.cache_ttl,
            )

            logger.info(f"Retrieved {len(memories)} project memories for project {project_id}")
            return memories
        except Exception as e:
            logger.error(f"Project memory search error: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return []

    # -------------------------------------------------------------------------
    # STATS
    # -------------------------------------------------------------------------
    async def get_stats(self, account_id: str, project_id: str) -> Dict[str, Any]:
        try:
            await self.db.initialize()
            client = await self.db.client

            result = await client.rpc(
                "get_project_memory_stats",
                {"p_account_id": account_id, "p_project_id": project_id},
            ).execute()

            if result.data and len(result.data) > 0:
                row = result.data[0]
                return {
                    "total_memories": row.get("total_memories", 0),
                    "memories_by_type": row.get("memories_by_type", {}),
                    "oldest_memory": row.get("oldest_memory"),
                    "newest_memory": row.get("newest_memory"),
                }
            return {"total_memories": 0, "memories_by_type": {}, "oldest_memory": None, "newest_memory": None}
        except Exception as e:
            logger.error(f"Error getting project memory stats: {e}")
            return {"total_memories": 0, "memories_by_type": {}, "oldest_memory": None, "newest_memory": None}

    # -------------------------------------------------------------------------
    # FORMAT — for prompt injection
    # -------------------------------------------------------------------------
    def format_memories_for_prompt(self, memories: List[ProjectMemoryItem]) -> str:
        if not memories:
            return ""

        sections: Dict[MemoryType, List[str]] = {
            MemoryType.FACT: [],
            MemoryType.PREFERENCE: [],
            MemoryType.CONTEXT: [],
            MemoryType.CONVERSATION_SUMMARY: [],
        }

        for memory in memories:
            sections[memory.memory_type].append(memory.content)

        formatted_parts = []

        if sections[MemoryType.FACT]:
            formatted_parts.append("Project Facts:\n- " + "\n- ".join(sections[MemoryType.FACT]))

        if sections[MemoryType.PREFERENCE]:
            formatted_parts.append("Project Preferences:\n- " + "\n- ".join(sections[MemoryType.PREFERENCE]))

        if sections[MemoryType.CONTEXT]:
            formatted_parts.append("Project Context:\n- " + "\n- ".join(sections[MemoryType.CONTEXT]))

        if sections[MemoryType.CONVERSATION_SUMMARY]:
            formatted_parts.append(
                "Project History:\n- " + "\n- ".join(sections[MemoryType.CONVERSATION_SUMMARY])
            )

        if not formatted_parts:
            return ""

        return "# What You Know About This Project\n\n" + "\n\n".join(formatted_parts)

    # -------------------------------------------------------------------------
    # Internal helpers
    # -------------------------------------------------------------------------
    async def _invalidate_cache(self, account_id: str, project_id: str):
        try:
            await Cache.delete(f"project_memories:search:{account_id}:{project_id}:*")
        except Exception:
            pass  # Cache invalidation failure is non-fatal

    def _row_to_item(self, row: Dict[str, Any], account_id: str, project_id: str) -> ProjectMemoryItem:
        return ProjectMemoryItem(
            memory_id=row["memory_id"],
            account_id=account_id,
            project_id=project_id,
            content=row["content"],
            memory_type=MemoryType(row["memory_type"]),
            confidence_score=row.get("confidence_score", 1.0),
            source_thread_id=row.get("source_thread_id"),
            metadata=row.get("metadata", {}),
            created_at=row.get("created_at"),
            updated_at=row.get("updated_at"),
        )

    def _item_to_dict(self, item: ProjectMemoryItem) -> Dict[str, Any]:
        return {
            "memory_id": item.memory_id,
            "account_id": item.account_id,
            "project_id": item.project_id,
            "content": item.content,
            "memory_type": item.memory_type.value if isinstance(item.memory_type, MemoryType) else item.memory_type,
            "confidence_score": item.confidence_score,
            "source_thread_id": item.source_thread_id,
            "metadata": item.metadata,
            "created_at": str(item.created_at) if item.created_at else None,
            "updated_at": str(item.updated_at) if item.updated_at else None,
        }

    def _dict_to_item(self, data: Dict[str, Any]) -> ProjectMemoryItem:
        return ProjectMemoryItem(
            memory_id=data["memory_id"],
            account_id=data["account_id"],
            project_id=data["project_id"],
            content=data["content"],
            memory_type=MemoryType(data["memory_type"]),
            confidence_score=data.get("confidence_score", 1.0),
            source_thread_id=data.get("source_thread_id"),
            metadata=data.get("metadata", {}),
            created_at=data.get("created_at"),
            updated_at=data.get("updated_at"),
        )


# Singleton instance
project_memory_service = ProjectMemoryService()
