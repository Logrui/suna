# Plan: Local Model Icon Integration

## Phase 1: Icon System Updates
- [ ] Task: Update `ModelProvider` type in `frontend/src/lib/model-provider-icons.tsx` to include `ollama` and `lm_studio`.
- [ ] Task: Update `getModelProvider` logic to detect `ollama/` and `lm_studio/` prefixes.
- [ ] Task: Map new providers to their respective SVG paths (`/images/models/ollama.svg`, `/images/models/lmstudio.svg`) in the `iconMap`.
- [ ] Task: Update `getModelProviderName` to return "Ollama" and "LM Studio".
- [ ] Task: Conductor - User Manual Verification 'Icon System Updates' (Protocol in workflow.md)

## Phase 2: Verification & UI Polish
- [ ] Task: Verify icons are correctly displayed in the Admin Model Diagnostics table (`/admin/models`).
- [ ] Task: Verify icons appear correctly in the model selection menus within the chat interface.
- [ ] Task: Ensure SVG rendering handles dark mode appropriately (checking if inversion is needed or if they are multi-color SVGs).
- [ ] Task: Conductor - User Manual Verification 'Verification & UI Polish' (Protocol in workflow.md)
