---

description: "Task list template for feature implementation"
---

# Tasks: [FEATURE NAME]

**Input**: Design documents from `/specs/[###-feature-name]/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: The examples below include test tasks. Tests are OPTIONAL - only include them if explicitly requested in the feature specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

# Portkit Tasks: [FEATURE NAME]

**Input**: `implementation_plan.md`
**Goal**: Execute the port/sync of [FEATURE NAME] with zero regressions.

## Phase 1: Environment & Fetch (The "Ingestion")
**Purpose**: Get the raw materials ready.
- [ ] T001 Run `fetch-upstream` to update `.portkit-cache` to target ref.
- [ ] T002 Run `map-dependencies` on upstream entry points to finalize Blast Radius.
- [ ] T003 [P] Create local directory structure (`src/features/...`).

## Phase 2: Shim & Scrub (The "Sanitization")
**Purpose**: Prepare the code for our repo (remove poison).
- [ ] T004 Run `sanitize-upstream` on `FileA.tsx` (Target: `next-intl`).
- [ ] T005 [P] Run `sanitize-upstream` on `FileB.ts` (Target: `Stripe`).
- [ ] T006 Manual Scrub: Remove any residual enterprise-only logic.

## Phase 3: Component Morphing (The "Morph")
**Purpose**: Merge complex UI/Logic (The hardest part).
- [ ] T007 Run `extract-region` on `LocalButton.tsx` (Save custom variants).
- [ ] T008 Overwrite `LocalButton.tsx` with Upstream version.
- [ ] T009 Inject saved regions back into `LocalButton.tsx`.
- [ ] T010 Resolve manual conflicts in `LocalButton.tsx`.

## Phase 4: Integration (The "Wiring")
**Purpose**: Connect the ported code to our backend/state.
- [ ] T011 Create "Bridge Adapter" for Auth (`src/auth/bridge.ts`).
- [ ] T012 Update `routes.ts` to include new pages.
- [ ] T013 [P] Add DB Migrations (if applicable).

## Phase 5: Verification (The "Audit Loop")
**Purpose**: Prove it works.
- [ ] T014 Run `verify-project` (Build/Lint check).
- [ ] T015 Create temp test `verify_feature.spec.ts`.
- [ ] T016 Run behavioral test -> Must Pass.
- [ ] T017 cleanup: Remove temp test files.

## Notes

- **[P]**: Parallelizable task.
- **Stop on Fail**: If T014 fails, do not proceed to T016.
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence