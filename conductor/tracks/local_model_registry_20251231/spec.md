# Spec: Local Model Registry Integration (Ollama & LM Studio)

## Overview
This track aims to integrate local AI models served via Ollama and LM Studio into the Suna platform's central model registry. This will allow users to use local inference engines alongside cloud providers.

## Functional Requirements
- **LocalModelRegistry:** Create a new registry class specifically for managing models discovered from local providers.
- **Ollama Integration:** Use `OllamaClient` to fetch available models from the configured `OLLAMA_API_BASE` and register them as `Model` objects.
- **LM Studio Integration:** Use `LMStudioClient` to fetch available models from `LM_STUDIO_API_BASE` and register them.
- **Startup Discovery:** The registry must perform model discovery once upon initialization (backend startup).
- **Registry Merging:** The main `ModelRegistry` in `registry.py` must initialize the `LocalModelRegistry` and include its models in the global available models list.
- **Model Metadata:** Mapping local model metadata (context window, capabilities, etc.) to the platform's `Model` schema, with sensible defaults where metadata is missing.

## Non-Functional Requirements
- **Graceful Failure:** If a local provider is unreachable on startup, the registry should log a warning but continue initialization for other providers.
- **Performance:** Model discovery should be asynchronous and non-blocking during registry initialization.

## Acceptance Criteria
- `LocalModelRegistry` is implemented and correctly instantiates `OllamaClient` and `LMStudioClient`.
- Models from a running Ollama/LM Studio instance appear in the `/api/ai-models/` endpoint response.
- Local models are correctly tagged with their provider (Ollama/LM Studio).
- The system doesn't crash if `OLLAMA_API_BASE` or `LM_STUDIO_API_BASE` are missing or unreachable.

## Out of Scope
- Periodic background polling for new local models (startup only for now).
- Advanced model management (loading/unloading) via the UI (discovery/listing only).
