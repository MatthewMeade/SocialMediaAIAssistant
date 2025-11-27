// client/hooks/use-chat-stream.ts
import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { StreamEventPayload } from '../../shared/stream-types';

interface UseChatStreamProps {
  threadId: string | null;
  onToken: (token: string) => void;
  onStatusChange: (status: string | null) => void;
}

export function useChatStream({ threadId, onToken, onStatusChange }: UseChatStreamProps) {
  const abortControllerRef = useRef<AbortController | null>(null);

  const connect = useCallback(async () => {
    if (!threadId) return;
    
    // Cleanup previous connection if exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController for this connection
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error('[useChatStream] No auth token available');
        return;
      }

      // Use fetch with streaming to support Authorization header
      const response = await fetch(`/api/ai/stream/${threadId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Accept': 'text/event-stream',
        },
        signal: abortController.signal,
      });

      if (!response.ok) {
        console.error('[useChatStream] Response not ok:', response.status, response.statusText);
        return;
      }

      // Parse SSE stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (!reader) {
        console.error('[useChatStream] No reader available');
        return;
      }

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        // Decode chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages (separated by \n\n)
        const messages = buffer.split('\n\n');
        buffer = messages.pop() || ''; // Keep incomplete message in buffer

        for (const message of messages) {
          if (!message.trim()) continue;

          let eventType = 'message'; // Default event type
          let data = '';

          // Parse SSE message format: event: <type>\ndata: <json>
          const lines = message.split('\n');
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              data = line.slice(6).trim();
            }
          }

          if (data) {
            try {
              const payload = JSON.parse(data) as StreamEventPayload;
              
              // Handle based on payload type
              switch (payload.type) {
                case 'token':
                  if (payload.content) onToken(payload.content);
                  break;
                case 'status_start':
                  onStatusChange(payload.content || 'Thinking...');
                  break;
                case 'status_end':
                  onStatusChange(null);
                  break;
                case 'connected':
                  console.log('[useChatStream] Connected to stream');
                  break;
              }
            } catch (err) {
              console.error('[useChatStream] Stream parse error', err, 'Data:', data);
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('[useChatStream] Stream aborted');
      } else {
        console.error('[useChatStream] Stream error', err);
      }
    }
  }, [threadId, onToken, onStatusChange]);

  const disconnect = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  return { connect, disconnect };
}


