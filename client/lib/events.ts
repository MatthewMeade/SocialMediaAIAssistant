export const AppEvents = {
  APPLY_CAPTION: "apply-caption",
  CREATE_POST: "create-post",
  OPEN_POST: "open-post",
  NAVIGATE_TO_CALENDAR: "navigate-to-calendar",
  POST_EDITOR_OPEN: "post-editor-open",
  POST_EDITOR_CLOSE: "post-editor-close",
  TRIGGER_AI_CHAT: "trigger-ai-chat",
} as const;

export const ToolNames = {
  NAVIGATE: "navigate_to_calendar",
  APPLY_CAPTION: "apply_caption_to_open_post",
  CREATE_POST: "create_post",
  OPEN_POST: "open_post",
} as const;

export interface TriggerAIChatPayload {
  message: string;
  shouldClear?: boolean;
  context?: Record<string, any>;
}

