export type StreamEventType = 
  | 'token'
  | 'status_start'
  | 'status_end'
  | 'error'
  | 'done';

export interface StreamEventPayload {
  type: StreamEventType;
  content?: string;
  toolName?: string;
  timestamp: number;
}


