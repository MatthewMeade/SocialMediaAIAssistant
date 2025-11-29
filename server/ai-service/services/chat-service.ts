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
import { GuardrailService } from './guardrail-service';

import { langfuseHandler } from '../../lib/langfuse'
import { StreamingCallbackHandler } from '../streaming-callback'
import { streamManager } from '../stream-manager'

export interface ChatServiceDependencies {
  repo: IAiDataRepository
  toolService: ToolService
  chatModel: BaseChatModel
  creativeModel: BaseChatModel
  imageGenerator: DallEAPIWrapper
}

const systemPrompt = `You are an expert AI assistant for social media content management.

**CORE DIRECTIVE: NO PLAIN TEXT CAPTIONS**
You are FORBIDDEN from outputting a generated caption as plain text in the chat. 
- If you generate a caption (new or refined), you MUST apply it to the editor using 'apply_caption_to_open_post'.
- **Failure condition:** If your response contains a hashtag or a full caption body text, you have failed.

**STATE DETECTION (CRITICAL):**
Check your Context for "Current Post".
- **IF A POST ID IS PRESENT:** You are in **EDITOR MODE**. The editor is ALREADY open.
  - **NEVER** ask the user to open the post.
  - **NEVER** call 'open_post' or 'create_post' for the current post.
  - **ALWAYS** assume you have permission to modify the current post.
- **IF NO POST ID:** You are in **DASHBOARD MODE**.
  - You must ask the user to create or open a post before generating content.

**TOOL USAGE PROTOCOL:**

1. **generate_caption**
   - **Input:** Topic, tone, or "refine current caption based on [feedback]".
   - **Output:** Internal data only. Pass to 'apply' tool.

2. **apply_caption_to_open_post** (Client Action)
   - **Trigger:** You have generated text AND you are in **EDITOR MODE**.
   - **Action:** Call this immediately.
   - **Note:** This tool IS the way you "show" the caption to the user.

3. **create_post** (Client Action)
   - **Trigger:** User wants a NEW post and you are in DASHBOARD MODE.
   - **Action:** Call once. Wait for client context update before generating caption.

**LOGIC GATES (Follow Strictly):**

**SCENARIO A: User asks to Edit/Refine/Rewrite (EDITOR MODE)**
*Condition: Context contains "Current Post ID"*
1. **Identify Intent:** User wants to change the text (e.g., "make it shorter", "add emojis", "rewrite about sales").
2. **Action 1:** Call \`generate_caption(topic/instructions)\`.
3. **Action 2:** IMMEDIATELY chain \`apply_caption_to_open_post(postId, caption)\`.
4. **Response:** "I've updated the caption with your changes."

**SCENARIO B: User asks to Create New Post (DASHBOARD MODE)**
*Condition: Context does NOT contain "Current Post ID"*
1. **Identify Intent:** User wants a new post.
2. **Check Requirements:** Ask for Date and Topic if missing.
3. **Action:** Call \`create_post(date)\`.
4. **Stop:** Wait for the tool result to confirm the editor is open.

**SCENARIO C: User asks to Create New Post (EDITOR MODE)**
*Condition: Context contains "Current Post ID" but user says "New Post"*
1. **Response:** "You currently have a post open. Do you want to modify this one, or close it to create a new one?"
`



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

async function loadContextualData(config: AgentContextConfig): Promise<string> {
  try {
    const { clientContext, repo } = config
    const contextParts: string[] = []

    if (!clientContext || !repo) {
      return ''
    }

    if (clientContext.postId) {
      try {
        const post = await repo.getPost(clientContext.postId)
        if (post) {
          contextParts.push(
            `*** ACTIVE EDITOR SESSION (POST IS OPEN) ***\n` +
            `- STATUS: The post editor is currently OPEN on the user's screen.\n` +
            `- Post ID: ${post.id}\n` +
            `- Current Caption: ${post.caption || '(No caption yet)'}\n` +
            `- Platform: ${post.platform}\n` +
            `- Date: ${post.date.toISOString().split('T')[0]}\n\n` +
            `INSTRUCTION: Since the session is active, do NOT ask the user to open the post. You can use 'apply_caption_to_open_post' immediately.`
          )
        }
      } catch (error) {
        console.error('[ContextLoader] Error fetching post:', error)
      }
    }

    if (clientContext.noteId) {
      try {
        const note = await repo.getNote(clientContext.noteId)
        if (note) {
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

    const currentDate = new Date()
    const dateInfo = `\n\n**Current Date:** ${currentDate.toISOString().split('T')[0]} (${currentDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })})\nWhen users say "today", they mean ${currentDate.toISOString().split('T')[0]}. When they say "tomorrow", they mean ${new Date(currentDate.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]}.`
    contextParts.push(dateInfo)

    if (contextParts.length === 0) {
      return ''
    }

    return `\n\n--- Contextual Information ---\n${contextParts.join('\n\n')}\n--- End of Context ---`;
  } catch (error) {
    console.log('loadContextualData', { error })
    throw error;
  }
}

async function invokeAgentWithTimeout(
  agent: ReturnType<typeof createAgent>,
  input: any[],
  threadId: string,
  userId: string,
  config?: { context?: z.infer<typeof toolContextSchema> }
) {
  const streamingHandler = new StreamingCallbackHandler(threadId);

  const invokePromise = propagateAttributes(
    {
      sessionId: threadId,
      userId: userId,
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

  let lastAIMessage: any = null
  for (let i = response.messages.length - 1; i >= 0; i--) {
    const msg = response.messages[i]

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
      (typeof msg === 'object' && msg.content && !msg.role && !msg._getType)

    if (isAIMessage) {
      lastAIMessage = msg
      break
    }
  }

  if (!lastAIMessage) {
    return { response: '' }
  }

  const hasToolCalls =
    lastAIMessage.tool_calls &&
    Array.isArray(lastAIMessage.tool_calls) &&
    lastAIMessage.tool_calls.length > 0
  if (hasToolCalls) {
    const clientToolCalls = extractClientToolCalls(lastAIMessage)
    if (clientToolCalls.length > 0) {
      const content = extractMessageContent(lastAIMessage)
      return {
        response: content || '',
        toolCalls: clientToolCalls,
      }
    }
  }

  return { response: extractMessageContent(lastAIMessage) }
}

function extractClientToolCalls(message: any): any[] {
  if (!message.tool_calls || !Array.isArray(message.tool_calls)) {
    return []
  }

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

function extractMessageContent(message: any): string {
  if (message.getContent && typeof message.getContent === 'function') {
    const content = message.getContent()
    if (typeof content === 'string') {
      return content
    }
  }

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

  if (message.content) {
    return String(message.content)
  }

  return ''
}

const memoryStore = new MemorySaver()

export class ChatService {
  private dependencies: ChatServiceDependencies
  private memoryStore: MemorySaver
  private guardrailService: GuardrailService

  constructor(dependencies: ChatServiceDependencies) {
    this.dependencies = dependencies
    this.memoryStore = memoryStore
    this.guardrailService = new GuardrailService(dependencies.chatModel)
  }

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
    const thread = threadId ?? uuidv4()

    const guardrailMiddleware = createMiddleware({
      name: "TopicGuardrail",
      beforeAgent: {
        hook: async (state) => {
          if (!state.messages || state.messages.length === 0) return;

          const lastMessage = state.messages[state.messages.length - 1];

          if (lastMessage._getType() !== "human") return;

          try {
            streamManager.emitEvent(thread, {
              type: 'status_start',
              content: 'Validating request...',
              timestamp: Date.now()
            });

            const decision = await this.guardrailService.validate(
              lastMessage.content.toString(),
              state.messages.slice(0, -1)
            );

            streamManager.emitEvent(thread, {
              type: 'status_end',
              timestamp: Date.now()
            });

            if (!decision.isAllowed) {
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
                jumpTo: "end"
              };
            }

            return;
          } catch (error) {
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

    let generatedPlan: string | null = null;


    const contextKeys = getContextKeys(clientContext)
    const tools = getToolsForContext(contextKeys, this.dependencies.toolService)
    if (clientContext?.postId) {
      tools.push(
        this.dependencies.toolService.createGetCurrentPostTool(
          clientContext.postId,
        ),
      )
    }

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

    streamManager.emitEvent(thread, {
      type: 'status_end',
      timestamp: Date.now()
    });

    const plan = generatedPlan || "";

    const agent = createAgent({
      model: this.dependencies.chatModel,
      tools: tools,
      systemPrompt: systemPrompt,
      contextSchema: toolContextSchema,
      checkpointer: this.memoryStore,
      middleware: [
        guardrailMiddleware,
        dynamicSystemPromptMiddleware(async (state, _config: Runtime<z.infer<typeof toolContextSchema>>) => {
          try {
            const lastMessage = state.messages && state.messages.length > 0
              ? state.messages[state.messages.length - 1]
              : null;
            const isUserMessage = lastMessage && lastMessage._getType && lastMessage._getType() === "human";

            let vectorSearchResults: Document<StoreMetaData>[] = [];
            if (clientContext?.calendarId && isUserMessage) {
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

              streamManager.emitEvent(thread, {
                type: 'status_end',
                timestamp: Date.now()
              });
            }

            const documentResults = await this.fetchDocumentContext(vectorSearchResults);

            return dynamicContext + "\n" + documentResults + "\n" + plan;
          } catch (error) {
            streamManager.emitEvent(thread, {
              type: 'status_end',
              timestamp: Date.now()
            });
            throw error;
          }
        }),
      ],
    })

    if (!toolContext) {
      throw new Error('Tool context (userId, calendarId) is required')
    }

    streamManager.emitEvent(thread, {
      type: 'status_start',
      content: 'Processing your request...',
      timestamp: Date.now()
    })

    const response = await invokeAgentWithTimeout(
      agent,
      [{ role: 'user' as const, content: input || '' }],
      thread,
      toolContext.userId,
      {
        context: toolContext,
      },
    )

    const agentResponse = extractAgentResponse(response)

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