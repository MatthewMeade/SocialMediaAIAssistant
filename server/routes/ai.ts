import { Hono } from 'hono'
import type { User } from '@supabase/supabase-js'
import { requireAuth, isUser, canAccessCalendar } from '../lib/auth'
import aiService from '../ai-service' // Import our new façade
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

  // 2. **Execute:** Call the AI service with the *validated* context
  try {
    const score = await aiService.gradeCaption(caption, calendarId)
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
    const result = await aiService.generateCaptions(request, calendarId)
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
    const newCaption = await aiService.applySuggestions(caption, suggestions)
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
 * Endpoint for the general chatbot.
 */
app.post('/chat', async (c) => {
  const authResult = c.get('authResult')
  if (!isUser(authResult)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const user = authResult

  const { input, history, calendarId } = await c.req.json()

  if (!input || !calendarId) {
    return c.json({ error: 'input and calendarId are required' }, 400)
  }

  // 1. **Authorize:**
  const hasAccess = await canAccessCalendar(user.id, calendarId)
  if (!hasAccess) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  // 2. **Execute:**
  try {
    const response = await aiService.runChat(input, history || [], user.id, calendarId)
    return c.json({ response })
  } catch (error: any) {
    console.error('[AI_ROUTE] Error in chat agent:', error)
    return c.json({ error: 'Chat failed', details: error.message }, 500)
  }
})

export default app