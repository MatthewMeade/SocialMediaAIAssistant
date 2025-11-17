import { Hono } from 'hono'
import type { User } from '@supabase/supabase-js'
import { requireAuth, isUser, canAccessCalendar } from '../lib/auth'
import { LocalDataRepository } from '../ai-service/repository'
import { ToolService } from '../services/tool-service'
import { ChatService } from '../services/chat-service'
import { chatModel, creativeModel, imageGenerator } from '../ai-service/models'
import { generateAndStoreImage } from '../ai-service/services/image-generation-service'
import { getBrandVoiceScore } from '../ai-service/services/grading-service'
import { generateCaptions } from '../ai-service/services/generation-service'
import type {
  CaptionGenerationRequest,
  ApplySuggestionsRequest,
} from '../ai-service/schemas'

type Variables = {
  authResult: User
}

const app = new Hono<{ Variables: Variables }>()

// Middleware to load and validate user
app.use('*', requireAuth)

/**
 * Endpoint for the Brand Voice Content Grader tool.
 */
app.post('/grade-caption', async (c) => {
  const authResult = c.get('authResult') // Get from requireAuth middleware
  if (!isUser(authResult)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const user = authResult

  const { caption, calendarId } = await c.req.json()

  if (typeof caption !== 'string' || !calendarId) {
    return c.json({ error: 'caption and calendarId are required' }, 400)
  }

  // 1. **Authorize:** Check if the user can access this calendar
  const hasAccess = await canAccessCalendar(user.id, calendarId)
  if (!hasAccess) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  // 2. **Execute:** Use repository to get brand rules and grade the caption
  try {
    const repo = new LocalDataRepository()

    // Get brand rules and grade the caption
    const brandRules = await repo.getBrandRules(calendarId)
    const score = await getBrandVoiceScore(
      caption,
      brandRules,
      chatModel,
    )
    return c.json(score)
  } catch (error: any) {
    console.error('[AI_ROUTE] Error grading caption:', error)
    return c.json({ error: 'Failed to grade caption', details: error.message }, 500)
  }
})

/**
 * Endpoint for the Caption Generator tool.
 */
app.post('/generate-caption', async (c) => {
  const authResult = c.get('authResult')
  if (!isUser(authResult)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const user = authResult

  const { calendarId, request } = (await c.req.json()) as {
    calendarId: string
    request: CaptionGenerationRequest
  }

  if (!calendarId || !request) {
    return c.json({ error: 'calendarId and request object are required' }, 400)
  }

  // 1. **Authorize:**
  const hasAccess = await canAccessCalendar(user.id, calendarId)
  if (!hasAccess) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  // 2. **Execute:**
  try {
    const repo = new LocalDataRepository()
    const brandRules = await repo.getBrandRules(calendarId)

    const result = await generateCaptions(
      request,
      brandRules,
      creativeModel,
      (caption, rules) => getBrandVoiceScore(caption, rules, chatModel),
    )
    return c.json(result)
  } catch (error: any) {
    console.error('[AI_ROUTE] Error generating caption:', error)
    return c.json(
      { error: 'Failed to generate caption', details: error.message },
      500,
    )
  }
})

/**
 * Endpoint for the Apply Suggestions tool.
 */
app.post('/apply-suggestions', async (c) => {
  const authResult = c.get('authResult')
  if (!isUser(authResult)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const user = authResult

  const { caption, suggestions, calendarId } =
    (await c.req.json()) as ApplySuggestionsRequest

  if (
    typeof caption !== 'string' ||
    !Array.isArray(suggestions) ||
    !calendarId
  ) {
    return c.json(
      { error: 'caption, suggestions, and calendarId are required' },
      400,
    )
  }

  // 1. **Authorize:**
  const hasAccess = await canAccessCalendar(user.id, calendarId)
  if (!hasAccess) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  // 2. **Execute:**
  try {
    const repo = new LocalDataRepository()
    const toolService = new ToolService({
      repo,
      chatModel,
      creativeModel,
      imageGenerator,
    })

    const newCaption = await toolService.applySuggestionsToCaption(
      caption,
      suggestions,
      { userId: user.id, calendarId },
    )
    return c.json({ newCaption })
  } catch (error: any) {
    console.error('[AI_ROUTE] Error applying suggestions:', error)
    return c.json(
      { error: 'Failed to apply suggestions', details: error.message },
      500,
    )
  }
})

/**
 * Endpoint for generating images with AI.
 */
app.post('/generate-image', async (c) => {
  const authResult = c.get('authResult')
  if (!isUser(authResult)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const user = authResult

  const { calendarId, prompt } = await c.req.json()

  if (!calendarId || typeof prompt !== 'string') {
    return c.json({ error: 'calendarId and prompt are required' }, 400)
  }

  // 1. **Authorize:**
  const hasAccess = await canAccessCalendar(user.id, calendarId)
  if (!hasAccess) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  // 2. **Execute:**
  try {
    // Image generation is still handled by the pure service function
    // This can be moved to ToolService in a future refactor if needed
    const newMediaItem = await generateAndStoreImage(
      prompt,
      calendarId,
      user.id,
      imageGenerator,
    )
    return c.json(newMediaItem)
  } catch (error: any) {
    console.error('[AI_ROUTE] Error generating image:', error)
    return c.json(
      { error: 'Failed to generate image', details: error.message },
      500,
    )
  }
})

/**
 * Chat endpoint for non-streaming conversations.
 * Returns JSON with response text and optional client-side tool calls.
 * Uses threadId to maintain conversation memory across requests.
 */
app.post('/chat', async (c) => {
  const authResult = c.get('authResult')
  if (!isUser(authResult)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const user = authResult

  const { input, history, calendarId, threadId, clientContext } = await c.req.json()

  // Validate required fields
  if (!calendarId) {
    return c.json({ error: 'calendarId is required' }, 400)
  }

  // Input can be empty when sending tool results (ToolMessage in history)
  // But we still require the field to be present
  if (input === undefined || input === null) {
    return c.json({ error: 'input is required' }, 400)
  }

  // Verify user has access to this calendar
  // Prevents users from accessing other calendars' data through the chat
  const hasAccess = await canAccessCalendar(user.id, calendarId)
  if (!hasAccess) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  try {
    console.log(`[AI_ROUTE] Starting chat request for user ${user.id}, calendar ${calendarId}`)

    // Use provided threadId or generate one based on user+calendar
    // ThreadId is used by frontend to track conversations
    const conversationThreadId = threadId || `${user.id}-${calendarId}`
    const startTime = Date.now()

    // Instantiate services with validated context
    const repo = new LocalDataRepository()
    const toolService = new ToolService({
      repo,
      chatModel,
      creativeModel,
      imageGenerator,
    })
    const chatService = new ChatService({
      repo,
      toolService,
      chatModel,
      creativeModel,
      imageGenerator,
    })

    // Run the chat with clientContext to determine which tools are available
    // Pass tool context (userId, calendarId) via runtime
    // Ensure calendarId is in clientContext for brand rules loading
    const enrichedClientContext = {
      ...clientContext,
      calendarId: clientContext?.calendarId || calendarId,
    }
    const result = await chatService.runChat(
      input || '',
      history || [],
      enrichedClientContext,
      { userId: user.id, calendarId },
    )

    const duration = Date.now() - startTime
    console.log(`[AI_ROUTE] Chat completed in ${duration}ms`)

    return c.json({
      response: result.response,
      toolCalls: result.toolCalls,
      threadId: conversationThreadId,
    })
  } catch (error: any) {
    console.error('[AI_ROUTE] Error in chat agent:', error)
    return c.json({ error: 'Chat failed', details: error.message }, 500)
  }
})

export default app