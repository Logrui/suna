import { toast } from 'sonner';
import { getApiUrl } from '@/lib/get-api-url';
import { createClient } from '@/lib/supabase/client';

const API_URL = getApiUrl();

/**
 * Download a single file from knowledge base
 */
export async function downloadFile(entryId: string, fileName: string) {
    try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.access_token) {
            toast.error('Authentication required');
            console.error('No access token available for download');
            return;
        }

        // Get file content from API
        const endpoint = `${API_URL}/knowledge-base/entries/${entryId}/content`;
        console.log('Downloading from:', endpoint);
        
        const response = await fetch(endpoint, {
            headers: {
                'Authorization': `Bearer ${session.access_token}`,
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Download failed: ${response.status} ${response.statusText}`, errorText);
            toast.error(`Failed to download file: ${response.statusText}`);
            return;
        }

        const data = await response.json();
        const content = data.content;

        if (!content) {
            console.error('No content in response');
            toast.error('File content is empty');
            return;
        }

        // Create blob and download with generic octet-stream type
        // Browser will handle download based on file extension
        const blob = new Blob([content], { type: 'application/octet-stream' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName || 'download';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast.success('File downloaded successfully');
    } catch (error) {
        console.error('Error downloading file:', error);
        toast.error(`Error downloading file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Download all files from a folder as a ZIP
 * Note: This requires backend implementation of the zip endpoint
 */
export async function downloadFolderAsZip(folderId: string, folderName: string) {
    try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.access_token) {
            toast.error('Authentication required');
            return;
        }

        // Check if zip download endpoint exists
        const zipEndpoint = `${API_URL}/knowledge-base/folders/${folderId}/download-zip`;
        
        const response = await fetch(zipEndpoint, {
            headers: {
                'Authorization': `Bearer ${session.access_token}`,
            }
        });

        if (!response.ok) {
            // Fallback: if zip endpoint doesn't exist, download files individually
            if (response.status === 404) {
                toast.info('Downloading files individually (zip not available yet)');
                await downloadFolderFilesIndividually(folderId, folderName, session.access_token);
                return;
            }
            toast.error('Failed to download folder');
            return;
        }

        // Download zip file
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${folderName || 'folder'}.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast.success('Folder downloaded successfully');
    } catch (error) {
        console.error('Error downloading folder:', error);
        toast.error('Error downloading folder');
    }
}

/**
 * Download individual files from a folder as fallback
 */
async function downloadFolderFilesIndividually(folderId: string, folderName: string, accessToken: string) {
    try {
        // Get folder entries
        const entriesResponse = await fetch(`${API_URL}/knowledge-base/folders/${folderId}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            }
        });

        if (!entriesResponse.ok) {
            toast.error('Failed to get folder contents');
            return;
        }

        const entries = await entriesResponse.json();

        // Download each file with a slight delay to avoid overwhelming the browser
        for (const entry of entries) {
            await new Promise(resolve => setTimeout(resolve, 500));
            
            try {
                const contentResponse = await fetch(`${API_URL}/knowledge-base/entries/${entry.entry_id}/content`, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                    }
                });

                if (contentResponse.ok) {
                    const data = await contentResponse.json();
                    const blob = new Blob([data.content], { type: 'text/plain' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = entry.filename;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                }
            } catch (error) {
                console.warn(`Failed to download ${entry.filename}:`, error);
            }
        }

        toast.success(`Downloaded ${entries.length} files`);
    } catch (error) {
        console.error('Error downloading folder files:', error);
        toast.error('Error downloading folder files');
    }
}
