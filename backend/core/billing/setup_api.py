from fastapi import APIRouter, Depends, HTTPException
from core.utils.auth_utils import verify_and_get_user_id_from_jwt
from core.utils.logger import logger
from .free_tier_service import free_tier_service
from core.utils.suna_default_agent_service import SunaDefaultAgentService
from core.services.supabase import DBConnection

router = APIRouter(prefix="/setup", tags=["setup"])

@router.post("/initialize")
async def initialize_account(
    account_id: str = Depends(verify_and_get_user_id_from_jwt)
):
    try:
        logger.info(f"[SETUP] Initializing account for {account_id}")
        
        db = DBConnection()
        await db.initialize()
        
        logger.info(f"[SETUP] Installing Suna agent for {account_id}")
        suna_service = SunaDefaultAgentService(db)
        await suna_service.install_suna_agent_for_user(account_id)
        
        logger.info(f"[SETUP] ✅ Account initialization complete for {account_id}")
        
        return {
            'success': True,
            'message': 'Account initialized successfully',
        }
        
    except Exception as e:
        logger.error(f"[SETUP] Error initializing account {account_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

