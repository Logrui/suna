/**
 * Unit tests for the AdvancedWorkflowEditor component.
 *
 * Tests the integration between Suna frontend and Langflow iframe,
 * including session fetching, authentication, and iframe rendering.
 * 
 * @vitest-environment jsdom
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock the AuthProvider before importing the component
vi.mock('@/components/AuthProvider', () => ({
    useAuth: vi.fn(),
}));

// Import the mocked module
import { useAuth } from '@/components/AuthProvider';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Get typed mock
const mockUseAuth = useAuth as Mock;

// Type definitions
interface MockSession {
    access_token: string;
    user: { id: string; email: string };
}

interface MockAdvancedWorkflowsSession {
    access_token: string;
    refresh_token?: string;
    advanced_workflows_url: string;
    flow_url: string;
    project_id: string;
    flow_id: string;
    project_created: boolean;
    flow_created: boolean;
    expires_in: number;
}

describe('AdvancedWorkflowEditor', () => {
    // Test fixtures
    const mockSession: MockSession = {
        access_token: 'mock-suna-token',
        user: { id: 'user-123', email: 'test@example.com' },
    };

    const mockSessionData: MockAdvancedWorkflowsSession = {
        access_token: 'mock-langflow-token',
        refresh_token: 'mock-refresh-token',
        advanced_workflows_url: 'http://localhost:7860',
        flow_url: 'http://localhost:7860/flow/workflow-123',
        project_id: 'agent-123',
        flow_id: 'workflow-123',
        project_created: false,
        flow_created: false,
        expires_in: 3600,
    };

    // Lazy import component to ensure mocks are set up first
    let AdvancedWorkflowEditor: React.ComponentType<{ agentId: string; workflowId: string }>;

    beforeEach(async () => {
        vi.clearAllMocks();
        mockFetch.mockReset();

        // Set environment variable
        vi.stubEnv('NEXT_PUBLIC_BACKEND_URL', 'http://localhost:8000/v1');

        // Dynamically import the component after mocks are set up
        const module = await import('../advanced-workflow-editor');
        AdvancedWorkflowEditor = module.AdvancedWorkflowEditor;
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    describe('Authentication', () => {
        it('shows error when not authenticated', async () => {
            mockUseAuth.mockReturnValue({
                session: null,
                user: null,
                loading: false,
            });

            render(
                <AdvancedWorkflowEditor agentId="agent-123" workflowId="workflow-123" />
            );

            await waitFor(() => {
                expect(screen.getByText(/Not authenticated/i)).toBeInTheDocument();
            });
        });

        it('shows loading state while fetching session', async () => {
            mockUseAuth.mockReturnValue({
                session: mockSession,
                user: mockSession.user,
                loading: false,
            });

            // Mock fetch that never resolves
            mockFetch.mockImplementation(() => new Promise(() => { }));

            render(
                <AdvancedWorkflowEditor agentId="agent-123" workflowId="workflow-123" />
            );

            await waitFor(() => {
                expect(screen.getByText(/Connecting to Advanced Workflows/i)).toBeInTheDocument();
            });
        });
    });

    describe('Session Fetching', () => {
        it('fetches session with correct parameters', async () => {
            mockUseAuth.mockReturnValue({
                session: mockSession,
                user: mockSession.user,
                loading: false,
            });

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockSessionData,
            });

            render(
                <AdvancedWorkflowEditor agentId="agent-123" workflowId="workflow-123" />
            );

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalled();
            });

            // Check URL and headers
            const [url, options] = mockFetch.mock.calls[0];
            expect(url).toContain('/advanced-workflows/session');
            expect(url).toContain('agent_id=agent-123');
            expect(url).toContain('workflow_id=workflow-123');
            expect(options.headers.Authorization).toBe(`Bearer ${mockSession.access_token}`);
        });

        it('handles 404 error gracefully', async () => {
            mockUseAuth.mockReturnValue({
                session: mockSession,
                user: mockSession.user,
                loading: false,
            });

            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
            });

            render(
                <AdvancedWorkflowEditor agentId="agent-123" workflowId="workflow-123" />
            );

            await waitFor(() => {
                expect(screen.getByText(/Advanced Workflows integration may not be configured correctly/i)).toBeInTheDocument();
            });
        });

        it('handles generic error with detail message', async () => {
            mockUseAuth.mockReturnValue({
                session: mockSession,
                user: mockSession.user,
                loading: false,
            });

            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 503,
                json: async () => ({ detail: 'Service unavailable' }),
            });

            render(
                <AdvancedWorkflowEditor agentId="agent-123" workflowId="workflow-123" />
            );

            await waitFor(() => {
                expect(screen.getByText(/Service unavailable/i)).toBeInTheDocument();
            });
        });
    });

    describe('Iframe Rendering', () => {
        it('renders iframe with correct src after successful session', async () => {
            mockUseAuth.mockReturnValue({
                session: mockSession,
                user: mockSession.user,
                loading: false,
            });

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockSessionData,
            });

            render(
                <AdvancedWorkflowEditor agentId="agent-123" workflowId="workflow-123" />
            );

            await waitFor(() => {
                const iframe = document.querySelector('iframe');
                expect(iframe).toBeInTheDocument();
                expect(iframe?.src).toContain('http://localhost:7860/flow/workflow-123');
                expect(iframe?.src).toContain('token=');
            });
        });
    });

    describe('Project/Flow Sync Logging', () => {
        it('logs when new project is created', async () => {
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });

            mockUseAuth.mockReturnValue({
                session: mockSession,
                user: mockSession.user,
                loading: false,
            });

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    ...mockSessionData,
                    project_created: true,
                }),
            });

            render(
                <AdvancedWorkflowEditor agentId="agent-123" workflowId="workflow-123" />
            );

            await waitFor(() => {
                expect(consoleSpy).toHaveBeenCalledWith(
                    expect.stringContaining('Created new project for agent: agent-123')
                );
            });

            consoleSpy.mockRestore();
        });

        it('logs when new flow is created', async () => {
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });

            mockUseAuth.mockReturnValue({
                session: mockSession,
                user: mockSession.user,
                loading: false,
            });

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    ...mockSessionData,
                    flow_created: true,
                }),
            });

            render(
                <AdvancedWorkflowEditor agentId="agent-123" workflowId="workflow-123" />
            );

            await waitFor(() => {
                expect(consoleSpy).toHaveBeenCalledWith(
                    expect.stringContaining('Created new flow for workflow: workflow-123')
                );
            });

            consoleSpy.mockRestore();
        });
    });

    describe('UI Controls', () => {
        it('renders retry button on error', async () => {
            mockUseAuth.mockReturnValue({
                session: mockSession,
                user: mockSession.user,
                loading: false,
            });

            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
            });

            render(
                <AdvancedWorkflowEditor agentId="agent-123" workflowId="workflow-123" />
            );

            await waitFor(() => {
                expect(screen.getByText(/Retry Connection/i)).toBeInTheDocument();
            });
        });

        it('retries session fetch when retry button is clicked', async () => {
            mockUseAuth.mockReturnValue({
                session: mockSession,
                user: mockSession.user,
                loading: false,
            });

            // First call fails
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
            });

            render(
                <AdvancedWorkflowEditor agentId="agent-123" workflowId="workflow-123" />
            );

            await waitFor(() => {
                expect(screen.getByText(/Retry Connection/i)).toBeInTheDocument();
            });

            // Second call succeeds
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockSessionData,
            });

            fireEvent.click(screen.getByText(/Retry Connection/i));

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledTimes(2);
            });
        });
    });

    describe('ID Mapping', () => {
        it('displays correct agent and workflow IDs', async () => {
            mockUseAuth.mockReturnValue({
                session: mockSession,
                user: mockSession.user,
                loading: false,
            });

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockSessionData,
            });

            render(
                <AdvancedWorkflowEditor agentId="agent-123" workflowId="workflow-123" />
            );

            await waitFor(() => {
                // Check that IDs are displayed in the sidebar
                expect(screen.getByText('workflow-123')).toBeInTheDocument();
                expect(screen.getByText('agent-123')).toBeInTheDocument();
            });
        });
    });
});

describe('AdvancedWorkflowEditor Integration Flow', () => {
    const mockSession = {
        access_token: 'mock-suna-token',
        user: { id: 'user-123', email: 'test@example.com' },
    };

    let AdvancedWorkflowEditor: React.ComponentType<{ agentId: string; workflowId: string }>;

    beforeEach(async () => {
        vi.clearAllMocks();
        mockFetch.mockReset();
        vi.stubEnv('NEXT_PUBLIC_BACKEND_URL', 'http://localhost:8000/v1');

        const module = await import('../advanced-workflow-editor');
        AdvancedWorkflowEditor = module.AdvancedWorkflowEditor;
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('follows complete integration flow: Auth → Session → Iframe', async () => {
        mockUseAuth.mockReturnValue({
            session: mockSession,
            user: mockSession.user,
            loading: false,
        });

        const mockSessionData = {
            access_token: 'langflow-token',
            flow_url: 'http://localhost:7860/flow/workflow-123',
            project_id: 'agent-123',
            flow_id: 'workflow-123',
            project_created: true,
            flow_created: true,
            expires_in: 3600,
        };

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockSessionData,
        });

        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });

        render(
            <AdvancedWorkflowEditor agentId="agent-123" workflowId="workflow-123" />
        );

        // 1. Verify session fetch was called
        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        // 2. Verify logging of session start
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('[Advanced Workflows] Starting session fetch'),
            expect.any(Object)
        );

        // 3. Verify iframe is rendered
        await waitFor(() => {
            const iframe = document.querySelector('iframe');
            expect(iframe).toBeInTheDocument();
        });

        consoleSpy.mockRestore();
    });
});
