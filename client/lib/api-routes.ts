export const ApiRoutes = {
  AI: {
    CHAT: "/api/ai/chat",
    GENERATE_CAPTION: "/api/ai/generate-caption",
    APPLY_SUGGESTIONS: "/api/ai/apply-suggestions",
    GRADE_CAPTION: "/api/ai/grade-caption",
    EXTRACT_BRAND_RULES: "/api/ai/extract-brand-rules",
  },
  POSTS: "/api/posts",
  CALENDARS: "/api/calendars",
  PROFILE: "/api/profile",
  UPLOAD: "/api/upload",
  BRAND_VOICE: "/api/brand-voice",
  INBOX: "/api/inbox",
  HEALTH: "/api/health",
  ORGANIZATION: "/api/organization",
  NOTES: "/api/notes",
} as const;

