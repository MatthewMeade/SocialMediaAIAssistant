import { createAgent, dynamicSystemPromptMiddleware, Runtime, Document, createMiddleware } from 'langchain'
import { AIMessage, SystemMessage } from '@langchain/core/messages'
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
import { GuardrailService } from './guardrail-service';
import { PlannerService } from './planner-service';

import { langfuseHandler } from '../../lib/langfuse'
import { StreamingCallbackHandler } from '../streaming-callback'
import { streamManager } from '../stream-manager'






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
const systemPrompt = `You are an expert AI assistant for social media content management.

**CORE DIRECTIVE: NO PLAIN TEXT CAPTIONS**
You are FORBIDDEN from outputting a generated caption as plain text in the chat. 
- If you generate a caption, you MUST apply it to the editor immediately using the 'apply_caption_to_open_post' tool.
- If you cannot apply it (no post is open), you must ask the user to open a post first.
- **Failure condition:** If your response contains a hashtag or a full caption in the text body, you have failed.

**PLANNING INSTRUCTION:**
If a **CURRENT PLAN** is provided in the context below, follow it strictly.

**TOOL USAGE PROTOCOL:**

1. **generate_caption**
   - **Trigger:** User asks to write/create/generate content.
   - **Input:** Extract the specific topic.
   - **Output:** This tool returns raw data. Do NOT show this data to the user. Pass it to the 'apply' tool.

2. **create_post** (Client Action)
   - **Trigger:** User wants to make/schedule a new post.
   - **Required Info:** Date (ISO, "today", "tomorrow") AND Topic.
   - **Action:** Call this ONCE to open the editor.
   - **Next Step:** Wait for the tool result to confirm the editor is open before generating the caption.

3. **apply_caption_to_open_post** (Client Action)
   - **Trigger:** You have a generated caption AND a post is open (Context: postId exists).
   - **Action:** Call this immediately after 'generate_caption'.
   - **Permission:** Do NOT ask for confirmation. The tool handles the UI permission request.

4. **get_posts**, **open_post**, **grade_caption**, **navigate_to_calendar**
   - Use these standard tools for retrieval, navigation, and grading tasks.

**STRICT WORKFLOWS (LOGIC GATES):**

**Workflow A: Creating a New Post**
1. **Identify Intent:** User wants a new post.
2. **Check Requirements:** Do you have the Date and Topic? If no, ASK.
3. **Step 1 (Action):** Call \`create_post(date)\`.
   - *Stop and wait for client confirmation.*
4. **Step 2 (Action):** Context now contains a 'Current Post' ID. Call \`generate_caption(topic)\`.
5. **Step 3 (Action):** IMMEDIATELY chain \`apply_caption_to_open_post(postId, caption)\`.
6. **Final Response:** "I've created the post and applied a draft caption in the editor."

**Workflow B: Editing/Refining Open Post**
1. **Identify Intent:** User wants to write/rewrite caption for the *current* post.
2. **Check Context:** Is there a 'Current Post' ID?
3. **Step 1 (Action):** Call \`generate_caption(topic)\`.
4. **Step 2 (Action):** IMMEDIATELY chain \`apply_caption_to_open_post(postId, caption)\`.

**CONTEXT AWARENESS:**
- Check the "Current Post" section in your context.
- If \`postId\` is present, the editor is open. You have permission to modify it.
- If \`postId\` is missing, you cannot use \`apply_caption_to_open_post\`.

**CRITICAL REMINDERS:**
- Never output the caption text directly.
- Never call \`create_post\` twice for the same request.
- If the user provides a topic but no date for a new post, ask for the date first.
`



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
  console.log('[Performance] Starting loadContextualData');
  console.time('[Performance] loadContextualData');

  try {
    const { clientContext, repo } = config
    const contextParts: string[] = []

    if (!clientContext || !repo) {
      console.timeEnd('[Performance] loadContextualData');
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
      console.timeEnd('[Performance] loadContextualData');
      return ''
    }

    // Format the context to be clearly delineated for the LLM
    const result = `\n\n--- Contextual Information ---\n${contextParts.join('\n\n')}\n--- End of Context ---`;
    console.timeEnd('[Performance] loadContextualData');
    return result;
  } catch (error) {
    console.timeEnd('[Performance] loadContextualData');
    throw error;
  }
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

  const streamingHandler = new StreamingCallbackHandler(threadId);

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
          callbacks: [streamingHandler, langfuseHandler],
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
  private plannerService: PlannerService

  constructor(dependencies: ChatServiceDependencies) {
    this.dependencies = dependencies
    this.memoryStore = memoryStore

    // Initialize guardrail with the centralized chat model (gpt-4o-mini)
    this.guardrailService = new GuardrailService(dependencies.chatModel)

    // Initialize planner with the centralized chat model
    this.plannerService = new PlannerService(dependencies.chatModel)
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
    // Generate threadId early so middleware can use it
    const thread = threadId ?? uuidv4()

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

          console.log('[Performance] Starting Guardrail middleware');
          console.time('[Performance] Guardrail middleware');

          try {
            // Emit status for guardrail validation
            streamManager.emitEvent(thread, {
              type: 'status_start',
              content: 'Validating request...',
              timestamp: Date.now()
            });

            // Delegate logic to the service
            // We pass previous messages (slice 0 to -1) as history for context awareness
            const decision = await this.guardrailService.validate(
              lastMessage.content.toString(),
              state.messages.slice(0, -1)
            );

            // Clear guardrail status
            streamManager.emitEvent(thread, {
              type: 'status_end',
              timestamp: Date.now()
            });

            // If blocked, short-circuit the agent
            if (!decision.isAllowed) {
              console.log({ decision })
              console.timeEnd('[Performance] Guardrail middleware');
              // Clear status before returning blocked response
              streamManager.emitEvent(thread, {
                type: 'status_end',
                timestamp: Date.now()
              });
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
            console.timeEnd('[Performance] Guardrail middleware');
            return;
          } catch (error) {
            console.timeEnd('[Performance] Guardrail middleware');
            // Clear status on error
            streamManager.emitEvent(thread, {
              type: 'status_end',
              timestamp: Date.now()
            });
            throw error;
          }
        },
        canJumpTo: ['end']
      }
    });

    // 2. Define the Planner Middleware
    // Use a closure variable to store the generated plan
    let generatedPlan: string | null = null;

    // Note: plannerMiddleware is currently commented out in middleware array but kept for future use
    const plannerMiddleware = createMiddleware({
      name: "Planner",
      beforeAgent: {
        hook: async (state) => {
          const lastMessage = state.messages[state.messages.length - 1];

          // Optimization: Only run planner on user messages
          if (lastMessage._getType() !== "human") {
            generatedPlan = null; // Reset plan for non-user messages
            return;
          }

          console.log('[Performance] Starting Planner middleware');
          console.time('[Performance] Planner middleware');

          try {
            // Emit status for planning
            streamManager.emitEvent(thread, {
              type: 'status_start',
              content: 'Planning next steps...',
              timestamp: Date.now()
            });

            // Serialize context for the planner (avoid sending huge objects)
            const contextSummary = JSON.stringify({
              page: clientContext?.page,
              component: clientContext?.component,
              hasOpenPost: !!clientContext?.postId,
              hasOpenNote: !!clientContext?.noteId,
              currentDate: new Date().toISOString().split('T')[0]
            });

            // Generate the plan
            generatedPlan = await this.plannerService.generatePlan(
              lastMessage.content.toString(),
              contextSummary
            );

            // Clear planning status
            streamManager.emitEvent(thread, {
              type: 'status_end',
              timestamp: Date.now()
            });

            if (generatedPlan) {
              console.log({ generatedPlan })
              console.timeEnd('[Performance] Planner middleware');
              return {
                messages: [new SystemMessage(generatedPlan)],

              }
            }
            console.timeEnd('[Performance] Planner middleware');
          } catch (error) {
            console.timeEnd('[Performance] Planner middleware');
            // Clear status on error
            streamManager.emitEvent(thread, {
              type: 'status_end',
              timestamp: Date.now()
            });
            throw error;
          }
        }
      }
    });

    // 3. Get tools (same as before)
    const contextKeys = getContextKeys(clientContext)
    const tools = getToolsForContext(contextKeys, this.dependencies.toolService)
    if (clientContext?.postId) {
      tools.push(
        this.dependencies.toolService.createGetCurrentPostTool(
          clientContext.postId,
        ),
      )
    }

    // Load standard context with status update
    streamManager.emitEvent(thread, {
      type: 'status_start',
      content: 'Loading context...',
      timestamp: Date.now()
    });

    const dynamicContext = await loadContextualData({
      clientContext: clientContext,
      toolService: this.dependencies.toolService,
      repo: this.dependencies.repo,
    });

    // Clear context loading status
    streamManager.emitEvent(thread, {
      type: 'status_end',
      timestamp: Date.now()
    });

    // Retrieve the plan from the closure variable
    const plan = generatedPlan || "";

    // 4. Create the agent with the middleware injected
    const agent = createAgent({
      model: this.dependencies.chatModel,
      tools: tools,
      systemPrompt: systemPrompt, // <-- Use the STATIC prompt
      contextSchema: toolContextSchema, // <-- Pass the tool context schema

      checkpointer: this.memoryStore, // Use the persistent memory store

      // 5. Add middleware to the pipeline
      middleware: [
        // Add Guardrail middleware FIRST so it runs before anything else
        guardrailMiddleware,


        // Context Injection (Updated to include plan and RAG search with conversation history)
        dynamicSystemPromptMiddleware(async (state, _config: Runtime<z.infer<typeof toolContextSchema>>) => {
          console.log('[Performance] Starting Context Injection middleware (RAG + Context)');
          console.time('[Performance] Context Injection middleware');

          try {
            // Only run RAG search on initial user messages, not on tool continuations
            // Check if the last message is from a human user
            const lastMessage = state.messages && state.messages.length > 0
              ? state.messages[state.messages.length - 1]
              : null;
            const isUserMessage = lastMessage && lastMessage._getType && lastMessage._getType() === "human";

            // Fetch RAG docs with conversation history from state.messages
            // This provides context-aware semantic search based on the full conversation
            let vectorSearchResults: Document<StoreMetaData>[] = [];
            if (clientContext?.calendarId && isUserMessage) {
              // Emit status for RAG search - more user-friendly message
              streamManager.emitEvent(thread, {
                type: 'status_start',
                content: 'Searching your notes...',
                timestamp: Date.now()
              });

              vectorSearchResults = await searchDocuments({
                history: state.messages || [],
                input,
                calendarId: clientContext.calendarId
              });

              // Clear RAG search status
              streamManager.emitEvent(thread, {
                type: 'status_end',
                timestamp: Date.now()
              });
            }

            const documentResults = await this.fetchDocumentContext(vectorSearchResults);

            // Combine everything
            const result = dynamicContext + "\n" + documentResults + "\n" + plan;
            console.timeEnd('[Performance] Context Injection middleware');
            return result;
          } catch (error) {
            console.timeEnd('[Performance] Context Injection middleware');
            // Clear status on error
            streamManager.emitEvent(thread, {
              type: 'status_end',
              timestamp: Date.now()
            });
            throw error;
          }
        }),


        // Add Planner middleware SECOND to generate plans
        // plannerMiddleware, // Currently disabled - uncomment to enable planning

        // todoListMiddleware(),
      ],
    })

    // 6. Validate tool context
    if (!toolContext) {
      throw new Error('Tool context (userId, calendarId) is required')
    }

    // 7. Emit initial status (threadId already generated above)
    streamManager.emitEvent(thread, {
      type: 'status_start',
      content: 'Processing your request...',
      timestamp: Date.now()
    })

    // CallbackHandler will use the trace with the specified ID
    // const langfuseHandler = new CallbackHandler({ traceMetadata: trace });


    // 8. Invoke the agent with just the current user message
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

    // 9. Extract and return the response
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