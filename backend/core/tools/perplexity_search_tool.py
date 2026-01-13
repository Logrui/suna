"""
Perplexity Search Tool - AI-powered web search with advanced filtering and video support.

This tool uses the Perplexity Search API to provide ranked web search results
with advanced filtering, time-based recency options, and comprehensive content extraction.
"""

import httpx
from dotenv import load_dotenv
from core.agentpress.tool import Tool, ToolResult, openapi_schema, tool_metadata
from core.utils.config import config
from core.sandbox.tool_base import SandboxToolsBase
from core.agentpress.thread_manager import ThreadManager
import json
import asyncio
import logging
import time
import re
from typing import Optional, List

# Video URL detection patterns (platform-agnostic)
VIDEO_PATTERNS = [
    # URL path patterns
    r'/watch[?/]',
    r'/video[s]?/',
    r'/embed/',
    r'/v/',
    r'/clip[s]?/',
    r'/shorts/',
    r'/reel[s]?/',
    r'/live/',
    # File extensions
    r'\.(mp4|webm|mov|avi|mkv)(\?|$)',
    # Platform indicators in domain
    r'(youtube|youtu\.be|vimeo|dailymotion|twitch|tiktok|rumble|odysee|bitchute|streamable|loom|wistia|vidyard|brightcove)',
]


def is_video_url(url: str) -> bool:
    """Detect if a URL likely points to video content."""
    if not url:
        return False
    url_lower = url.lower()
    return any(re.search(pattern, url_lower) for pattern in VIDEO_PATTERNS)


@tool_metadata(
    display_name="Perplexity Search",
    description="AI-powered web search with advanced filtering, citations, and video detection",
    icon="Sparkles",
    color="bg-violet-100 dark:bg-violet-800/50",
    weight=29,
    visible=True,
    usage_guide="""
### PERPLEXITY AI SEARCH

**AI-POWERED SEARCH CAPABILITIES:**
- Get ranked search results from Perplexity's continuously refreshed index
- Advanced filtering by domain, recency, country, and language
- **VIDEO DETECTION:** Automatically identifies and categorizes video URLs from any platform
- **BATCH SEARCHING:** Execute multiple queries concurrently for faster research
- Time-based filtering (day, week, month, year)
- Country and language-specific results

**RESEARCH BEST PRACTICES:**
1. **Multi-source approach for thorough research:**
   - Use perplexity_search with BATCH MODE for multiple queries simultaneously
   - Leverage domain filtering to focus on authoritative sources
   - Use recency filters for time-sensitive information

2. **Research Workflow:**
   - Start with broad queries to understand the landscape
   - Use domain filters to focus on specific source types
   - Apply date filters for current events or recent developments

**SEARCH PARAMETERS:**
- `query`: Single query string or array of queries for batch mode
- `max_results`: Number of results per query (1-20, default: 10)
- `search_domain_filter`: List of domains to restrict results to
- `search_recency_filter`: 'day', 'week', 'month', or 'year'
- `country`: Country code to prioritize results from (e.g., 'US', 'GB')
- `search_language_filter`: Array of language codes (e.g., ['en', 'es'])
- `include_videos`: When true, runs additional video-focused search

**VIDEO DETECTION:**
- Results are automatically categorized as regular results or videos
- Video URLs are detected from any platform (YouTube, Vimeo, TikTok, etc.)
- Use `include_videos=true` to run parallel video-focused searches

**DATA FRESHNESS:**
- Use `search_recency_filter` for time-sensitive information
- Check `date` and `last_updated` fields in results
- Combine with `search_after_date` for precise date filtering
"""
)
class PerplexitySearchTool(SandboxToolsBase):
    """Tool for performing AI-powered web searches using Perplexity API."""

    def __init__(self, project_id: str, thread_manager: ThreadManager):
        super().__init__(project_id, thread_manager)
        load_dotenv()
        
        self.perplexity_api_key = config.PERPLEXITY_API_KEY
        self.api_base = "https://api.perplexity.ai"
        
        if not self.perplexity_api_key:
            logging.warning("PERPLEXITY_API_KEY not configured - Perplexity Search Tool will not be available")

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "perplexity_search",
            "description": "Search the web using Perplexity's AI-powered search API. Supports batch queries, domain filtering, recency filters, and automatic video detection. For batch searches, pass query as a native array of strings. Results include titles, URLs, snippets, dates, and automatic video categorization. **🚨 PARAMETER NAMES**: Use EXACTLY these parameter names: `query` (REQUIRED), `max_results`, `search_domain_filter`, `search_recency_filter`, `country`, `search_language_filter`, `include_videos`.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "oneOf": [
                            {
                                "type": "string",
                                "description": "**REQUIRED** - A single search query. Example: \"latest AI developments 2024\""
                            },
                            {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "**REQUIRED** - Multiple search queries for batch mode. Each query runs concurrently. Example: [\"AI news\", \"machine learning trends\", \"deep learning applications\"]"
                            }
                        ],
                        "description": "**REQUIRED** - Search query or array of queries for batch mode."
                    },
                    "max_results": {
                        "type": "integer",
                        "description": "**OPTIONAL** - Maximum results per query (1-20). Default: 10.",
                        "default": 10
                    },
                    "search_domain_filter": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "**OPTIONAL** - List of domains to restrict results to. Max 20 domains. Example: [\"arxiv.org\", \"nature.com\", \"science.org\"]"
                    },
                    "search_recency_filter": {
                        "type": "string",
                        "enum": ["day", "week", "month", "year"],
                        "description": "**OPTIONAL** - Filter by recency: 'day' (24h), 'week' (7d), 'month' (30d), 'year' (365d)."
                    },
                    "country": {
                        "type": "string",
                        "description": "**OPTIONAL** - Country code to prioritize results from. Example: 'US', 'GB', 'DE'."
                    },
                    "search_language_filter": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "**OPTIONAL** - ISO 639-1 language codes. Max 10. Example: ['en', 'es', 'fr']"
                    },
                    "include_videos": {
                        "type": "boolean",
                        "description": "**OPTIONAL** - When true, runs additional video-focused search and categorizes video URLs. Default: false.",
                        "default": False
                    }
                },
                "required": ["query"],
                "additionalProperties": False
            }
        }
    })
    async def perplexity_search(
        self,
        query: str | list[str],
        max_results: int = 10,
        search_domain_filter: Optional[List[str]] = None,
        search_recency_filter: Optional[str] = None,
        country: Optional[str] = None,
        search_language_filter: Optional[List[str]] = None,
        include_videos: bool = False
    ) -> ToolResult:
        """
        Search the web using Perplexity's AI-powered search API.
        Supports both single and batch queries with advanced filtering.
        """
        try:
            if not self.perplexity_api_key:
                return self.fail_response("Perplexity Search is not available. PERPLEXITY_API_KEY is not configured.")
            
            # Normalize max_results
            if max_results is None:
                max_results = 10
            elif isinstance(max_results, int):
                max_results = max(1, min(max_results, 20))
            elif isinstance(max_results, str):
                try:
                    max_results = max(1, min(int(max_results), 20))
                except ValueError:
                    max_results = 10
            else:
                max_results = 10

            # Handle JSON string query arrays
            if isinstance(query, str) and query.strip().startswith('['):
                try:
                    parsed_query = json.loads(query)
                    if isinstance(parsed_query, list):
                        query = parsed_query
                except (json.JSONDecodeError, ValueError):
                    pass
            
            is_batch = isinstance(query, list)
            
            if is_batch:
                if not query or len(query) == 0:
                    return self.fail_response("At least one search query is required in the batch.")
                
                queries = [q.strip() for q in query if q and isinstance(q, str) and q.strip()]
                if not queries:
                    return self.fail_response("No valid search queries provided in the batch.")
                
                logging.info(f"Executing batch Perplexity search for {len(queries)} queries with {max_results} results each")
                
                # Execute all searches concurrently
                start_time = time.time()
                tasks = []
                for q in queries:
                    tasks.append(self._execute_single_search(
                        q, max_results, search_domain_filter, search_recency_filter,
                        country, search_language_filter
                    ))
                    if include_videos:
                        # Add video-focused search for each query
                        tasks.append(self._execute_single_search(
                            f"{q} video",
                            min(5, max_results),  # Fewer video results
                            search_domain_filter, search_recency_filter,
                            country, search_language_filter
                        ))
                
                search_results = await asyncio.gather(*tasks, return_exceptions=True)
                elapsed_time = time.time() - start_time
                logging.info(f"Batch search completed in {elapsed_time:.2f}s (concurrent execution)")
                
                # Process results
                batch_response = {
                    "batch_mode": True,
                    "total_queries": len(queries),
                    "results": []
                }
                
                all_successful = True
                result_idx = 0
                
                for i, q in enumerate(queries):
                    main_result = search_results[result_idx]
                    result_idx += 1
                    
                    video_result = None
                    if include_videos:
                        video_result = search_results[result_idx]
                        result_idx += 1
                    
                    if isinstance(main_result, Exception):
                        logging.error(f"Error processing query '{q}': {str(main_result)}")
                        batch_response["results"].append({
                            "query": q,
                            "success": False,
                            "error": str(main_result),
                            "results": [],
                            "videos": []
                        })
                        all_successful = False
                    else:
                        # Merge and categorize results
                        all_results = main_result.get("results", [])
                        if video_result and not isinstance(video_result, Exception):
                            all_results.extend(video_result.get("results", []))
                        
                        # Deduplicate by URL
                        seen_urls = set()
                        deduplicated = []
                        for r in all_results:
                            if r.get("url") not in seen_urls:
                                seen_urls.add(r.get("url"))
                                deduplicated.append(r)
                        
                        # Categorize into regular results and videos
                        videos = [r for r in deduplicated if is_video_url(r.get("url", ""))]
                        regular = [r for r in deduplicated if not is_video_url(r.get("url", ""))]
                        
                        batch_response["results"].append({
                            "query": q,
                            "success": main_result.get("success", False),
                            "results": regular,
                            "videos": videos,
                            "response": main_result.get("response", {})
                        })
                        if not main_result.get("success", False):
                            all_successful = False
                
                logging.info(f"Batch search completed: {len([r for r in batch_response['results'] if r.get('success')])}/{len(queries)} queries successful")
                
                return ToolResult(
                    success=all_successful,
                    output=json.dumps(batch_response, ensure_ascii=False)
                )
            else:
                # Single query mode
                if not query or not isinstance(query, str):
                    return self.fail_response("A valid search query is required.")
                
                query = query.strip()
                if not query:
                    return self.fail_response("A valid search query is required.")
                
                logging.info(f"Executing Perplexity search for query: '{query}' with {max_results} results")
                
                # Main search
                main_result = await self._execute_single_search(
                    query, max_results, search_domain_filter, search_recency_filter,
                    country, search_language_filter
                )
                
                # Video search if requested
                video_result = None
                if include_videos:
                    video_result = await self._execute_single_search(
                        f"{query} video",
                        min(5, max_results),
                        search_domain_filter, search_recency_filter,
                        country, search_language_filter
                    )
                
                # Merge and categorize
                all_results = main_result.get("results", [])
                if video_result and video_result.get("success"):
                    all_results.extend(video_result.get("results", []))
                
                # Deduplicate
                seen_urls = set()
                deduplicated = []
                for r in all_results:
                    if r.get("url") not in seen_urls:
                        seen_urls.add(r.get("url"))
                        deduplicated.append(r)
                
                # Categorize
                videos = [r for r in deduplicated if is_video_url(r.get("url", ""))]
                regular = [r for r in deduplicated if not is_video_url(r.get("url", ""))]
                
                response = {
                    "query": query,
                    "results": regular,
                    "videos": videos,
                    "success": main_result.get("success", False)
                }
                
                if main_result.get("success", False):
                    return ToolResult(
                        success=True,
                        output=json.dumps(response, ensure_ascii=False)
                    )
                else:
                    logging.warning(f"No search results found for query: '{query}'")
                    return ToolResult(
                        success=False,
                        output=json.dumps(response, ensure_ascii=False)
                    )
        
        except Exception as e:
            error_message = str(e)
            query_str = ", ".join(query) if isinstance(query, list) else str(query)
            logging.error(f"Error performing Perplexity search for '{query_str}': {error_message}")
            simplified_message = f"Error performing Perplexity search: {error_message[:200]}"
            if len(error_message) > 200:
                simplified_message += "..."
            return self.fail_response(simplified_message)
    
    async def _execute_single_search(
        self,
        query: str,
        max_results: int,
        search_domain_filter: Optional[List[str]] = None,
        search_recency_filter: Optional[str] = None,
        country: Optional[str] = None,
        search_language_filter: Optional[List[str]] = None
    ) -> dict:
        """
        Execute a single search query against Perplexity Search API.
        
        Returns:
            dict with success status, results array, and full response
        """
        try:
            headers = {
                "Authorization": f"Bearer {self.perplexity_api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "query": query,
                "max_results": max_results
            }
            
            # Add optional filters
            if search_domain_filter:
                payload["search_domain_filter"] = search_domain_filter[:20]  # Max 20 domains
            if search_recency_filter and search_recency_filter in ["day", "week", "month", "year"]:
                payload["search_recency_filter"] = search_recency_filter
            if country:
                payload["country"] = country
            if search_language_filter:
                payload["search_language_filter"] = search_language_filter[:10]  # Max 10 languages
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.api_base}/search",
                    json=payload,
                    headers=headers,
                    timeout=30.0
                )
                response.raise_for_status()
                data = response.json()
            
            # Extract results
            results = data.get("results", [])
            
            # Normalize result format
            normalized_results = []
            for r in results:
                normalized_results.append({
                    "title": r.get("title", ""),
                    "url": r.get("url", ""),
                    "snippet": r.get("snippet", ""),
                    "content": r.get("snippet", ""),  # Alias for compatibility
                    "date": r.get("date"),
                    "last_updated": r.get("last_updated"),
                    "is_video": is_video_url(r.get("url", ""))
                })
            
            success = len(normalized_results) > 0
            
            logging.info(f"Retrieved {len(normalized_results)} results for query: '{query}'")
            
            return {
                "success": success,
                "results": normalized_results,
                "response": data
            }
        
        except httpx.HTTPStatusError as e:
            error_message = f"HTTP {e.response.status_code}: {e.response.text}"
            logging.error(f"Perplexity API error for '{query}': {error_message}")
            return {
                "success": False,
                "results": [],
                "response": {},
                "error": error_message
            }
        except Exception as e:
            error_message = str(e)
            logging.error(f"Error executing Perplexity search for '{query}': {error_message}")
            return {
                "success": False,
                "results": [],
                "response": {},
                "error": error_message
            }


if __name__ == "__main__":
    async def test_perplexity_search():
        """Test function for the Perplexity search tool"""
        print("Test function needs to be updated for sandbox version")
    
    asyncio.run(test_perplexity_search())
