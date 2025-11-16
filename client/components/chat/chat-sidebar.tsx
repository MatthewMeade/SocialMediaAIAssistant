import { useState, useRef, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { X, Send, Sparkles, Check, Calendar, FileText, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { apiFetch } from "@/lib/api-client"
import { appEventBus } from "@/lib/event-bus"
import { useAppContext } from "@/components/layout/app-layout"

interface Message {
  role: "user" | "assistant" | "tool"
  content: string
  toolCalls?: ToolCall[]
  tool_call_id?: string
  name?: string
}

// Discriminated union for different tool call types
type ToolCall =
  | {
    id: string
    name: "navigate_to_calendar"
    args: {
      label?: string
      page?: string
    }
  }
  | {
    id: string
    name: "apply_caption_to_open_post"
    args: {
      postId: string
      caption: string
    }
  }
  | {
    id: string
    name: "create_post"
    args: {
      date: string
      label?: string
    }
  }
  | {
    id: string
    name: "open_post"
    args: {
      postId: string
      label?: string
    }
  }
  | {
    id: string
    name: string
    args: Record<string, any>
  }

interface ChatSidebarProps {
  isOpen: boolean
  onClose: () => void
  // No calendarId prop needed - it comes from context
}

// Custom UI components for different tool types
interface ToolCallUIProps {
  toolCall: ToolCall
  isExecuted: boolean
  isLoading: boolean
  onExecute: (toolCall: ToolCall) => void
}

function CaptionSuggestionCard({ toolCall, isExecuted, isLoading, onExecute }: ToolCallUIProps) {
  if (toolCall.name !== "apply_caption_to_open_post") return null

  const { caption } = toolCall.args
  const preview = caption.length > 150 ? caption.substring(0, 150) + "..." : caption

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-medium">Caption Suggestion</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Suggested caption for your post:</p>
          <div className="rounded-md border bg-background p-3">
            <p className="text-sm whitespace-pre-wrap">{preview}</p>
            {caption.length > 150 && (
              <p className="text-xs text-muted-foreground mt-2">
                {caption.length} characters total
              </p>
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-0">
        <Button
          onClick={() => onExecute(toolCall)}
          disabled={isLoading || isExecuted}
          className="w-full"
          size="sm"
        >
          {isExecuted ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              Caption Applied
            </>
          ) : (
            <>
              <FileText className="h-4 w-4 mr-2" />
              Apply Caption
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}

function NavigationButton({ toolCall, isExecuted, isLoading, onExecute }: ToolCallUIProps) {
  if (toolCall.name !== "navigate_to_calendar") return null

  const label = toolCall.args.label || "Open Calendar"

  return (
    <Card className="border-border">
      <CardContent className="p-4">
        <Button
          onClick={() => onExecute(toolCall)}
          disabled={isLoading || isExecuted}
          variant="outline"
          className="w-full justify-start"
          size="sm"
        >
          {isExecuted ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              {label}
            </>
          ) : (
            <>
              <Calendar className="h-4 w-4 mr-2" />
              {label}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}

function CreatePostCard({ toolCall, isExecuted, isLoading, onExecute }: ToolCallUIProps) {
  if (toolCall.name !== "create_post") return null

  const { date } = toolCall.args
  const formattedDate = (() => {
    if (!date) return "selected date"
    const lower = date.toLowerCase()
    if (lower === "today") return "today"
    if (lower === "tomorrow") return "tomorrow"
    try {
      const d = new Date(date)
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
      }
    } catch { }
    return date
  })()

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Plus className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-medium">Create New Post</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <p className="text-sm text-muted-foreground">
          Create a new post scheduled for <span className="font-medium text-foreground">{formattedDate}</span>
        </p>
      </CardContent>
      <CardFooter className="pt-0">
        <Button
          onClick={() => onExecute(toolCall)}
          disabled={isLoading || isExecuted}
          className="w-full"
          size="sm"
        >
          {isExecuted ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              Post Created
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              Create Post
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}

function OpenPostCard({ toolCall, isExecuted, isLoading, onExecute }: ToolCallUIProps) {
  if (toolCall.name !== "open_post") return null

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-medium">Open Post</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <p className="text-sm text-muted-foreground">
          Open this post in the editor to view or edit it
        </p>
      </CardContent>
      <CardFooter className="pt-0">
        <Button
          onClick={() => onExecute(toolCall)}
          disabled={isLoading || isExecuted}
          className="w-full"
          size="sm"
        >
          {isExecuted ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              Opened
            </>
          ) : (
            <>
              <FileText className="h-4 w-4 mr-2" />
              Open
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}

function GenericToolCard({ toolCall, isExecuted, isLoading, onExecute }: ToolCallUIProps) {
  return (
    <Card className="border-border">
      <CardContent className="p-4">
        <div className="space-y-2">
          <p className="text-sm font-medium">{toolCall.name}</p>
          <Button
            onClick={() => onExecute(toolCall)}
            disabled={isLoading || isExecuted}
            variant="outline"
            className="w-full"
            size="sm"
          >
            {isExecuted ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Done
              </>
            ) : (
              "Execute"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function ToolCallRenderer({ toolCall, isExecuted, isLoading, onExecute }: ToolCallUIProps) {
  if (toolCall.name === "apply_caption_to_open_post") {
    return <CaptionSuggestionCard toolCall={toolCall} isExecuted={isExecuted} isLoading={isLoading} onExecute={onExecute} />
  }
  if (toolCall.name === "create_post") {
    return <CreatePostCard toolCall={toolCall} isExecuted={isExecuted} isLoading={isLoading} onExecute={onExecute} />
  }
  if (toolCall.name === "open_post") {
    return <OpenPostCard toolCall={toolCall} isExecuted={isExecuted} isLoading={isLoading} onExecute={onExecute} />
  }
  if (toolCall.name === "navigate_to_calendar") {
    return <NavigationButton toolCall={toolCall} isExecuted={isExecuted} isLoading={isLoading} onExecute={onExecute} />
  }
  return <GenericToolCard toolCall={toolCall} isExecuted={isExecuted} isLoading={isLoading} onExecute={onExecute} />
}

export function ChatSidebar({ isOpen, onClose }: ChatSidebarProps) {
  const navigate = useNavigate()
  const { calendarSlug } = useParams()
  const { clientContext } = useAppContext() // 1. Read the full context

  // Use a ref to track the latest context value so we can poll it in async functions
  const contextRef = useRef(clientContext)
  useEffect(() => {
    contextRef.current = clientContext
  }, [clientContext])

  /**
   * Generic function to wait for a context value to appear.
   * Useful for waiting for async state updates (e.g., post creation, context updates).
   * 
   * @param checkFn Function that returns true when the condition is met
   * @param options Configuration options
   * @returns The value returned by checkFn when condition is met, or undefined if timeout
   */
  const waitForContext = async <T,>(
    checkFn: (context: typeof clientContext) => T | null | undefined,
    options: {
      maxWaitTime?: number
      pollInterval?: number
      initialDelay?: number
    } = {}
  ): Promise<T | null | undefined> => {
    const {
      maxWaitTime = 5000,
      pollInterval = 100,
      initialDelay = 100,
    } = options

    // Give React a moment to process events and start updating state
    if (initialDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, initialDelay))
    }

    const startTime = Date.now()

    while (Date.now() - startTime < maxWaitTime) {
      const currentContext = contextRef.current
      const result = checkFn(currentContext)

      if (result !== null && result !== undefined) {
        // Give it one more tick to ensure the update is fully propagated
        await new Promise(resolve => setTimeout(resolve, 50))
        return result
      }

      // Wait before checking again
      await new Promise(resolve => setTimeout(resolve, pollInterval))
    }

    // Timeout - return the last checked value
    return checkFn(contextRef.current)
  }

  // Initialize threadId with a stable value that doesn't depend on context
  // We'll update it when context is available
  const [threadId, setThreadId] = useState<string>(() => `default-${Date.now()}`)

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hello! I'm your AI assistant. How can I help you with your social media content today?",
    },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  // Update threadId when calendarId becomes available
  useEffect(() => {
    if (clientContext.calendarId) {
      setThreadId(`${clientContext.calendarId}-${Date.now()}`)
    }
  }, [clientContext.calendarId])
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
   * Executes a client-side tool action by dispatching events via the event bus.
   * This is a "dumb" dispatcher - it doesn't contain logic specific to any tool.
   * Components subscribe to events and handle the logic themselves.
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
      let result: string

      // Dispatch the appropriate event based on tool name
      // TypeScript will narrow the type based on the discriminated union
      if (toolCall.name === "navigate_to_calendar") {
        // Dispatch navigation event - the layout or appropriate component will handle it
        appEventBus.dispatch("navigate-to-calendar", {
          label: toolCall.args.label,
        })

        // Also handle navigation directly here as a fallback
        if (calendarSlug) {
          navigate(`/${calendarSlug}/calendar`)
          result = "Navigated to calendar page"
        } else {
          result = "Navigation requested - please use the button"
        }
      } else if (toolCall.name === "apply_caption_to_open_post") {
        // Dispatch caption application event - PostEditor will handle it
        // Use postId from context if available (more reliable for new posts), otherwise use the one from tool call
        const postId = clientContext.pageState?.postId || toolCall.args.postId
        appEventBus.dispatch("apply-caption", {
          postId: postId,
          caption: toolCall.args.caption,
        })
        result = `Caption suggestion applied to post ${postId}`
      } else if (toolCall.name === "create_post") {
        // Dispatch post creation event - CalendarView will handle it
        appEventBus.dispatch("create-post", {
          date: toolCall.args.date,
        })

        // Wait for the post to be created and context to be updated with postId
        const postId = await waitForContext(
          (context) => context.pageState?.postId,
          { maxWaitTime: 5000, pollInterval: 100, initialDelay: 100 }
        )

        result = postId
          ? `Post created and opened (ID: ${postId})`
          : `Post creation requested for ${toolCall.args.date}`
      } else if (toolCall.name === "open_post") {
        // Dispatch post open event - CalendarView will handle it
        appEventBus.dispatch("open-post", {
          postId: toolCall.args.postId,
        })
        result = `Open post requested for ${toolCall.args.postId}`
      } else {
        throw new Error(`Unknown client-side tool: ${toolCall.name}`)
      }

      // Send tool result back to agent
      await sendToolResult(toolCall.id, toolCall.name, result)
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

    // Build the clientContext object from the AppContext
    // Use contextRef to get the latest context value (updated by useEffect)
    const currentContext = contextRef.current
    const backendClientContext = {
      page: currentContext.page === 'postEditor' ? 'calendar' : currentContext.page,
      component: currentContext.page === 'postEditor' ? 'postEditor' : undefined,
      postId: currentContext.pageState?.postId || undefined,
      pageState: currentContext.pageState || undefined,
    }

    const response = await apiFetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: "",
        history: [...history, toolMessage],
        calendarId: contextRef.current.calendarId || '',
        threadId,
        clientContext: backendClientContext,
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

      // Build the clientContext object from the AppContext
      // The backend expects: { page?, component?, postId?, pageState? }
      const backendClientContext = {
        page: clientContext.page === 'postEditor' ? 'calendar' : clientContext.page,
        component: clientContext.page === 'postEditor' ? 'postEditor' : undefined,
        postId: clientContext.pageState?.postId || undefined,
        pageState: clientContext.pageState || undefined,
      }

      const response = await apiFetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: userMessage.content,
          history,
          calendarId: clientContext.calendarId || '', // 2. Send the calendarId from context
          threadId,
          clientContext: backendClientContext, // 3. Send the full context object
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
                  {/* Render tool calls with custom UI */}
              {message.toolCalls && message.toolCalls.length > 0 && (
                    <div className="flex flex-col gap-3 mt-3">
                      {message.toolCalls.map((toolCall) => {
                    const isExecuted = executedToolCalls.has(toolCall.id)
                    
                    return (
                      <ToolCallRenderer
                        key={toolCall.id}
                        toolCall={toolCall}
                        isExecuted={isExecuted}
                        isLoading={isLoading}
                        onExecute={executeClientTool}
                      />
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

