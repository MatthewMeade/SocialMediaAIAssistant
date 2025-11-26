import { createAgent, dynamicSystemPromptMiddleware, Runtime, Document, createMiddleware } from 'langchain'
import { AIMessage } from '@langchain/core/messages'
import type { IAiDataRepository } from '../repository'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import type { DallEAPIWrapper } from '@langchain/openai'
import type { ToolService } from './tool-service'
import { toolContextSchema } from './tool-service'
import { getContextKeys, getToolsForContext } from '../tool-manifest'
import * as z from 'zod'
import { searchDocuments } from 'server/ai-service/services/search-service'
import { StoreMetaData } from 'server/ai-service/vector-store'
import { convertSlateToText } from 'server/lib/content-utils'
import { MemorySaver } from "@langchain/langgraph";
import { v4 as uuidv4 } from 'uuid';
import { propagateAttributes } from '@langfuse/tracing'
import { CallbackHandler } from "@langfuse/langchain";
import { GuardrailService } from './guardrail-service';

import { langfuseHandler } from '../../lib/langfuse'
import Langfuse from 'langfuse'






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
 * Invokes the agent with a timeout to prevent hanging requests.
 * The threadId must be passed in config.configurable.thread_id for the checkpointer to work.
 * Uses propagateAttributes to set sessionId (from threadId) and userId for Langfuse tracking.
 */
async function invokeAgentWithTimeout(
  agent: ReturnType<typeof createAgent>,
  input: any[],
  threadId: string,
  userId: string,
  config?: { context?: z.infer<typeof toolContextSchema> }
) {
  // Use propagateAttributes to set sessionId and userId for Langfuse tracking
  // This ensures all observations (including tool calls) are tracked in the same session
  const invokePromise = propagateAttributes(
    {
      sessionId: threadId, // Use threadId as sessionId - all messages in a thread are one session
      userId: userId,     // Track which user this conversation belongs to
    },
    async () => {
      return await agent.invoke(
        { messages: input },
        {
          configurable: { thread_id: threadId },
          ...config,
          callbacks: [langfuseHandler],
        },
      )
    }
  )

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
  // Check for AIMessage instances first (from LangChain)
  let lastAIMessage: any = null
  for (let i = response.messages.length - 1; i >= 0; i--) {
    const msg = response.messages[i]

    // Check if it's an AIMessage instance (has _getType method or is instance of AIMessage)
    // Also check for serialized AIMessage objects
    const msgType = msg._getType ? msg._getType() : null
    const isAIMessage =
      msgType === 'ai' ||
      msgType === 'assistant' ||
      (msg.constructor && msg.constructor.name === 'AIMessage') ||
      msg instanceof AIMessage ||
      msg.role === 'assistant' ||
      msg.role === 'ai' ||
      msg.role === 'model' ||
      msg.name === 'model' ||
      (typeof msg === 'object' && msg.content && !msg.role && !msg._getType) // Fallback for serialized messages

    if (isAIMessage) {
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
  // Handle AIMessage instances with getContent method
  if (message.getContent && typeof message.getContent === 'function') {
    const content = message.getContent()
    if (typeof content === 'string') {
      return content
    }
  }

  // Handle direct content property
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

  // Fallback: try to stringify if content exists
  if (message.content) {
    return String(message.content)
  }

  return ''
}

const memoryStore = new MemorySaver()

/**
 * The ChatService is the single entry point for the /api/ai/chat route.
 * It manages the full lifecycle of an agent request.
 */
export class ChatService {
  private dependencies: ChatServiceDependencies
  private memoryStore: MemorySaver
  private guardrailService: GuardrailService

  constructor(dependencies: ChatServiceDependencies) {
    this.dependencies = dependencies
    this.memoryStore = memoryStore

    // Initialize guardrail with the centralized chat model (gpt-4o-mini)
    this.guardrailService = new GuardrailService(dependencies.chatModel)
  }

  /**
   * Runs the chat agent with the provided input.
   * Uses MemorySaver to maintain conversation history via threadId.
   * Determines which tools are needed based on clientContext, gets those tools
   * from the ToolService, and runs the agent.
   */
  async runChat(
    input: string,
    threadId?: string,
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
  ): Promise<{ response: string; toolCalls?: any[], threadId: string, traceId: string }> {
    // 1. Define the Guardrail Middleware
    const guardrailMiddleware = createMiddleware({
      name: "TopicGuardrail",
      beforeAgent: {
        hook: async (state) => {
          // Quick checks to skip invalid states or non-user messages
          if (!state.messages || state.messages.length === 0) return;

          const lastMessage = state.messages[state.messages.length - 1];

          // Only validate inputs from the human user
          if (lastMessage._getType() !== "human") return;

          // Delegate logic to the service
          // We pass previous messages (slice 0 to -1) as history for context awareness
          const decision = await this.guardrailService.validate(
            lastMessage.content.toString(),
            state.messages.slice(0, -1)
          );

          // If blocked, short-circuit the agent
          if (!decision.isAllowed) {
            console.log({ decision })
            return {
              messages: [
                new AIMessage(
                  decision.refusalMessage ||
                  "I specialize in social media management and cannot help with that request."
                )
              ],
              jumpTo: "end" // This is the critical instruction that stops the agent
            };
          }

          // If allowed, return nothing to let the agent continue normally
          return;
        },
        canJumpTo: ['end']
      }
    });

    // 2. Get tools (same as before)
    const contextKeys = getContextKeys(clientContext)
    const tools = getToolsForContext(contextKeys, this.dependencies.toolService)
    if (clientContext?.postId) {
      tools.push(
        this.dependencies.toolService.createGetCurrentPostTool(
          clientContext.postId,
        ),
      )
    }

    // 3. Create the agent with the middleware injected
    const agent = createAgent({
      model: this.dependencies.chatModel,
      tools: tools,
      systemPrompt: systemPrompt, // <-- Use the STATIC prompt
      contextSchema: toolContextSchema, // <-- Pass the tool context schema

      checkpointer: this.memoryStore, // Use the persistent memory store

      // 4. Add middleware to the pipeline
      middleware: [
        // Add Guardrail middleware FIRST so it runs before anything else
        guardrailMiddleware,

        // Existing dynamic context middleware
        dynamicSystemPromptMiddleware(async (state, _config: Runtime<z.infer<typeof toolContextSchema>>) => {
          // Run your ID-based retrieval logic
          // We need to pass repo and clientContext separately since they're not in the tool context
          const dynamicContext = await loadContextualData({
            clientContext: clientContext,
            toolService: this.dependencies.toolService,
            repo: this.dependencies.repo,
          })


          const vectorSearchResults = (await searchDocuments({ history: state.messages, input, calendarId: clientContext?.calendarId! }))
          const documentResults = await this.fetchDocumentContext(vectorSearchResults)


          // Return the dynamic context string to be appended to the system prompt
          return dynamicContext + "\n" + documentResults
        }),
      ],
    })

    // 3. Validate tool context
    if (!toolContext) {
      throw new Error('Tool context (userId, calendarId) is required')
    }

    // 4. Generate or use provided threadId
    // The MemorySaver uses threadId to maintain conversation history
    const thread = threadId ?? uuidv4()

    // CallbackHandler will use the trace with the specified ID
    // const langfuseHandler = new CallbackHandler({ traceMetadata: trace });


    // 5. Invoke the agent with just the current user message
    // The MemorySaver automatically loads previous messages from the thread
    // Pass userId to enable Langfuse user tracking
    const response = await invokeAgentWithTimeout(
      agent,
      [{ role: 'user' as const, content: input || '' }],
      thread,
      toolContext.userId,
      {
        context: toolContext,
      },
    )

    // 6. Extract and return the response
    // No special continuation logic needed - the frontend handles sending
    // "The tool action has been completed" messages when tools finish
    const agentResponse = extractAgentResponse(response)

    // Debug: Log the response structure when response is empty (might be guardrail blocking)
    if (!agentResponse.response && response.messages) {
      console.log('[ChatService] Empty response detected, checking messages:', JSON.stringify(response.messages.map((m: any) => ({
        type: m._getType ? m._getType() : m.constructor?.name || 'unknown',
        content: m.content,
        role: m.role,
        name: m.name
      })), null, 2))
    }

    return {
      ...agentResponse,
      threadId: thread,
      traceId: langfuseHandler.last_trace_id!
    }
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

