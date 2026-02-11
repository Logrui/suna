"""
Project Memory Service — CRUD + semantic search for project-scoped memories.

Follows the same patterns as retrieval_service.py but scoped to a specific project.
"""

from typing import List, Dict, Any, Optional, Tuple
from core.utils.logger import logger
from core.utils.cache import Cache
from core.utils.config import config
from core.services.supabase import DBConnection
from core.ai_models import model_manager
from .embedding_service import EmbeddingService
from .models import ProjectMemoryItem, MemoryType
import json
from datetime import datetime


class ProjectMemoryService:
    def __init__(self, model: Optional[str] = None):
        self.embedding_service = EmbeddingService()
        self.db = DBConnection()
        self.cache_ttl = 60
        self.model = model or config.MEMORY_EXTRACTION_MODEL
        self._litellm = None

    @property
    def litellm(self):
        if self._litellm is None:
            import litellm
            self._litellm = litellm
        return self._litellm

    def _get_resolved_model(self) -> str:
        resolved = model_manager.resolve_model_id(self.model)
        return model_manager.get_litellm_model_id(resolved)

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
        skip_consolidation: bool = False,
    ) -> ProjectMemoryItem:
        try:
            await self.db.initialize()
            client = await self.db.client

            # -----------------------------------------------------------------
            # INTELLIGENT CONSOLIDATION (Phase 6)
            # -----------------------------------------------------------------
            if not skip_consolidation:
                consolidation_result = await self.consolidate_memory(
                    account_id=account_id,
                    project_id=project_id,
                    content=content,
                    memory_type=memory_type,
                    metadata=metadata
                )
                
                if consolidation_result:
                    action = consolidation_result.get("action")
                    logger.info(f"🧠 [MEMORY_CONSOLIDATION] LLM decided on action: {action}")
                    
                    if action == "skip":
                        # If LLM says skip, it means the info is already there or useless.
                        # We try to find the "existing" one to return, or just return a dummy.
                        # For now, let's just return what they found or create a "skipped" result.
                        # But create_memory must return a ProjectMemoryItem.
                        # Better to just proceed with a dummy if we can't find the existing one.
                        pass # For now, we'll continue to create if LLM didn't return a specific ID
                    
                    elif action == "replace" or action == "merge":
                        # Remove old memories
                        to_remove = consolidation_result.get("memories_to_remove", [])
                        if to_remove:
                            for mid in to_remove:
                                await self.delete_memory(account_id, project_id, mid)
                        
                        # Use the new consolidated content
                        content = consolidation_result.get("new_memory_content", content)
                        if consolidation_result.get("metadata"):
                            metadata = {**(metadata or {}), **consolidation_result.get("metadata", {})}

                    elif action == "update":
                        updates = consolidation_result.get("memories_to_update", [])
                        if updates:
                            # Update the first one and return it
                            u = updates[0]
                            updated = await self.update_memory(
                                account_id=account_id,
                                project_id=project_id,
                                memory_id=u["id"],
                                content=u.get("new_content"),
                                metadata=u.get("metadata")
                            )
                            if updated:
                                return updated
            # -----------------------------------------------------------------

            # Generate embedding for semantic search
            embedding = None
            try:
                embedding = await self.embedding_service.embed_text(content)
            except Exception as e:
                logger.warning(f"Failed to generate embedding for project memory: {e}")

            # Create the record
            data = {
                "account_id": account_id,
                "project_id": project_id,
                "content": content,
                "memory_type": memory_type,
                "confidence_score": confidence_score,
                "source_thread_id": source_thread_id,
                "metadata": metadata or {},
                "embedding": embedding
            }
            

            
            res = await client.table("user_project_memories").insert(data).execute()

            if not res.data:
                raise ValueError("Insert returned no data")

            created = res.data[0]
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
        use_keywords: bool = True,
    ) -> List[ProjectMemoryItem]:
        try:
            # If enabled, augment search with keywords
            if use_keywords:
                keywords = await self.extract_keywords(query_text)
                if keywords:
                    logger.info(f"🧠 [MEMORY_SEARCH] Augmented with keywords: {keywords}")
                    # Combine query with keywords for potentially better embedding match
                    # or run multiple searches if we had more complex retrieval logic.
                    # For now, we just prepend keywords to the query.
                    query_text = f"{', '.join(keywords)}. {query_text}"

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
                    "p_query_embedding": str(query_embedding),  # PostgREST needs string format for vector type
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
    # INTELLIGENCE & CONSOLIDATION (Phase 6)
    # -------------------------------------------------------------------------
    async def extract_keywords(self, content: str) -> List[str]:
        """Extract search keywords using LLM."""
        try:
            from core.prompts.memory_consolidation_prompt import (
                MEMORY_KEYWORD_EXTRACTION_SYSTEM_PROMPT,
                MEMORY_KEYWORD_EXTRACTION_MESSAGE
            )
            
            prompt = MEMORY_KEYWORD_EXTRACTION_MESSAGE.format(memory_content=content)
            resolved_model = self._get_resolved_model()
            
            response = await self.litellm.acompletion(
                model=resolved_model,
                messages=[
                    {"role": "system", "content": MEMORY_KEYWORD_EXTRACTION_SYSTEM_PROMPT},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,
                max_tokens=200
            )
            
            resp_content = response.choices[0].message.content
            # Basic JSON extraction
            start = resp_content.find("[")
            end = resp_content.rfind("]")
            if start != -1 and end != -1:
                return json.loads(resp_content[start:end+1])
            return []
        except Exception as e:
            logger.warning(f"Keyword extraction failed: {e}")
            return []

    async def consolidate_memory(
        self,
        account_id: str,
        project_id: str,
        content: str,
        memory_type: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        """Analyze and consolidate a new memory against existing ones."""
        try:
            # 1. Search for similar memories
            similar = await self.search_memories(
                account_id=account_id,
                project_id=project_id,
                query_text=content,
                limit=5,
                similarity_threshold=0.4, # Focus on relatively close matches
                use_keywords=False # Don't use keywords here to avoid recursive search loops
            )
            
            if not similar:
                return None
            
            # 2. Prepare analysis context
            from core.prompts.memory_consolidation_prompt import (
                MEMORY_CONSOLIDATION_SYSTEM_PROMPT,
                MEMORY_CONSOLIDATION_MESSAGE
            )
            
            similar_text = ""
            for m in similar:
                similar_text += f"ID: {m.memory_id}\nType: {m.memory_type.value}\nContent: {m.content}\n\n"
            
            prompt = MEMORY_CONSOLIDATION_MESSAGE.format(
                account_id=account_id,
                project_id=project_id,
                current_timestamp=datetime.now().isoformat(),
                new_memory=content,
                new_memory_metadata=json.dumps(metadata or {}),
                similar_memories=similar_text.strip()
            )
            
            resolved_model = self._get_resolved_model()
            response = await self.litellm.acompletion(
                model=resolved_model,
                messages=[
                    {"role": "system", "content": MEMORY_CONSOLIDATION_SYSTEM_PROMPT},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,
                max_tokens=1000
            )
            
            resp_content = response.choices[0].message.content
            # Basic JSON extraction
            start = resp_content.find("{")
            end = resp_content.rfind("}")
            if start != -1 and end != -1:
                return json.loads(resp_content[start:end+1])
            return None
            
        except Exception as e:
            logger.error(f"Memory consolidation analysis failed: {e}")
            return None

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
