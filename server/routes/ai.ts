import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import type { User } from '@supabase/supabase-js'
import { requireAuth, isUser } from '../lib/auth'
import { LocalDataRepository } from '../ai-service/repository'
import { ToolService } from '../ai-service/services/tool-service'
import { ChatService } from '../ai-service/services/chat-service'
import { chatModel, creativeModel, imageGenerator } from '../ai-service/models'
import { generateAndStoreImage } from '../ai-service/services/image-generation-service'
import { getBrandVoiceScore } from '../ai-service/services/grading-service'
import { generateCaptions, extractBrandRules } from '../ai-service/services/generation-service'
import { streamManager } from '../ai-service/stream-manager'
import type {
  CaptionGenerationRequest,
  ApplySuggestionsRequest,
} from '../ai-service/schemas'
// Langfuse SDK is initialized in server/lib/langfuse.ts

type Variables = {
  authResult: User
}

const app = new Hono<{ Variables: Variables }>()

app.use('*', requireAuth)

app.get('/stream/:threadId', (c) => {
  const threadId = c.req.param('threadId')

  return streamSSE(c, async (stream) => {
    await stream.writeSSE({
      data: JSON.stringify({ type: 'connected' }),
      event: 'connected',
    })

    const unsubscribe = streamManager.subscribe(threadId, async (payload) => {
      await stream.writeSSE({
        data: JSON.stringify(payload),
        event: 'message',
      })
    })

    let isOpen = true
    stream.onAbort(() => { 
      isOpen = false
      unsubscribe()
    })
    
    while (isOpen) {
      await stream.sleep(1000)
    }
    
    unsubscribe()
  })
})

app.post('/grade-caption', async (c) => {
  const authResult = c.get('authResult')
  if (!isUser(authResult)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const user = authResult

  const { caption, calendarId } = await c.req.json() as { caption: string; calendarId: string }

  if (typeof caption !== 'string' || !calendarId) {
    return c.json({ error: 'caption and calendarId are required' }, 400)
  }

  try {
    const repo = new LocalDataRepository(user.id, calendarId)
    const brandRules = await repo.getBrandRules()
    const score = await getBrandVoiceScore(
      caption as string,
      brandRules,
      chatModel,
    )
    return c.json(score)
  } catch (error: any) {
    console.error('Error grading caption:', error)
    if (error.message?.includes('Forbidden')) {
      return c.json({ error: 'Forbidden' }, 403)
    }
    return c.json({ error: 'Failed to grade caption', details: error.message }, 500)
  }
})

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

  try {
    const repo = new LocalDataRepository(user.id, calendarId)
    const brandRules = await repo.getBrandRules()

    const result = await generateCaptions(
      request,
      brandRules,
      creativeModel
    )
    return c.json(result)
  } catch (error: any) {
    console.error('Error generating caption:', error)
    if (error.message?.includes('Forbidden')) {
      return c.json({ error: 'Forbidden' }, 403)
    }
    return c.json(
      { error: 'Failed to generate caption', details: error.message },
      500,
    )
  }
})

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
    console.error('Error applying suggestions:', error)
    if (error.message?.includes('Forbidden')) {
      return c.json({ error: 'Forbidden' }, 403)
    }
    return c.json(
      { error: 'Failed to apply suggestions', details: error.message },
      500,
    )
  }
})

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

  try {
    const repo = new LocalDataRepository(user.id, calendarId)
    await repo.getBrandRules()

    const newMediaItem = await generateAndStoreImage(
      prompt,
      calendarId,
      user.id,
      imageGenerator,
    )
    return c.json(newMediaItem)
  } catch (error: any) {
    console.error('Error generating image:', error)
    if (error.message?.includes('Forbidden')) {
      return c.json({ error: 'Forbidden' }, 403)
    }
    return c.json(
      { error: 'Failed to generate image', details: error.message },
      500,
    )
  }
})

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
    console.error('Error extracting rules:', error)
    return c.json(
      { error: 'Failed to extract rules', details: error.message },
      500,
    )
  }
})

app.post('/chat', async (c) => {
  const authResult = c.get('authResult')
  if (!isUser(authResult)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const user = authResult

  const { input, calendarId, threadId, clientContext } = await c.req.json()

  if (!calendarId) {
    return c.json({ error: 'calendarId is required' }, 400)
  }

  if (input === undefined || input === null || input === '') {
    return c.json({ error: 'input is required' }, 400)
  }

  try {
    const conversationThreadId = threadId || `${user.id}-${calendarId}`

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

    return c.json({
      response: result.response,
      toolCalls: result.toolCalls,
      threadId: conversationThreadId,
      traceId: result.traceId
    })
  } catch (error: any) {
    console.error('Error in chat agent:', error)
    if (error.message?.includes('Forbidden')) {
      return c.json({ error: 'Forbidden' }, 403)
    }
    return c.json({ error: 'Chat failed', details: error.message }, 500)
  }
})

export default app