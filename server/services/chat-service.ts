import { createAgent, dynamicSystemPromptMiddleware, Runtime, Document } from 'langchain'
import type { IAiDataRepository } from '../ai-service/repository'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import type { DallEAPIWrapper } from '@langchain/openai'
import type { ToolService } from './tool-service'
import { toolContextSchema } from './tool-service'
import { getContextKeys, getToolsForContext } from '../ai-service/tool-manifest'
import * as z from 'zod'
import { searchDocuments } from 'server/ai-service/services/search-service'
import { StoreMetaData } from 'server/ai-service/vector-store'
import { convertSlateToText } from 'server/lib/content-utils'

/**
 * Dependencies injected into the ChatService.
 */
export interface ChatServiceDependencies {
  repo: IAiDataRepository
  toolService: ToolService
  chatModel: BaseChatModel
  creativeModel: BaseChatModel
  imageGenerator: DallEAPIWrapper
}

/**
 * System prompt for the social media content assistant.
 */
const systemPrompt = `You are an expert AI assistant for social media content management. You help users create, manage, and optimize their social media content.

CRITICAL: You MUST use tools to help users. Do NOT just provide text responses when tools are available.

**When to use tools:**
1. **generate_caption**: ALWAYS use this tool when users ask you to create, write, or generate a caption for a post. Extract the topic from their request, then call generate_caption with the topic. Do NOT write the caption directly in your response - use the tool!

2. **get_posts**: Use this tool when users ask about their posts, want to see what's scheduled, or need information about existing content.

3. **grade_caption**: Use this tool when users ask you to evaluate, grade, review, or score a caption. This tool grades the caption against brand voice rules and returns a score (0-100), rule breakdown, and suggestions for improvement.

4. **apply_caption_to_open_post**:
   - **AUTOMATICALLY use this tool** when you've generated a caption AND a post is open (check the "Current Post" context). 
   - **IMPORTANT**: This tool shows a UI card/button that asks the user for permission - you do NOT need to ask for confirmation before calling the tool. The tool itself handles the permission request via the UI.
   - Also use this tool when users explicitly ask you to update/save a caption.
   - You can only use this tool when a post is open (check the "Current Post" context). Use the Post ID from that context as the postId parameter.
   - The user will see the suggestion in a card and can click to accept or ignore it - the tool call itself is the permission request.

5. **create_post**:
   - Use this tool when users ask to create a new post, add a post, or schedule a post.
   - **WORKFLOW**: When a user asks you to "make a post" or "create a post":
     **STEP 1**: Ask the user which date they want to schedule the post for (e.g., "today", "tomorrow", or a specific date like "2025-11-26") AND what topic they want.
     **STEP 2**: Once you have BOTH the date AND topic:
       a) FIRST: Call create_post with the date ONCE - This opens the post editor modal on the client and saves the post immediately
       b) THEN: Always provide a text response explaining what you're doing, like "I've created and opened the post editor for [date]. Now I'll generate a caption for your post about [topic]."
       c) THEN: Call generate_caption with the topic
       d) FINALLY: Check if the "Current Post" context has a postId. If it does, call apply_caption_to_open_post with that postId. The post will be saved immediately when created, so the postId should be available.
     **CRITICAL**:
       - Always provide text responses between tool calls. Never return empty responses.
       - DO NOT call create_post more than once - call it ONCE and then continue with generate_caption
       - DO NOT call open_post after create_post - create_post already opens the editor
       - The post is saved immediately when created, so you can use the postId from context right away
   - The date can be in ISO format (YYYY-MM-DD), "today", "tomorrow", or a day name like "Monday".

6. **open_post**: Use this tool when users ask to view, edit, or open a specific post. You can get post IDs from the get_posts tool or from the calendar context. This opens the post in the editor.

7. **navigate_to_calendar**: Use this tool when users ask to open, view, access, or navigate to the calendar page. Do NOT just describe navigation - you must call the tool.

**Example workflow for caption generation (when post is open):**
- User: "Create a caption about our sale"
- You: [Call generate_caption with topic="our sale"]
- You: [IMMEDIATELY call apply_caption_to_open_post with the generated caption and the Post ID from context]
- You: "I've created and applied a caption suggestion for your post! You can review it in the editor and make any changes you'd like."

**Example workflow for creating a new post (when NO post is open):**
- User: "Make a post about our sale"
- You: "Great! Which date would you like to schedule this post for? You can say 'today', 'tomorrow', or a specific date like '2025-11-26'. Also, what topic would you like for the post?"
- User: "Tomorrow, topic is our summer sale"
- You: [Call create_post with date="tomorrow"]
- You: "I've opened the post editor for tomorrow. Now I'll generate a caption for your post about the summer sale."
- You: [Call generate_caption with topic="our summer sale"]
- You: "I've generated a caption: [show caption]. Since the post editor is now open, I can apply this caption to your post."
- You: [Check if "Current Post" context has a postId - if yes, call apply_caption_to_open_post. If no, say "The post editor should be open now. I can apply the caption once it's ready."]

**Example workflow for caption generation only (when NO post is open and user doesn't want to create post):**
- User: "Create a caption about our sale"
- You: [Call generate_caption with topic="our sale"]
- You: "I've generated a caption for you: [show caption]. To apply it, please open a post in the editor first, or I can help you create a new post if you'd like."

**Tool usage rules:**
- ALWAYS use generate_caption instead of writing captions directly
- When a post is open and you generate a caption, AUTOMATICALLY apply it using apply_caption_to_open_post - the tool itself shows a UI that asks for permission, so you don't need to ask first
- When you receive a ToolMessage indicating completion, acknowledge it briefly and continue with the NEXT step - DO NOT call the same tool again
- NEVER call the same tool twice in a row - if you called create_post and received a ToolMessage, do NOT call create_post again
- Be proactive - if a tool would help, use it
- Remember: Tools with returnDirect: true (like apply_caption_to_open_post) show UI elements that handle permission - you can call them directly without asking first
- Provide helpful, actionable feedback. Be friendly and professional.`

/**
 * Schema for the agent's configurable context.
 * This allows us to pass clientContext and toolService to the middleware.
 */
type AgentContextConfig = {
  clientContext?: {
    page?: string
    component?: string
    postId?: string
    noteId?: string
    calendarId?: string
    pageState?: {
      currentMonth?: number
      currentYear?: number
      postId?: string
      noteId?: string
      [key: string]: any
    }
  }
  toolService: ToolService
  repo: IAiDataRepository
}

/**
 * This function replaces the old 'buildSystemPrompt' logic.
 * It reads the clientContext (passed via config.configurable) and fetches
 * specific documents by ID, not by semantic search.
 */
async function loadContextualData(config: AgentContextConfig): Promise<string> {
  const { clientContext, repo } = config
  const contextParts: string[] = []

  if (!clientContext || !repo) {
    return '' // No context to inject
  }

  console.log({ clientContext })

  // 1. Post context (fetch by ID)
  if (clientContext.postId) {
    try {
      const post = await repo.getPost(clientContext.postId)
      if (post) {
        contextParts.push(
          `**Current Post:**\nThe user is currently viewing/editing a post:\n- Post ID: ${post.id}\n- Caption: ${post.caption || '(No caption yet)'}\n- Platform: ${post.platform}\n- Status: ${post.status}\n- Date: ${post.date.toISOString().split('T')[0]}\n- Images: ${post.images.length} image(s)\n\nWhen the user asks about "this post" or "the current post", they are referring to this post. When using the apply_caption_to_open_post tool, you MUST use Post ID: ${post.id} as the postId parameter.`,
        )
      }
    } catch (error) {
      console.error('[ContextLoader] Error fetching post:', error)
    }
  }

  // 1b. Note context (fetch by ID)
  if (clientContext.noteId) {
    try {
      const note = await repo.getNote(clientContext.noteId)
      if (note) {
        // Extract text content from Slate JSON for context
        const extractText = (content: any): string => {
          if (!content || !Array.isArray(content)) return ''
          return content
            .map((node: any) => {
              if (node.children) {
                return node.children
                  .map((child: any) => child.text || '')
                  .join('')
              }
              return ''
            })
            .join('\n')
            .trim()
        }
        const noteText = extractText(note.content)
        contextParts.push(
          `**Current Note:**\nThe user is currently viewing/editing a note:\n- Note ID: ${note.id}\n- Title: ${note.title}\n- Content: ${noteText || '(Empty note)'}\n\nWhen the user asks about "this note" or "the current note", they are referring to this note.`,
        )
      }
    } catch (error) {
      console.error('[ContextLoader] Error fetching note:', error)
    }
  }

  // 2. Brand Voice context (fetch all for calendar)
  // Repository is already scoped to a specific calendarId, so we can fetch brand rules directly
  try {
    const brandRules = await repo.getBrandRules()
    const enabledRules = brandRules.filter((r) => r.enabled)
    if (enabledRules.length > 0) {
      const rulesText = enabledRules
        .map((r) => `- **${r.title}:** ${r.description}`)
        .join('\n')
      contextParts.push(
        `**Brand Voice Rules:**\nThe following brand voice rules are active for this calendar:\n${rulesText}\n\nAlways follow these rules when generating or suggesting content. When grading content, evaluate it against these rules.`,
      )
    } else {
      contextParts.push(
        '**Brand Voice Rules:**\nNo active brand voice rules are currently configured for this calendar.',
      )
    }
  } catch (error) {
    console.error('[ContextLoader] Error fetching brand rules:', error)
  }

  // 3. Add current date context
  const currentDate = new Date()
  const dateInfo = `\n\n**Current Date:** ${currentDate.toISOString().split('T')[0]} (${currentDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })})\nWhen users say "today", they mean ${currentDate.toISOString().split('T')[0]}. When they say "tomorrow", they mean ${new Date(currentDate.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]}.`
  contextParts.push(dateInfo)

  // Return the final formatted string
  if (contextParts.length === 0) {
    return ''
  }

  // Format the context to be clearly delineated for the LLM
  return `\n\n--- Contextual Information ---\n${contextParts.join('\n\n')}\n--- End of Context ---`
}

/**
 * Converts API message history to LangChain message format.
 */
function convertHistoryToLangChainMessages(
  history: Array<{
    role: string
    content: string
    tool_calls?: any[]
    tool_call_id?: string
    name?: string
  }>,
) {
  return history.map((msg) => {
    if (msg.role === 'user') {
      return { role: 'user' as const, content: msg.content }
    }
    if (msg.role === 'tool') {
      return {
        role: 'tool' as const,
        content: msg.content,
        tool_call_id: msg.tool_call_id!,
        ...(msg.name && { name: msg.name }),
      }
    }
    // Assistant
    // Ensure content is always a string (not empty, as empty strings can cause format issues)
    const assistantContent = msg.content && msg.content.trim() ? msg.content : (msg.tool_calls ? '' : ' ')
    return {
      role: 'assistant' as const,
      content: assistantContent,
      ...(msg.tool_calls && { tool_calls: msg.tool_calls }),
    }
  })
}

/**
 * Invokes the agent with a timeout to prevent hanging requests.
 */
async function invokeAgentWithTimeout(
  agent: ReturnType<typeof createAgent>,
  input: any[],
  config?: { context?: z.infer<typeof toolContextSchema> },
) {
  const invokePromise = agent.invoke({ messages: input }, config)

  return Promise.race([
    invokePromise,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error('Agent invocation timeout after 60 seconds')),
        60000,
      ),
    ),
  ]) as Promise<any>
}

/**
 * Extracts the response content and tool calls from the agent's response.
 */
function extractAgentResponse(response: any): {
  response: string
  toolCalls?: any[]
} {
  if (
    !response.messages ||
    !Array.isArray(response.messages) ||
    response.messages.length === 0
  ) {
    return { response: JSON.stringify(response, null, 2) }
  }

  // Find the last AIMessage
  let lastAIMessage: any = null
  for (let i = response.messages.length - 1; i >= 0; i--) {
    const msg = response.messages[i]
    if (
      msg.role === 'assistant' ||
      msg.role === 'ai' ||
      msg.role === 'model' ||
      msg.name === 'model'
    ) {
      lastAIMessage = msg
      break
    }
  }

  if (!lastAIMessage) {
    return { response: '' }
  }

  // Check for tool calls
  const hasToolCalls =
    lastAIMessage.tool_calls &&
    Array.isArray(lastAIMessage.tool_calls) &&
    lastAIMessage.tool_calls.length > 0
  if (hasToolCalls) {
    const clientToolCalls = extractClientToolCalls(lastAIMessage)
    if (clientToolCalls.length > 0) {
      // Include any text content even when there are client-side tool calls
      // This allows the AI to provide context/feedback along with tool actions
      const content = extractMessageContent(lastAIMessage)
      return {
        response: content || '',
        toolCalls: clientToolCalls,
      }
    }
  }

  // Return content
  return { response: extractMessageContent(lastAIMessage) }
}

/**
 * Extracts client-side tool calls from an AIMessage.
 * Only returns tool calls for client-side tools (those with returnDirect: true).
 */
function extractClientToolCalls(message: any): any[] {
  if (!message.tool_calls || !Array.isArray(message.tool_calls)) {
    return []
  }

  // Filter for client-side tools only
  // These are tools that have returnDirect: true and are executed on the client
  const clientToolCalls = message.tool_calls.filter(
    (tc: any) =>
      tc &&
      typeof tc === 'object' &&
      (tc.name === 'navigate_to_calendar' ||
        tc.name === 'apply_caption_to_open_post' ||
        tc.name === 'create_post' ||
        tc.name === 'open_post'),
  )

  return clientToolCalls.map((tc: any) => ({
    id: tc.id,
    name: tc.name,
    args: tc.args || {},
  }))
}

/**
 * Extracts text content from a message.
 */
function extractMessageContent(message: any): string {
  if (typeof message.content === 'string') {
    return message.content
  }

  if (Array.isArray(message.content)) {
    return message.content
      .map((block: any) =>
        typeof block === 'string' ? block : block.text || '',
      )
      .join('')
  }

  return ''
}

/**
 * The ChatService is the single entry point for the /api/ai/chat route.
 * It manages the full lifecycle of an agent request.
 */
export class ChatService {
  private dependencies: ChatServiceDependencies

  constructor(dependencies: ChatServiceDependencies) {
    this.dependencies = dependencies
  }

  /**
   * Runs the chat agent with the provided input and history.
   * Determines which tools are needed based on clientContext, gets those tools
   * from the ToolService, and runs the agent.
   */
  async runChat(
    input: string,
    history: Array<{
      role: string
      content: string
      tool_calls?: any[]
      tool_call_id?: string
      name?: string
    }>,
    clientContext?: {
      page?: string
      component?: string
      postId?: string
      noteId?: string
      calendarId?: string
      pageState?: {
        currentMonth?: number
        currentYear?: number
        postId?: string
        noteId?: string
        [key: string]: any
      }
    },
    toolContext?: z.infer<typeof toolContextSchema>,
  ): Promise<{ response: string; toolCalls?: any[] }> {
    // 1. Get tools (same as before)
    const contextKeys = getContextKeys(clientContext)
    const tools = getToolsForContext(contextKeys, this.dependencies.toolService)
    if (clientContext?.postId) {
      tools.push(
        this.dependencies.toolService.createGetCurrentPostTool(
          clientContext.postId,
        ),
      )
    }

    // 2. Create the agent
    const agent = createAgent({
      model: this.dependencies.chatModel,
      tools: tools,
      systemPrompt: systemPrompt, // <-- Use the STATIC prompt
      contextSchema: toolContextSchema, // <-- Pass the tool context schema

      // 3. Add the middleware
      middleware: [
        dynamicSystemPromptMiddleware(async (_state, _config: Runtime<z.infer<typeof toolContextSchema>>) => {
          // Run your ID-based retrieval logic
          // We need to pass repo and clientContext separately since they're not in the tool context
          const dynamicContext = await loadContextualData({
            clientContext: clientContext,
            toolService: this.dependencies.toolService,
            repo: this.dependencies.repo,
          })


          const vectorSearchResults = (await searchDocuments({ history, input, calendarId: clientContext?.calendarId! }))
          const documentResults = await this.fetchDocumentContext(vectorSearchResults)

          console.log(dynamicContext + "\n" + documentResults)

          // Return the dynamic context string to be appended to the system prompt
          return dynamicContext + "\n" + documentResults
        }),
      ],
    })

    // 4. Convert history
    const messages = convertHistoryToLangChainMessages(history)

    // 5. Invoke the agent
    // We pass the full message list in the input
    // We pass our tool context (userId, calendarId) via the context parameter
    if (!toolContext) {
      throw new Error('Tool context (userId, calendarId) is required')
    }

    const response = await invokeAgentWithTimeout(
      agent,
      [...messages, { role: 'user' as const, content: input || '' }],
      {
        context: toolContext,
      },
    )

    // 6. Handle response (same as your existing logic)
    const lastMessage = messages[messages.length - 1]
    const hasToolMessage = lastMessage && lastMessage.role === 'tool'
    const responseMessageCount = response.messages?.length || 0
    const inputMessageCount = messages.length

    if (hasToolMessage && responseMessageCount <= inputMessageCount) {
      const continuationMessages = [
        ...messages,
        {
          role: 'user' as const,
          content:
            'The tool action has been completed. Please continue with the next step.',
        },
      ]
      const continuationResponse = await invokeAgentWithTimeout(
        agent,
        continuationMessages,
        {
          context: toolContext,
        },
      )
      return extractAgentResponse(continuationResponse)
    }

    return extractAgentResponse(response)
  }

  private fetchDocumentContext = async (documents: Document<StoreMetaData>[]) => {
    const fetchPromises = documents.map(async doc => {
      if (doc.metadata.documentType === 'note') {
        const note = await this.dependencies.repo.getNote(doc.metadata.documentId)
        return {
          title: note?.title,
          content: note?.content ? convertSlateToText(note?.content) : null,
          type: 'Note'
        }
      }

      if (doc.metadata.documentType === 'knowledgebase') {

        // TODO: Get actual content here
        return {
          title: "Test Article",
          content: "This is an example article",
          type: 'Knowledgebase Article'
        }
      }
    })

    const results = await Promise.all(fetchPromises)

    const contextStr = results.map(r => (`
        ${r?.type}: ${r?.title}
        ${r?.content}
      `)).join('\n')


    return `Relevant Documents: \n${contextStr}`
  }
}

