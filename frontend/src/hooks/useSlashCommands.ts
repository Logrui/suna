// frontend/src/hooks/useSlashCommands.ts

import { useQuery } from '@tanstack/react-query';
import { SlashCommand } from '@/lib/slashCommands';
import { createClient } from '@/lib/supabase/client';
import { getApiUrl } from '@/lib/get-api-url';

const API_URL = getApiUrl();
const SLASH_COMMANDS_FOLDER_NAME = 'Slash Commands';

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
      console.error('Failed to fetch folders');
      return null;
    }
    
    const folders = await foldersRes.json();
    let slashCommandsFolder = folders.find((f: any) => f.name === SLASH_COMMANDS_FOLDER_NAME);
    
    // Create folder if it doesn't exist
    if (!slashCommandsFolder) {
      console.log('Creating Slash Commands folder...');
      const createFolderRes = await fetch(`${API_URL}/knowledge-base/folders`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: SLASH_COMMANDS_FOLDER_NAME,
          description: 'Custom slash command prompts for quick access in chat',
        }),
      });
      
      if (!createFolderRes.ok) {
        console.error('Failed to create Slash Commands folder');
        return null;
      }
      
      slashCommandsFolder = await createFolderRes.json();
      console.log('✓ Created Slash Commands folder');
    }
    
    const folderId = slashCommandsFolder.folder_id;
    
    // Get existing entries in the folder
    const entriesRes = await fetch(`${API_URL}/knowledge-base/folders/${folderId}/entries`, { headers });
    if (!entriesRes.ok) {
      console.error('Failed to fetch folder entries');
      return folderId;
    }
    
    const entries = await entriesRes.json();
    
    // Create example commands if folder is empty
    if (entries.length === 0) {
      console.log('Creating example slash commands...');
      
      for (const example of EXAMPLE_COMMANDS) {
        try {
          // Create a text file with the command content
          const blob = new Blob([example.content], { type: 'text/plain' });
          const formData = new FormData();
          formData.append('file', blob, `${example.name}.txt`);
          
          const uploadRes = await fetch(`${API_URL}/knowledge-base/folders/${folderId}/upload`, {
            method: 'POST',
            headers: {
              'Authorization': headers.Authorization,
            },
            body: formData,
          });
          
          if (uploadRes.ok) {
            const result = await uploadRes.json();
            
            // Update the entry summary to store the description
            if (result.entry_id) {
              await fetch(`${API_URL}/knowledge-base/${result.entry_id}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({
                  summary: example.description,
                }),
              });
            }
            
            console.log(`✓ Created example command: ${example.name}`);
          }
        } catch (err) {
          console.error(`Error creating example command ${example.name}:`, err);
        }
      }
    }
    
    return folderId;
  } catch (err) {
    console.error('Error initializing slash commands:', err);
    return null;
  }
}

export function useSlashCommands() {
  return useQuery<SlashCommand[], Error>({
    queryKey: ['slash-commands'],
    queryFn: async () => {
      try {
        // Initialize folder and examples if needed
        const folderId = await initializeSlashCommands();
        
        if (!folderId) {
          // Return fallback commands if initialization failed
          return EXAMPLE_COMMANDS.map(ex => ({
            name: ex.name,
            description: ex.description,
            prompt: ex.content,
          }));
        }
        
        const headers = await getAuthHeaders();
        
        // Fetch all entries in the Slash Commands folder
        const entriesRes = await fetch(`${API_URL}/knowledge-base/folders/${folderId}/entries`, { headers });
        
        if (!entriesRes.ok) {
          console.error('Failed to fetch slash command entries');
          return [];
        }
        
        const entries = await entriesRes.json();
        
        // Convert entries to SlashCommand format
        const commands: SlashCommand[] = entries.map((entry: any) => ({
          name: entry.filename.replace(/\.(txt|md)$/i, ''), // Remove file extension
          description: entry.summary || '',
          prompt: entry.content || '',
        }));
        
        return commands;
      } catch (err) {
        console.error('Error fetching slash commands:', err);
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
