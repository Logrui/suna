import json
import hashlib
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from uuid import uuid4
from cryptography.fernet import Fernet
import os

from core.services.supabase import DBConnection
from core.utils.logger import logger


@dataclass
class ComposioProfile:
    profile_id: str
    account_id: str
    mcp_qualified_name: str
    profile_name: str
    display_name: str
    encrypted_config: str
    config_hash: str
    toolkit_slug: str
    toolkit_name: str
    mcp_url: str
    redirect_url: Optional[str] = None
    connected_account_id: Optional[str] = None
    is_active: bool = True
    is_default: bool = False
    is_connected: bool = False
    created_at: datetime = None
    updated_at: datetime = None


class ComposioProfileService:
    def __init__(self, db_connection: Optional[DBConnection] = None):
        self.db = db_connection or DBConnection()
        
    def _get_encryption_key(self) -> bytes:
        # Try MCP_CREDENTIAL_ENCRYPTION_KEY first, then fall back to ENCRYPTION_KEY
        key = os.getenv("MCP_CREDENTIAL_ENCRYPTION_KEY") or os.getenv("ENCRYPTION_KEY")
        if not key:
            raise ValueError("MCP_CREDENTIAL_ENCRYPTION_KEY or ENCRYPTION_KEY environment variable is required")
        return key.encode()

    def _encrypt_config(self, config_json: str) -> str:
        fernet = Fernet(self._get_encryption_key())
        return fernet.encrypt(config_json.encode()).decode()

    def _decrypt_config(self, encrypted_config: str) -> Dict[str, Any]:
        fernet = Fernet(self._get_encryption_key())
        decrypted = fernet.decrypt(encrypted_config.encode()).decode()
        return json.loads(decrypted)

    def _generate_config_hash(self, config_json: str) -> str:
        return hashlib.sha256(config_json.encode()).hexdigest()

    def _build_config(
        self,
        toolkit_slug: str,
        toolkit_name: str,
        mcp_url: str,
        redirect_url: Optional[str] = None,
        user_id: str = "default",
        connected_account_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        logger.debug(f"[BUILD_CONFIG] Starting with types:")
        logger.debug(f"  - toolkit_slug: {type(toolkit_slug).__name__} = {repr(toolkit_slug)}")
        logger.debug(f"  - toolkit_name: {type(toolkit_name).__name__} = {repr(toolkit_name)}")
        logger.debug(f"  - mcp_url: {type(mcp_url).__name__} = {repr(mcp_url)}")
        logger.debug(f"  - redirect_url: {type(redirect_url).__name__} = {repr(redirect_url)}")
        logger.debug(f"  - user_id: {type(user_id).__name__} = {repr(user_id)}")
        logger.debug(f"  - connected_account_id: {type(connected_account_id).__name__} = {repr(connected_account_id)}")
        
        # Ensure all values are proper types before building config
        if isinstance(mcp_url, list):
            logger.warning(f"[BUILD_CONFIG] mcp_url is a list, converting: {mcp_url}")
            mcp_url = mcp_url[0] if mcp_url else ""
        if isinstance(redirect_url, list):
            logger.warning(f"[BUILD_CONFIG] redirect_url is a list, converting: {redirect_url}")
            redirect_url = redirect_url[0] if redirect_url else None
        if isinstance(user_id, list):
            logger.warning(f"[BUILD_CONFIG] user_id is a list, converting: {user_id}")
            user_id = user_id[0] if user_id else "default"
        if isinstance(connected_account_id, list):
            logger.warning(f"[BUILD_CONFIG] connected_account_id is a list, converting: {connected_account_id}")
            connected_account_id = connected_account_id[0] if connected_account_id else None
        
        config_dict = {
            "type": "composio",
            "toolkit_slug": toolkit_slug,
            "toolkit_name": toolkit_name,
            "mcp_url": str(mcp_url) if mcp_url else "",
            "redirect_url": str(redirect_url) if redirect_url else None,
            "user_id": str(user_id) if user_id else "default",
            "connected_account_id": str(connected_account_id) if connected_account_id else None,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        logger.debug(f"[BUILD_CONFIG] Final config dict: {config_dict}")
        return config_dict

    async def _generate_unique_profile_name(self, base_name: str, account_id: str, mcp_qualified_name: str, client) -> str:
        original_name = base_name
        counter = 1
        current_name = base_name
        
        while True:
            existing = await client.table('user_mcp_credential_profiles').select('profile_id').eq(
                'account_id', account_id
            ).eq('mcp_qualified_name', mcp_qualified_name).eq('profile_name', current_name).execute()
            
            if not existing.data:
                return current_name
            
            counter += 1
            current_name = f"{original_name} ({counter})"

    async def create_profile(
        self,
        account_id: str,
        profile_name: str,
        toolkit_slug: str,
        toolkit_name: str,
        mcp_url: str,
        redirect_url: Optional[str] = None,
        user_id: str = "default",
        is_default: bool = False,
        connected_account_id: Optional[str] = None,
    ) -> ComposioProfile:
        try:
            logger.debug(f"[CREATE_PROFILE_ENTER] Function entry - about to log parameters")
            logger.debug(f"[CREATE_PROFILE_START] Received parameters:")
            logger.debug(f"  - account_id: type={type(account_id).__name__}, value={repr(account_id)}")
            logger.debug(f"  - profile_name: type={type(profile_name).__name__}, value={repr(profile_name)}")
            logger.debug(f"  - toolkit_slug: type={type(toolkit_slug).__name__}, value={repr(toolkit_slug)}")
            logger.debug(f"  - toolkit_name: type={type(toolkit_name).__name__}, value={repr(toolkit_name)}")
            logger.debug(f"  - mcp_url: type={type(mcp_url).__name__}, value={repr(mcp_url)}")
            logger.debug(f"[REDIRECT_URL_RECEIVED] redirect_url: type={type(redirect_url).__name__}, value={repr(redirect_url)}, is_None={redirect_url is None}, is_string={isinstance(redirect_url, str)}, is_list={isinstance(redirect_url, list)}")
            logger.debug(f"  - user_id: type={type(user_id).__name__}, value={repr(user_id)}")
            logger.debug(f"  - connected_account_id: type={type(connected_account_id).__name__}, value={repr(connected_account_id)}")
            
            logger.debug(f"Creating Composio profile for user: {account_id}, toolkit: {toolkit_slug}")
            logger.debug(f"MCP URL to store: {mcp_url}")
            
            # Ensure all parameters are properly typed (handle API responses that might return lists)
            if isinstance(mcp_url, list):
                logger.warning(f"[TYPE_ISSUE] mcp_url is a list, converting to string: {mcp_url}")
                mcp_url = mcp_url[0] if mcp_url else ""
            
            if redirect_url is not None and isinstance(redirect_url, list):
                logger.warning(f"[TYPE_ISSUE] redirect_url is a list, converting to string: {redirect_url}")
                redirect_url = redirect_url[0] if redirect_url else None
            
            if user_id and isinstance(user_id, list):
                logger.warning(f"user_id is a list, converting to string: {user_id}")
                user_id = user_id[0] if user_id else "default"
            
            logger.debug(f"[REDIRECT_URL_AFTER_CONVERSION] Before str(): type={type(redirect_url).__name__}, value={repr(redirect_url)}")
            mcp_url = str(mcp_url) if mcp_url else ""
            redirect_url = str(redirect_url) if redirect_url else None
            logger.debug(f"[REDIRECT_URL_AFTER_CONVERSION] After str(): type={type(redirect_url).__name__}, value={repr(redirect_url)}")
            user_id = str(user_id) if user_id else "default"
            
            logger.debug(f"[BUILD_CONFIG_CALL] About to call _build_config with redirect_url:")
            logger.debug(f"  - Type: {type(redirect_url).__name__}")
            logger.debug(f"  - Value: {repr(redirect_url)}")
            logger.debug(f"  - Is None: {redirect_url is None}")
            logger.debug(f"  - Is string: {isinstance(redirect_url, str)}")
            logger.debug(f"  - Is list: {isinstance(redirect_url, list)}")
            if isinstance(redirect_url, list):
                logger.error(f"[BUILD_CONFIG_CALL] ERROR: redirect_url is still a list before _build_config call!")
            
            config = self._build_config(
                toolkit_slug, toolkit_name, mcp_url, redirect_url, user_id, connected_account_id
            )
            logger.debug(f"[POST_BUILD_CONFIG] Immediately after _build_config call")
            logger.debug(f"[CONFIG_BUILT] Config successfully built")
            
            try:
                config_json = json.dumps(config, sort_keys=True)
                logger.debug(f"[CONFIG_BUILT] JSON serialization successful")
            except Exception as json_err:
                logger.error(f"[CONFIG_JSON_ERROR] Failed to JSON serialize config: {type(json_err).__name__}: {str(json_err)}")
                raise
                
            try:
                encrypted_config = self._encrypt_config(config_json)
                logger.debug(f"[CONFIG_BUILT] Encryption successful")
            except Exception as encrypt_err:
                logger.error(f"[CONFIG_ENCRYPT_ERROR] Failed to encrypt config: {type(encrypt_err).__name__}: {str(encrypt_err)}")
                raise
                
            try:
                config_hash = self._generate_config_hash(config_json)
                logger.debug(f"[CONFIG_BUILT] Hash generation successful")
            except Exception as hash_err:
                logger.error(f"[CONFIG_HASH_ERROR] Failed to hash config: {type(hash_err).__name__}: {str(hash_err)}")
                raise
            
            mcp_qualified_name = f"composio.{toolkit_slug}"
            profile_id = str(uuid4())
            now = datetime.now(timezone.utc)
            
            client = await self.db.client
            
            unique_profile_name = await self._generate_unique_profile_name(
                profile_name, account_id, mcp_qualified_name, client
            )
            
            if unique_profile_name != profile_name:
                logger.debug(f"Generated unique profile name: {unique_profile_name} (original: {profile_name})")
            
            if is_default:
                await client.table('user_mcp_credential_profiles').update({
                    'is_default': False
                }).eq('account_id', account_id).eq('mcp_qualified_name', mcp_qualified_name).execute()
            
            logger.debug("[DB_INSERT_START] About to insert profile into database")
            
            try:
                result = await client.table('user_mcp_credential_profiles').insert({
                    'profile_id': profile_id,
                    'account_id': account_id,
                    'mcp_qualified_name': mcp_qualified_name,
                    'profile_name': unique_profile_name,
                    'display_name': unique_profile_name,
                    'encrypted_config': encrypted_config,
                    'config_hash': config_hash,
                    'is_active': True,
                    'is_default': is_default,
                    'created_at': now.isoformat(),
                    'updated_at': now.isoformat()
                }).execute()
                
                logger.debug(f"[DB_INSERT_RESULT] Result type: {type(result).__name__}")
                if hasattr(result, 'data'):
                    logger.debug(f"[DB_INSERT_RESULT] Result.data type: {type(result.data).__name__}")
                    logger.debug(f"[DB_INSERT_RESULT] Result.data: {repr(result.data)[:200]}")
                if hasattr(result, 'error'):
                    logger.debug(f"[DB_INSERT_RESULT] Result.error: {repr(result.error)}")
                
                if not result.data:
                    raise Exception("Failed to create profile in database")
                    
            except Exception as db_error:
                logger.error(f"[DB_INSERT_ERROR] Exception type: {type(db_error).__name__}")
                logger.error(f"[DB_INSERT_ERROR] Exception message: {str(db_error)}")
                logger.error(f"[DB_INSERT_ERROR] Exception args: {repr(db_error.args)}")
                raise
            
            logger.debug(f"Successfully created Composio profile: {profile_id}")
            
            logger.debug(f"[CREATE_COMPOSIO_PROFILE_OBJ] Building ComposioProfile object:")
            logger.debug(f"  - profile_id: {repr(profile_id)}")
            logger.debug(f"  - account_id: {repr(account_id)}")
            logger.debug(f"  - toolkit_slug: type={type(toolkit_slug).__name__}, value={repr(toolkit_slug)}")
            logger.debug(f"  - toolkit_name: type={type(toolkit_name).__name__}, value={repr(toolkit_name)}")
            logger.debug(f"  - mcp_url: type={type(mcp_url).__name__}, value={repr(mcp_url)}")
            logger.debug(f"  - redirect_url: type={type(redirect_url).__name__}, value={repr(redirect_url)}")
            logger.debug(f"  - connected_account_id: type={type(connected_account_id).__name__}, value={repr(connected_account_id)}")
            
            return ComposioProfile(
                profile_id=profile_id,
                account_id=account_id,
                mcp_qualified_name=mcp_qualified_name,
                profile_name=unique_profile_name,
                display_name=unique_profile_name,
                encrypted_config=encrypted_config,
                config_hash=config_hash,
                toolkit_slug=toolkit_slug,
                toolkit_name=toolkit_name,
                mcp_url=mcp_url,
                redirect_url=redirect_url,
                connected_account_id=connected_account_id,
                is_active=True,
                is_default=is_default,
                is_connected=bool(redirect_url),
                created_at=now,
                updated_at=now
            )
            
        except Exception as e:
            try:
                logger.error(f"Failed to create Composio profile: {e}", exc_info=True)
            except Exception as logging_error:
                # If logging itself fails (e.g., with list concatenation), try a safer log
                try:
                    logger.error(f"Failed to create Composio profile. Also failed to log error: {type(logging_error).__name__}")
                except:
                    pass
            raise

    async def get_mcp_config_for_agent(self, profile_id: str) -> Dict[str, Any]:
        try:
            client = await self.db.client
            result = await client.table('user_mcp_credential_profiles').select('*').eq(
                'profile_id', profile_id
            ).execute()
            
            if not result.data:
                raise ValueError(f"Profile {profile_id} not found")
            
            profile_data = result.data[0]

            config = self._decrypt_config(profile_data['encrypted_config'])
            
            if config.get('type') != 'composio':
                raise ValueError(f"Profile {profile_id} is not a Composio profile")
            
            return {
                "name": config['toolkit_name'],
                "type": "composio",
                "mcp_qualified_name": profile_data['mcp_qualified_name'],
                "toolkit_slug": config.get('toolkit_slug', ''),
                "config": {
                    "profile_id": profile_id
                },
                "enabledTools": []
            }
            
        except Exception as e:
            logger.error(f"Failed to get MCP config for profile {profile_id}: {e}", exc_info=True)
            raise
    
    async def get_mcp_url_for_runtime(self, profile_id: str) -> str:
        try:
            client = await self.db.client
            
            result = await client.table('user_mcp_credential_profiles').select('*').eq(
                'profile_id', profile_id
            ).execute()
            
            if not result.data:
                raise ValueError(f"Profile {profile_id} not found")
            
            profile_data = result.data[0]
            
            config = self._decrypt_config(profile_data['encrypted_config'])
            
            if config.get('type') != 'composio':
                raise ValueError(f"Profile {profile_id} is not a Composio profile")
            
            mcp_url = config.get('mcp_url')
            if not mcp_url:
                raise ValueError(f"Profile {profile_id} has no MCP URL")
            
            logger.debug(f"Retrieved MCP URL for profile {profile_id}")
            return mcp_url
            
        except Exception as e:
            logger.error(f"Failed to get MCP URL for profile {profile_id}: {e}", exc_info=True)
            raise

    async def get_profile_config(self, profile_id: str) -> Dict[str, Any]:
        try:
            client = await self.db.client
            
            result = await client.table('user_mcp_credential_profiles').select('encrypted_config').eq(
                'profile_id', profile_id
            ).execute()
            
            if not result.data:
                raise ValueError(f"Profile {profile_id} not found")
            
            return self._decrypt_config(result.data[0]['encrypted_config'])
            
        except Exception as e:
            logger.error(f"Failed to get config for profile {profile_id}: {e}", exc_info=True)
            raise

    async def get_profiles(self, account_id: str, toolkit_slug: Optional[str] = None) -> List[ComposioProfile]:
        try:
            client = await self.db.client
            
            query = client.table('user_mcp_credential_profiles').select('*').eq('account_id', account_id)
            
            if toolkit_slug:
                query = query.eq('mcp_qualified_name', f"composio.{toolkit_slug}")
            else:
                query = query.like('mcp_qualified_name', 'composio.%')
            
            result = await query.execute()
            
            profiles = []
            for row in result.data:
                config = self._decrypt_config(row['encrypted_config'])
                
                profile = ComposioProfile(
                    profile_id=row['profile_id'],
                    account_id=row['account_id'],
                    mcp_qualified_name=row['mcp_qualified_name'],
                    profile_name=row['profile_name'],
                    display_name=row['display_name'],
                    encrypted_config=row['encrypted_config'],
                    config_hash=row['config_hash'],
                    toolkit_slug=config.get('toolkit_slug', ''),
                    toolkit_name=config.get('toolkit_name', ''),
                    mcp_url=config.get('mcp_url', ''),
                    redirect_url=config.get('redirect_url'),
                    connected_account_id=config.get('connected_account_id'),
                    is_active=row.get('is_active', True),
                    is_default=row.get('is_default', False),
                    is_connected=bool(config.get('redirect_url')),
                    created_at=datetime.fromisoformat(row['created_at'].replace('Z', '+00:00')) if row.get('created_at') else None,
                    updated_at=datetime.fromisoformat(row['updated_at'].replace('Z', '+00:00')) if row.get('updated_at') else None
                )
                profiles.append(profile)
            
            return profiles
            
        except Exception as e:
            logger.error(f"Failed to get Composio profiles: {e}", exc_info=True)
            raise 