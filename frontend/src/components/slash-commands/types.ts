/**
 * Slash Commands Type Definitions & Configuration
 */

/**
 * Configuration for slash commands storage
 * Change this single constant to update the folder name throughout the app
 */
export const SLASH_COMMANDS_FOLDER_NAME = 'Suna';

/**
 * Slash Command Interface
 * Represents a reusable prompt template stored in Knowledge Base
 * 
 * Two types of commands:
 * 1. Standard: Direct prompt injection (e.g., "summarize.md")
 * 2. GitHub-compatible: Instruction reference injection (e.g., "feature.prompt.md")
 */
export interface SlashCommand {
  name: string;
  description: string;
  prompt: string;
  /** Indicates this is a GitHub-format command (e.g., feature.prompt.md) */
  isGitHubFormat?: boolean;
  /** For GitHub-format, the instruction file reference (e.g., "feature.prompt.md") */
  instructionFile?: string;
}
