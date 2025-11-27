import os
import urllib.parse
import uuid
from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException, APIRouter, Form, Depends, Request
from fastapi.responses import Response
from pydantic import BaseModel
from daytona_sdk import AsyncSandbox

from core.sandbox.sandbox import get_or_start_sandbox, delete_sandbox, create_sandbox
from core.utils.logger import logger
from core.utils.auth_utils import get_optional_user_id, verify_and_get_user_id_from_jwt, verify_sandbox_access, verify_sandbox_access_optional
from core.services.supabase import DBConnection
from core.utils.sandbox_utils import generate_unique_filename, get_uploads_directory
import mimetypes
import html

# Initialize shared resources
router = APIRouter(tags=["sandbox"])
db = None

def initialize(_db: DBConnection):
    """Initialize the sandbox API with resources from the main API."""
    global db
    db = _db
    logger.debug("Initialized sandbox API with database connection")

class FileInfo(BaseModel):
    """Model for file information"""
    name: str
    path: str
    is_dir: bool
    size: int
    mod_time: str
    permissions: Optional[str] = None

def normalize_path(path: str) -> str:
    """
    Normalize a path to ensure proper UTF-8 encoding and handling.
    
    Args:
        path: The file path, potentially containing URL-encoded characters
        
    Returns:
        Normalized path with proper UTF-8 encoding
    """
    try:
        # First, ensure the path is properly URL-decoded
        decoded_path = urllib.parse.unquote(path)
        
        # Handle Unicode escape sequences like \u0308
        try:
            # Replace Python-style Unicode escapes (\u0308) with actual characters
            # This handles cases where the Unicode escape sequence is part of the URL
            import re
            unicode_pattern = re.compile(r'\\u([0-9a-fA-F]{4})')
            
            def replace_unicode(match):
                hex_val = match.group(1)
                return chr(int(hex_val, 16))
            
            decoded_path = unicode_pattern.sub(replace_unicode, decoded_path)
        except Exception as unicode_err:
            logger.warning(f"Error processing Unicode escapes in path '{path}': {str(unicode_err)}")
        
        logger.debug(f"Normalized path from '{path}' to '{decoded_path}'")
        return decoded_path
    except Exception as e:
        logger.error(f"Error normalizing path '{path}': {str(e)}")
        return path  # Return original path if decoding fails



async def get_sandbox_by_id_safely(client, sandbox_id: str) -> AsyncSandbox:
    """
    Safely retrieve a sandbox object by its ID, using the project that owns it.
    
    Args:
        client: The Supabase client
        sandbox_id: The sandbox ID to retrieve
    
    Returns:
        AsyncSandbox: The sandbox object
        
    Raises:
        HTTPException: If the sandbox doesn't exist or can't be retrieved
    """
    # Find the project that owns this sandbox
    project_result = await client.table('projects').select('project_id').filter('sandbox->>id', 'eq', sandbox_id).execute()
    
    if not project_result.data or len(project_result.data) == 0:
        logger.error(f"No project found for sandbox ID: {sandbox_id}")
        raise HTTPException(status_code=404, detail="Sandbox not found - no project owns this sandbox ID")
    
    # project_id = project_result.data[0]['project_id']
    # logger.debug(f"Found project {project_id} for sandbox {sandbox_id}")
    
    try:
        # Get the sandbox
        sandbox = await get_or_start_sandbox(sandbox_id)
        # Extract just the sandbox object from the tuple (sandbox, sandbox_id, sandbox_pass)
        # sandbox = sandbox_tuple[0]
            
        return sandbox
    except Exception as e:
        logger.error(f"Error retrieving sandbox {sandbox_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve sandbox: {str(e)}")

@router.post("/sandboxes/{sandbox_id}/files")
async def create_file(
    sandbox_id: str, 
    path: str = Form(...),
    file: UploadFile = File(...),
    request: Request = None,
    user_id: str = Depends(verify_and_get_user_id_from_jwt)
):
    """Create a file in the sandbox using direct file upload"""
    # Normalize the path to handle UTF-8 encoding correctly
    path = normalize_path(path)
    
    logger.debug(f"Received file upload request for sandbox {sandbox_id}, path: {path}, user_id: {user_id}")
    client = await db.client
    
    # Verify the user has access to this sandbox
    await verify_sandbox_access(client, sandbox_id, user_id)
    
    try:
        # Get sandbox using the safer method
        sandbox = await get_sandbox_by_id_safely(client, sandbox_id)
        
        # Extract filename from the provided path
        from pathlib import Path as PathLib
        original_filename = PathLib(path).name
        
        # Always use /workspace/uploads/ as the base directory
        uploads_dir = get_uploads_directory()
        
        # Generate a unique filename to avoid conflicts
        unique_filename = await generate_unique_filename(sandbox, uploads_dir, original_filename)
        
        # Construct the final path
        final_path = f"{uploads_dir}/{unique_filename}"
        
        # Read file content directly from the uploaded file
        content = await file.read()
        
        # Create file using raw binary content
        await sandbox.fs.upload_file(content, final_path)
        logger.info(f"File uploaded successfully: {final_path} in sandbox {sandbox_id}")
        
        return {
            "status": "success", 
            "created": True, 
            "path": final_path,
            "original_filename": original_filename,
            "final_filename": unique_filename,
            "renamed": original_filename != unique_filename
        }
    except Exception as e:
        logger.error(f"Error creating file in sandbox {sandbox_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/sandboxes/{sandbox_id}/files")
async def update_file(
    sandbox_id: str,
    request: Request = None,
    user_id: Optional[str] = Depends(get_optional_user_id)
):
    try:
        body = await request.json()
        path = body.get('path')
        content = body.get('content', '')
        
        if not path:
            raise HTTPException(status_code=400, detail="Path is required")
        
        path = normalize_path(path)
        
        logger.debug(f"Received file update request for sandbox {sandbox_id}, path: {path}, user_id: {user_id}")
        client = await db.client
        
        await verify_sandbox_access(client, sandbox_id, user_id)
        
        sandbox = await get_sandbox_by_id_safely(client, sandbox_id)
        
        content_bytes = content.encode('utf-8') if isinstance(content, str) else content
        await sandbox.fs.upload_file(content_bytes, path)
        logger.debug(f"File updated at {path} in sandbox {sandbox_id}")
        
        return {"status": "success", "updated": True, "path": path}
    except Exception as e:
        logger.error(f"Error updating file in sandbox {sandbox_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sandboxes/{sandbox_id}/files")
async def list_files(
    sandbox_id: str, 
    path: str,
    request: Request = None,
    user_id: Optional[str] = Depends(get_optional_user_id)
):
    path = normalize_path(path)
    
    logger.debug(f"Received list files request for sandbox {sandbox_id}, path: {path}, user_id: {user_id}")
    client = await db.client
    
    # Verify the user has access to this sandbox
    await verify_sandbox_access_optional(client, sandbox_id, user_id)
    
    try:
        # Get sandbox using the safer method
        sandbox = await get_sandbox_by_id_safely(client, sandbox_id)
        
        # List files
        files = await sandbox.fs.list_files(path)
        result = []
        
        for file in files:
            # Convert file information to our model
            # Ensure forward slashes are used for paths, regardless of OS
            full_path = f"{path.rstrip('/')}/{file.name}" if path != '/' else f"/{file.name}"
            file_info = FileInfo(
                name=file.name,
                path=full_path, # Use the constructed path
                is_dir=file.is_dir,
                size=file.size,
                mod_time=str(file.mod_time),
                permissions=getattr(file, 'permissions', None)
            )
            result.append(file_info)
        
        logger.debug(f"Successfully listed {len(result)} files in sandbox {sandbox_id}")
        return {"files": [file.dict() for file in result]}
    except Exception as e:
        logger.error(f"Error listing files in sandbox {sandbox_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sandboxes/{sandbox_id}/files/content")
async def read_file(
    sandbox_id: str, 
    path: str,
    request: Request = None,
    user_id: Optional[str] = Depends(get_optional_user_id)
):
    """Read a file from the sandbox"""
    # Normalize the path to handle UTF-8 encoding correctly
    original_path = path
    path = normalize_path(path)
    
    logger.debug(f"Received file read request for sandbox {sandbox_id}, path: {path}, user_id: {user_id}")
    logger.debug(f"Request URL: {request.url}")
    if original_path != path:
        logger.debug(f"Normalized path from '{original_path}' to '{path}'")
    
    client = await db.client
    
    # Verify the user has access to this sandbox
    await verify_sandbox_access_optional(client, sandbox_id, user_id)
    
    try:
        # Get sandbox using the safer method
        sandbox = await get_sandbox_by_id_safely(client, sandbox_id)
        
        # Read file directly - don't check existence first with a separate call
        try:
            content = await sandbox.fs.download_file(path)
        except Exception as download_err:
            logger.error(f"Error downloading file {path} from sandbox {sandbox_id}: {str(download_err)}")
            raise HTTPException(
                status_code=404, 
                detail=f"Failed to download file: {str(download_err)}"
            )
        
        # Return a Response object with the content directly
        filename = os.path.basename(path)
        logger.debug(f"Successfully read file {filename} from sandbox {sandbox_id}")
        
        # Ensure proper encoding by explicitly using UTF-8 for the filename in Content-Disposition header
        # This applies RFC 5987 encoding for the filename to support non-ASCII characters
        import urllib.parse
        encoded_filename = urllib.parse.quote(filename, safe='')
        
        # Guess mime type
        media_type, _ = mimetypes.guess_type(filename)
        if not media_type:
            media_type = "application/octet-stream"
            
        # Heuristic to fix escaped HTML content
        if path.lower().endswith('.html') or path.lower().endswith('.htm'):
            if isinstance(content, bytes):
                try:
                    decoded = content.decode('utf-8')
                    # Check for common escaped HTML tags
                    if '&lt;html' in decoded or '&lt;!DOCTYPE' in decoded or '&lt;body' in decoded:
                        logger.warning(f"Detected escaped HTML in {path}, unescaping...")
                        content = html.unescape(decoded).encode('utf-8')
                except Exception as e:
                    logger.warning(f"Failed to check/unescape bytes content: {e}")
            elif isinstance(content, str):
                 if '&lt;html' in content or '&lt;!DOCTYPE' in content or '&lt;body' in content:
                    logger.warning(f"Detected escaped HTML in {path}, unescaping...")
                    content = html.unescape(content)

        # Determine disposition type (inline for viewable content, attachment for others)
        # We want HTML, images, PDFs, text to be viewable inline
        viewable_types = ['text/', 'image/', 'application/pdf', 'application/json', 'application/javascript']
        disposition_type = "attachment"
        
        for v_type in viewable_types:
            if media_type.startswith(v_type):
                disposition_type = "inline"
                break
        
        content_disposition = f"{disposition_type}; filename*=UTF-8''{encoded_filename}"
        
        logger.debug(f"Serving file {path} with media_type='{media_type}' and Content-Disposition='{content_disposition}'")
        
        return Response(
            content=content,
            media_type=media_type,
            headers={"Content-Disposition": content_disposition}
        )
    except HTTPException:
        # Re-raise HTTP exceptions without wrapping
        raise
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        logger.error(f"Error reading file in sandbox {sandbox_id}: {str(e)}\nTraceback: {error_trace}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@router.delete("/sandboxes/{sandbox_id}/files")
async def delete_file(
    sandbox_id: str, 
    path: str,
    request: Request = None,
    user_id: str = Depends(verify_and_get_user_id_from_jwt)
):
    """Delete a file from the sandbox"""
    # Normalize the path to handle UTF-8 encoding correctly
    path = normalize_path(path)
    
    logger.debug(f"Received file delete request for sandbox {sandbox_id}, path: {path}, user_id: {user_id}")
    client = await db.client
    
    # Verify the user has access to this sandbox
    await verify_sandbox_access(client, sandbox_id, user_id)
    
    try:
        # Get sandbox using the safer method
        sandbox = await get_sandbox_by_id_safely(client, sandbox_id)
        
        # Delete file
        await sandbox.fs.delete_file(path)
        logger.debug(f"File deleted at {path} in sandbox {sandbox_id}")
        
        return {"status": "success", "deleted": True, "path": path}
    except Exception as e:
        logger.error(f"Error deleting file in sandbox {sandbox_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/sandboxes/{sandbox_id}")
async def delete_sandbox_route(
    sandbox_id: str,
    request: Request = None,
    user_id: str = Depends(verify_and_get_user_id_from_jwt)
):
    """Delete an entire sandbox"""
    logger.debug(f"Received sandbox delete request for sandbox {sandbox_id}, user_id: {user_id}")
    client = await db.client
    
    # Verify the user has access to this sandbox
    await verify_sandbox_access(client, sandbox_id, user_id)
    
    try:
        # Delete the sandbox using the sandbox module function
        await delete_sandbox(sandbox_id)
        
        return {"status": "success", "deleted": True, "sandbox_id": sandbox_id}
    except Exception as e:
        logger.error(f"Error deleting sandbox {sandbox_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Should happen on server-side fully
@router.post("/project/{project_id}/sandbox/ensure-active")
async def ensure_project_sandbox_active(
    project_id: str,
    request: Request = None,
    user_id: Optional[str] = Depends(get_optional_user_id)
):
    """
    Ensure that a project's sandbox is active and running.
    Checks the sandbox status and starts it if it's not running.
    """
    logger.debug(f"Received ensure sandbox active request for project {project_id}, user_id: {user_id}")
    client = await db.client
    
    # Find the project and sandbox information
    project_result = await client.table('projects').select('*').eq('project_id', project_id).execute()
    
    if not project_result.data or len(project_result.data) == 0:
        logger.error(f"Project not found: {project_id}")
        raise HTTPException(status_code=404, detail="Project not found")
    
    project_data = project_result.data[0]
    
    # For public projects, no authentication is needed
    if not project_data.get('is_public'):
        # For private projects, we must have a user_id
        if not user_id:
            logger.error(f"Authentication required for private project {project_id}")
            raise HTTPException(status_code=401, detail="Authentication required for this resource")
            
        account_id = project_data.get('account_id')
        
        # Verify account membership
        if account_id:
            account_user_result = await client.schema('basejump').from_('account_user').select('account_role').eq('user_id', user_id).eq('account_id', account_id).execute()
            if not (account_user_result.data and len(account_user_result.data) > 0):
                logger.error(f"User {user_id} not authorized to access project {project_id}")
                raise HTTPException(status_code=403, detail="Not authorized to access this project")
    
    try:
        # Get sandbox ID from project data
        sandbox_info = project_data.get('sandbox', {})
        if not sandbox_info.get('id'):
            raise HTTPException(status_code=404, detail="No sandbox found for this project")
            
        sandbox_id = sandbox_info['id']
        
        # Get or start the sandbox
        logger.debug(f"Ensuring sandbox is active for project {project_id}")
        sandbox = await get_or_start_sandbox(sandbox_id)
        
        # Refresh preview URLs to ensure they match current configuration
        from core.utils.preview_urls import get_vnc_preview_url, get_website_preview_url
        vnc_url = get_vnc_preview_url(sandbox_id)
        website_url = get_website_preview_url(sandbox_id)
        
        # Update project with fresh URLs if they differ
        current_sandbox_info = project_data.get('sandbox', {})
        if current_sandbox_info.get('vnc_preview') != vnc_url or current_sandbox_info.get('sandbox_url') != website_url:
            logger.info(f"Updating stale preview URLs for project {project_id}")
            logger.debug(f"Old VNC: {current_sandbox_info.get('vnc_preview')} -> New VNC: {vnc_url}")
            logger.debug(f"Old Web: {current_sandbox_info.get('sandbox_url')} -> New Web: {website_url}")
            
            current_sandbox_info['vnc_preview'] = vnc_url
            current_sandbox_info['sandbox_url'] = website_url
            
            await client.table('projects').update({
                'sandbox': current_sandbox_info
            }).eq('project_id', project_id).execute()
        
        logger.debug(f"Successfully ensured sandbox {sandbox_id} is active for project {project_id}")
        
        return {
            "status": "success", 
            "sandbox_id": sandbox_id,
            "message": "Sandbox is active"
        }
    except Exception as e:
        logger.error(f"Error ensuring sandbox is active for project {project_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/project/{project_id}/files")
async def create_file_in_project(
    project_id: str,
    path: str = Form(...),
    file: UploadFile = File(...),
    user_id: str = Depends(verify_and_get_user_id_from_jwt)
):
    """
    Upload a file to a project, creating a sandbox if one doesn't exist.
    This endpoint handles both sandbox creation and file upload in a single call.
    """
    logger.debug(f"Received file upload for project {project_id}, path: {path}, user_id: {user_id}")
    
    # Normalize the path
    path = normalize_path(path)
    client = await db.client
    
    # Find the project and verify user has access
    project_result = await client.table('projects').select('*').eq('project_id', project_id).execute()
    
    if not project_result.data or len(project_result.data) == 0:
        logger.error(f"Project not found: {project_id}")
        raise HTTPException(status_code=404, detail="Project not found")
    
    project_data = project_result.data[0]
    account_id = project_data.get('account_id')
    
    # Verify user has access to this project
    if account_id:
        account_user_result = await client.schema('basejump').from_('account_user').select('account_role').eq('user_id', user_id).eq('account_id', account_id).execute()
        if not (account_user_result.data and len(account_user_result.data) > 0):
            logger.error(f"User {user_id} not authorized to access project {project_id}")
            raise HTTPException(status_code=403, detail="Not authorized to access this project")
    
    try:
        # Reuse existing sandbox creation/retrieval logic from agent_runs
        from core.agent_runs import _ensure_sandbox_for_thread
        
        # Check if sandbox existed before
        existing_sandbox_id = project_data.get('sandbox', {}).get('id')
        
        # Ensure sandbox exists (creates if needed)
        sandbox, sandbox_id = await _ensure_sandbox_for_thread(client, project_id, [file])
        
        if not sandbox or not sandbox_id:
            raise HTTPException(status_code=500, detail="Failed to ensure sandbox for file upload")
        
        sandbox_created = (existing_sandbox_id is None)
        
        # Upload the file to the sandbox
        from pathlib import Path as PathLib
        original_filename = PathLib(path).name
        
        # Always use /workspace/uploads/ as the base directory
        uploads_dir = get_uploads_directory()
        
        # Generate a unique filename to avoid conflicts
        unique_filename = await generate_unique_filename(sandbox, uploads_dir, original_filename)
        
        # Construct the final path
        final_path = f"{uploads_dir}/{unique_filename}"
        
        # Read file content
        content = await file.read()
        
        # Upload file to sandbox
        await sandbox.fs.upload_file(content, final_path)
        logger.info(f"File uploaded successfully: {final_path} in sandbox {sandbox_id}")
        
        return {
            "status": "success",
            "created": True,
            "path": final_path,
            "original_filename": original_filename,
            "final_filename": unique_filename,
            "renamed": original_filename != unique_filename,
            "sandbox_id": sandbox_id,
            "sandbox_created": sandbox_created
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading file to project {project_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sandboxes/{sandbox_id}/proxy/{port}")
async def proxy_daytona_preview_root(
    sandbox_id: str,
    port: int,
    request: Request,
    user_id: Optional[str] = Depends(get_optional_user_id)
):
    """Handle proxy requests without a trailing slash/path"""
    return await proxy_daytona_preview(sandbox_id, port, "", request, user_id)

@router.get("/sandboxes/{sandbox_id}/proxy/{port}/{path:path}")
async def proxy_daytona_preview(
    sandbox_id: str,
    port: int,
    path: str,
    request: Request,
    user_id: Optional[str] = Depends(get_optional_user_id)
):
    """
    Proxy a request to the Daytona preview URL, injecting the header to skip the warning.
    """
    logger.debug(f"Proxy request: sandbox={sandbox_id} port={port} path={path}")
    logger.debug(f"Incoming Request URL: {request.url}")
    
    client = await db.client
    # Verify access (optional but recommended)
    await verify_sandbox_access_optional(client, sandbox_id, user_id)

    try:
        # Get the sandbox to retrieve the correct preview URL dynamically
        sandbox = await get_sandbox_by_id_safely(client, sandbox_id)
        
        # Get the authoritative preview URL from Daytona
        # This handles different domains (daytona.app, daytona.work, etc.) automatically
        preview_link_obj = await sandbox.get_preview_link(port)
        base_target_url = preview_link_obj.url if hasattr(preview_link_obj, 'url') else str(preview_link_obj)
        
        # Strip trailing slash from base if present to avoid double slashes
        base_target_url = base_target_url.rstrip('/')
        
        # Construct full target URL
        # Ensure path starts with / if it's not empty
        if path and not path.startswith('/'):
            path = f"/{path}"
            
        target_url = f"{base_target_url}{path}"
        
        if request.query_params:
            target_url += f"?{request.query_params}"
            
        logger.debug(f"Proxying to upstream Daytona URL: {target_url}")

        import httpx
        from fastapi.responses import StreamingResponse
        
        # Create client without follow_redirects=True initially to debug, 
        # but we likely need it. However, we must ensure headers persist.
        # httpx strips Authorization headers on redirect, but custom headers should persist 
        # unless it's a cross-origin redirect which might be tricky.
        # For now, keep follow_redirects=True.
        async_client = httpx.AsyncClient(follow_redirects=True, verify=False) # Disable SSL verify for upstream if needed
        
        # Disable compression to ensure we can sniff the content type correctly
        # and to avoid double-compression issues
        headers = {
            'X-Daytona-Skip-Preview-Warning': 'true',
            'Accept-Encoding': 'identity'
        }
        
        req = async_client.build_request('GET', target_url, headers=headers)
        
        logger.debug(f"Sending proxy request to: {target_url} with headers: {headers}")
        
        r = await async_client.send(req, stream=True)
        
        logger.debug(f"Upstream response: {r.status_code} Content-Type: {r.headers.get('content-type')}")
        logger.debug(f"Upstream headers: {dict(r.headers)}")
        
        # Determine content type
        content_type = r.headers.get("content-type")
        
        # Force text/html for .html files regardless of upstream header
        if path.lower().endswith('.html') or path.lower().endswith('.htm'):
            content_type = 'text/html; charset=utf-8'
            logger.debug(f"Forcing Content-Type: {content_type} based on file extension")
        
        # Create an iterator for the response bytes
        iterator = r.aiter_bytes()
        first_chunk = b""
        
        # Also check for escaped HTML if it's an HTML file
        is_html_file = path.lower().endswith('.html') or path.lower().endswith('.htm')
        
        # If content type is generic or missing, try to sniff the content
        # This is more robust than checking file extensions
        if not content_type or 'text/plain' in content_type or 'application/octet-stream' in content_type or is_html_file:
            try:
                # Peek at the first chunk
                first_chunk = await iterator.__anext__()
                
                # Simple sniffing for HTML
                # Check for common HTML tags at the start (ignoring whitespace)
                sample = first_chunk[:1024].strip().lower()
                logger.debug(f"Sniffing sample (len={len(sample)}): {sample[:50]}...")
                
                is_escaped_html = False
                if sample.startswith(b'&lt;html') or sample.startswith(b'&lt;!doctype') or b'&lt;html' in sample[:100]:
                    is_escaped_html = True
                    logger.warning(f"Detected escaped HTML in proxy stream for {path}")
                
                if sample.startswith(b'<!doctype html') or sample.startswith(b'<html') or b'<html' in sample[:100] or is_escaped_html:
                    content_type = 'text/html; charset=utf-8'
                    logger.debug(f"Sniffed HTML content for {path}, forcing Content-Type: {content_type}")
                    
                    # If we force content type, we must ensure nosniff doesn't block us if it was set upstream
                    if 'x-content-type-options' in r.headers:
                        logger.debug("Removing X-Content-Type-Options header to allow sniffing override")
                        pass
            except StopAsyncIteration:
                # Empty body
                logger.debug("Empty response body from upstream")
                pass
            except Exception as e:
                logger.warning(f"Error sniffing content type: {e}")
        
        async def unescape_stream(iterator):
            """
            Generator that unescapes HTML content from the stream.
            This buffers the content to unescape it.
            """
            buffer = b""
            async for chunk in iterator:
                buffer += chunk
            
            # Decode, unescape, and re-encode
            try:
                decoded = buffer.decode('utf-8')
                unescaped = html.unescape(decoded)
                yield unescaped.encode('utf-8')
            except Exception as e:
                logger.error(f"Failed to unescape stream: {e}")
                yield buffer

        async def stream_generator():
            # Reconstruct the full stream
            async def chain_iterator():
                if first_chunk:
                    yield first_chunk
                async for chunk in iterator:
                    yield chunk
            
            final_iterator = chain_iterator()
            
            # If we detected escaped HTML, wrap the iterator in the unescaper
            if 'is_escaped_html' in locals() and is_escaped_html:
                logger.info(f"Enabling HTML unescaping for {path}")
                async for chunk in unescape_stream(final_iterator):
                    yield chunk
            else:
                async for chunk in final_iterator:
                    yield chunk
        
        logger.debug(f"Final Response - Status: {r.status_code}, Content-Type: {content_type}")
        
        # We should probably forward some headers, but for now let's just ensure Content-Type is correct.
        # If we want to be a transparent proxy, we should forward safe headers.
        # But for this specific fix, just setting media_type is key.
        
        # Construct response headers
        response_headers = {}
        # Forward some safe headers if needed, but definitely NOT Content-Disposition if we want inline
        # Actually, let's explicitly set Content-Disposition to inline to be safe
        response_headers["Content-Disposition"] = "inline"
        
        return StreamingResponse(
            stream_generator(),
            status_code=r.status_code,
            media_type=content_type,
            headers=response_headers,
            background=None 
        )
    except Exception as e:
        logger.error(f"Error proxying to Daytona: {e}")
        raise HTTPException(status_code=502, detail=f"Failed to proxy request: {str(e)}")

