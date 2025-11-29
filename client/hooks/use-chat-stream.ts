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
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error('No auth token available');
        return;
      }

      const response = await fetch(`/api/ai/stream/${threadId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Accept': 'text/event-stream',
        },
        signal: abortController.signal,
      });

      if (!response.ok) {
        console.error('Response not ok:', response.status, response.statusText);
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (!reader) {
        console.error('No reader available');
        return;
      }

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        const messages = buffer.split('\n\n');
        buffer = messages.pop() || '';

        for (const message of messages) {
          if (!message.trim()) continue;

          let data = '';

          const lines = message.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              data = line.slice(6).trim();
            }
          }

          if (data) {
            try {
              const payload = JSON.parse(data) as StreamEventPayload;
              
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
              }
            } catch (err) {
              console.error('Stream parse error', err, 'Data:', data);
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Stream error', err);
      }
    }
  }, [threadId, onToken, onStatusChange]);

  const disconnect = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  return { connect, disconnect };
}


