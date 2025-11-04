// frontend/src/hooks/useSlashCommands.ts

import { useQuery } from '@tanstack/react-query';
import { parseMarkdownCommand, SlashCommand } from '@/lib/slashCommands';
import { listSandboxFiles, getSandboxFileContent, createSandboxFile } from '@/lib/api';

const EXAMPLE_COMMANDS = [
  {
    filename: 'summarize.md',
    content: `---
description: "Summarize content into 5 bullet points."
---

Summarize the following content in 5 bullet points, focusing on key takeaways and important numbers or dates.`,
  },
  {
    filename: 'draft-email.md',
    content: `---
description: "Draft a professional email."
---

Draft a professional email for the following scenario. Keep it to 2-3 paragraphs, use a formal tone, and include a clear call-to-action.`,
  },
  {
    filename: 'brainstorm.md',
    content: `---
description: "Generate 10 creative ideas."
---

Generate 10 creative ideas for the following topic. Be diverse, think outside the box, and explain each idea briefly.`,
  },
  {
    filename: 'explain-simple.md',
    content: `---
description: "Explain complex concepts simply."
---

Explain the following in simple terms that a 10-year-old could understand. Avoid technical jargon and use real-world examples if possible.`,
  },
];

/**
 * Initialize example commands if they don't exist
 */
async function initializeExampleCommands(sandboxId: string) {
  try {
    // First, try to list files in the directory (this will tell us if it exists)
    const files = await listSandboxFiles(sandboxId, '/workspace/Knowledge/prompts');
    
    // Check if we have any .md files
    const existingCommands = files.filter((f: any) => f.name.endsWith('.md') && !f.is_dir);
    
    if (existingCommands.length === 0) {
      // Directory exists but no commands, create examples
      console.log('Initializing example slash commands...');
      
      for (const example of EXAMPLE_COMMANDS) {
        try {
          await createSandboxFile(
            sandboxId,
            `/workspace/Knowledge/prompts/${example.filename}`,
            example.content
          );
          console.log(`✓ Created example command: ${example.filename}`);
        } catch (err) {
          console.error(`Error creating example command ${example.filename}:`, err);
        }
      }
    }
  } catch (err) {
    // Directory likely doesn't exist, create it by creating the first file
    console.log('Initializing slash commands directory and examples...');
    
    for (const example of EXAMPLE_COMMANDS) {
      try {
        await createSandboxFile(
          sandboxId,
          `/workspace/Knowledge/prompts/${example.filename}`,
          example.content
        );
        console.log(`✓ Created example command: ${example.filename}`);
      } catch (err) {
        console.error(`Error creating example command ${example.filename}:`, err);
      }
    }
  }
}

export function useSlashCommands(sandboxId?: string) {
  return useQuery<SlashCommand[], Error>({
    queryKey: ['slash-commands', sandboxId],
    queryFn: async () => {
      if (!sandboxId) {
        return [];
      }

      try {
        // Initialize example commands on first load
        await initializeExampleCommands(sandboxId);

        // List files in the designated prompts directory
        const files = await listSandboxFiles(sandboxId, '/workspace/Knowledge/prompts');

        // Filter for .md files
        const markdownFiles = files.filter((file: any) => file.name.endsWith('.md') && !file.is_dir);

        // Fetch content for each markdown file and parse it
        const commands = await Promise.all(
          markdownFiles.map(async (file: any) => {
            try {
              const content = await getSandboxFileContent(sandboxId, file.path);
              const contentStr = typeof content === 'string' ? content : await content.text();
              return parseMarkdownCommand(file.name, contentStr);
            } catch (err) {
              console.error(`Error loading command ${file.name}:`, err);
              return null;
            }
          })
        );

        // Filter out any nulls from failed fetches
        return commands.filter((cmd): cmd is SlashCommand => cmd !== null);
      } catch (err) {
        console.error('Error in useSlashCommands:', err);
        return [];
      }
    },
    enabled: !!sandboxId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 2,
  });
}
