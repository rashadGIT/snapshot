/**
 * useJobWebSocket Hook
 *
 * React hook for managing WebSocket connection to a specific job (room).
 * Handles connection lifecycle, reconnection, and event dispatching.
 *
 * @example
 * ```tsx
 * const { isConnected, lastEvent } = useJobWebSocket({
 *   jobId: job?.id || null,
 *   onEvent: (event) => {
 *     if (event.type === 'UPLOAD_CREATED') {
 *       // Update local state with new upload
 *     }
 *   },
 * });
 * ```
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { WebSocketEvent } from './broadcaster';

/**
 * Hook options
 */
interface UseJobWebSocketOptions {
  /** Job ID to subscribe to (null = not connected) */
  jobId: string | null;
  /** Callback fired when event is received */
  onEvent?: (event: WebSocketEvent) => void;
  /** Enable automatic reconnection (default: true) */
  autoReconnect?: boolean;
  /** Enable debug logging (default: false) */
  debug?: boolean;
}

/**
 * Hook return value
 */
interface UseJobWebSocketReturn {
  /** Whether WebSocket is currently connected */
  isConnected: boolean;
  /** Last event received (useful for triggering effects) */
  lastEvent: WebSocketEvent | null;
  /** Connection error (if any) */
  error: Error | null;
  /** Manually trigger reconnection */
  reconnect: () => void;
  /** Current connection state */
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'error';
}

/**
 * WebSocket connection hook for real-time job updates
 *
 * Features:
 * - Automatic connection management
 * - Exponential backoff reconnection (up to 5 attempts)
 * - JWT authentication via cookie
 * - Job room subscription
 * - Event validation and dispatching
 * - Clean disconnection on unmount
 */
export function useJobWebSocket({
  jobId,
  onEvent,
  autoReconnect = true,
  debug = false,
}: UseJobWebSocketOptions): UseJobWebSocketReturn {
  // State
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<WebSocketEvent | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');

  // Refs (persist across renders, don't trigger re-renders)
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isManualDisconnectRef = useRef(false);

  /**
   * Extract JWT token from cookie
   * WebSocket requires token in query string for authentication
   */
  const getIdToken = useCallback((): string | null => {
    try {
      const cookies = document.cookie.split(';');
      const tokenCookie = cookies.find(c => c.trim().startsWith('id_token='));
      const token = tokenCookie?.split('=')[1] || null;

      if (!token && debug) {
        console.warn('[WebSocket] No id_token cookie found');
      }

      return token;
    } catch (err) {
      console.error('[WebSocket] Failed to read cookie:', err);
      return null;
    }
  }, [debug]);

  /**
   * Establish WebSocket connection
   */
  const connect = useCallback(() => {
    // Skip if no jobId or already connected
    if (!jobId) {
      if (debug) console.log('[WebSocket] No jobId, skipping connection');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      if (debug) console.log('[WebSocket] Already connected');
      return;
    }

    // Get JWT token
    const token = getIdToken();
    if (!token) {
      const err = new Error('No authentication token found. Please log in.');
      setError(err);
      setConnectionState('error');
      return;
    }

    // Get WebSocket URL from environment
    const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL;
    if (!wsUrl) {
      const err = new Error('NEXT_PUBLIC_WEBSOCKET_URL environment variable not set');
      setError(err);
      setConnectionState('error');
      console.error('[WebSocket]', err.message);
      return;
    }

    try {
      setConnectionState('connecting');
      if (debug) console.log('[WebSocket] Connecting...', { jobId, wsUrl });

      // Create WebSocket with JWT token in query string
      const ws = new WebSocket(`${wsUrl}?token=${token}`);

      // Connection opened
      ws.onopen = () => {
        if (debug) console.log('[WebSocket] ✓ Connected');
        setIsConnected(true);
        setError(null);
        setConnectionState('connected');
        reconnectAttemptsRef.current = 0;
        isManualDisconnectRef.current = false;

        // Join job room
        const joinMessage = JSON.stringify({
          action: 'joinJob',
          jobId,
        });
        ws.send(joinMessage);
        if (debug) console.log('[WebSocket] → Sent joinJob', { jobId });
      };

      // Message received
      ws.onmessage = (event) => {
        try {
          const data: WebSocketEvent = JSON.parse(event.data);
          if (debug) console.log('[WebSocket] ← Received event:', data);

          // Update state
          setLastEvent(data);

          // Call user's event handler
          onEvent?.(data);
        } catch (err) {
          console.error('[WebSocket] Failed to parse message:', err, event.data);
        }
      };

      // Error occurred
      ws.onerror = (event) => {
        console.error('[WebSocket] ✗ Error:', event);
        const err = new Error('WebSocket connection error');
        setError(err);
        setConnectionState('error');
      };

      // Connection closed
      ws.onclose = (event) => {
        if (debug) console.log('[WebSocket] Connection closed', { code: event.code, reason: event.reason });
        setIsConnected(false);
        setConnectionState('disconnected');
        wsRef.current = null;

        // Auto-reconnect with exponential backoff (unless manually disconnected)
        if (autoReconnect && !isManualDisconnectRef.current && reconnectAttemptsRef.current < 5) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          if (debug) console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/5)`);

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        } else if (reconnectAttemptsRef.current >= 5) {
          console.error('[WebSocket] Max reconnection attempts reached. Please refresh the page.');
          setError(new Error('Connection lost. Please refresh the page.'));
        }
      };

      wsRef.current = ws;
    } catch (err) {
      console.error('[WebSocket] Connection failed:', err);
      const error = err instanceof Error ? err : new Error('Connection failed');
      setError(error);
      setConnectionState('error');
    }
  }, [jobId, getIdToken, onEvent, autoReconnect, debug]);

  /**
   * Manually trigger reconnection
   * Resets reconnection attempts and closes existing connection
   */
  const reconnect = useCallback(() => {
    if (debug) console.log('[WebSocket] Manual reconnect triggered');

    // Close existing connection
    if (wsRef.current) {
      isManualDisconnectRef.current = true;
      wsRef.current.close();
      wsRef.current = null;
    }

    // Clear reconnection timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Reset attempts and reconnect
    reconnectAttemptsRef.current = 0;
    isManualDisconnectRef.current = false;
    connect();
  }, [connect, debug]);

  /**
   * Effect: Connect when jobId changes
   */
  useEffect(() => {
    if (jobId) {
      connect();
    }

    // Cleanup on unmount or jobId change
    return () => {
      if (debug) console.log('[WebSocket] Cleaning up connection');

      // Clear reconnection timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      // Close WebSocket
      if (wsRef.current) {
        isManualDisconnectRef.current = true;
        wsRef.current.close();
        wsRef.current = null;
      }

      setIsConnected(false);
      setConnectionState('disconnected');
    };
  }, [jobId, connect, debug]);

  return {
    isConnected,
    lastEvent,
    error,
    reconnect,
    connectionState,
  };
}
