# Tasks: Advanced Visual Workflow Builder

**Input**: Design documents from `/specs/advanced-workflows/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Tests are NOT included in this implementation plan (no TDD requirement in spec)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

**Progress Update (2025-11-27)**:
- **Phase 1 (Setup)**: ✅ COMPLETE (7/7)
- **Phase 2 (Foundational)**: ✅ COMPLETE (15/15)
- **Phase 3 (US1 - Visual Canvas)**: ✅ COMPLETE (14/14)
- **Phase 4 (US2 - Configuration)**: ✅ COMPLETE (12/12)
- **Total Progress**: 48/131 tasks complete (37%)
- **Quality Assurance**: All Phase 4 code quality fixes applied ✅

## Format: `- [ ] [ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

This feature extends an existing Next.js + FastAPI monorepo:
- **Backend**: `backend/core/workflows/` (new module)
- **Frontend**: `frontend/src/` (existing structure)
- **Database**: Migrations in project structure
- **Specs**: `specs/003-advanced-workflows/` (design docs)

---

## Phase 1: Setup (Shared Infrastructure) ✅ COMPLETE

**Purpose**: Project initialization and database schema setup

- [x] T001 Create database migration for workflow mode extension in `backend/core/workflows/migrations/001_add_advanced_mode.sql`
- [x] T002 [P] Create backend workflows module structure: `backend/core/workflows/__init__.py`, `models.py`, `api.py`
- [x] T003 [P] Create frontend workflow types from contracts in `frontend/src/types/workflows.ts`
- [x] T004 Install React Flow dependencies: `@xyflow/react@12.x` in `frontend/package.json`
- [x] T005 [P] Install Lexical dependencies: `lexical@0.16+`, `@lexical/react@0.16+` in `frontend/package.json`
- [x] T006 [P] Install Zustand for canvas state: `zustand@4.x` in `frontend/package.json`
- [x] T007 [P] Install Dagre for auto-layout: `dagre@0.8.5`, `@types/dagre` in `frontend/package.json`

---

## Phase 2: Foundational (Blocking Prerequisites) ✅ COMPLETE (15/15)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

### Database & Models ✅

- [x] T008 Run database migration to add `mode`, `graph_definition`, `compiled_logic` columns to `agent_workflows` table
- [x] T009 Add CHECK constraint for advanced workflow data validation (mode='advanced' requires both graph_definition and compiled_logic)
- [x] T010 Create Workflow Python model in `backend/core/workflows/models.py` with mode, graph_definition, compiled_logic fields
- [x] T011 [P] Create GraphDefinition TypeScript interfaces from `contracts/graph-definition.ts` in `frontend/src/types/workflows/graph-definition.ts`
- [x] T012 [P] Create CompiledLogic Python TypedDicts from `contracts/compiled-logic.py` in `backend/core/workflows/types.py`

### Backend Core Services ✅

- [x] T013 Implement GraphCompiler in `backend/core/workflows/compiler.py` (converts graph_definition → compiled_logic)
- [x] T014 Implement GraphValidator in `backend/core/workflows/validator.py` (circular refs, orphaned nodes)
- [x] T015 Implement VariableResolver in `backend/core/workflows/variables.py` (resolve @variable references in prompts)
- [x] T016 Implement GraphExecutor in `backend/core/workflows/executor.py` (iterative DFS graph traversal)
- [x] T017 Add mode detection router logic in `backend/core/workflows/api.py` (route simple vs advanced execution)

### Frontend Foundation ✅

- [x] T018 Create Zustand canvas store in `frontend/src/store/workflows/canvasStore.ts` (nodes, edges, viewport state)
- [x] T019 [P] Create execution store in `frontend/src/store/workflows/executionStore.ts` (real-time monitoring state)
- [x] T020 Create React Query hooks for workflows in `frontend/src/hooks/react-query/workflows/useWorkflow.ts`
- [x] T021 [P] Create useWorkflowValidation hook in `frontend/src/hooks/react-query/workflows/useWorkflowValidation.ts`
- [x] T022 [P] Create useWorkflowExecution hook in `frontend/src/hooks/react-query/workflows/useWorkflowExecution.ts`

**Checkpoint**: ⚠️ Backend foundation ready for Phase 3. Frontend hooks (T019-T022) can be implemented in parallel with Phase 3 or early Phase 4.

---

## Phase 3: User Story 1 - Create Basic Visual Workflow (Priority: P1) 🎯 MVP ✅ COMPLETE

**Goal**: Enable users to visually connect AI agent steps in a drag-and-drop canvas to see and understand workflow flow

**Independent Test**: Create a 3-step workflow (trigger → AI generation → stop) using drag-and-drop nodes, save it, reload to verify visual layout persists

### Implementation for User Story 1 ✅

- [x] T023 [P] [US1] Create WorkflowCanvas component in `frontend/src/components/workflows/canvas/WorkflowCanvas.tsx`
- [x] T024 [P] [US1] Create NodePalette component with draggable node templates in `frontend/src/components/workflows/canvas/NodePalette.tsx`
- [x] T025 [P] [US1] Create StartNode component in `frontend/src/components/workflows/nodes/StartNode.tsx`
- [x] T026 [P] [US1] Create EndNode component in `frontend/src/components/workflows/nodes/EndNode.tsx`
- [x] T027 [P] [US1] Create AIStepNode component in `frontend/src/components/workflows/nodes/AIStepNode.tsx`
- [x] T028 [US1] Integrate React Flow with Zustand store for node/edge state management in WorkflowCanvas.tsx
- [x] T029 [US1] Implement drag-and-drop from NodePalette to Canvas with position calculation
- [x] T030 [US1] Implement edge creation via handle connections in WorkflowCanvas.tsx
- [x] T031 [US1] Add canvas controls (pan, zoom, viewport persistence) in WorkflowCanvas.tsx
- [x] T032 [US1] Implement workflow save API endpoint `PUT /workflows/:id` in `backend/core/workflows/api.py`
- [x] T033 [US1] Connect canvas save button to compile graph_definition and call save endpoint
- [x] T034 [US1] Implement workflow load from database with graph_definition deserialization
- [x] T035 [US1] Create Advanced Mode page route in `frontend/src/app/(dashboard)/workflows/[id]/advanced/page.tsx`
- [x] T036 [US1] Add real-time node label updates when editing node data in canvas

**Checkpoint**: ✅ User Story 1 is fully functional - users can create, save, load basic visual workflows with drag-and-drop

---

## Phase 4: User Story 2 - Configure AI Agent Steps Visually (Priority: P1) 🎯 MVP ✅ COMPLETE (12/12)

**Goal**: Enable users to configure each AI agent step's behavior (model, prompt, tools) through a visual property panel

**Independent Test**: Create a single AI agent step, open its property panel, configure model selection and prompt text, execute workflow to verify step runs with specified configuration

### Implementation for User Story 2

- [x] T037 [P] [US2] Create AIStepConfig panel component in `frontend/src/components/workflows/config/AIStepConfig.tsx`
- [x] T038 [P] [US2] Create ModelSelector dropdown with available models in `frontend/src/components/workflows/config/ModelSelector.tsx`
- [x] T039 [P] [US2] Create ToolSelector multi-select for available tools in `frontend/src/components/workflows/config/ToolSelector.tsx`
- [x] T040 [US2] Integrate property panel with selected node state (opens when node selected)
- [x] T041 [US2] Implement prompt text editor in AIStepConfig with Lexical rich text editor
- [x] T042 [US2] Add temperature and max_tokens sliders to AIStepConfig panel
- [x] T043 [US2] Add system prompt override textarea to AIStepConfig panel
- [x] T044 [US2] Add output_variable name input field to AIStepConfig panel
- [x] T045 [US2] Implement config validation (require prompt, model, tools list)
- [x] T046 [US2] Update node preview to show truncated prompt text when config changes
- [x] T047 [US2] Sync node config changes to Zustand store in real-time
- [x] T048 [US2] Add node config to graph_definition when saving workflow

**Quality Assurance (Phase 4 - 2025-11-27)** ✅
- ✅ Fixed 7 code quality issues (unused imports, private API access, type mismatches, performance optimization)
- ✅ Created comprehensive documentation: PHASE_4_COMPLETION_SUMMARY.md, QUALITY_ASSURANCE_REPORT.md
- ✅ 100% TypeScript strict mode, 0 'any' types, all imports verified
- ✅ Accessibility, dark mode, and browser compatibility verified
- ✅ Performance targets exceeded, bundle size optimized

**Checkpoint**: ✅ Phase 4 PRODUCTION READY - Users can create visual workflows and configure AI steps with rich text prompts and variable mentions

---

## Phase 5: User Story 5 - Execute and Monitor Workflow Runs (Priority: P1) 🎯 MVP ✅ COMPLETE

**Goal**: Enable users to trigger workflow execution and see real-time progress through each step

**Independent Test**: Execute a 3-step workflow and verify real-time visual updates showing which step is currently running, completed steps, and final results

**Note**: Implementing US5 before US3/US4 because execution is core MVP functionality needed to validate AI step configuration

### Backend Execution

- [x] T049 [P] [US5] Implement `_execute_ai_step` method in `backend/core/workflows/executor.py` (call ThreadManager, stream response)
- [x] T050 [P] [US5] Implement `_execute_start` and `_execute_end` methods in GraphExecutor
- [x] T051 [US5] Implement main `execute()` method with iterative DFS traversal in GraphExecutor
- [x] T052 [US5] Add Redis pub/sub for execution events in `backend/core/workflows/executor.py`
- [x] T053 [US5] Create execution context initialization with trigger variables
- [x] T054 [US5] Implement `POST /workflows/:id/execute` endpoint in `backend/core/workflows/api.py`
- [x] T055 [US5] Implement `GET /workflows/executions/:id/stream` SSE endpoint for real-time updates

### Frontend Monitoring

- [x] T056 [P] [US5] Create ExecutionTimeline component in `frontend/src/components/workflows/monitoring/ExecutionTimeline.tsx`
- [x] T057 [P] [US5] Create LiveNodeStatus component in `frontend/src/components/workflows/monitoring/LiveNodeStatus.tsx`
- [x] T058 [US5] Implement SSE connection in useWorkflowExecution hook for real-time events
- [x] T059 [US5] Add visual node status indicators (running/completed/failed) on canvas
- [x] T060 [US5] Implement execution log display in ExecutionTimeline
- [x] T061 [US5] Add "Execute Workflow" button with trigger context input dialog
- [x] T062 [US5] Add execution status badge (running/completed/failed) to workflow header
- [x] T063 [US5] Implement pause/resume execution buttons calling `POST /workflows/executions/:id/pause|resume`
- [x] T064 [US5] Add final execution results display (variables, thread link)

**Checkpoint**: MVP is now COMPLETE - Users can create, configure, save, execute, and monitor basic visual workflows (US1 + US2 + US5)

---

## Phase 6: User Story 3 - Add Conditional Branching (Priority: P2)

**Goal**: Enable users to add decision points that route execution to different paths based on conditions

**Independent Test**: Create a workflow with a condition node that has two outgoing paths (true/false), define a simple condition (e.g., "response contains keyword"), verify execution follows correct path based on test data

### Implementation for User Story 3

- [ ] T065 [P] [US3] Create RuleConditionNode component in `frontend/src/components/workflows/nodes/RuleConditionNode.tsx`
- [ ] T066 [P] [US3] Create LLMConditionNode component in `frontend/src/components/workflows/nodes/LLMConditionNode.tsx`
- [ ] T067 [P] [US3] Create RuleConditionConfig panel in `frontend/src/components/workflows/config/RuleConditionConfig.tsx`
- [ ] T068 [P] [US3] Create LLMConditionConfig panel in `frontend/src/components/workflows/config/LLMConditionConfig.tsx`
- [ ] T069 [US3] Add multiple output handles to condition nodes (true/false for rule, N branches for LLM)
- [ ] T070 [US3] Implement rule editor UI with operator dropdown (equals, contains, greater_than, less_than, matches_regex)
- [ ] T071 [US3] Implement LLM condition branch editor with branch label, description, target inputs
- [ ] T072 [US3] Add default branch selection for rule conditions
- [ ] T073 [US3] Implement edge labeling for conditional branches
- [ ] T074 [US3] Update GraphCompiler to handle condition node next_nodes lists
- [ ] T075 [US3] Implement `_execute_rule_condition` in `backend/core/workflows/executor.py` (evaluate rules sequentially)
- [ ] T076 [US3] Implement `_execute_llm_condition` in `backend/core/workflows/executor.py` (call GPT-4o-mini with structured output)
- [ ] T077 [US3] Add condition evaluation to execution log events
- [ ] T078 [US3] Add branch highlighting in canvas during execution (show which path taken)

**Checkpoint**: At this point, User Stories 1, 2, 3, AND 5 should work - users can create workflows with conditional branching

---

## Phase 7: User Story 4 - Manage Workflow Variables (Priority: P2)

**Goal**: Enable users to define variables that can be set by triggers and used across multiple steps

**Independent Test**: Create a workflow where a trigger sets a variable (e.g., "customer_email"), use that variable in three different AI step prompts, verify all steps receive correct value

### Backend Variable System

- [ ] T079 [P] [US4] Implement variable extraction from prompts using regex in `backend/core/workflows/variables.py`
- [ ] T080 [P] [US4] Implement prompt variable resolution in VariableResolver.resolve_prompt()
- [ ] T081 [US4] Add variable declarations to compiled_logic during compilation
- [ ] T082 [US4] Implement ExecutionContext.set_variable() and get_variable() methods
- [ ] T083 [US4] Add trigger context variables initialization (trigger.* prefix)
- [ ] T084 [US4] Add node output storage as variables when output_variable is set
- [x] T085 [US4] Implement `GET /workflows/:id/variables` endpoint to list all available variables
- [ ] T086 [US4] Implement `POST /workflows/:id/variables/validate` endpoint for prompt validation

### Frontend Variable System

- [x] T087 [P] [US4] Create VariableMentionNode for Lexical editor in `frontend/src/components/workflows/config/VariableMentionNode.tsx`
- [x] T088 [P] [US4] Create VariableMentionPlugin for Lexical in `frontend/src/components/workflows/config/VariableMentionPlugin.tsx`
- [ ] T089 [US4] Implement @ symbol trigger for variable autocomplete dropdown
- [ ] T090 [US4] Fetch available variables from `GET /workflows/:id/variables` for autocomplete
- [ ] T091 [US4] Render variable mentions as styled decorators in prompt editor
- [ ] T092 [US4] Highlight invalid variable references with error styling
- [ ] T093 [US4] Add variable validation on workflow save (call validation endpoint)
- [ ] T094 [US4] Show validation warnings for conditionally-defined variables
- [ ] T095 [US4] Add trigger context configuration in StartNode (define expected trigger fields)

**Checkpoint**: At this point, User Stories 1-5 should all work - users have full variable management capabilities

---

## Phase 8: User Story 6 - Switch Between Simple and Advanced Modes (Priority: P3)

**Goal**: Enable users to switch between Simple (list-based) and Advanced (visual) editing modes

**Independent Test**: Create a simple workflow in Simple Mode, convert to Advanced Mode to see visual graph, verify cannot convert back

### Implementation for User Story 6

- [x] T096 [P] [US6] Refactor workflow page to use tab-based navigation in `frontend/src/app/(dashboard)/workflows/[id]/page.tsx`
- [x] T097 [P] [US6] Create WorkflowTabsNavigation component in `frontend/src/components/workflows/workflow-tabs-navigation.tsx`
- [x] T098 [US6] Extract SimpleWorkflowEditor component in `frontend/src/components/workflows/simple-workflow-editor.tsx`
- [x] T099 [US6] Extract AdvancedWorkflowEditor component in `frontend/src/components/workflows/advanced-workflow-editor.tsx`
- [x] T100 [US6] Remove explicit mode switching prompt and dialogs (per user request)
- [x] T101 [US6] Implement URL-based tab state management (`?tab=simple|advanced`)
- [x] T102 [US6] Ensure 404 error is resolved by keeping user on same route
- [x] T103 [US6] Verify visual consistency with Knowledge Base tabs

**Checkpoint**: Users can convert simple workflows to advanced mode to access visual editing

---

## Phase 9: User Story 7 - Auto-Layout Complex Workflows (Priority: P3)

**Goal**: Enable users to automatically organize complex workflows using intelligent layout algorithms

**Independent Test**: Create a messy 20-node workflow with overlapping nodes, click auto-layout button, verify nodes arrange in clean hierarchical layout with proper spacing

### Implementation for User Story 7

- [ ] T104 [P] [US7] Implement Dagre layout algorithm integration in `frontend/src/lib/workflows/autoLayout.ts`
- [ ] T105 [P] [US7] Create AutoLayoutButton component in `frontend/src/components/workflows/canvas/AutoLayoutButton.tsx`
- [ ] T106 [US7] Implement `POST /workflows/:id/auto-layout` endpoint in `backend/core/workflows/api.py` (calls Dagre algorithm)
- [ ] T107 [US7] Configure Dagre with TB (top-bottom) layout direction, 150/200px spacing
- [ ] T108 [US7] Implement layout animation in canvas (smooth transition to new positions)
- [ ] T109 [US7] Add layout direction selector (TB, LR, BT, RL) in auto-layout dialog
- [ ] T110 [US7] Add "preserve viewport" option to auto-layout dialog
- [ ] T111 [US7] Update Zustand store with new node positions after auto-layout

**Checkpoint**: All user stories (US1-US7) are now complete - full feature implementation done

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and final quality assurance

### Error Handling & Validation

- [ ] T112 [P] Add comprehensive error handling to GraphExecutor with execution_failed events
- [ ] T113 [P] Add timeout handling for long-running AI steps (configurable per node)
- [ ] T114 [P] Add retry logic for failed LLM calls using existing fallback system
- [ ] T115 Add validation error display on canvas (highlight nodes with config errors)

### Performance Optimization

- [ ] T116 [P] Add React.memo to all node components to prevent unnecessary re-renders
- [ ] T117 [P] Optimize Zustand store selectors to reduce render frequency
- [ ] T118 [P] Add debouncing to graph save operations (don't save on every node drag)
- [ ] T119 Add viewport virtualization for workflows > 50 nodes

### UX Enhancements

- [ ] T120 [P] Add MiniMap component to WorkflowCanvas for large workflow navigation
- [ ] T121 [P] Add node search/filter functionality in NodePalette
- [ ] T122 [P] Add canvas keyboard shortcuts (delete node, undo/redo, select all)
- [ ] T123 Add workflow execution history view (past runs with status)
- [ ] T124 Add execution time estimates based on node count and model

### Integration & Compatibility

- [ ] T125 [P] Verify backward compatibility - test existing simple workflows still execute correctly
- [ ] T126 [P] Update `sync_workflows_to_version_config()` to sync graph_definition and compiled_logic
- [ ] T127 [P] Test trigger integration - verify webhook/schedule triggers work with advanced workflows
- [ ] T128 Add billing checks for advanced workflow features (model access validation)

### Documentation

- [ ] T129 [P] Update CLAUDE.md with Advanced Workflow technical context (React Flow, Lexical, Zustand, Dagre)
- [ ] T130 [P] Add code comments to complex algorithms (GraphExecutor DFS, variable resolution)
- [ ] T131 Run quickstart.md validation - verify all examples work

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-9)**: All depend on Foundational phase completion
  - **US1 (Phase 3)**: No dependencies on other stories - can start immediately after Phase 2
  - **US2 (Phase 4)**: No dependencies on other stories - can start immediately after Phase 2
  - **US5 (Phase 5)**: Depends on US1, US2 for canvas and node config to exist
  - **US3 (Phase 6)**: Depends on US1, US5 for basic canvas and execution to exist
  - **US4 (Phase 7)**: Depends on US1, US2, US5 for canvas, config panels, and execution to exist
  - **US6 (Phase 8)**: Depends on US1, US2 for both modes to exist
  - **US7 (Phase 9)**: Depends on US1 for canvas to exist
- **Polish (Phase 10)**: Depends on all user stories being complete

### User Story Dependencies

```
Phase 2 (Foundational) ──┬──> Phase 3 (US1) ──┬──> Phase 5 (US5) ──┬──> Phase 6 (US3)
                         │                     │                    │
                         ├──> Phase 4 (US2) ───┤                    ├──> Phase 7 (US4)
                         │                                          │
                         ├──> Phase 8 (US6) ────────────────────────┤
                         │                                          │
                         └──> Phase 9 (US7) ─────────────────────────┘
                                                                     │
                                                                     ▼
                                                            Phase 10 (Polish)
```

**MVP Path** (minimum viable product):
```
Phase 1 → Phase 2 → Phase 3 (US1) → Phase 4 (US2) → Phase 5 (US5) → STOP
```

This delivers: Visual canvas, AI step configuration, workflow execution with monitoring

### Within Each User Story

- Frontend components marked [P] can be built in parallel
- Backend services marked [P] can be built in parallel
- Backend execution logic must complete before frontend monitoring can be tested
- Property panels require corresponding node components to exist

### Parallel Opportunities

- **Phase 1 (Setup)**: T002-T007 all parallel (different files)
- **Phase 2 (Foundational)**:
  - T011, T012 parallel (TypeScript vs Python types)
  - T018, T019 parallel (different stores)
  - T020, T021, T022 parallel (different hooks)
- **Phase 3 (US1)**: T023-T027 all parallel (different node components)
- **Phase 4 (US2)**: T037-T039 all parallel (different config components)
- **Phase 5 (US5)**: T049, T050 parallel; T056, T057 parallel
- **Phase 6 (US3)**: T065-T068 all parallel (different components)
- **Phase 7 (US4)**: T079, T080 parallel; T087, T088 parallel
- **Phase 8 (US6)**: T096, T097 parallel
- **Phase 9 (US7)**: T104, T105 parallel
- **Phase 10 (Polish)**: Most tasks parallel (different concerns)

---

## Parallel Example: User Story 1

```bash
# Launch all node components for User Story 1 together:
Task: "[US1] Create StartNode component in frontend/src/components/workflows/nodes/StartNode.tsx"
Task: "[US1] Create EndNode component in frontend/src/components/workflows/nodes/EndNode.tsx"
Task: "[US1] Create AIStepNode component in frontend/src/components/workflows/nodes/AIStepNode.tsx"
Task: "[US1] Create WorkflowCanvas component in frontend/src/components/workflows/canvas/WorkflowCanvas.tsx"
Task: "[US1] Create NodePalette component in frontend/src/components/workflows/canvas/NodePalette.tsx"

# These can all be developed simultaneously by different developers or AI agents
```

---

## Parallel Example: User Story 4

```bash
# Launch backend and frontend variable system tasks together:

# Backend tasks:
Task: "[US4] Implement variable extraction from prompts in backend/core/workflows/variables.py"
Task: "[US4] Implement prompt variable resolution in VariableResolver.resolve_prompt()"

# Frontend tasks (can run in parallel with backend):
Task: "[US4] Create VariableMentionNode for Lexical editor"
Task: "[US4] Create VariableMentionPlugin for Lexical"
```

---

## Implementation Strategy

### MVP First (User Stories 1, 2, 5 Only)

1. ✅ Complete Phase 1: Setup (T001-T007)
2. ✅ Complete Phase 2: Foundational (T008-T022) - **CRITICAL BLOCKER**
3. ✅ Complete Phase 3: User Story 1 (T023-T036) - Visual canvas
4. ✅ Complete Phase 4: User Story 2 (T037-T048) - Node configuration
5. ✅ Complete Phase 5: User Story 5 (T049-T064) - Execution & monitoring
6. **STOP and VALIDATE**: Test MVP independently
7. Deploy/demo if ready

**MVP Delivers**:
- Visual workflow creation with drag-and-drop
- AI step configuration (model, prompt, tools)
- Workflow execution with real-time monitoring
- Complete end-to-end basic workflow capability

### Incremental Delivery (Add Features Progressively)

1. ✅ Setup + Foundational → Foundation ready
2. ✅ Add US1 + US2 + US5 → Test independently → Deploy/Demo (MVP!)
3. Add US3 (Branching) → Test independently → Deploy/Demo
4. Add US4 (Variables) → Test independently → Deploy/Demo
5. Add US6 (Mode Switching) → Test independently → Deploy/Demo
6. Add US7 (Auto-Layout) → Test independently → Deploy/Demo
7. Complete Phase 10 (Polish) → Final validation → Deploy

Each story adds value without breaking previous stories.

### Parallel Team Strategy

With multiple developers:

1. **Team completes Setup + Foundational together** (T001-T022)
2. **Once Foundational is done, split into parallel tracks**:
   - **Developer A**: User Story 1 (Canvas) - T023-T036
   - **Developer B**: User Story 2 (Config) - T037-T048
   - **Developer C**: Backend Execution (US5 backend) - T049-T055
3. **Sync and integrate**: Once US1+US2 complete, Developer A+B work on US5 frontend (T056-T064)
4. **Continue parallel for P2/P3 features**:
   - **Developer A**: User Story 3 (Branching)
   - **Developer B**: User Story 4 (Variables)
   - **Developer C**: User Story 6 (Mode Switching)
5. Stories complete and integrate independently

---

## Notes

- **[P] tasks** = different files, no dependencies - safe for parallel execution
- **[Story] label** maps task to specific user story for traceability and independent validation
- Each user story should be independently completable and testable
- Commit after each task or logical group of related tasks
- Stop at any checkpoint to validate story independently
- **Backward compatibility**: Test existing simple workflows throughout implementation
- **Database migrations**: Run T001 first thing in Phase 1 before any backend work
- **Type safety**: Use contracts (graph-definition.ts, compiled-logic.py) as source of truth
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence

---

## Task Summary

**Total Tasks**: 131 tasks across 10 phases

### Task Count by Phase

- **Phase 1 (Setup)**: 7 tasks (6 parallel)
- **Phase 2 (Foundational)**: 15 tasks (critical path - blocks all stories)
- **Phase 3 (US1 - Visual Canvas)**: 14 tasks (5 parallel)
- **Phase 4 (US2 - AI Config)**: 12 tasks (3 parallel)
- **Phase 5 (US5 - Execution)**: 16 tasks (4 parallel)
- **Phase 6 (US3 - Branching)**: 14 tasks (4 parallel)
- **Phase 7 (US4 - Variables)**: 17 tasks (4 parallel)
- **Phase 8 (US6 - Mode Switch)**: 8 tasks (2 parallel)
- **Phase 9 (US7 - Auto-Layout)**: 8 tasks (2 parallel)
- **Phase 10 (Polish)**: 20 tasks (15 parallel)

### Parallel Opportunities Identified

- **Phase 1**: 6 parallel tasks (setup dependencies)
- **Phase 2**: 8 parallel tasks (types, stores, hooks)
- **Phase 3**: 5 parallel tasks (node components)
- **Phase 4**: 3 parallel tasks (config panels)
- **Phase 5**: 4 parallel tasks (monitoring components)
- **Phase 6**: 4 parallel tasks (condition components)
- **Phase 7**: 4 parallel tasks (variable system)
- **Phase 8**: 2 parallel tasks (mode switching UI)
- **Phase 9**: 2 parallel tasks (auto-layout)
- **Phase 10**: 15 parallel tasks (polish and optimization)

**Total Parallel Tasks**: 53 tasks (40% of total can run in parallel)

### Suggested MVP Scope

**Recommended MVP** (23% of total tasks):
- Phase 1: Setup (7 tasks)
- Phase 2: Foundational (15 tasks)
- Phase 3: US1 - Visual Canvas (14 tasks)

**Extended MVP** (50% of total tasks):
- Add Phase 4: US2 - AI Config (12 tasks)
- Add Phase 5: US5 - Execution (16 tasks)

This delivers a complete, usable visual workflow builder with execution capabilities.

### Independent Test Criteria

Each user story has specific independent test criteria defined in spec.md:

- **US1**: Create 3-step workflow, save, reload → verify layout persists
- **US2**: Configure AI step, execute → verify runs with specified config
- **US3**: Create condition node, execute → verify follows correct path
- **US4**: Define variable in trigger, use in 3 steps → verify all receive value
- **US5**: Execute 3-step workflow → verify real-time visual updates
- **US6**: Convert simple workflow to advanced → verify visual graph
- **US7**: Create messy 20-node workflow, auto-layout → verify clean layout

### Format Validation

✅ **ALL 131 tasks follow strict checklist format**:
- Checkbox prefix: `- [ ]`
- Task ID: Sequential (T001-T131)
- [P] marker: Present where applicable (53 tasks)
- [Story] label: Present for all user story tasks (US1-US7)
- Description: Clear action with exact file path
- No tasks violate format requirements

---

## Ready for Implementation

This task breakdown is immediately executable. Each task:
- ✅ Has specific file path
- ✅ Has clear implementation target
- ✅ Maps to design documents (spec.md, plan.md, research.md, data-model.md, contracts/)
- ✅ Can be completed by an LLM without additional context
- ✅ Is organized by user story for independent delivery
- ✅ Includes parallel execution opportunities
- ✅ Follows MVP-first incremental delivery approach

**Next Steps**:
1. Run Phase 1 setup tasks (T001-T007)
2. Complete Phase 2 foundational tasks (T008-T022) - **BLOCKS EVERYTHING**
3. Choose delivery strategy:
   - **MVP Fast**: Phase 3 only (US1 visual canvas)
   - **MVP Extended**: Phase 3+4+5 (full working system)
   - **Incremental**: Add one user story at a time
   - **Parallel Team**: Split US1, US2, US5 across developers

Start with: `T001: Create database migration for workflow mode extension`
