import { useState, useRef, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { X, Send, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { apiFetch } from "@/lib/api-client"

interface Message {
  role: "user" | "assistant" | "tool"
  content: string
  toolCalls?: ToolCall[]
  tool_call_id?: string
  name?: string
}

interface ToolCall {
  id: string
  name: string
  args: {
    label?: string
    action?: string
    data?: any
  }
}

interface ChatSidebarProps {
  isOpen: boolean
  onClose: () => void
  calendarId: string
}

export function ChatSidebar({ isOpen, onClose, calendarId }: ChatSidebarProps) {
  const navigate = useNavigate()
  const { calendarSlug } = useParams()
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hello! I'm your AI assistant. How can I help you with your social media content today?",
    },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [threadId] = useState<string>(() => `${calendarId}-${Date.now()}`)
  const [executedToolCalls, setExecutedToolCalls] = useState<Set<string>>(new Set())
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [isOpen])

  /**
   * Executes a client-side tool action locally in the browser.
   * These actions don't require server interaction - they're UI operations like navigation or clearing chat.
   */
  const executeClientTool = async (toolCall: ToolCall) => {
    // Prevent multiple clicks
    if (executedToolCalls.has(toolCall.id)) {
      return
    }
    
    // Mark as executed immediately to prevent duplicate clicks
    setExecutedToolCalls((prev) => new Set(prev).add(toolCall.id))
    
    setIsLoading(true)
    try {
      // Handle navigate_to_calendar tool
      if (toolCall.name === "navigate_to_calendar") {
        const result = await executeToolAction(
          "navigate_to_calendar",
          toolCall.args.data,
          messages,
          setMessages,
          navigate,
          calendarSlug
        )
        await sendToolResult(toolCall.id, toolCall.name, result)
      }
    } catch (error) {
      // If execution fails, unmark as executed so user can retry
      setExecutedToolCalls((prev) => {
        const newSet = new Set(prev)
        newSet.delete(toolCall.id)
        return newSet
      })
      // Show error to user
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error executing that action. Please try again.",
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }
  
  /**
   * Executes a specific tool action and returns a result message.
   */
  async function executeToolAction(
    action: string,
    _data: unknown,
    _currentMessages: Message[],
    _setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
    navigateFn: (path: string) => void,
    slug: string | undefined
  ): Promise<string> {
    if (action === "navigate_to_calendar") {
      if (slug) {
        navigateFn(`/${slug}/calendar`)
        return "Navigated to calendar page"
      }
      throw new Error("Unable to navigate - calendar not found")
    }
    
    throw new Error(`Unknown tool action: ${action}`)
  }

  /**
   * Sends a tool execution result back to the agent.
   * With returnDirect: true, the tool result goes directly to the user, but we still need
   * to send a ToolMessage so the agent knows the tool completed and can continue.
   */
  const sendToolResult = async (toolCallId: string, toolName: string, result: string) => {
    const history = buildMessageHistory(messages)
    
    const toolMessage = {
      role: "tool" as const,
      content: result,
      tool_call_id: toolCallId,
      name: toolName,
    }

    const response = await apiFetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: "",
        history: [...history, toolMessage],
        calendarId,
        threadId,
      }),
    })

    if (!response.ok) {
      throw new Error("Failed to send tool result")
    }

    const data = await response.json()
    
    // Add the ToolMessage to state so it's included in future history
    setMessages((prev) => [
      ...prev,
      {
        role: "tool",
        content: result,
        tool_call_id: toolCallId,
        name: toolName,
      },
      // Add the agent's continuation response (after processing the ToolMessage)
      {
        role: "assistant",
        content: data.response || "",
        toolCalls: data.toolCalls,
      },
    ])
  }
  
  /**
   * Converts frontend messages to API format.
   * Uses LangChain's format directly ("user" | "assistant" | "tool") to avoid unnecessary conversions.
   * Only converts camelCase toolCalls to snake_case tool_calls for API compatibility.
   */
  function buildMessageHistory(messages: Message[]): Array<{
    role: "user" | "assistant" | "tool"
    content: string
    tool_calls?: Array<{ id: string; name: string; args: any }>
    tool_call_id?: string
    name?: string
  }> {
    return messages.map((msg) => {
      // Handle ToolMessages
      if (msg.role === "tool") {
        return {
          role: "tool" as const,
          content: msg.content,
          tool_call_id: msg.tool_call_id!,
          ...(msg.name && { name: msg.name }),
        }
      }
      
      // Handle User and Assistant messages
      const apiMsg: {
        role: "user" | "assistant" | "tool"
        content: string
        tool_calls?: Array<{ id: string; name: string; args: any }>
        tool_call_id?: string
        name?: string
      } = {
        role: msg.role,
        content: msg.content || "",
      }
      
      // Convert camelCase toolCalls to snake_case tool_calls for API
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        apiMsg.tool_calls = msg.toolCalls.map((tc) => ({
          id: tc.id,
          name: tc.name,
          args: tc.args,
        }))
      }
      
      return apiMsg
    })
  }

  /**
   * Handles sending a user message to the agent.
   * Updates UI optimistically, then adds the agent's response when it arrives.
   * If there are pending tool calls, sends cancellation ToolMessages for them.
   */
  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = { role: "user", content: input.trim() }
    const newMessages = [...messages, userMessage]
    
    // Check for pending tool calls (tool calls that haven't been executed)
    const pendingToolCalls: Array<{ id: string; name: string }> = []
    for (const msg of messages) {
      if (msg.role === "assistant" && msg.toolCalls) {
        for (const toolCall of msg.toolCalls) {
          if (!executedToolCalls.has(toolCall.id)) {
            pendingToolCalls.push({ id: toolCall.id, name: toolCall.name })
          }
        }
      }
    }
    
    // Update UI immediately for better UX (optimistic update)
    setMessages(newMessages)
    setInput("")
    setIsLoading(true)

    try {
      // Convert previous messages to API format (exclude the current message)
      // The current message is sent as "input" instead of being in history
      let history = buildMessageHistory(newMessages.slice(0, -1))
      
      // Add cancellation ToolMessages for any pending tool calls
      if (pendingToolCalls.length > 0) {
        const cancellationMessages = pendingToolCalls.map((tc) => ({
          role: "tool" as const,
          content: "Tool call cancelled by user",
          tool_call_id: tc.id,
          name: tc.name,
        }))
        history = [...history, ...cancellationMessages]
        // Mark these tool calls as executed so they don't show as pending
        setExecutedToolCalls((prev) => {
          const newSet = new Set(prev)
          pendingToolCalls.forEach((tc) => newSet.add(tc.id))
          return newSet
        })
      }

      const response = await apiFetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: userMessage.content,
          history,
          calendarId,
          threadId,
        }),
      })

      if (!response.ok) {
        throw new Error("Request failed")
      }

      const data = await response.json()
      
      // Add agent's response (may include tool calls for client-side execution)
      // When tool calls are present, don't add the returnDirect result content
      // The tool result is handled by the button click, which sends a ToolMessage
      if (data.toolCalls && data.toolCalls.length > 0) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "", // Empty content for tool calls - button will be rendered
            toolCalls: data.toolCalls,
          },
        ])
      } else {
        // Regular response without tool calls
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.response || "",
            toolCalls: data.toolCalls,
          },
        ])
      }
    } catch (error) {
      // Show error message to user
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <aside
      className={cn(
        "fixed right-0 top-0 z-50 flex h-screen w-96 flex-col border-l border-border bg-card shadow-lg transition-transform duration-300 ease-in-out",
        isOpen ? "translate-x-0" : "translate-x-full",
      )}
    >
      {/* Header */}
      <div className="flex h-16 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">AI Assistant</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
          <X className="h-4 w-4" />
          <span className="sr-only">Close chat</span>
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages
          .filter((message) => message.role !== "tool") // Don't render ToolMessages in UI
          .map((message, index) => {
            // Generate stable key: use tool call IDs if available, otherwise use index + role + content hash
            const messageKey = message.toolCalls?.length 
              ? `msg-${message.toolCalls.map(tc => tc.id).join('-')}`
              : `msg-${index}-${message.role}-${message.content.substring(0, 20)}`
            
            return (
          <div
            key={messageKey}
            className={cn(
              "flex w-full",
              message.role === "user" ? "justify-end" : "justify-start",
            )}
          >
            <div
              className={cn(
                "max-w-[80%] rounded-lg px-4 py-2 flex flex-col gap-2",
                message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              {/* Render tool calls as buttons */}
              {message.toolCalls && message.toolCalls.length > 0 && (
                <div className="flex flex-col gap-2 mt-2">
                  {message.toolCalls.map((toolCall) => {
                    // Determine button label based on tool type
                    const buttonLabel = toolCall.name === "navigate_to_calendar"
                      ? (toolCall.args.label || "Open Calendar")
                      : toolCall.args.label || "Execute"
                    
                    const isExecuted = executedToolCalls.has(toolCall.id)
                    
                    return (
                      <Button
                        key={toolCall.id}
                        onClick={() => executeClientTool(toolCall)}
                        variant="outline"
                        size="sm"
                        className="w-full justify-start"
                        disabled={isLoading || isExecuted}
                      >
                        {isExecuted ? "✓ " + buttonLabel : buttonLabel}
                      </Button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
            )
          })}
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-lg bg-muted px-4 py-2">
              <div className="flex gap-1">
                <div className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-4">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message... (Press Enter to send, Shift+Enter for new line)"
            className="min-h-[60px] max-h-[120px] resize-none"
            disabled={isLoading}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="h-[60px] w-[60px] shrink-0"
          >
            <Send className="h-4 w-4" />
            <span className="sr-only">Send message</span>
          </Button>
        </div>
      </div>
    </aside>
  )
}
