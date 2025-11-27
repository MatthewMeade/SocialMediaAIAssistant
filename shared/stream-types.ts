// shared/stream-types.ts

export type StreamEventType = 
  | 'token'        // A chunk of text
  | 'status_start' // Tool started (e.g. "Searching...")
  | 'status_end'   // Tool finished
  | 'error'        // Stream specific error
  | 'done';        // Stream complete

export interface StreamEventPayload {
  type: StreamEventType;
  content?: string; // The text token or status message
  toolName?: string;
  timestamp: number;
}


