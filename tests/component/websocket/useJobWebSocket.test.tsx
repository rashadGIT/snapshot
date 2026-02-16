/**
 * Component Tests for useJobWebSocket Hook
 *
 * Tests the WebSocket connection hook with mocked WebSocket
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useJobWebSocket } from '@/lib/websocket/useJobWebSocket';
import type { WebSocketEvent } from '@/lib/websocket/broadcaster';

// Mock WebSocket
class MockWebSocket {
  url: string;
  readyState: number = WebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  constructor(url: string) {
    this.url = url;
    // Simulate connection opening after a brief delay
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 10);
  }

  send(data: string) {
    // Mock send
  }

  close() {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code: 1000, reason: 'Normal closure' }));
    }
  }

  // Helper to simulate receiving a message
  simulateMessage(data: any) {
    if (this.onmessage) {
      const event = new MessageEvent('message', {
        data: JSON.stringify(data),
      });
      this.onmessage(event);
    }
  }
}

// Replace global WebSocket with mock
global.WebSocket = MockWebSocket as any;

// Mock document.cookie
Object.defineProperty(document, 'cookie', {
  writable: true,
  value: 'id_token=test-jwt-token',
});

describe('useJobWebSocket Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_WEBSOCKET_URL = 'wss://test.execute-api.us-east-1.amazonaws.com/production';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Connection Management', () => {
    it('should initialize with disconnected state', () => {
      const { result } = renderHook(() =>
        useJobWebSocket({
          jobId: null,
          onEvent: vi.fn(),
        })
      );

      expect(result.current.isConnected).toBe(false);
      expect(result.current.connectionState).toBe('disconnected');
    });

    it('should connect when jobId is provided', async () => {
      const { result } = renderHook(() =>
        useJobWebSocket({
          jobId: 'test-job-123',
          onEvent: vi.fn(),
        })
      );

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      }, { timeout: 100 });

      expect(result.current.connectionState).toBe('connected');
    });

    it('should not connect when jobId is null', () => {
      const { result } = renderHook(() =>
        useJobWebSocket({
          jobId: null,
          onEvent: vi.fn(),
        })
      );

      expect(result.current.isConnected).toBe(false);
    });

    it('should disconnect and cleanup on unmount', async () => {
      const { result, unmount } = renderHook(() =>
        useJobWebSocket({
          jobId: 'test-job-123',
          onEvent: vi.fn(),
        })
      );

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      unmount();

      // Connection should be cleaned up
      expect(result.current.isConnected).toBe(false);
    });
  });

  describe('Event Handling', () => {
    it('should call onEvent callback when message received', async () => {
      const onEvent = vi.fn();
      let mockWs: MockWebSocket | null = null;

      // Intercept WebSocket creation to get reference
      const OriginalWebSocket = global.WebSocket;
      global.WebSocket = class extends MockWebSocket {
        constructor(url: string) {
          super(url);
          mockWs = this;
        }
      } as any;

      const { result } = renderHook(() =>
        useJobWebSocket({
          jobId: 'test-job-123',
          onEvent,
        })
      );

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // Simulate receiving a message
      const testEvent: WebSocketEvent = {
        type: 'MESSAGE_CREATED',
        payload: {
          jobId: 'test-job-123',
          message: {
            id: 'msg-1',
            content: 'Test message',
            userId: 'user-1',
            userName: 'Test User',
            createdAt: new Date().toISOString(),
          },
        },
      };

      act(() => {
        mockWs?.simulateMessage(testEvent);
      });

      await waitFor(() => {
        expect(onEvent).toHaveBeenCalledWith(testEvent);
      });

      global.WebSocket = OriginalWebSocket;
    });

    it('should update lastEvent state when message received', async () => {
      let mockWs: MockWebSocket | null = null;

      const OriginalWebSocket = global.WebSocket;
      global.WebSocket = class extends MockWebSocket {
        constructor(url: string) {
          super(url);
          mockWs = this;
        }
      } as any;

      const { result } = renderHook(() =>
        useJobWebSocket({
          jobId: 'test-job-123',
          onEvent: vi.fn(),
        })
      );

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      const testEvent: WebSocketEvent = {
        type: 'UPLOAD_CREATED',
        payload: {
          jobId: 'test-job-123',
          upload: {
            id: 'upload-1',
            s3Key: 'test.jpg',
            fileName: 'test.jpg',
            fileType: 'image/jpeg',
            fileSize: 1024,
            uploadedAt: new Date().toISOString(),
            uploadedBy: 'Helper',
          },
        },
      };

      act(() => {
        mockWs?.simulateMessage(testEvent);
      });

      await waitFor(() => {
        expect(result.current.lastEvent).toEqual(testEvent);
      });

      global.WebSocket = OriginalWebSocket;
    });
  });

  describe('Reconnection Logic', () => {
    it('should have reconnect function available', () => {
      const { result } = renderHook(() =>
        useJobWebSocket({
          jobId: 'test-job-123',
          onEvent: vi.fn(),
        })
      );

      expect(typeof result.current.reconnect).toBe('function');
    });

    it('should support manual reconnection', async () => {
      const { result } = renderHook(() =>
        useJobWebSocket({
          jobId: 'test-job-123',
          onEvent: vi.fn(),
        })
      );

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // Trigger manual reconnect
      act(() => {
        result.current.reconnect();
      });

      // Should eventually reconnect
      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      }, { timeout: 200 });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing JWT token gracefully', () => {
      // Clear cookie
      Object.defineProperty(document, 'cookie', {
        writable: true,
        value: '',
      });

      const { result } = renderHook(() =>
        useJobWebSocket({
          jobId: 'test-job-123',
          onEvent: vi.fn(),
        })
      );

      expect(result.current.connectionState).toBe('error');
      expect(result.current.error).toBeTruthy();

      // Restore cookie
      Object.defineProperty(document, 'cookie', {
        writable: true,
        value: 'id_token=test-jwt-token',
      });
    });

    it('should handle missing NEXT_PUBLIC_WEBSOCKET_URL', () => {
      const originalUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL;
      delete process.env.NEXT_PUBLIC_WEBSOCKET_URL;

      const { result } = renderHook(() =>
        useJobWebSocket({
          jobId: 'test-job-123',
          onEvent: vi.fn(),
        })
      );

      expect(result.current.connectionState).toBe('error');
      expect(result.current.error).toBeTruthy();

      process.env.NEXT_PUBLIC_WEBSOCKET_URL = originalUrl;
    });
  });
});
