// frontend/src/lib/slashCommands.ts

/**
 * Slash Command Interface
 * Represents a reusable prompt template stored in Knowledge Base
 */
export interface SlashCommand {
  name: string;
  description: string;
  prompt: string;
}
