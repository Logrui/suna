import os
import urllib.parse
import uuid
from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException, APIRouter, Form, Depends, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import Response
from pydantic import BaseModel
from daytona_sdk import AsyncSandbox
import asyncio
import websockets

from core.sandbox.sandbox import get_or_start_sandbox, delete_sandbox, create_sandbox
from core.utils.logger import logger
from core.utils.auth_utils import get_optional_user_id, verify_and_get_user_id_from_jwt, verify_sandbox_access, verify_sandbox_access_optional
from core.services.supabase import DBConnection
from core.utils.sandbox_utils import generate_unique_filename, get_uploads_directory

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
        content_disposition = f"attachment; filename*=UTF-8''{encoded_filename}"
        
        return Response(
            content=content,
            media_type="application/octet-stream",
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
        
        # Determine content type
        content_type = r.headers.get("content-type")
        
        # Create an iterator for the response bytes
        iterator = r.aiter_bytes()
        first_chunk = b""
        
        # If content type is generic or missing, try to sniff the content
        # This is more robust than checking file extensions
        if not content_type or 'text/plain' in content_type or 'application/octet-stream' in content_type:
            try:
                # Peek at the first chunk
                first_chunk = await iterator.__anext__()
                
                # Simple sniffing for HTML
                # Check for common HTML tags at the start (ignoring whitespace)
                sample = first_chunk[:1024].strip().lower()
                logger.debug(f"Sniffing sample (len={len(sample)}): {sample[:50]}...")
                
                if sample.startswith(b'<!doctype html') or sample.startswith(b'<html'):
                    content_type = 'text/html; charset=utf-8'
                    logger.debug(f"Sniffed HTML content for {path}, forcing Content-Type: {content_type}")
            except StopAsyncIteration:
                # Empty body
                logger.debug("Empty response body from upstream")
                pass
            except Exception as e:
                logger.warning(f"Error sniffing content type: {e}")
        
        async def stream_generator():
            if first_chunk:
                yield first_chunk
            async for chunk in iterator:
                yield chunk
        
        return StreamingResponse(
            stream_generator(),
            status_code=r.status_code,
            media_type=content_type,
            background=None 
        )
    except Exception as e:
        logger.error(f"Error proxying to Daytona: {e}")
        raise HTTPException(status_code=502, detail=f"Failed to proxy request: {str(e)}")


@router.websocket("/sandboxes/{sandbox_id}/proxy/{port}/websockify")
async def proxy_daytona_websocket(
    websocket: WebSocket,
    sandbox_id: str,
    port: int,
    user_id: Optional[str] = Depends(get_optional_user_id)
):
    """
    WebSocket proxy for VNC/noVNC connections to Daytona sandbox.

    This endpoint handles bidirectional WebSocket communication required for VNC streaming.
    It relays data between the frontend client and the Daytona VNC server.

    Security: Verifies user has access to the sandbox before accepting the connection.
    """
    upstream_ws = None

    try:
        # Verify access BEFORE accepting the WebSocket connection
        client = await db.client
        await verify_sandbox_access_optional(client, sandbox_id, user_id)

        # Accept WebSocket connection after authorization
        await websocket.accept()
        logger.debug(f"WebSocket connection accepted for sandbox={sandbox_id} port={port} user={user_id}")

        # Get sandbox and retrieve the preview URL
        sandbox = await get_sandbox_by_id_safely(client, sandbox_id)

        # Get the authoritative preview URL from Daytona
        preview_link_obj = await sandbox.get_preview_link(port)
        base_target_url = preview_link_obj.url if hasattr(preview_link_obj, 'url') else str(preview_link_obj)

        # Convert HTTP(S) URL to WebSocket URL (handle protocol prefix properly)
        if base_target_url.startswith('https://'):
            ws_url = 'wss://' + base_target_url[8:]
        elif base_target_url.startswith('http://'):
            ws_url = 'ws://' + base_target_url[7:]
        else:
            ws_url = base_target_url  # Already a ws:// or wss:// URL

        # Add websockify path if not already present
        if not ws_url.endswith('/websockify'):
            ws_url = ws_url.rstrip('/') + '/websockify'

        logger.info(f"Connecting to upstream VNC WebSocket: {ws_url}")

        # Build headers including the skip warning header
        extra_headers = {
            'X-Daytona-Skip-Preview-Warning': 'true'
        }

        # Connect to Daytona VNC server with SSL verification disabled (self-signed certs)
        upstream_ws = await websockets.connect(
            ws_url,
            extra_headers=extra_headers,
            ssl=None,  # Disable SSL verification for development
            ping_interval=20,
            ping_timeout=10
        )

        logger.info(f"Successfully connected to upstream VNC WebSocket for sandbox {sandbox_id}")

        # Flags to track connection state and prevent double-close
        client_closed = False
        upstream_closed = False

        # Create bidirectional relay tasks
        async def relay_client_to_upstream():
            """Relay messages from client (frontend) to upstream (Daytona)"""
            nonlocal client_closed, upstream_closed
            try:
                while True:
                    # Receive from client
                    data = await websocket.receive()

                    if 'text' in data:
                        await upstream_ws.send(data['text'])
                    elif 'bytes' in data:
                        await upstream_ws.send(data['bytes'])
                    else:
                        logger.warning(f"Received unknown data type from client: {data}")
            except WebSocketDisconnect:
                logger.debug("Client WebSocket disconnected")
                client_closed = True
            except Exception as e:
                logger.error(f"Error relaying client to upstream: {e}")
                client_closed = True
            finally:
                # Close upstream connection when client disconnects
                if not upstream_closed and upstream_ws and not upstream_ws.closed:
                    upstream_closed = True
                    try:
                        await upstream_ws.close()
                    except Exception:
                        pass  # Already closed or error during close

        async def relay_upstream_to_client():
            """Relay messages from upstream (Daytona) to client (frontend)"""
            nonlocal client_closed, upstream_closed
            try:
                async for message in upstream_ws:
                    if isinstance(message, bytes):
                        await websocket.send_bytes(message)
                    else:
                        await websocket.send_text(message)
            except websockets.exceptions.ConnectionClosed:
                logger.debug("Upstream WebSocket disconnected")
                upstream_closed = True
            except Exception as e:
                logger.error(f"Error relaying upstream to client: {e}")
                upstream_closed = True
            finally:
                # Close client connection when upstream disconnects
                if not client_closed:
                    client_closed = True
                    try:
                        await websocket.close()
                    except Exception:
                        pass  # Already closed or error during close

        # Run both relay tasks concurrently
        await asyncio.gather(
            relay_client_to_upstream(),
            relay_upstream_to_client(),
            return_exceptions=True
        )

    except HTTPException as e:
        # Auth/access errors - don't accept connection
        logger.error(f"HTTP error in WebSocket proxy: {e}")
        try:
            await websocket.close(code=1008, reason=str(e.detail))
        except Exception:
            pass  # Connection may not be accepted yet
    except websockets.exceptions.WebSocketException as e:
        logger.error(f"WebSocket error connecting to Daytona: {e}")
        try:
            await websocket.close(code=1011, reason=f"Failed to connect to VNC server: {str(e)}")
        except Exception:
            pass  # Already closed
    except Exception as e:
        logger.error(f"Unexpected error in WebSocket proxy: {e}", exc_info=True)
        try:
            await websocket.close(code=1011, reason=f"Internal error: {str(e)}")
        except Exception:
            pass  # Already closed
    finally:
        # Final cleanup - ensure upstream is closed
        if upstream_ws and not upstream_ws.closed:
            try:
                await upstream_ws.close()
            except Exception:
                pass
        logger.debug(f"WebSocket proxy closed for sandbox {sandbox_id}")

