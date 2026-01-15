from daytona_sdk import AsyncDaytona, DaytonaConfig, CreateSandboxFromSnapshotParams, AsyncSandbox, SessionExecuteRequest, Resources, SandboxState
from dotenv import load_dotenv
from core.utils.logger import logger
from core.utils.config import config
from core.utils.config import Configuration
import asyncio

load_dotenv()

# logger.debug("Initializing Daytona sandbox configuration")
daytona_config = DaytonaConfig(
    api_key=config.DAYTONA_API_KEY,
    api_url=config.DAYTONA_SERVER_URL, 
    target=config.DAYTONA_TARGET,
)

if daytona_config.api_key:
    logger.debug("Daytona sandbox configured successfully")
else:
    logger.warning("No Daytona API key found in environment variables")

if daytona_config.api_url:
    logger.debug(f"Daytona API URL set to: {daytona_config.api_url}")
else:
    logger.warning("No Daytona API URL found in environment variables")

if daytona_config.target:
    logger.debug(f"Daytona target set to: {daytona_config.target}")
else:
    logger.warning("No Daytona target found in environment variables")

daytona = AsyncDaytona(daytona_config)

async def get_or_start_sandbox(sandbox_id: str) -> AsyncSandbox:
    """Retrieve a sandbox by ID, check its state, and start it if needed."""
    
    logger.info(f"Getting or starting sandbox with ID: {sandbox_id}")

    try:
        sandbox = await daytona.get(sandbox_id)
        
        # Check if sandbox needs to be started
        if sandbox.state in [SandboxState.ARCHIVED, SandboxState.STOPPED, SandboxState.ARCHIVING]:
            logger.info(f"Sandbox is in {sandbox.state} state. Starting...")
            try:
                await daytona.start(sandbox)
                
                # Wait for sandbox to reach STARTED state
                for _ in range(30):
                    await asyncio.sleep(1)
                    sandbox = await daytona.get(sandbox_id)
                    if sandbox.state == SandboxState.STARTED:
                        break
                
                # Start supervisord in a session when restarting
                await start_supervisord_session(sandbox)
            except Exception as e:
                logger.error(f"Error starting sandbox: {e}")
                raise e
        
        logger.info(f"Sandbox {sandbox_id} is ready")
        return sandbox
        
    except Exception as e:
        logger.error(f"Error retrieving or starting sandbox: {str(e)}")
        raise e

async def start_supervisord_session(sandbox: AsyncSandbox):
    """Start supervisord in a session."""
    session_id = "supervisord-session"
    try:
        await sandbox.process.create_session(session_id)
        await sandbox.process.execute_session_command(session_id, SessionExecuteRequest(
            command="exec /usr/bin/supervisord -n -c /etc/supervisor/conf.d/supervisord.conf",
            var_async=True
        ))
        logger.info("Supervisord started successfully")
    except Exception as e:
        # Don't fail if supervisord already running
        logger.warning(f"Could not start supervisord: {str(e)}")

async def create_sandbox(password: str, project_id: str = None) -> AsyncSandbox:
    """Create a new sandbox with all required services configured and running."""
    
    logger.info("Creating new Daytona sandbox environment")
    # logger.debug("Configuring sandbox with snapshot and environment variables")
    
    labels = None
    if project_id:
        # logger.debug(f"Using sandbox_id as label: {project_id}")
        labels = {'id': project_id}
        
    params = CreateSandboxFromSnapshotParams(
        snapshot=Configuration.SANDBOX_SNAPSHOT_NAME,
        public=True,
        labels=labels,
        env_vars={
            "CHROME_PERSISTENT_SESSION": "true",
            "RESOLUTION": "1048x768x24",
            "RESOLUTION_WIDTH": "1048",
            "RESOLUTION_HEIGHT": "768",
            "VNC_PASSWORD": password,
            "ANONYMIZED_TELEMETRY": "false",
            "CHROME_PATH": "",
            "CHROME_USER_DATA": "",
            "CHROME_DEBUGGING_PORT": "9222",
            "CHROME_DEBUGGING_HOST": "localhost",
            "CHROME_CDP": ""
        },
        # resources=Resources(
        #     cpu=2,
        #     memory=4,
        #     disk=5,
        # ),
        auto_stop_interval=15,
        auto_archive_interval=30,
    )
    
    # Create the sandbox
    sandbox = await daytona.create(params)
    logger.info(f"Sandbox created with ID: {sandbox.id}")
    
    # Start supervisord in a session for new sandbox
    await start_supervisord_session(sandbox)
    
    logger.info(f"Sandbox environment successfully initialized")
    # Patch browserApi.ts to use OpenRouter
    await patch_browser_api(sandbox)
    
    return sandbox

async def delete_sandbox(sandbox_id: str) -> bool:
    """Delete a sandbox by its ID."""
    logger.info(f"Deleting sandbox with ID: {sandbox_id}")

    try:
        # Get the sandbox
        sandbox = await daytona.get(sandbox_id)
        
        # Delete the sandbox
        await daytona.delete(sandbox)
        
        logger.info(f"Successfully deleted sandbox {sandbox_id}")
        return True
    except Exception as e:
        logger.error(f"Error deleting sandbox {sandbox_id}: {str(e)}")
        raise e


# OpenRouter browserApi.ts content - will be injected into sandbox
BROWSER_API_OPENROUTER = '''import express from 'express';
import { Stagehand, type LogLine, type Page } from '@browserbasehq/stagehand';
import { FileChooser } from 'playwright';
const app = express();
app.use(express.json());
interface BrowserActionResult { success: boolean; message: string; error?: string; url: string; title: string; screenshot_base64?: string; action?: string; }
class BrowserAutomation {
    public router: express.Router;
    private stagehand: Stagehand | null;
    public browserInitialized: boolean;
    private page: Page | null;
    constructor() {
        this.router = express.Router();
        this.browserInitialized = false;
        this.stagehand = null;
        this.page = null;
        this.router.post('/navigate', this.navigate.bind(this));
        this.router.post('/screenshot', this.screenshot.bind(this));
        this.router.post('/act', this.act.bind(this));
        this.router.post('/extract', this.extract.bind(this));
        this.router.post('/convert-svg', this.convertSvg.bind(this));
    }
    async init(apiKey: string): Promise<{status: string, message: string}> {
        try {
            if (!this.browserInitialized) {
                if (this.stagehand && this.page) { await this.shutdown(); }
                console.log("Initializing browser with OpenRouter API");
                this.stagehand = new Stagehand({
                    env: "LOCAL", enableCaching: true, verbose: 2,
                    logger: (logLine: LogLine) => { console.log(`[${logLine.category}] ${logLine.message}`); },
                    modelName: "anthropic/claude-haiku-4-5",
                    modelClientOptions: { apiKey, baseURL: "https://openrouter.ai/api/v1" },
                    localBrowserLaunchOptions: { headless: false, viewport: { width: 1024, height: 768 }, downloadsPath: '/workspace/downloads', acceptDownloads: true, preserveUserDataDir: false, args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"] }
                });
                await this.stagehand.init();
                this.browserInitialized = true;
                this.page = this.stagehand.page;
                if (this.page) {
                    this.page.on('close', () => { this.browserInitialized = false; });
                    try { const b = this.page.context().browser(); b?.on('disconnected', () => { this.browserInitialized = false; }); } catch (e) {}
                }
                await this.page.goto('https://www.google.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
                return { status: "healthy", message: "Browser initialized with OpenRouter" };
            }
            return { status: "healthy", message: "Browser already initialized" };
        } catch (error) { return { status: "error", message: String(error) }; }
    }
    health(): {status: string} { return (this.browserInitialized && this.page && !this.page.isClosed()) ? { status: "healthy" } : { status: "unhealthy" }; }
    async shutdown() { this.browserInitialized = false; if (this.stagehand) { try { await this.stagehand.close(); } catch (e) {} } this.stagehand = null; this.page = null; return { status: "shutdown", message: "Browser shutdown" }; }
    async get_stagehand_state() { try { if (this.page && this.health().status === "healthy") { const s = await this.page.screenshot({ fullPage: false }).then(b => b.toString('base64')); return { url: await this.page.url(), title: await this.page.title(), screenshot_base64: s }; } return { url: "", title: "", screenshot_base64: "" }; } catch (e) { return { url: "", title: "", screenshot_base64: "" }; } }
    async navigate(req: express.Request, res: express.Response): Promise<void> { try { if (this.page && this.browserInitialized) { const { url } = req.body; await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }); const p = await this.get_stagehand_state(); res.json({ success: true, message: "Navigated to " + url, url: p.url, title: p.title, screenshot_base64: p.screenshot_base64 }); } else { res.status(500).json({ success: false, message: "Browser not initialized", url: "", title: "" }); } } catch (e) { const p = await this.get_stagehand_state(); res.status(500).json({ success: false, message: "Failed", url: p.url, title: p.title, error: e }); } }
    async screenshot(req: express.Request, res: express.Response): Promise<void> { try { if (this.page && this.browserInitialized) { const p = await this.get_stagehand_state(); res.json({ success: true, message: "Screenshot taken", url: p.url, title: p.title, screenshot_base64: p.screenshot_base64 }); } else { res.status(500).json({ success: false, message: "Browser not initialized", url: "", title: "" }); } } catch (e) { const p = await this.get_stagehand_state(); res.status(500).json({ success: false, message: "Failed", url: p.url, title: p.title, error: e }); } }
    async act(req: express.Request, res: express.Response): Promise<void> { try { if (this.page && this.browserInitialized) { const { action, iframes, variables, filePath } = req.body; const fh = async (fc: FileChooser) => { if(filePath) { await fc.setFiles(filePath); } else { await fc.setFiles([]); } }; this.page.on('filechooser', fh); const r = await this.page.act({action, iframes: iframes || true, variables}); const p = await this.get_stagehand_state(); this.page.off('filechooser', fh); res.json({ success: r.success, message: r.message, action: r.action, url: p.url, title: p.title, screenshot_base64: p.screenshot_base64 }); } else { res.status(500).json({ success: false, message: "Browser not initialized", url: "", title: "" }); } } catch (e) { const p = await this.get_stagehand_state(); res.status(500).json({ success: false, message: "Failed", url: p.url, title: p.title, error: e }); } }
    async extract(req: express.Request, res: express.Response): Promise<void> { try { if (this.page && this.browserInitialized) { const { instruction, iframes } = req.body; const r = await this.page.extract({ instruction, iframes }); const p = await this.get_stagehand_state(); res.json({ success: r.success, message: `Extracted`, action: r.extraction, url: p.url, title: p.title, screenshot_base64: p.screenshot_base64 }); } else { res.status(500).json({ success: false, message: "Browser not initialized", url: "", title: "" }); } } catch (e) { const p = await this.get_stagehand_state(); res.status(500).json({ success: false, message: "Failed", url: p.url, title: p.title, error: e }); } }
    async convertSvg(req: express.Request, res: express.Response) { res.json({ success: true, message: "SVG conversion not implemented in patch" }); }
}
const browserAutomation = new BrowserAutomation();
app.use('/api', browserAutomation.router);
app.get('/api', (req, res) => { const h = browserAutomation.health(); res.status(h.status === "healthy" ? 200 : 500).json({ status: h.status, service: "browserApi" }); });
app.post('/api/init', async (req, res) => { const {api_key} = req.body; const r = await browserAutomation.init(api_key); res.status(r.status === "healthy" ? 200 : 500).json({ status: r.status, message: r.message }); });
app.listen(8004, () => { console.log('Starting browser server on port 8004 with OpenRouter'); });
'''

async def patch_browser_api(sandbox: AsyncSandbox):
    """Patch browserApi.ts in sandbox to use OpenRouter instead of Gemini"""
    try:
        logger.info("Patching browserApi.ts to use OpenRouter...")
        
        # Write the patched browserApi.ts
        await sandbox.filesystem.write_file("/app/browserApi.ts", BROWSER_API_OPENROUTER)
        
        # Restart the browserApi service
        session_id = "patch-session"
        try:
            await sandbox.process.create_session(session_id)
        except:
            pass
        
        await sandbox.process.execute_session_command(session_id, SessionExecuteRequest(
            command="supervisorctl restart browserApi",
            var_async=False
        ))
        
        logger.info("browserApi.ts patched successfully to use OpenRouter!")
        return True
    except Exception as e:
        logger.error(f"Failed to patch browserApi.ts: {e}")
        return False
