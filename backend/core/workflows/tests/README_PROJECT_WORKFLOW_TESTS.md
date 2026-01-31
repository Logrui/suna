# Project and Workflow Creation Unit Tests

## Summary

Created comprehensive unit tests for the Advanced Workflows integration in **Suna Kortix** to test programmatic creation of projects and workflows using the auth session exchange logic.

**Test File Location:**
```
d:\Homelab\suna\backend\core\workflows\tests\test_project_workflow_creation.py
```

## What Was Tested

### 1. **`ensure_project_exists()` Function**
Tests for creating/fetching Langflow projects from Suna backend:

- ✅ **Creation of new projects** - Verifies 201 response and `created: true`
- ✅ **Fetching existing projects** - Verifies 200 response and `created: false`
- ✅ **Auth headers** - Ensures Bearer token and Integration Key are sent correctly
- ✅ **Request payload** - Validates `suna_agent_id`, `name`, and `description` fields
- ✅ **Error handling**:
  - Service unavailable (503)
  - Timeout (504)
  - Bad gateway for server errors (502)

### 2. **`ensure_flow_exists()` Function**
Tests for creating/fetching Langflow flows from Suna backend:

- ✅ **Creation of new flows** - Verifies 201 response and `created: true`
- ✅ **Fetching existing flows** - Verifies 200 response and `created: false`
- ✅ **Auth headers** - Ensures Bearer token and Integration Key are sent correctly
- ✅ **Request payload** - Validates `suna_workflow_id`, `suna_agent_id`, `name`, and `description`
- ✅ **Project linkage** - Confirms `folder_id` correctly links flow to parent project (agent)
- ✅ **Error handling** - Same as project tests

### 3. **Complete Sequence Tests**
Tests for the end-to-end flow of creating both projects and flows:

- ✅ **New project + New flow** - Both created and properly linked
- ✅ **Existing project + New flow** - Only flow is created, linked to existing project
- ✅ **ID mapping** - Verifies 1:1 mapping (Suna Agent ID = Langflow Project ID, Suna Workflow ID = Langflow Flow ID)

## Test Structure

```python
class TestEnsureProjectExists:
    """Unit tests for ensure_project_exists()"""
    # 7 test methods covering all scenarios

class TestEnsureFlowExists:
    """Unit tests for ensure_flow_exists()"""
    # 8 test methods covering all scenarios

class TestProjectAndFlowCreationSequence:
    """Test complete sequences of project + flow creation"""
    # 2 test methods for different scenarios
```

## Running the Tests

### From Suna Backend Container

```bash
# Run just these tests
docker exec -it suna-backend-1 uv run pytest core/workflows/tests/test_project_workflow_creation.py -v

# Run with coverage
docker exec -it suna-backend-1 uv run pytest core/workflows/tests/test_project_workflow_creation.py -v --cov=core.advanced_workflows_bridge

# Run specific test class
docker exec -it suna-backend-1 uv run pytest core/workflows/tests/test_project_workflow_creation.py::TestEnsureProjectExists -v
```

### From Local Environment

```bash
cd d:\Homelab\suna\backend
uv run pytest core/workflows/tests/test_project_workflow_creation.py -v
```

## Test Markers

All tests are marked as integration tests and use async:
- `@pytest.mark.asyncio` - All tests are async
- Can add `@pytest.mark.integration` to mark as integration tests

## Dependencies

Tests use:
- `pytest` - Test framework
- `pytest-asyncio` - Async test support
- `unittest.mock` - Mocking HTTP calls and database queries
- `httpx` - HTTP client mocking

All dependencies are already in `pyproject.toml`.

## Key Mock Patterns Used

### 1. **Environment Variables**
```python
with patch.dict(os.environ, mock_env):
    # Test code
```

### 2. **HTTP Responses**
```python
mock_response = AsyncMock()
mock_response.status_code = 201
mock_response.json.return_value = {...}

with patch("httpx.AsyncClient.post", return_value=mock_response):
    # Test code
```

### 3. **HTTP Errors**
```python
with patch("httpx.AsyncClient.post", side_effect=httpx.TimeoutException("timeout")):
    # Test code
```

## Coverage

The tests cover:
- ✅ All success paths (new and existing resources)
- ✅ All error paths (503, 504, 502)
- ✅ Auth header validation
- ✅ Request payload validation
- ✅ Response parsing
- ✅ 1:1 ID mapping
- ✅ Project-flow linkage (folder_id)

## Integration with Existing Tests

These tests complement the existing E2E tests in:
```
d:\Homelab\suna\backend\core\workflows\tests\test_advanced_workflows_e2e.py
```

**Differences:**
- **E2E tests** - Mock the entire session flow including token exchange
- **These unit tests** - Focus specifically on project/flow creation with real HTTP mocking

## Next Steps

1. **Run the tests** to verify they pass
2. **Add to CI/CD** pipeline if one exists
3. **Monitor coverage** - Target \u003e80% for these critical functions
4. **Extend as needed** - Add more edge cases if discovered

## Notes

- Tests are **isolated** - Each test is independent
- Tests use **AsyncMock** for all async functions
- All external dependencies (HTTP, DB) are **mocked**
- Tests verify **both happy and error paths**
