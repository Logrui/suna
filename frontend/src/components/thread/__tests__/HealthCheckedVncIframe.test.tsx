/**
 * Unit tests for HealthCheckedVncIframe component
 *
 * Tests cover:
 * - WebSocket path construction
 * - URL protocol upgrades
 * - Auth token handling
 * - Error states and retry logic
 */

import { render, screen, waitFor } from '@testing-library/react';
import { HealthCheckedVncIframe } from '../HealthCheckedVncIframe';

// Mock the useVncPreloader hook
jest.mock('@/hooks/files', () => ({
  useVncPreloader: jest.fn(),
}));

import { useVncPreloader } from '@/hooks/files';

describe('HealthCheckedVncIframe', () => {
  const mockSandbox = {
    id: 'test-sandbox-123',
    vnc_preview: 'https://kortix.syhc.dev/api/sandboxes/test-sandbox-123/proxy/6080/',
    pass: 'test-password-456',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('WebSocket Path Construction', () => {
    it('should construct correct WebSocket path from vnc_preview URL', () => {
      (useVncPreloader as jest.Mock).mockReturnValue({
        status: 'ready',
        isPreloaded: true,
        accessToken: null,
      });

      render(<HealthCheckedVncIframe sandbox={mockSandbox} />);

      // Verify console log was called with correct path
      expect(console.log).toHaveBeenCalledWith(
        '[VNC Debug] Constructing VNC connection:',
        expect.objectContaining({
          vnc_preview: mockSandbox.vnc_preview,
          websocket_path: '/api/sandboxes/test-sandbox-123/proxy/6080/websockify',
          sandbox_id: mockSandbox.id,
        })
      );
    });

    it('should handle vnc_preview URL without trailing slash', () => {
      const sandboxNoSlash = {
        ...mockSandbox,
        vnc_preview: 'https://kortix.syhc.dev/api/sandboxes/test-sandbox-123/proxy/6080',
      };

      (useVncPreloader as jest.Mock).mockReturnValue({
        status: 'ready',
        isPreloaded: true,
        accessToken: null,
      });

      render(<HealthCheckedVncIframe sandbox={sandboxNoSlash} />);

      expect(console.log).toHaveBeenCalledWith(
        '[VNC Debug] Constructing VNC connection:',
        expect.objectContaining({
          websocket_path: '/api/sandboxes/test-sandbox-123/proxy/6080/websockify',
        })
      );
    });

    it('should URL-encode the WebSocket path parameter', () => {
      (useVncPreloader as jest.Mock).mockReturnValue({
        status: 'ready',
        isPreloaded: true,
        accessToken: null,
      });

      render(<HealthCheckedVncIframe sandbox={mockSandbox} />);

      // Check that final URL contains encoded path
      expect(console.log).toHaveBeenCalledWith(
        '[VNC Debug] Final VNC URL:',
        expect.stringContaining('path=%2Fapi%2Fsandboxes%2Ftest-sandbox-123%2Fproxy%2F6080%2Fwebsockify')
      );
    });
  });

  describe('Protocol Upgrades', () => {
    it('should upgrade HTTP to HTTPS when page is HTTPS', () => {
      // Mock window.location to be HTTPS
      Object.defineProperty(window, 'location', {
        value: { protocol: 'https:', origin: 'https://kortix.syhc.dev' },
        writable: true,
      });

      const sandboxHttp = {
        ...mockSandbox,
        vnc_preview: 'http://kortix.syhc.dev/api/sandboxes/test-sandbox-123/proxy/6080/',
      };

      (useVncPreloader as jest.Mock).mockReturnValue({
        status: 'ready',
        isPreloaded: true,
        accessToken: null,
      });

      render(<HealthCheckedVncIframe sandbox={sandboxHttp} />);

      expect(console.log).toHaveBeenCalledWith('[VNC Debug] Upgraded HTTP to HTTPS');
    });

    it('should not upgrade HTTPS to HTTP', () => {
      Object.defineProperty(window, 'location', {
        value: { protocol: 'http:', origin: 'http://localhost:9990' },
        writable: true,
      });

      (useVncPreloader as jest.Mock).mockReturnValue({
        status: 'ready',
        isPreloaded: true,
        accessToken: null,
      });

      render(<HealthCheckedVncIframe sandbox={mockSandbox} />);

      expect(console.log).not.toHaveBeenCalledWith('[VNC Debug] Upgraded HTTP to HTTPS');
    });
  });

  describe('Authentication Token', () => {
    it('should append access token when available', () => {
      (useVncPreloader as jest.Mock).mockReturnValue({
        status: 'ready',
        isPreloaded: true,
        accessToken: 'test-token-789',
      });

      render(<HealthCheckedVncIframe sandbox={mockSandbox} />);

      expect(console.log).toHaveBeenCalledWith('[VNC Debug] Added auth token to VNC URL');
      expect(console.log).toHaveBeenCalledWith(
        '[VNC Debug] Final VNC URL:',
        expect.stringContaining('token=test-token-789')
      );
    });

    it('should not append token when not available', () => {
      (useVncPreloader as jest.Mock).mockReturnValue({
        status: 'ready',
        isPreloaded: true,
        accessToken: null,
      });

      render(<HealthCheckedVncIframe sandbox={mockSandbox} />);

      expect(console.log).not.toHaveBeenCalledWith('[VNC Debug] Added auth token to VNC URL');
    });
  });

  describe('Connection States', () => {
    it('should show loading state when status is loading', () => {
      (useVncPreloader as jest.Mock).mockReturnValue({
        status: 'loading',
        isPreloaded: false,
        retryCount: 0,
        accessToken: null,
      });

      render(<HealthCheckedVncIframe sandbox={mockSandbox} />);

      expect(screen.getByText(/testing vnc connection/i)).toBeInTheDocument();
    });

    it('should show error state when status is error', () => {
      (useVncPreloader as jest.Mock).mockReturnValue({
        status: 'error',
        isPreloaded: false,
        retryCount: 5,
        retry: jest.fn(),
        accessToken: null,
      });

      render(<HealthCheckedVncIframe sandbox={mockSandbox} />);

      expect(screen.getByText(/vnc connection failed/i)).toBeInTheDocument();
    });

    it('should show VNC iframe when preloaded', () => {
      (useVncPreloader as jest.Mock).mockReturnValue({
        status: 'ready',
        isPreloaded: true,
        accessToken: null,
      });

      const { container } = render(<HealthCheckedVncIframe sandbox={mockSandbox} />);

      const iframe = container.querySelector('iframe');
      expect(iframe).toBeInTheDocument();
      expect(iframe?.src).toContain('vnc_lite.html');
    });
  });

  describe('Retry Logic', () => {
    it('should call retry function when retry button is clicked', async () => {
      const mockRetry = jest.fn();

      (useVncPreloader as jest.Mock).mockReturnValue({
        status: 'error',
        isPreloaded: false,
        retryCount: 3,
        retry: mockRetry,
        accessToken: null,
      });

      render(<HealthCheckedVncIframe sandbox={mockSandbox} />);

      const retryButton = screen.getByText(/retry/i);
      retryButton.click();

      expect(mockRetry).toHaveBeenCalled();
    });

    it('should show retry count in error message', () => {
      (useVncPreloader as jest.Mock).mockReturnValue({
        status: 'error',
        isPreloaded: false,
        retryCount: 3,
        retry: jest.fn(),
        accessToken: null,
      });

      render(<HealthCheckedVncIframe sandbox={mockSandbox} />);

      expect(screen.getByText(/failed after 3 attempts/i)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing sandbox data gracefully', () => {
      (useVncPreloader as jest.Mock).mockReturnValue({
        status: 'idle',
        isPreloaded: false,
        accessToken: null,
      });

      const { container } = render(<HealthCheckedVncIframe sandbox={null as any} />);

      expect(container.firstChild).toBeNull();
    });

    it('should handle malformed vnc_preview URL', () => {
      const malformedSandbox = {
        ...mockSandbox,
        vnc_preview: 'not-a-valid-url',
      };

      (useVncPreloader as jest.Mock).mockReturnValue({
        status: 'ready',
        isPreloaded: true,
        accessToken: null,
      });

      // Should not throw error
      expect(() => {
        render(<HealthCheckedVncIframe sandbox={malformedSandbox} />);
      }).not.toThrow();
    });
  });
});
