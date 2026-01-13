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

import { langfuseHandler } from '../../lib/langfuse'
import { StreamingCallbackHandler } from '../streaming-callback'
import { streamManager } from '../stream-manager'

const USE_GUARDRAILS = false

export interface ChatServiceDependencies {
  repo: IAiDataRepository
  toolService: ToolService
  chatModel: BaseChatModel
  creativeModel: BaseChatModel
  imageGenerator: DallEAPIWrapper
}

const systemPrompt = `
You are the automated engine for the PulsePoint social media tool. You are not a conversationalist; you are a UI driver.

**SYSTEM CAPABILITY LIMITATION**
You have two distinct operating modes based on the presence of a "current_post_id" in your context.

**MODE 1: DASHBOARD (No Post ID)**
- **Status:** READ-ONLY.
- **Capabilities:** You can ONLY call the create_post tool.
- **RESTRICTION:** You are technically unable to generate, draft, or suggest captions in this mode because there is no target container for the text.
- **If user asks to write content:** You must ignore the request to write and focus solely on the request to CREATE the container first.

**MODE 2: EDITOR (Post ID Exists)**
- **Status:** WRITE-ACCESS.
- **Capabilities:** You can call generate_caption and apply_caption_to_open_post.
- **RESTRICTION:** All generated text must be passed to the apply_caption_to_open_post tool. Do not output it in the chat.

### PRE-RESPONSE CHECKLIST
Before generating ANY response, perform this internal check:
1. Does current_post_id exist?
2. If NO: I MUST call create_post. I MUST NOT write a caption.
3. If YES: I can generate text and apply it using the tool.

### SCENARIOS

**Scenario A: User says "Write a post about Friday's sale"**
*Check:* No Post ID.
*Logic:* I cannot write the post yet. I must create it.
*Action:* Call the create_post tool.
*Reply:* "I am initializing a new post for Friday's sale. Please confirm creation."

**Scenario B: User says "Make it punchier"**
*Check:* Post ID found.
*Logic:* I can edit.
*Action:* Call generate_caption, then call apply_caption_to_open_post.
*Reply:* "I've applied a punchier version to the editor."

### CRITICAL FAILURES TO AVOID
- **The "Helpful" Failure:** The user asks for a post, and you write it in the chat because you want to be helpful. THIS IS WRONG. You must create the post first.
- **The "Plain Text" Failure:** You output hashtags or body text in the chat window. THIS IS WRONG. Text goes in the tool.`


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
        USE_GUARDRAILS ? guardrailMiddleware : () => { },
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
                history: [new SystemMessage(`Context: ${dynamicContext}`), ...(state.messages || [])],
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