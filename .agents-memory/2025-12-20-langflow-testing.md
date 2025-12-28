# Langflow API Testing Memory

## Testing Context
- **Location**: `backend/core/workflows/tests/test_langflow_projects_api.py`
- **Target**: Langflow Projects API (`/api/v1/projects/`)
- **Status**: ✅ All 21 tests passing

## Execution Environment (Docker)
The `suna-backend-1` container uses a virtual environment.
- **Python Path**: `/app/.venv/bin/python`
- **Pip Path**: Not directly exposed in `bin`, but modules are pre-installed.
- **Global Python**: `/usr/local/bin/python` (Avoid using this, lacks dependencies)

## Common Pitfalls
1. **ModuleNotFoundError ('redis', 'core', etc.)**:
   - This occurs if you run tests inside `backend/core/...` without the full app context/dependencies being perfect.
   - **Fix**: For isolated API tests, run them from `/tmp` or use `--ignore-glob="*/__init__.py"` to prevent pytest from walking up the package tree and triggering app initialization.

2. **Asyncio Fixtures**:
   - Use `@pytest_asyncio.fixture` instead of `@pytest.fixture` for async fixtures to avoid scope warnings/errors.

## Test Command
```bash
docker exec suna-backend-1 /app/.venv/bin/python -m pytest /path/to/test.py -v
```

## Configuration
- Uses `ADVANCED_WORKFLOWS_BACKEND_URL` (default: `http://host.docker.internal:7861`)
- Uses `ADVANCED_WORKFLOWS_INTEGRATION_SECRET`
