import { createAgent, tool } from "langchain"
import * as z from "zod"
import type { IAiDataRepository } from "../repository"
import type { BaseChatModel } from "@langchain/core/language_models/chat_models"
import type { DallEAPIWrapper } from "@langchain/openai"

// System prompt for the social media content assistant
const systemPrompt = `You are an expert AI assistant for social media content management. You help users create, manage, and optimize their social media content.

IMPORTANT: When users ask to open, view, access, or navigate to the calendar page, you MUST call the navigate_to_calendar tool. Do NOT just describe navigation - you must actually call the tool. The tool will show a button that the user clicks.

When you receive a ToolMessage indicating that a tool action has been completed (e.g., "Navigated to calendar page"), acknowledge the completion briefly and then proactively ask what else you can help with. Do NOT just repeat the tool result - continue the conversation naturally and helpfully.

For example, if you receive "Navigated to calendar page", respond with something like: "Great! You're now on your calendar page. What would you like to do next? I can help you create posts, schedule content, or manage your social media strategy."

Provide helpful, actionable feedback. Be friendly and professional. Use tools proactively when they would help answer the user's question or complete their request.`

// Context type for tools
interface ToolContext {
  userId: string
  calendarId: string
  repo: IAiDataRepository
  chatModel: BaseChatModel
  creativeModel: BaseChatModel
  imageGenerator: DallEAPIWrapper
}

// Helper function to create tools with context
// Context parameter kept for future tools, but not currently used by navigate_to_calendar
function createTools(_context: ToolContext) {
  // Client-side tool: Shows a button that navigates to the calendar page
  // Frontend extracts tool_calls to render the button, then sends ToolMessage when clicked
  const navigateToCalendarTool = tool(
    async (_input: { label?: string }) => {
      return "A button will be shown to navigate to your calendar page. Please wait for the user to click it."
    },
    {
      name: "navigate_to_calendar",
      description: "Call this tool when the user asks to open, view, access, or navigate to the calendar page. This tool shows an interactive button that the user must click to navigate. You MUST call this tool - do not just describe how to navigate.",
      schema: z.object({
        label: z.string().optional().describe("The text to display on the button (default: 'Open Calendar')"),
      }),
      returnDirect: true, // Return value goes directly to user when tool is called
      // When frontend sends ToolMessage back, agent will process it and continue
    }
  )

  return [navigateToCalendarTool]
}

// Note: We don't use a checkpointer because the frontend manages conversation history
// and passes the full history with each request. This avoids state duplication.

/**
 * Converts API message history to LangChain message format.
 * Frontend already sends LangChain-compatible format, so this is just type assertions.
 */
function convertHistoryToLangChainMessages(
  history: Array<{ role: string; content: string; tool_calls?: any[]; tool_call_id?: string; name?: string }>
) {
  return history.map((msg) => {
    if (msg.role === "user") {
      return { role: "user" as const, content: msg.content }
    }
    if (msg.role === "tool") {
      return {
        role: "tool" as const,
        content: msg.content,
        tool_call_id: msg.tool_call_id!,
        ...(msg.name && { name: msg.name }),
      }
    }
    // Assistant
    return {
      role: "assistant" as const,
      content: msg.content || "",
      ...(msg.tool_calls && { tool_calls: msg.tool_calls }),
    }
  })
}

/**
 * Invokes the agent with a timeout to prevent hanging requests.
 * LLM calls can sometimes hang indefinitely, so we race against a timeout.
 */
async function invokeAgentWithTimeout(
  agent: ReturnType<typeof createAgent>,
  input: any[]
) {
  const invokePromise = agent.invoke({ messages: input })
  
  return Promise.race([
    invokePromise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Agent invocation timeout after 60 seconds")), 60000)
    ),
  ]) as Promise<any>
}

/**
 * Extracts the response content and tool calls from the agent's response.
 * Returns the last AIMessage's content and tool calls.
 */
function extractAgentResponse(response: any): { response: string; toolCalls?: any[] } {
  if (!response.messages || !Array.isArray(response.messages) || response.messages.length === 0) {
    return { response: JSON.stringify(response, null, 2) }
  }

  // Find the last AIMessage (LangChain uses 'model' as the role in some cases)
  let lastAIMessage: any = null
  for (let i = response.messages.length - 1; i >= 0; i--) {
    const msg = response.messages[i]
    if (msg.role === "assistant" || msg.role === "ai" || msg.role === "model" || msg.name === "model") {
      lastAIMessage = msg
      break
    }
  }

  if (!lastAIMessage) {
    return { response: "" }
  }

  // Check for tool calls
  const hasToolCalls = lastAIMessage.tool_calls && Array.isArray(lastAIMessage.tool_calls) && lastAIMessage.tool_calls.length > 0
  if (hasToolCalls) {
    const clientToolCalls = extractClientToolCalls(lastAIMessage)
    if (clientToolCalls.length > 0) {
      return {
        response: "",
        toolCalls: clientToolCalls,
      }
    }
  }

  // Return content
  return { response: extractMessageContent(lastAIMessage) }
}

/**
 * Extracts client-side tool calls from an AIMessage.
 * Only returns tool calls for "navigate_to_calendar" which are executed on the client.
 */
function extractClientToolCalls(message: any): any[] {
  if (!message.tool_calls || !Array.isArray(message.tool_calls)) {
    return []
  }
  
  // Filter for client-side tools only
  // Other tools (like get_brand_rules) are executed server-side by the agent
  const clientToolCalls = message.tool_calls.filter(
    (tc: any) => tc && typeof tc === "object" && tc.name === "navigate_to_calendar"
  )
  
  return clientToolCalls.map((tc: any) => ({
    id: tc.id,
    name: tc.name,
    args: tc.args,
  }))
}

/**
 * Extracts text content from a message, handling different content formats.
 * LangChain messages can have content as string, array of blocks, or other formats.
 */
function extractMessageContent(message: any): string {
  if (typeof message.content === "string") {
    return message.content
  }
  
  if (Array.isArray(message.content)) {
    // Content blocks can be strings or objects with text property
    return message.content
      .map((block: any) => (typeof block === "string" ? block : block.text || ""))
      .join("")
  }
  
  return ""
}

/**
 * Runs the chat agent with the provided input and history.
 * Creates a new agent instance (lightweight - just binds tools to model) and invokes it.
 */
export async function runChatAgent(
  input: string,
  history: Array<{ role: string; content: string; tool_calls?: any[]; tool_call_id?: string; name?: string }>,
  userId: string,
  calendarId: string,
  repo: IAiDataRepository,
  chatModel: BaseChatModel,
  creativeModel: BaseChatModel,
  imageGenerator: DallEAPIWrapper,
): Promise<{ response: string; toolCalls?: any[] }> {
  // Create tools and agent (lightweight - just binds tools to already-initialized model)
  const tools = createTools({ userId, calendarId, repo, chatModel, creativeModel, imageGenerator })
  const agent = createAgent({
    model: chatModel,
    systemPrompt,
    tools,
  })

  // Convert history to LangChain format and add current input if present
  const messages = convertHistoryToLangChainMessages(history)
  if (input.trim()) {
    messages.push({ role: "user" as const, content: input })
  }

  // Invoke agent and extract response
  const response = await invokeAgentWithTimeout(agent, messages)
  
  // If we sent a ToolMessage but the agent didn't generate a continuation,
  // explicitly prompt it to continue
  const lastMessage = messages[messages.length - 1]
  const hasToolMessage = lastMessage && lastMessage.role === "tool"
  const responseMessageCount = response.messages?.length || 0
  const inputMessageCount = messages.length
  
  if (hasToolMessage && responseMessageCount <= inputMessageCount) {
    const continuationMessages = [...messages, { 
      role: "user" as const, 
      content: "The tool action has been completed. Please acknowledge this and ask what else you can help with." 
    }]
    const continuationResponse = await invokeAgentWithTimeout(agent, continuationMessages)
    return extractAgentResponse(continuationResponse)
  }
  
  return extractAgentResponse(response)
}

