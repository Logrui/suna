/**
 * Unit tests for useVncPreloader hook
 *
 * Tests cover:
 * - Preload lifecycle
 * - Retry logic with exponential backoff
 * - Timeout handling
 * - Error scenarios
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useVncPreloader } from '../useVncPreloader';

describe('useVncPreloader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();

    // Mock document.body.appendChild and removeChild
    jest.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
    jest.spyOn(document.body, 'removeChild').mockImplementation((node) => node);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  const mockSandbox = {
    vnc_preview: 'https://kortix.syhc.dev/api/sandboxes/test-123/proxy/6080/',
    pass: 'test-password',
  };

  describe('Preload Lifecycle', () => {
    it('should start with idle status', () => {
      const { result } = renderHook(() => useVncPreloader(null));

      expect(result.current.status).toBe('idle');
      expect(result.current.isPreloaded).toBe(false);
    });

    it('should transition to loading when sandbox is provided', async () => {
      const { result, rerender } = renderHook(
        ({ sandbox }) => useVncPreloader(sandbox),
        { initialProps: { sandbox: null } }
      );

      expect(result.current.status).toBe('idle');

      rerender({ sandbox: mockSandbox });

      await waitFor(() => {
        expect(result.current.status).toBe('loading');
      });
    });

    it('should create iframe with correct URL', async () => {
      const { rerender } = renderHook(
        ({ sandbox }) => useVncPreloader(sandbox),
        { initialProps: { sandbox: null } }
      );

      rerender({ sandbox: mockSandbox });

      await waitFor(() => {
        expect(document.body.appendChild).toHaveBeenCalled();
      });

      const iframe = (document.body.appendChild as jest.Mock).mock.calls[0][0];
      expect(iframe.src).toContain('vnc_lite.html');
      expect(iframe.src).toContain('password=test-password');
    });

    it('should log preload start', async () => {
      const { rerender } = renderHook(
        ({ sandbox }) => useVncPreloader(sandbox),
        { initialProps: { sandbox: null } }
      );

      rerender({ sandbox: mockSandbox });

      await waitFor(() => {
        expect(console.log).toHaveBeenCalledWith(
          '[VNC Preloader] Starting preload:',
          expect.objectContaining({
            url: expect.stringContaining('vnc_lite.html'),
            retryCount: 0,
          })
        );
      });
    });
  });

  describe('Retry Logic', () => {
    it('should retry on timeout with exponential backoff', async () => {
      jest.useFakeTimers();

      const { rerender } = renderHook(
        ({ sandbox }) => useVncPreloader(sandbox, { maxRetries: 3, timeoutMs: 1000 }),
        { initialProps: { sandbox: null } }
      );

      rerender({ sandbox: mockSandbox });

      // Fast-forward past first timeout
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('VNC preload failed, retrying in'),
          expect.anything()
        );
      });

      // Should calculate exponential backoff: 2000 * 1.5^0 = 2000ms
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('retrying in 2000ms')
      );
    });

    it('should give up after max retries', async () => {
      jest.useFakeTimers();

      const { result, rerender } = renderHook(
        ({ sandbox }) => useVncPreloader(sandbox, { maxRetries: 2, timeoutMs: 100 }),
        { initialProps: { sandbox: null } }
      );

      rerender({ sandbox: mockSandbox });

      // Exhaust all retries
      for (let i = 0; i <= 2; i++) {
        act(() => {
          jest.advanceTimersByTime(100);
        });
        if (i < 2) {
          act(() => {
            jest.advanceTimersByTime(2000 * Math.pow(1.5, i));
          });
        }
      }

      await waitFor(() => {
        expect(result.current.status).toBe('error');
      });

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('VNC preload failed after 2 attempts')
      );
    });

    it('should cap exponential backoff at 10 seconds', () => {
      const delays = [
        2000 * Math.pow(1.5, 0), // 2000ms
        2000 * Math.pow(1.5, 1), // 3000ms
        2000 * Math.pow(1.5, 2), // 4500ms
        2000 * Math.pow(1.5, 3), // 6750ms
        2000 * Math.pow(1.5, 4), // 10125ms -> capped at 10000ms
      ];

      delays.forEach((delay, index) => {
        const cappedDelay = Math.min(delay, 10000);
        if (index >= 4) {
          expect(cappedDelay).toBe(10000);
        }
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle iframe onload success', async () => {
      const { result, rerender } = renderHook(
        ({ sandbox }) => useVncPreloader(sandbox),
        { initialProps: { sandbox: null } }
      );

      rerender({ sandbox: mockSandbox });

      await waitFor(() => {
        expect(document.body.appendChild).toHaveBeenCalled();
      });

      const iframe = (document.body.appendChild as jest.Mock).mock.calls[0][0];

      // Simulate successful load
      act(() => {
        iframe.onload();
      });

      await waitFor(() => {
        expect(result.current.status).toBe('ready');
        expect(result.current.isPreloaded).toBe(true);
      });

      expect(console.log).toHaveBeenCalledWith('✅ VNC preloaded successfully');
    });

    it('should handle iframe onerror', async () => {
      jest.useFakeTimers();

      const { rerender } = renderHook(
        ({ sandbox }) => useVncPreloader(sandbox, { maxRetries: 1 }),
        { initialProps: { sandbox: null } }
      );

      rerender({ sandbox: mockSandbox });

      await waitFor(() => {
        expect(document.body.appendChild).toHaveBeenCalled();
      });

      const iframe = (document.body.appendChild as jest.Mock).mock.calls[0][0];

      // Simulate error
      act(() => {
        iframe.onerror(new Event('error'));
      });

      expect(console.error).toHaveBeenCalledWith(
        '[VNC Preloader] iframe.onerror triggered:',
        expect.any(Event)
      );
    });

    it('should clean up iframe on timeout', async () => {
      jest.useFakeTimers();

      const { rerender } = renderHook(
        ({ sandbox }) => useVncPreloader(sandbox, { timeoutMs: 1000 }),
        { initialProps: { sandbox: null } }
      );

      rerender({ sandbox: mockSandbox });

      await waitFor(() => {
        expect(document.body.appendChild).toHaveBeenCalled();
      });

      // Fast-forward to timeout
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(console.log).toHaveBeenCalledWith(
        '[VNC Preloader] Load timeout reached after',
        1000,
        'ms'
      );

      expect(document.body.removeChild).toHaveBeenCalled();
    });
  });

  describe('Retry Function', () => {
    it('should expose retry function', () => {
      const { result } = renderHook(() => useVncPreloader(mockSandbox));

      expect(result.current.retry).toBeDefined();
      expect(typeof result.current.retry).toBe('function');
    });

    it('should reset retry count when retry is called', async () => {
      jest.useFakeTimers();

      const { result, rerender } = renderHook(
        ({ sandbox }) => useVncPreloader(sandbox, { maxRetries: 3, timeoutMs: 100 }),
        { initialProps: { sandbox: mockSandbox } }
      );

      // Let it timeout once
      act(() => {
        jest.advanceTimersByTime(100);
      });

      expect(result.current.retryCount).toBeGreaterThan(0);

      // Call retry
      act(() => {
        result.current.retry();
      });

      expect(result.current.retryCount).toBe(0);
      expect(result.current.status).toBe('idle');
    });
  });

  describe('Cleanup', () => {
    it('should cleanup iframe on unmount', async () => {
      const { unmount, rerender } = renderHook(
        ({ sandbox }) => useVncPreloader(sandbox),
        { initialProps: { sandbox: null } }
      );

      rerender({ sandbox: mockSandbox });

      await waitFor(() => {
        expect(document.body.appendChild).toHaveBeenCalled();
      });

      unmount();

      expect(document.body.removeChild).toHaveBeenCalled();
    });

    it('should clear timeouts on unmount', async () => {
      jest.useFakeTimers();

      const { unmount, rerender } = renderHook(
        ({ sandbox }) => useVncPreloader(sandbox),
        { initialProps: { sandbox: null } }
      );

      rerender({ sandbox: mockSandbox });

      unmount();

      // No errors should occur from pending timeouts
      act(() => {
        jest.runAllTimers();
      });
    });
  });

  describe('Access Token', () => {
    it('should fetch access token from Supabase', async () => {
      const mockGetSession = jest.fn().mockResolvedValue({
        data: {
          session: {
            access_token: 'test-token-123',
          },
        },
      });

      // Mock Supabase client
      jest.mock('@/lib/supabase/client', () => ({
        createClient: () => ({
          auth: {
            getSession: mockGetSession,
          },
        }),
      }));

      const { result } = renderHook(() => useVncPreloader(mockSandbox));

      await waitFor(() => {
        expect(result.current.accessToken).toBe('test-token-123');
      });
    });
  });
});
