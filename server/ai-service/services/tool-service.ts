import { tool } from 'langchain'
import * as z from 'zod'
import type { ToolRuntime } from '@langchain/core/tools'
import type { IAiDataRepository } from '../repository'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import type { DallEAPIWrapper } from '@langchain/openai'
import { getBrandVoiceScore } from './grading-service'
import { generateCaptions, applySuggestions } from './generation-service'

export const toolContextSchema = z.object({
  userId: z.string(),
  calendarId: z.string(),
})

export type ToolContext = z.infer<typeof toolContextSchema>

export interface ToolServiceDependencies {
  repo: IAiDataRepository
  chatModel: BaseChatModel
  creativeModel: BaseChatModel
  imageGenerator: DallEAPIWrapper
}

export class ToolService {
  private dependencies: ToolServiceDependencies

  constructor(dependencies: ToolServiceDependencies) {
    this.dependencies = dependencies
  }

  async applySuggestionsToCaption(
    caption: string,
    suggestions: string[],
    _context: ToolContext,
  ): Promise<string> {
    return applySuggestions(
      caption,
      suggestions,
      this.dependencies.chatModel,
    )
  }

  createGetPostsTool() {
    return tool(
      async (_input: {}, runtime: ToolRuntime<{}, typeof toolContextSchema>) => {
        try {
          const context = runtime.context
          if (!context) {
            throw new Error('Context is required')
          }

          const posts = await this.dependencies.repo.getPosts()
          return posts.map((p) => ({
            id: p.id,
            caption: p.caption,
            date: p.date.toISOString(),
            platform: p.platform,
            status: p.status,
          }))
        } catch (error) {
          console.log('createGetPostsTool', { error })
          throw error;
        }
      },
      {
        name: 'get_posts',
        description:
          'Fetches all posts for the current calendar. Returns post IDs, captions, dates, platforms, and statuses.',
        schema: z.object({}),
      },
    )
  }

  createGetCurrentPostTool(postId?: string) {
    return tool(
      async (_input: {}, runtime: ToolRuntime<{}, typeof toolContextSchema>) => {
        try {
          const context = runtime.context
          if (!context) {
            throw new Error('Context is required')
          }

          const targetPostId = postId
          if (!targetPostId) {
            return { error: 'No post ID provided' }
          }

          const post = await this.dependencies.repo.getPost(targetPostId)
          if (!post) {
            return { error: 'Post not found' }
          }

          return {
            id: post.id,
            caption: post.caption,
            date: post.date.toISOString(),
            platform: post.platform,
            status: post.status,
            images: post.images,
            authorName: post.authorName,
          }
        } catch (error) {
          console.log('createGetCurrentPostTool', { error })
          throw error;
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

  createGenerateCaptionTool() {
    return tool(
      async (
        input: {
          topic: string
          existingCaption?: string
        },
        runtime: ToolRuntime<{}, typeof toolContextSchema>,
      ) => {
        try {
          const context = runtime.context
          if (!context) {
            throw new Error('Context is required')
          }

          const brandRules = await this.dependencies.repo.getBrandRules()

          const result = await generateCaptions(
            {
              topic: input.topic,
              existingCaption: input.existingCaption,
            },
            brandRules,
            this.dependencies.creativeModel,
          )

          return {
            caption: result.caption,
            score: null,
            suggestions: [],
          }
        } catch (error) {
          console.log('createGenerateCaptionTool', { error })
          throw error;
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

  createApplyCaptionTool() {
    return tool(
      async (
        input: { postId: string; caption: string },
        runtime: ToolRuntime<{}, typeof toolContextSchema>,
      ) => {
        try {
          const context = runtime.context
          if (!context) {
            throw new Error('Context is required')
          }

          const post = await this.dependencies.repo.getPost(input.postId)
          if (!post) {
            throw new Error('Post not found')
          }

          return `Caption suggestion ready for post ${input.postId}. The client will apply this change.`;
        } catch (error) {
          console.log('createApplyCaptionTool', { error })
          throw error;
        }
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

  createNavigateToPageTool() {
    return tool(
      async (
        input: { page?: string; label?: string },
        runtime: ToolRuntime<{}, typeof toolContextSchema>,
      ) => {
        try {
          if (!runtime.context) {
            throw new Error('Context is required')
          }

          return `Navigation requested to ${input.page || 'calendar'}. The client will handle this.`;
        } catch (error) {
          console.log('createNavigateToPageTool', { error })
          throw error;
        }
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

  createGetBrandRulesTool() {
    return tool(
      async (_input: {}, runtime: ToolRuntime<{}, typeof toolContextSchema>) => {
        try {
          const context = runtime.context
          if (!context) {
            throw new Error('Context is required')
          }

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
        } catch (error) {
          console.log('createGetBrandRulesTool', { error })
          throw error;
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

  createGradeCaptionTool() {
    return tool(
      async (
        input: { caption: string },
        runtime: ToolRuntime<{}, typeof toolContextSchema>,
      ) => {
        try {
          const context = runtime.context
          if (!context) {
            throw new Error('Context is required')
          }

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
        } catch (error) {
          console.log('createGradeCaptionTool', { error })
          throw error;
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

  createCreatePostTool() {
    return tool(
      async (
        input: { date: string; label?: string },
        runtime: ToolRuntime<{}, typeof toolContextSchema>,
      ) => {
        try {
          if (!runtime.context) {
            throw new Error('Context is required')
          }

          return `Post creation requested for ${input.date}. The client will open the post editor.`;
        } catch (error) {
          console.log('createCreatePostTool', { error })
          throw error;
        }
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

  createOpenPostTool() {
    return tool(
      async (
        input: { postId: string; label?: string },
        runtime: ToolRuntime<{}, typeof toolContextSchema>,
      ) => {
        try {
          const context = runtime.context
          if (!context) {
            throw new Error('Context is required')
          }

          const post = await this.dependencies.repo.getPost(input.postId)
          if (!post) {
            throw new Error('Post not found')
          }

          return `Open post requested for ${input.postId}. The client will open the post editor.`;
        } catch (error) {
          console.log('createOpenPostTool', { error })
          throw error;
        }
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
