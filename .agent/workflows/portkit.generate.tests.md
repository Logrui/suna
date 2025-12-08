---
description: Create repo-specific testing scripts to enable behavioral verification.
---

//turbo-all

## User Input
```text
$ARGUMENTS
```

## Outline
1.  **Parse Input**: Identify Feature Name and Technology (e.g., Next.js, Python).
2.  **Analyze Context**:
    *   Check `package.json` for `playwright`, `cypress`, `jest`.
    *   Check `pyproject.toml` or `requirements.txt` for `pytest`.

3.  **Strategy**:
    *   **Frontend**: Prefer Playwright E2E for generic feature verification.
    *   **Backend**: Prefer Pytest integration tests.

4.  **Scaffold Test**:
    *   **Create File**: `tests/portkit_[feature].spec.ts` (or `test_portkit_[feature].py`).
    *   **Draft Content**:
        *   Import `spec.md` requirements (as comments).
        *   Generate standard boilerplate (Login -> Navigate to Page -> Assert Element Visible).
        *   *Note*: Use best-guess selectors based on `research.md` or `tasks.md` file modifications.

5.  **Completion**:
    *   Output: "Test scaffold created at `tests/portkit_[feature].spec.ts`. Run with `npx playwright test ...`."
