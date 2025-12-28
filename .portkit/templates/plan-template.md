# Portkit: Implementation Plan

**Feature**: [Feature Name]
**Based On**: `research.md`
**Date**: [Date]

## 1. Technical Context & Constitution
<!-- Adapted from Speckit plan-template.md -->
*   **Language/Version**: [e.g. TypeScript 5.0]
*   **Target Platform**: [e.g. Next.js App Router]
*   **Constitution Check**: [Pass/Fail]

## 2. Checklist (The "Go-To" Guide)
<!-- Extracted from checklist.md -->
*   [ ] Fetch Upstream Branch
*   [ ] Extract Custom Logic from `Button.tsx`
*   [ ] Sync new files (`NewPage.tsx`)
*   [ ] Morph `Button.tsx` (Inject Upstream + Re-apply Custom)
*   [ ] Verify Build

## 3. Component Morph Strategy
<!-- Detailed instructions for the Builder (Portkit Specific) -->
### `Button.tsx`
1.  Run `extract-region` to save `variant` logic.
2.  Overwrite with Upstream file.
3.  Inject saved logic at line 45.

## 4. Project Structure (Impact Analysis)
<!-- Adapted from Speckit plan-template.md -->
```text
src/components/
├── Button.tsx           # Modified (Morph)
└── NewPage.tsx          # New (Copy)
```

## 5. Task Decomposition (High Level)
<!-- Pointer to tasks.md -->
*   See `tasks.md` for the granular Step-by-Step builder instructions.
