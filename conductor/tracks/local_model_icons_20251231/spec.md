# Spec: Local Model Icon Integration

## Overview
This track aims to update the frontend model icon system to support and correctly display icons for local model providers (Ollama and LM Studio). This will improve the visual identity of local models in the UI, specifically in the new Admin Model Diagnostics page and the chat configuration menus.

## Functional Requirements
- **Provider Detection:** Update `getModelProvider` logic to recognize `ollama/` and `lm_studio/` model ID prefixes.
- **Icon Mapping:** 
  - Map the `ollama` provider to `/images/models/ollama.svg`.
  - Map the `lm_studio` provider to `/images/models/lmstudio.svg`.
- **Display Names:** Update `getModelProviderName` to return "Ollama" and "LM Studio" for the respective providers.
- **Type Safety:** Update the `ModelProvider` TypeScript type definition to include the new providers.

## Non-Functional Requirements
- **Consistency:** Ensure the icons follow the existing design language (responsive border radius, proper dark mode handling).

## Acceptance Criteria
- Models with IDs starting with `ollama/` display the Ollama SVG icon.
- Models with IDs starting with `lm_studio/` display the LM Studio SVG icon.
- The provider name is correctly shown as "Ollama" or "LM Studio" in tooltips or labels.
- Verified in the Admin Model Diagnostics table.
