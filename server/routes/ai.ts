import { Hono } from 'hono'
import type { User } from '@supabase/supabase-js'
import { requireAuth, isUser } from '../lib/auth'
import { LocalDataRepository } from '../ai-service/repository'
import { ToolService } from '../services/tool-service'
import { ChatService } from '../services/chat-service'
import { chatModel, creativeModel, imageGenerator } from '../ai-service/models'
import { generateAndStoreImage } from '../ai-service/services/image-generation-service'
import { getBrandVoiceScore } from '../ai-service/services/grading-service'
import { generateCaptions, extractBrandRules } from '../ai-service/services/generation-service'
import type {
  CaptionGenerationRequest,
  ApplySuggestionsRequest,
} from '../ai-service/schemas'
// Langfuse SDK is initialized in server/lib/langfuse.ts

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

  // Execute: Repository handles auth internally
  try {
    const repo = new LocalDataRepository(user.id, calendarId)

    // Get brand rules and grade the caption
    const brandRules = await repo.getBrandRules()
    const score = await getBrandVoiceScore(
      caption,
      brandRules,
      chatModel,
    )
    return c.json(score)
  } catch (error: any) {
    console.error('[AI_ROUTE] Error grading caption:', error)
    if (error.message?.includes('Forbidden')) {
      return c.json({ error: 'Forbidden' }, 403)
    }
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

  // Execute: Repository handles auth internally
  try {
    const repo = new LocalDataRepository(user.id, calendarId)
    const brandRules = await repo.getBrandRules()

    const result = await generateCaptions(
      request,
      brandRules,
      creativeModel,
      (caption, rules) => getBrandVoiceScore(caption, rules, chatModel),
    )
    return c.json(result)
  } catch (error: any) {
    console.error('[AI_ROUTE] Error generating caption:', error)
    if (error.message?.includes('Forbidden')) {
      return c.json({ error: 'Forbidden' }, 403)
    }
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

  // Execute: Repository handles auth internally
  try {
    const repo = new LocalDataRepository(user.id, calendarId)
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
    if (error.message?.includes('Forbidden')) {
      return c.json({ error: 'Forbidden' }, 403)
    }
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

  // Execute: Verify access before generating image
  // (Image generation service doesn't use repo, so we check auth here)
  try {
    const repo = new LocalDataRepository(user.id, calendarId)
    // Verify access by attempting to get brand rules (which checks auth)
    await repo.getBrandRules()

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
    if (error.message?.includes('Forbidden')) {
      return c.json({ error: 'Forbidden' }, 403)
    }
    return c.json(
      { error: 'Failed to generate image', details: error.message },
      500,
    )
  }
})

/**
 * Endpoint to extract brand rules from text
 */
app.post('/extract-brand-rules', async (c) => {
  const authResult = c.get('authResult')
  if (!isUser(authResult)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const { text } = await c.req.json()

  if (!text || typeof text !== 'string') {
    return c.json({ error: 'Text content is required' }, 400)
  }

  try {
    const result = await extractBrandRules(text, chatModel)
    return c.json(result)
  } catch (error: any) {
    console.error('[AI_ROUTE] Error extracting rules:', error)
    return c.json(
      { error: 'Failed to extract rules', details: error.message },
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

  const { input, calendarId, threadId, clientContext } = await c.req.json()

  // Validate required fields
  if (!calendarId) {
    return c.json({ error: 'calendarId is required' }, 400)
  }

  // Input is required - the frontend should send "The tool action has been completed"
  // when continuing after a tool execution, rather than sending empty input
  if (input === undefined || input === null || input === '') {
    return c.json({ error: 'input is required' }, 400)
  }

  try {
    console.log(`[AI_ROUTE] Starting chat request for user ${user.id}, calendar ${calendarId}`)

    // Use provided threadId or generate one based on user+calendar
    // ThreadId is used by frontend to track conversations
    const conversationThreadId = threadId || `${user.id}-${calendarId}`
    const startTime = Date.now()

    // Instantiate services with repository that handles auth internally
    const repo = new LocalDataRepository(user.id, calendarId)
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
    // MemorySaver handles conversation history via threadId - no need to pass history
    const enrichedClientContext = {
      ...clientContext,
      calendarId: clientContext?.calendarId || calendarId,
    }
    const result = await chatService.runChat(
      input,
      threadId || undefined,
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
    if (error.message?.includes('Forbidden')) {
      return c.json({ error: 'Forbidden' }, 403)
    }
    return c.json({ error: 'Chat failed', details: error.message }, 500)
  }
})

export default app