export const WORKFLOWS = {
  CREATE_POST: {
    id: "CREATE_POST",
    description: "User wants to create, schedule, or draft a new social media post.",
    steps: [
      "1. ASK the user for the topic/content of the post. Do NOT generate a caption until you have a topic.",
      "2. ASK the user for the target date. Do NOT assume 'today' or 'tomorrow' unless specified.",
      "3. ONCE you have the date and topic, call 'create_post' to open the editor.",
      "4. Call 'generate_caption' using the topic provided by the user.",
      "5. Call 'apply_caption_to_open_post'."
    ]
  },
  REFINE_CAPTION: {
    id: "REFINE_CAPTION",
    description: "User wants to edit, fix, or rewrite an existing caption.",
    steps: [
      "1. Identify the feedback or new direction.",
      "2. Ensure a post is currently open/selected (check context).",
      "3. Call 'generate_caption' (or apply_suggestions endpoint) with the new context.",
      "4. Call 'apply_caption_to_open_post'."
    ]
  },
  ANALYZE_BRAND: {
    id: "ANALYZE_BRAND",
    description: "User wants to check if content matches brand voice or view rules.",
    steps: [
      "1. Call 'get_brand_rules' to retrieve active guidelines.",
      "2. If a caption is provided, call 'grade_caption'.",
      "3. Provide a summary of the alignment."
    ]
  }
} as const;

export const APP_SPEC = `
The app is a Social Media Calendar called "Social Hub".

- **Calendar View**: Users can view posts on a monthly grid.

- **Post Editor**: A modal to draft content, select platforms (Instagram, LinkedIn, Twitter), and set status.

- **AI Features**: 
  - Caption Generation based on topics.
  - Brand Voice analysis and grading.
  - Image Generation (DALL-E 3).

- **Media Library**: Users can upload and select images.

- **Navigation**: Users can be navigated to specific pages using tools.
`;

