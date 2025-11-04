// frontend/src/lib/slashCommands.ts

export interface SlashCommand {
  name: string;
  description: string;
  prompt: string;
}

/**
 * Parse a markdown file into a SlashCommand object
 * Extracts YAML frontmatter and prompt content
 */
export function parseMarkdownCommand(filename: string, markdownContent: string): SlashCommand {
  // Extract command name from filename (e.g., "summarize.md" -> "summarize")
  const name = filename.replace(/\.md$/, '');

  // Split content into frontmatter and body
  const parts = markdownContent.split(/^---\s*$/m);
  let description = '';
  let prompt = '';

  if (parts.length >= 3) {
    // Has frontmatter
    const frontmatter = parts[1];
    prompt = parts.slice(2).join('---').trim();

    // Extract description from frontmatter using regex
    const descMatch = frontmatter.match(/description:\s*["']([^"']+)["']/);
    if (descMatch) {
      description = descMatch[1];
    }
  } else {
    // No frontmatter, entire content is the prompt
    prompt = markdownContent.trim();
  }

  return { name, description, prompt };
}

/**
 * Detect if a message starts with a slash command
 * Returns the command name and any arguments if found
 */
export function detectCommand(message: string): { name: string; args: string } | null {
  const match = message.match(/^\/(\w+(?:-\w+)*)\s*(.*)/);
  if (!match) return null;
  
  return {
    name: match[1],
    args: match[2],
  };
}

/**
 * Inject the prompt from a slash command into the user's message
 * Replaces /command with the full prompt, appending any args
 */
export function injectPrompt(message: string, command: SlashCommand): string {
  const detected = detectCommand(message);
  if (!detected) return message;

  // Replace the /command with the prompt, and append args if any
  const fullPrompt = detected.args 
    ? `${command.prompt}\n\n${detected.args}`
    : command.prompt;

  return fullPrompt;
}
