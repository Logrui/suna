// frontend/src/hooks/useSlashCommands.ts

import { useQuery } from '@tanstack/react-query';
import { SlashCommand, SLASH_COMMANDS_FOLDER_NAME } from '@/components/slash-commands/types';
import { createClient } from '@/lib/supabase/client';
import { getApiUrl } from '@/lib/get-api-url';

const API_URL = getApiUrl();

const EXAMPLE_COMMANDS = [
  {
    name: 'summarize',
    description: 'Summarize content into 5 bullet points.',
    content: 'Summarize the following content in 5 bullet points, focusing on key takeaways and important numbers or dates.',
  },
  {
    name: 'draft-email',
    description: 'Draft a professional email.',
    content: 'Draft a professional email for the following scenario. Keep it to 2-3 paragraphs, use a formal tone, and include a clear call-to-action.',
  },
  {
    name: 'brainstorm',
    description: 'Generate 10 creative ideas.',
    content: 'Generate 10 creative ideas for the following topic. Be diverse, think outside the box, and explain each idea briefly.',
  },
  {
    name: 'explain-simple',
    description: 'Explain complex concepts simply.',
    content: 'Explain the following in simple terms that a 10-year-old could understand. Avoid technical jargon and use real-world examples if possible.',
  },
];

/**
 * Get auth headers for API requests
 */
async function getAuthHeaders() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    throw new Error('No access token available');
  }
  
  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Initialize slash commands folder and example commands if they don't exist
 */
async function initializeSlashCommands() {
  try {
    const headers = await getAuthHeaders();
    
    // Get all folders
    const foldersRes = await fetch(`${API_URL}/knowledge-base/folders`, { headers });
    if (!foldersRes.ok) {
      //console.error('[SlashCommands] Failed to fetch folders:', foldersRes.status, foldersRes.statusText);
      return null;
    }
    
    const folders = await foldersRes.json();
    // console.log('[SlashCommands] Fetched folders:', folders.map((f: any) => f.name));
    
    // Check if prompts folder exists
    let promptsFolder = folders.find((f: any) => f.name === SLASH_COMMANDS_FOLDER_NAME);
    
    // Create prompts folder if it doesn't exist
    if (!promptsFolder) {
      // console.log('[SlashCommands] Creating prompts folder...');
      const createPromptsFolderRes = await fetch(`${API_URL}/knowledge-base/folders`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: SLASH_COMMANDS_FOLDER_NAME,
          description: 'Custom slash command prompts for quick access in chat',
        }),
      });
      
      if (!createPromptsFolderRes.ok) {
        const errorText = await createPromptsFolderRes.text();
        //console.error('[SlashCommands] Failed to create prompts folder:', createPromptsFolderRes.status, errorText);
        return null;
      }
      
      promptsFolder = await createPromptsFolderRes.json();
      // console.log('[SlashCommands] ✓ Created Suna folder:', promptsFolder.folder_id);
    } else {
      // console.log('[SlashCommands] Suna folder already exists:', promptsFolder.folder_id);
    }
    
    const folderId = promptsFolder.folder_id;
    
    // Get existing entries in the folder
    const entriesRes = await fetch(`${API_URL}/knowledge-base/folders/${folderId}/entries`, { headers });
    if (!entriesRes.ok) {
      //console.error('[SlashCommands] Failed to fetch folder entries:', entriesRes.status, entriesRes.statusText);
      return folderId;
    }
    
    const entries = await entriesRes.json();
    // console.log('[SlashCommands] Existing entries:', entries.length, 'files');
    if (entries.length > 0) {
      // console.log('[SlashCommands] Entry details:', entries.map((e: any) => ({
      //   filename: e.filename,
      //   summary: e.summary?.substring(0, 50) || '(no summary)',
      //   hasContent: !!e.content,
      //   contentLength: e.content?.length || 0,
      //   entryId: e.entry_id,
      // })));
    }
    
    // Check which example commands are missing and create only those
    const existingFilenames = new Set(entries.map((e: any) => e.filename.toLowerCase()));
    const missingCommands = EXAMPLE_COMMANDS.filter(cmd => {
      const mdFilename = `${cmd.name}.md`.toLowerCase();
      return !existingFilenames.has(mdFilename);
    });
    
    //console.log('[SlashCommands] Existing files:', Array.from(existingFilenames));
    //console.log('[SlashCommands] Missing commands to create:', missingCommands.map(c => c.name));
    
    if (missingCommands.length > 0) {
      // console.log(`[SlashCommands] Creating ${missingCommands.length} missing slash commands...`);
      
      for (const example of missingCommands) {
        try {
          console.log(`[SlashCommands] Uploading ${example.name}.md...`);
          
          // Create a markdown file with the command content
          const blob = new Blob([example.content], { type: 'text/markdown' });
          const formData = new FormData();
          formData.append('file', blob, `${example.name}.md`);
          
          //console.log(`[SlashCommands] File size: ${blob.size} bytes, MIME: text/markdown`);
          
          const uploadRes = await fetch(`${API_URL}/knowledge-base/folders/${folderId}/upload`, {
            method: 'POST',
            headers: {
              'Authorization': headers.Authorization,
            },
            body: formData,
          });
          
          //console.log(`[SlashCommands] Upload response for ${example.name}.md:`, uploadRes.status, uploadRes.statusText);
          
          if (uploadRes.ok) {
            const result = await uploadRes.json();
            //console.log(`[SlashCommands] Upload result for ${example.name}.md:`, {
            //  entry_id: result.entry_id,
            //  filename: result.filename,
            //  success: result.success,
            //});
            
            // Update the entry summary to store the description
            if (result.entry_id) {
              console.log(`[SlashCommands] Updating summary for entry ${result.entry_id}...`);
              
              const updateRes = await fetch(`${API_URL}/knowledge-base/${result.entry_id}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({
                  summary: example.description,
                }),
              });
              //console.log(`[SlashCommands] Update summary response for ${example.name}.md:`, updateRes.status, updateRes.statusText);
              
              if (!updateRes.ok) {
                const updateError = await updateRes.text();
                console.warn(`[SlashCommands] Warning: Failed to update summary:`, updateError);
              }
            }
            
            //console.log(`[SlashCommands] ✓ Created example command: ${example.name}.md`);
          } else {
            const errorText = await uploadRes.text();
            console.error(`[SlashCommands] Failed to create ${example.name}.md:`, uploadRes.status, errorText);
          }
        } catch (err) {
          //console.error(`[SlashCommands] Error creating example command ${example.name}:`, err);
        }
      }
    } else {
      //console.log('[SlashCommands] All example commands already exist, skipping upload');
    }
    
    return folderId;
  } catch (err) {
    //console.error('[SlashCommands] Error initializing slash commands:', err);
    return null;
  }
}

export function useSlashCommands() {
  return useQuery<SlashCommand[], Error>({
    queryKey: ['slash-commands'],
    queryFn: async () => {
      try {
        // console.log('[SlashCommands] useSlashCommands: Fetching commands...');
        
        // Initialize folder and examples if needed
        const folderId = await initializeSlashCommands();
        
        if (!folderId) {
          //console.warn('[SlashCommands] useSlashCommands: Initialization failed, returning fallback commands');
          return EXAMPLE_COMMANDS.map(ex => ({
            name: ex.name,
            description: ex.description,
            prompt: ex.content,
          }));
        }
        
        const headers = await getAuthHeaders();
        
        // Fetch all entries in the Suna folder
        // console.log('[SlashCommands] useSlashCommands: Fetching entries from folder:', folderId);
        const entriesRes = await fetch(`${API_URL}/knowledge-base/folders/${folderId}/entries`, { headers });
        
        if (!entriesRes.ok) {
          console.error('[SlashCommands] useSlashCommands: Failed to fetch slash command entries:', entriesRes.status);
          return [];
        }
        
        const entries = await entriesRes.json();
        // console.log('[SlashCommands] useSlashCommands: Fetched entries:', entries.length);
        
        // Fetch content for each entry in parallel
        const entriesWithContent = await Promise.all(
          entries.map(async (entry: any) => {
            try {
              const contentRes = await fetch(`${API_URL}/knowledge-base/entries/${entry.entry_id}/content`, { headers });
              if (contentRes.ok) {
                const { content } = await contentRes.json();
                return { ...entry, content };
              } else {
                console.warn(`[SlashCommands] Failed to fetch content for ${entry.filename}:`, contentRes.status);
                return entry;
              }
            } catch (err) {
              console.error(`[SlashCommands] Error fetching content for ${entry.filename}:`, err);
              return entry;
            }
          })
        );
        
        // Convert entries to SlashCommand format
        // Handles both standard (.md/.txt) and GitHub-format (.prompt.md) commands
        const commands: SlashCommand[] = entriesWithContent.map((entry: any) => {
          const filename = entry.filename;
          const isGitHubFormat = /\.prompt\.md$/i.test(filename);
          
          let commandName: string;
          let description: string;
          
          if (isGitHubFormat) {
            // Extract command name from "[command-name].prompt.md" format
            commandName = filename.replace(/\.prompt\.md$/i, '');
            // If no summary, generate one from instruction file reference
            description = entry.summary || `Follow instructions in ${filename}`;
          } else {
            // Standard format: remove .txt or .md extension
            commandName = filename.replace(/\.(txt|md)$/i, '');
            description = entry.summary || '';
          }
          
          return {
            name: commandName,
            description: description,
            prompt: entry.content || '',
            isGitHubFormat: isGitHubFormat,
            instructionFile: isGitHubFormat ? filename : undefined,
          };
        });
        
        //console.log('[SlashCommands] useSlashCommands: Converted to commands:', commands.map(c => ({
        //  name: c.name,
        //  descriptionLength: c.description.length,
        //  promptLength: c.prompt.length,
        //})));
        
        return commands;
      } catch (err) {
        console.error('[SlashCommands] useSlashCommands: Error fetching slash commands:', err);
        // Return fallback commands on error
        return EXAMPLE_COMMANDS.map(ex => ({
          name: ex.name,
          description: ex.description,
          prompt: ex.content,
        }));
      }
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 2,
  });
}
