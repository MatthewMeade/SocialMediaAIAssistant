import { tool } from 'langchain'
import * as z from 'zod'
import type { ToolRuntime } from '@langchain/core/tools'
import type { IAiDataRepository } from '../repository'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import type { DallEAPIWrapper } from '@langchain/openai'
import { getBrandVoiceScore } from './grading-service'
import { generateCaptions, applySuggestions } from './generation-service'

/**
 * Context schema for tools - passed via LangChain runtime.
 * This context is validated at the route level before being passed to the agent.
 */
export const toolContextSchema = z.object({
  userId: z.string(),
  calendarId: z.string(),
})

export type ToolContext = z.infer<typeof toolContextSchema>

/**
 * Dependencies injected into the ToolService.
 */
export interface ToolServiceDependencies {
  repo: IAiDataRepository
  chatModel: BaseChatModel
  creativeModel: BaseChatModel
  imageGenerator: DallEAPIWrapper
}

/**
 * The ToolService provides AI tools for the chatbot.
 * 
 * All tools receive context via LangChain's runtime feature, ensuring
 * stateless, testable, and reusable tool implementations.
 * 
 * Database write operations are NOT included here - they should be handled
 * by API routes directly using the repository or database functions.
 */
export class ToolService {
  private dependencies: ToolServiceDependencies

  constructor(dependencies: ToolServiceDependencies) {
    this.dependencies = dependencies
  }

  // ============================================================================
  // STANDARD METHODS (Used by API routes)
  // ============================================================================

  /**
   * Applies suggestions to a caption using AI.
   * This is an AI service method (not a database write), used by API routes.
   * Authorization is handled by the repository.
   */
  async applySuggestionsToCaption(
    caption: string,
    suggestions: string[],
    _context: ToolContext,
  ): Promise<string> {
    // Repository handles auth internally
    return applySuggestions(
      caption,
      suggestions,
      this.dependencies.chatModel,
    )
  }

  // ============================================================================
  // AI TOOL FACTORY METHODS (Used by ChatService)
  // ============================================================================

  /**
   * Creates a read-only tool for fetching posts.
   * The tool receives context via runtime parameter.
   */
  createGetPostsTool() {
    return tool(
      async (_input: {}, runtime: ToolRuntime<{}, typeof toolContextSchema>) => {
        const context = runtime.context
        if (!context) {
          throw new Error('Context is required')
        }

        // Repository handles auth internally
        const posts = await this.dependencies.repo.getPosts()
        // Return a simplified representation for the AI
        return posts.map((p) => ({
          id: p.id,
          caption: p.caption,
          date: p.date.toISOString(),
          platform: p.platform,
          status: p.status,
        }))
      },
      {
        name: 'get_posts',
        description:
          'Fetches all posts for the current calendar. Returns post IDs, captions, dates, platforms, and statuses.',
        schema: z.object({}),
      },
    )
  }

  /**
   * Creates a tool for getting the current post details.
   * Useful when the user is viewing/editing a specific post.
   */
  createGetCurrentPostTool(postId?: string) {
    return tool(
      async (_input: {}, runtime: ToolRuntime<{}, typeof toolContextSchema>) => {
        const context = runtime.context
        if (!context) {
          throw new Error('Context is required')
        }

        // Use provided postId or try to get from context if available
        const targetPostId = postId
        if (!targetPostId) {
          return { error: 'No post ID provided' }
        }

        // Repository handles auth and verifies post belongs to calendar
        const post = await this.dependencies.repo.getPost(targetPostId)
        if (!post) {
          return { error: 'Post not found' }
        }

        // Return full post details for the AI
        return {
          id: post.id,
          caption: post.caption,
          date: post.date.toISOString(),
          platform: post.platform,
          status: post.status,
          images: post.images,
          authorName: post.authorName,
        }
      },
      {
        name: 'get_current_post',
        description:
          'Gets the details of the post the user is currently viewing or editing. Returns the full post information including caption, images, platform, and status.',
        schema: z.object({}),
      },
    )
  }

  /**
   * Creates a tool for generating captions.
   * The tool receives context via runtime parameter.
   */
  createGenerateCaptionTool() {
    return tool(
      async (
        input: {
          topic: string
          existingCaption?: string
        },
        runtime: ToolRuntime<{}, typeof toolContextSchema>,
      ) => {
        const context = runtime.context
        if (!context) {
          throw new Error('Context is required')
        }

        // Repository handles auth internally
        const brandRules = await this.dependencies.repo.getBrandRules()

        const result = await generateCaptions(
          {
            topic: input.topic,
            existingCaption: input.existingCaption,
          },
          brandRules,
          this.dependencies.creativeModel,
          (caption, rules) =>
            getBrandVoiceScore(caption, rules, this.dependencies.chatModel),
        )

        return {
          caption: result.caption,
          score: result.score?.overall ?? null,
          suggestions: result.score?.suggestions ?? [],
        }
      },
      {
        name: 'generate_caption',
        description:
          'Generates a new post caption or refines an existing one based on brand voice rules. Returns the caption, score, and suggestions.',
        schema: z.object({
          topic: z.string().describe('The main topic of the post'),
          existingCaption: z
            .string()
            .optional()
            .describe('An existing caption to refine (optional)'),
        }),
      },
    )
  }

  /**
   * Creates a client-side "suggestion" tool for applying a caption to a post.
   * This tool returns `returnDirect: true`, so the client receives the suggestion
   * and applies it via the event bus.
   */
  createApplyCaptionTool() {
    return tool(
      async (
        input: { postId: string; caption: string },
        runtime: ToolRuntime<{}, typeof toolContextSchema>,
      ) => {
        const context = runtime.context
        if (!context) {
          throw new Error('Context is required')
        }

        // Repository handles auth and verifies post belongs to calendar
        const post = await this.dependencies.repo.getPost(input.postId)
        if (!post) {
          throw new Error('Post not found')
        }

        // This is a suggestion tool - the actual write happens on the client
        // We just return a message that the client will handle
        return `Caption suggestion ready for post ${input.postId}. The client will apply this change.`
      },
      {
        name: 'apply_caption_to_open_post',
        description:
          'Applies a generated caption to the currently open post in the post editor. This is a suggestion that the user can accept or reject. IMPORTANT: Use the Post ID from the "Current Post" context section in the system message. If no post ID is provided in context, you cannot use this tool.',
        schema: z.object({
          postId: z.string().describe('The ID of the post to update. This should match the Post ID from the "Current Post" context in the system message.'),
          caption: z.string().describe('The caption text to apply to the post'),
        }),
        returnDirect: true, // Client-side tool - returns directly to UI
      },
    )
  }

  /**
   * Creates a client-side navigation tool.
   * This tool returns `returnDirect: true`, so the client receives the navigation instruction.
   */
  createNavigateToPageTool() {
    return tool(
      async (
        input: { page?: string; label?: string },
        runtime: ToolRuntime<{}, typeof toolContextSchema>,
      ) => {
        // Verify context exists (no auth needed for navigation)
        if (!runtime.context) {
          throw new Error('Context is required')
        }

        // This is a client-side tool - the actual navigation happens on the client
        return `Navigation requested to ${input.page || 'calendar'}. The client will handle this.`
      },
      {
        name: 'navigate_to_calendar',
        description:
          'Navigates to the calendar page. Shows a button that the user clicks to navigate.',
        schema: z.object({
          page: z.string().optional().describe('The page to navigate to (default: calendar)'),
          label: z
            .string()
            .optional()
            .describe('The text to display on the button (default: "Open Calendar")'),
        }),
        returnDirect: true, // Client-side tool - returns directly to UI
      },
    )
  }

  /**
   * Creates a tool for getting brand voice rules.
   * Useful when the AI needs to reference brand rules.
   */
  createGetBrandRulesTool() {
    return tool(
      async (_input: {}, runtime: ToolRuntime<{}, typeof toolContextSchema>) => {
        const context = runtime.context
        if (!context) {
          throw new Error('Context is required')
        }

        // Repository handles auth internally
        const rules = await this.dependencies.repo.getBrandRules()
        const enabledRules = rules.filter((r) => r.enabled)
        
        if (enabledRules.length === 0) {
          return {
            message: 'No active brand voice rules are configured.',
            rules: [],
          }
        }

        return {
          rules: enabledRules.map((r) => ({
            id: r.id,
            title: r.title,
            description: r.description,
          })),
          total: enabledRules.length,
        }
      },
      {
        name: 'get_brand_rules',
        description:
          'Gets the active brand voice rules for the current calendar. Use this when you need to reference or explain the brand voice guidelines.',
        schema: z.object({}),
      },
    )
  }

  /**
   * Creates a tool for grading a caption against brand voice rules.
   * Useful when the AI needs to evaluate an existing caption.
   */
  createGradeCaptionTool() {
    return tool(
      async (
        input: { caption: string },
        runtime: ToolRuntime<{}, typeof toolContextSchema>,
      ) => {
        const context = runtime.context
        if (!context) {
          throw new Error('Context is required')
        }

        // Repository handles auth internally
        const brandRules = await this.dependencies.repo.getBrandRules()

        const score = await getBrandVoiceScore(
          input.caption,
          brandRules,
          this.dependencies.chatModel,
        )

        return {
          overall: score.overall,
          rules: score.rules,
          suggestions: score.suggestions,
          message: `Caption scored ${score.overall}/100. ${score.suggestions.length} suggestion(s) provided.`,
        }
      },
      {
        name: 'grade_caption',
        description:
          'Grades a caption against the brand voice rules. Returns the overall score (0-100), breakdown by rule, and actionable suggestions for improvement. Use this when users ask you to evaluate, grade, or review a caption.',
        schema: z.object({
          caption: z.string().describe('The caption text to grade against brand voice rules'),
        }),
      },
    )
  }

  /**
   * Creates a client-side tool for creating a new post on a specific date.
   * This tool returns `returnDirect: true`, so the client receives the instruction.
   */
  createCreatePostTool() {
    return tool(
      async (
        input: { date: string; label?: string },
        runtime: ToolRuntime<{}, typeof toolContextSchema>,
      ) => {
        // Verify context exists (no auth needed for client-side tool)
        if (!runtime.context) {
          throw new Error('Context is required')
        }

        // This is a client-side tool - the actual post creation happens on the client
        return `Post creation requested for ${input.date}. The client will open the post editor.`
      },
      {
        name: 'create_post',
        description:
          'Creates a new post on a specific date. Opens the post editor modal with a new draft post. The date should be in ISO format (YYYY-MM-DD) or a relative date like "today", "tomorrow", or a day name like "Monday".',
        schema: z.object({
          date: z
            .string()
            .describe(
              'The date for the new post. Can be ISO format (YYYY-MM-DD), "today", "tomorrow", or a day name (e.g., "Monday").',
            ),
          label: z
            .string()
            .optional()
            .describe('Optional label to display on the button (default: "Create Post")'),
        }),
        returnDirect: true, // Client-side tool - returns directly to UI
      },
    )
  }

  /**
   * Creates a client-side tool for opening an existing post.
   * This tool returns `returnDirect: true`, so the client receives the instruction.
   */
  createOpenPostTool() {
    return tool(
      async (
        input: { postId: string; label?: string },
        runtime: ToolRuntime<{}, typeof toolContextSchema>,
      ) => {
        const context = runtime.context
        if (!context) {
          throw new Error('Context is required')
        }

        // Repository handles auth and verifies post belongs to calendar
        const post = await this.dependencies.repo.getPost(input.postId)
        if (!post) {
          throw new Error('Post not found')
        }

        // This is a client-side tool - the actual navigation happens on the client
        return `Open post requested for ${input.postId}. The client will open the post editor.`
      },
      {
        name: 'open_post',
        description:
          'Opens an existing post in the post editor. Use this when the user asks to view, edit, or open a specific post. You can get post IDs from the get_posts tool.',
        schema: z.object({
          postId: z.string().describe('The ID of the post to open'),
          label: z
            .string()
            .optional()
            .describe('Optional label to display on the button (default: "Open Post")'),
        }),
        returnDirect: true, // Client-side tool - returns directly to UI
      },
    )
  }
}
