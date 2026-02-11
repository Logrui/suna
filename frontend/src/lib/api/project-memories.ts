import { createClient } from '@/lib/supabase/client';

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

export type MemoryType = 'fact' | 'preference' | 'instruction' | 'context';

export interface ProjectMemory {
    memory_id: string;
    account_id: string;
    project_id: string;
    content: string;
    memory_type: MemoryType;
    confidence_score: number;
    source_thread_id: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

export interface CreateProjectMemoryPayload {
    content: string;
    memory_type?: MemoryType;
    metadata?: Record<string, unknown>;
}

export interface UpdateProjectMemoryPayload {
    content?: string;
    memory_type?: MemoryType;
    metadata?: Record<string, unknown>;
}

export interface ProjectMemoriesListResponse {
    memories: ProjectMemory[];
    total: number;
    page: number;
    page_size: number;
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

async function getAuthHeaders(): Promise<Record<string, string>> {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) throw new Error('Not authenticated');
    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
    };
}

function getBackendUrl(): string {
    return process.env.NEXT_PUBLIC_BACKEND_URL || '';
}

// ────────────────────────────────────────────────────────────────
// API Functions
// ────────────────────────────────────────────────────────────────

export async function listProjectMemories(
    projectId: string,
    opts?: { page?: number; pageSize?: number; memoryType?: MemoryType }
): Promise<ProjectMemoriesListResponse> {
    const headers = await getAuthHeaders();
    const params = new URLSearchParams();
    if (opts?.page) params.set('page', String(opts.page));
    if (opts?.pageSize) params.set('page_size', String(opts.pageSize));
    if (opts?.memoryType) params.set('memory_type', opts.memoryType);

    const url = `${getBackendUrl()}/api/projects/${projectId}/memories?${params}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Failed to list memories: ${res.statusText}`);
    return res.json();
}

export async function getProjectMemory(
    projectId: string,
    memoryId: string
): Promise<ProjectMemory> {
    const headers = await getAuthHeaders();
    const url = `${getBackendUrl()}/api/projects/${projectId}/memories/${memoryId}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Failed to get memory: ${res.statusText}`);
    return res.json();
}

export async function createProjectMemory(
    projectId: string,
    payload: CreateProjectMemoryPayload
): Promise<ProjectMemory> {
    const headers = await getAuthHeaders();
    const url = `${getBackendUrl()}/api/projects/${projectId}/memories`;
    const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Failed to create memory: ${res.statusText}`);
    return res.json();
}

export async function updateProjectMemory(
    projectId: string,
    memoryId: string,
    payload: UpdateProjectMemoryPayload
): Promise<ProjectMemory> {
    const headers = await getAuthHeaders();
    const url = `${getBackendUrl()}/api/projects/${projectId}/memories/${memoryId}`;
    const res = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Failed to update memory: ${res.statusText}`);
    return res.json();
}

export async function deleteProjectMemory(
    projectId: string,
    memoryId: string
): Promise<void> {
    const headers = await getAuthHeaders();
    const url = `${getBackendUrl()}/api/projects/${projectId}/memories/${memoryId}`;
    const res = await fetch(url, { method: 'DELETE', headers });
    if (!res.ok) throw new Error(`Failed to delete memory: ${res.statusText}`);
}

export async function searchProjectMemories(
    projectId: string,
    query: string,
    opts?: { limit?: number; threshold?: number }
): Promise<ProjectMemory[]> {
    const headers = await getAuthHeaders();
    const params = new URLSearchParams({ query });
    if (opts?.limit) params.set('limit', String(opts.limit));
    if (opts?.threshold) params.set('threshold', String(opts.threshold));

    const url = `${getBackendUrl()}/api/projects/${projectId}/memories/search?${params}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Failed to search memories: ${res.statusText}`);
    return res.json();
}
