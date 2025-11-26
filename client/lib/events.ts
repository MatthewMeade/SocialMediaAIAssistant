/**
 * Application event constants for the event bus.
 * Using constants prevents typos and provides type safety.
 */
export const AppEvents = {
  APPLY_CAPTION: "apply-caption",
  CREATE_POST: "create-post",
  OPEN_POST: "open-post",
  NAVIGATE_TO_CALENDAR: "navigate-to-calendar",
  POST_EDITOR_OPEN: "post-editor-open",
  POST_EDITOR_CLOSE: "post-editor-close",
  TRIGGER_AI_CHAT: "trigger-ai-chat",
} as const;

/**
 * Tool name constants for client-side tool calls.
 * Using constants prevents typos and provides type safety.
 */
export const ToolNames = {
  NAVIGATE: "navigate_to_calendar",
  APPLY_CAPTION: "apply_caption_to_open_post",
  CREATE_POST: "create_post",
  OPEN_POST: "open_post",
} as const;

/**
 * Payload for TRIGGER_AI_CHAT event
 */
export interface TriggerAIChatPayload {
  message: string;
  shouldClear?: boolean; // If true, resets the chat history before sending
  context?: Record<string, any>; // Optional extra context overrides
}

