import { tool } from 'langchain'
import * as z from 'zod'
import type { IAiDataRepository } from '../ai-service/repository'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import type { DallEAPIWrapper } from '@langchain/openai'
import type { Post, BrandRule } from '../../shared/types'
import { canAccessCalendar } from '../lib/auth'
import { getBrandVoiceScore } from '../ai-service/services/grading-service'
import {
  generateCaptions,
  applySuggestions,
} from '../ai-service/services/generation-service'
import type {
  CaptionGenerationRequest,
  CaptionGenerationResult,
} from '../ai-service/schemas'
import { savePost as dbSavePost, deletePost as dbDeletePost } from '../lib/db/posts'

/**
 * Context that is securely injected into the ToolService instance.
 * This context is validated at the route level before service instantiation.
 */
export interface ToolServiceContext {
  userId: string
  calendarId: string
}

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
 * The ToolService is the single source of truth for all business logic and authorization.
 * 
 * It provides:
 * 1. Standard methods (used by API routes) - includes write operations and auth checks
 * 2. AI Tool Factory methods (used by ChatService) - creates read-only or suggestion tools
 * 
 * The service is instantiated per-request with validated user context, ensuring
 * all operations are scoped to the correct user and calendar.
 */
export class ToolService {
  private context: ToolServiceContext
  private dependencies: ToolServiceDependencies

  constructor(
    context: ToolServiceContext,
    dependencies: ToolServiceDependencies,
  ) {
    this.context = context
    this.dependencies = dependencies
  }

  // ============================================================================
  // STANDARD METHODS (Used by API routes)
  // ============================================================================

  /**
   * Gets all posts for the calendar.
   * Includes authorization check.
   */
  async getPosts(): Promise<Post[]> {
    // Verify access (defense in depth - should already be checked at route level)
    const hasAccess = await canAccessCalendar(
      this.context.userId,
      this.context.calendarId,
    )
    if (!hasAccess) {
      throw new Error('Forbidden: User does not have access to this calendar')
    }

    return this.dependencies.repo.getPosts(this.context.calendarId)
  }

  /**
   * Gets a single post by ID.
   * Includes authorization check to ensure the post belongs to the calendar.
   */
  async getPost(postId: string): Promise<Post | null> {
    const hasAccess = await canAccessCalendar(
      this.context.userId,
      this.context.calendarId,
    )
    if (!hasAccess) {
      throw new Error('Forbidden: User does not have access to this calendar')
    }

    const post = await this.dependencies.repo.getPost(postId)
    
    // Verify the post belongs to this calendar
    if (post && post.calendarId !== this.context.calendarId) {
      return null
    }

    return post
  }

  /**
   * Gets a single note by ID.
   * Includes authorization check to ensure the note belongs to the calendar.
   */
  async getNote(noteId: string): Promise<any | null> {
    const hasAccess = await canAccessCalendar(
      this.context.userId,
      this.context.calendarId,
    )
    if (!hasAccess) {
      throw new Error('Forbidden: User does not have access to this calendar')
    }

    // Import supabase here to avoid circular dependencies
    const { supabase } = await import('../lib/supabase')
    const { data: note, error } = await supabase
      .from("notes")
      .select("*")
      .eq("id", noteId)
      .eq("calendar_id", this.context.calendarId)
      .single()

    if (error || !note) {
      return null
    }

    // Map to response format
    return {
      id: note.id,
      calendarId: note.calendar_id,
      title: note.title,
      content: note.content,
      createdAt: note.created_at,
      updatedAt: note.updated_at,
    }
  }

  /**
   * Saves a post (create or update).
   * Includes authorization check and author validation.
   */
  async savePost(post: Omit<Post, 'id'> & { id?: string }): Promise<Post | null> {
    const hasAccess = await canAccessCalendar(
      this.context.userId,
      this.context.calendarId,
    )
    if (!hasAccess) {
      throw new Error('Forbidden: User does not have access to this calendar')
    }

    // Ensure the post is scoped to this calendar
    const postToSave = {
      ...post,
      calendarId: this.context.calendarId,
    }

    // If updating an existing post, verify the user is the author
    if (post.id) {
      const existingPost = await this.dependencies.repo.getPost(post.id)
      if (!existingPost) {
        throw new Error('Post not found')
      }
      if (existingPost.calendarId !== this.context.calendarId) {
        throw new Error('Forbidden: Post does not belong to this calendar')
      }
      // Only the author can update their own post
      if (existingPost.authorId !== this.context.userId) {
        throw new Error('Forbidden: Only the author can update this post')
      }
    } else {
      // For new posts, set the author
      postToSave.authorId = this.context.userId
    }

    return dbSavePost(postToSave)
  }

  /**
   * Deletes a post.
   * Includes authorization check and author validation.
   */
  async deletePost(postId: string): Promise<boolean> {
    const hasAccess = await canAccessCalendar(
      this.context.userId,
      this.context.calendarId,
    )
    if (!hasAccess) {
      throw new Error('Forbidden: User does not have access to this calendar')
    }

    const post = await this.dependencies.repo.getPost(postId)
    if (!post) {
      return false
    }

    if (post.calendarId !== this.context.calendarId) {
      throw new Error('Forbidden: Post does not belong to this calendar')
    }

    // Only the author can delete their own post
    if (post.authorId !== this.context.userId) {
      throw new Error('Forbidden: Only the author can delete this post')
    }

    return dbDeletePost(postId)
  }

  /**
   * Gets brand rules for the calendar.
   * Includes authorization check.
   */
  async getBrandRules(): Promise<BrandRule[]> {
    const hasAccess = await canAccessCalendar(
      this.context.userId,
      this.context.calendarId,
    )
    if (!hasAccess) {
      throw new Error('Forbidden: User does not have access to this calendar')
    }

    return this.dependencies.repo.getBrandRules(this.context.calendarId)
  }

  /**
   * Generates a caption using AI.
   * Includes authorization check.
   */
  async generateCaption(
    request: CaptionGenerationRequest,
  ): Promise<CaptionGenerationResult> {
    const hasAccess = await canAccessCalendar(
      this.context.userId,
      this.context.calendarId,
    )
    if (!hasAccess) {
      throw new Error('Forbidden: User does not have access to this calendar')
    }

    const brandRules = await this.dependencies.repo.getBrandRules(
      this.context.calendarId,
    )

    return generateCaptions(
      {
        topic: request.topic,
        existingCaption: request.existingCaption,
      },
      brandRules,
      this.dependencies.creativeModel,
      (caption, rules) =>
        getBrandVoiceScore(caption, rules, this.dependencies.chatModel),
    )
  }

  /**
   * Applies suggestions to a caption.
   * Includes authorization check.
   */
  async applySuggestionsToCaption(
    caption: string,
    suggestions: string[],
  ): Promise<string> {
    const hasAccess = await canAccessCalendar(
      this.context.userId,
      this.context.calendarId,
    )
    if (!hasAccess) {
      throw new Error('Forbidden: User does not have access to this calendar')
    }

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
   * The tool is hard-coded to use this instance's context.
   */
  createGetPostsTool() {
    return tool(
      async () => {
        const posts = await this.getPosts()
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
      async () => {
        // Use provided postId or try to get from context if available
        const targetPostId = postId
        if (!targetPostId) {
          return { error: 'No post ID provided' }
        }

        const post = await this.getPost(targetPostId)
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
   * The tool is hard-coded to use this instance's context.
   */
  createGenerateCaptionTool() {
    return tool(
      async (input: {
        topic: string
        existingCaption?: string
      }) => {
        const result = await this.generateCaption({
          topic: input.topic,
          existingCaption: input.existingCaption,
        })
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
      async (input: { postId: string; caption: string }) => {
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
      async (input: { page: string; label?: string }) => {
        // This is a client-side tool - the actual navigation happens on the client
        return `Navigation requested to ${input.page}. The client will handle this.`
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
      async () => {
        const rules = await this.getBrandRules()
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
   * Grades a caption against brand voice rules.
   * Returns the brand score, rule breakdown, and suggestions.
   */
  async gradeCaption(caption: string): Promise<{
    overall: number
    rules: Array<{ ruleId: string; score: number; feedback: string }>
    suggestions: string[]
  }> {
    const hasAccess = await canAccessCalendar(
      this.context.userId,
      this.context.calendarId,
    )
    if (!hasAccess) {
      throw new Error('Forbidden: User does not have access to this calendar')
    }

    const brandRules = await this.dependencies.repo.getBrandRules(
      this.context.calendarId,
    )

    const score = await getBrandVoiceScore(
      caption,
      brandRules,
      this.dependencies.chatModel,
    )

    return {
      overall: score.overall,
      rules: score.rules,
      suggestions: score.suggestions,
    }
  }

  /**
   * Creates a tool for grading a caption against brand voice rules.
   * Useful when the AI needs to evaluate an existing caption.
   */
  createGradeCaptionTool() {
    return tool(
      async (input: { caption: string }) => {
        const result = await this.gradeCaption(input.caption)
        return {
          overall: result.overall,
          rules: result.rules,
          suggestions: result.suggestions,
          message: `Caption scored ${result.overall}/100. ${result.suggestions.length} suggestion(s) provided.`,
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
      async (input: { date: string; label?: string }) => {
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
      async (input: { postId: string; label?: string }) => {
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

