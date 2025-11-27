// server/ai-service/stream-manager.ts
import { EventEmitter } from 'events';
import type { StreamEventPayload } from '../../shared/stream-types';

class StreamManager extends EventEmitter {
  emitEvent(threadId: string, payload: StreamEventPayload) {
    this.emit(`event:${threadId}`, payload);
  }

  subscribe(threadId: string, callback: (payload: StreamEventPayload) => void) {
    const eventName = `event:${threadId}`;
    this.on(eventName, callback);
    return () => this.off(eventName, callback);
  }
}

export const streamManager = new StreamManager();


