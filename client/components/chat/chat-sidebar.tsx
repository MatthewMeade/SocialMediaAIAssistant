import { useState, useRef, useEffect, useCallback } from "react"
import type React from "react"
import { useNavigate, useParams } from "react-router-dom"
import { X, Send, Sparkles, Check, Calendar, FileText, Plus, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { apiFetch } from "@/lib/api-client"
import { appEventBus } from "@/lib/event-bus"
import { AppEvents, ToolNames } from "@/lib/events"
import { ApiRoutes } from "@/lib/api-routes"
import { useAppContext } from "@/components/layout/app-layout"
import ReactMarkdown from "react-markdown"

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
  aiMessage?: string // Optional AI message to display before the tool call
}

function CaptionSuggestionCard({ toolCall, isExecuted, isLoading, onExecute }: ToolCallUIProps) {
  if (toolCall.name !== "apply_caption_to_open_post") return null

  const { caption } = toolCall.args

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-1.5">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-medium">Caption Suggestion</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pb-1.5">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Suggested caption for your post:</p>
          <div className="rounded-md border bg-background p-2">
            <p className="text-sm whitespace-pre-wrap">{caption}</p>
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-0 px-1.5 pb-1.5">
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
      <CardContent className="p-1.5">
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
    } catch {
      // Invalid date, return original
    }
    return date
  })()

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-1.5">
        <div className="flex items-center gap-2">
          <Plus className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-medium">Create New Post</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pb-1.5">
        <p className="text-sm text-muted-foreground">
          Create a new post scheduled for <span className="font-medium text-foreground">{formattedDate}</span>
        </p>
      </CardContent>
      <CardFooter className="pt-0 px-1.5 pb-1.5">
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
      <CardHeader className="pb-1.5">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-medium">Open Post</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pb-1.5">
        <p className="text-sm text-muted-foreground">
          Open this post in the editor to view or edit it
        </p>
      </CardContent>
      <CardFooter className="pt-0 px-1.5 pb-1.5">
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
      <CardContent className="p-1.5">
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

// Client-side messages that appear above tool calls to guide the user
const TOOL_CALL_MESSAGES: Record<string, string> = {
  [ToolNames.CREATE_POST]: "Let's get started! Click the button below to create and open the post editor.",
  [ToolNames.OPEN_POST]: "I'll help you open that post. Click the button below to view it in the editor.",
  [ToolNames.APPLY_CAPTION]: "I've generated a caption for your post. Review it below and click to apply it to your post.",
  [ToolNames.NAVIGATE]: "Let me take you to your calendar. Click the button below to navigate there.",
}

// Lookup map for tool components - makes it easy to add new tools
const toolComponentMap: Record<string, React.ComponentType<ToolCallUIProps>> = {
  [ToolNames.APPLY_CAPTION]: CaptionSuggestionCard,
  [ToolNames.CREATE_POST]: CreatePostCard,
  [ToolNames.OPEN_POST]: OpenPostCard,
  [ToolNames.NAVIGATE]: NavigationButton,
}

function ToolCallRenderer({ toolCall, isExecuted, isLoading, onExecute, aiMessage }: ToolCallUIProps) {
  // Look up the component from the map, default to GenericToolCard if not found
  const CardComponent = toolComponentMap[toolCall.name] || GenericToolCard

  // Use client-side message if available, otherwise fall back to AI message
  const message = TOOL_CALL_MESSAGES[toolCall.name] || aiMessage

  // Show message above the tool call card if available
  if (message) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{message}</p>
        <CardComponent
          toolCall={toolCall}
          isExecuted={isExecuted}
          isLoading={isLoading}
          onExecute={onExecute}
        />
      </div>
    )
  }

  return (
    <CardComponent
      toolCall={toolCall}
      isExecuted={isExecuted}
      isLoading={isLoading}
      onExecute={onExecute}
    />
  )
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
  const waitForContext = useCallback(async <T,>(
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
  }, [])

  // Generate a new threadId when calendarId is available
  // Chats are ephemeral - threadId is only used for the current session
  const generateThreadId = (calendarId: string | null | undefined): string => {
    if (calendarId) {
      return `${calendarId}-${Date.now()}`
    }
    return `default-${Date.now()}`
  }

  const [threadId, setThreadId] = useState<string>(() => generateThreadId(clientContext.calendarId ?? undefined))

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hello! I'm your AI assistant. How can I help you with your social media content today?",
    },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  // Generate a new threadId when calendarId changes
  useEffect(() => {
    if (clientContext.calendarId) {
      setThreadId(generateThreadId(clientContext.calendarId))
    }
  }, [clientContext.calendarId])

  // Function to start a new chat session
  const startNewChat = useCallback(() => {
    setMessages([
      {
        role: "assistant",
        content: "Hello! I'm your AI assistant. How can I help you with your social media content today?",
      },
    ])
    setThreadId(generateThreadId(clientContext.calendarId ?? undefined))
    setExecutedToolCalls(new Set())
    setInput("")
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
   * Sends a tool execution result back to the agent.
   * With returnDirect: true, the tool result goes directly to the user, but we still need
   * to send a message so the agent knows the tool completed and can continue.
   * The memory store handles conversation history, so we just send the continuation message.
   */
  const sendToolResult = useCallback(async (_toolCallId: string, _toolName: string, _result: string) => {
    // Build the clientContext object from the AppContext
    // Use contextRef to get the latest context value (updated by useEffect)
    const currentContext = contextRef.current
    const backendClientContext = {
      page: currentContext.page === 'postEditor' ? 'calendar' : currentContext.page,
      component: currentContext.page === 'postEditor' ? 'postEditor' : undefined,
      postId: currentContext.pageState?.postId || undefined,
      pageState: currentContext.pageState || undefined,
    }

    // Send a continuation message - the backend's memory store will handle
    // loading the conversation history and processing the tool result
    const response = await apiFetch(ApiRoutes.AI.CHAT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: "The tool action has been completed. Please continue with the next step.",
        calendarId: contextRef.current.calendarId || '',
        threadId,
        clientContext: backendClientContext,
      }),
    })

    if (!response.ok) {
      throw new Error("Failed to send tool result")
    }

    const data = await response.json()

    // Update threadId from response if provided (backend may have generated one)
    if (data.threadId && data.threadId !== threadId) {
      setThreadId(data.threadId)
    }

    // Add the agent's continuation response
    // Note: We don't add the ToolMessage to UI state since the memory store
    // handles it internally and we filter out tool messages from display anyway
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: data.response || "",
        toolCalls: data.toolCalls,
      },
    ])
  }, [threadId])

  /**
   * Executes a client-side tool action by dispatching events via the event bus.
   * This is a "dumb" dispatcher - it doesn't contain logic specific to any tool.
   * Components subscribe to events and handle the logic themselves.
   */
  const executeClientTool = useCallback(async (toolCall: ToolCall) => {
    // Prevent multiple clicks
    if (executedToolCalls.has(toolCall.id)) {
      return
    }
    
    // Mark as executed immediately to prevent duplicate clicks
    setExecutedToolCalls((prev) => new Set(prev).add(toolCall.id))
    
    setIsLoading(true)
    try {
      let result: string = ""

      // Use a switch statement for better readability and type safety
      switch (toolCall.name) {
        case ToolNames.NAVIGATE: {
          // TypeScript narrows the type here
          if (toolCall.name !== ToolNames.NAVIGATE) break
          const navigateArgs = toolCall.args as { label?: string; page?: string }
      // Dispatch navigation event - the layout or appropriate component will handle it
          appEventBus.dispatch(AppEvents.NAVIGATE_TO_CALENDAR, {
            label: navigateArgs.label,
          })

          // Also handle navigation directly here as a fallback
          if (calendarSlug) {
            navigate(`/${calendarSlug}/calendar`)
            result = "Navigated to calendar page"
          } else {
            result = "Navigation requested - please use the button"
          }
          break
        }

        case ToolNames.APPLY_CAPTION: {
          // TypeScript narrows the type here
          if (toolCall.name !== ToolNames.APPLY_CAPTION) break
          const applyCaptionArgs = toolCall.args as { postId: string; caption: string }
        // Dispatch caption application event - PostEditor will handle it
        // Use postId from context if available (more reliable for new posts), otherwise use the one from tool call
          const postId = clientContext.pageState?.postId || applyCaptionArgs.postId
          appEventBus.dispatch(AppEvents.APPLY_CAPTION, {
            postId: postId,
            caption: applyCaptionArgs.caption,
          })
          result = `Caption suggestion applied to post ${postId}`
          break
        }

        case ToolNames.CREATE_POST: {
          // TypeScript narrows the type here
          if (toolCall.name !== ToolNames.CREATE_POST) break
          const createPostArgs = toolCall.args as { date: string; label?: string }
        // Dispatch post creation event - CalendarView will handle it
          appEventBus.dispatch(AppEvents.CREATE_POST, {
            date: createPostArgs.date,
          })

          // Wait for the post to be created and context to be updated with postId
          const postId = await waitForContext(
            (context) => context.pageState?.postId,
            { maxWaitTime: 5000, pollInterval: 100, initialDelay: 100 }
          )

          result = postId
            ? `Post created and opened (ID: ${postId})`
            : `Post creation requested for ${createPostArgs.date}`
          break
        }

        case ToolNames.OPEN_POST: {
          // TypeScript narrows the type here
          if (toolCall.name !== ToolNames.OPEN_POST) break
          const openPostArgs = toolCall.args as { postId: string; label?: string }
        // Dispatch post open event - CalendarView will handle it
          appEventBus.dispatch(AppEvents.OPEN_POST, {
            postId: openPostArgs.postId,
          })
          result = `Open post requested for ${openPostArgs.postId}`
          break
        }

        default: {
          // This trick gives you a compile-time error if you
          // forget to handle a new tool type from your `ToolCall` discriminated union.
          const _exhaustiveCheck: never = toolCall as never
          void _exhaustiveCheck // Mark as intentionally unused
          throw new Error(`Unknown client-side tool: ${(toolCall as any).name}`)
        }
      }

      // Send tool result back to agent
      await sendToolResult(toolCall.id, toolCall.name, result)
    } catch (error) {
      console.error('Error executing tool call:', error)
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
  }, [executedToolCalls, clientContext, calendarSlug, navigate, sendToolResult, waitForContext])

  /**
   * Handles sending a user message to the agent.
   * Updates UI optimistically, then adds the agent's response when it arrives.
   * If there are pending tool calls, sends cancellation ToolMessages for them.
   */
  const handleSend = useCallback(async () => {
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
      // Mark pending tool calls as cancelled (they'll be ignored by the memory store)
      // The memory store handles conversation history, so we don't need to send it
      if (pendingToolCalls.length > 0) {
        setExecutedToolCalls((prev) => {
          const newSet = new Set(prev)
          pendingToolCalls.forEach((tc) => newSet.add(tc.id))
          return newSet
        })
      }

      // Build the clientContext object from the AppContext
      // The backend expects: { page?, component?, postId?, noteId?, pageState? }
      const backendClientContext = {
        page: clientContext.page === 'postEditor' ? 'calendar' : clientContext.page,
        component: clientContext.page === 'postEditor' ? 'postEditor' : undefined,
        postId: clientContext.pageState?.postId || undefined,
        noteId: clientContext.pageState?.noteId || undefined,
        pageState: clientContext.pageState || undefined,
      }

      // Send only the current user message - the memory store handles conversation history
      const response = await apiFetch(ApiRoutes.AI.CHAT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: userMessage.content,
          calendarId: clientContext.calendarId || '',
          threadId,
          clientContext: backendClientContext,
        }),
      })

      if (!response.ok) {
        throw new Error("Request failed")
      }

      const data = await response.json()
      
      // Update threadId from response if provided (backend may have generated one)
      if (data.threadId && data.threadId !== threadId) {
        setThreadId(data.threadId)
      }

      // Add agent's response (may include tool calls for client-side execution)
      // Include the response content even when tool calls are present, so the AI can provide context
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.response || "",
          toolCalls: data.toolCalls,
        },
      ])
    } catch (error) {
      console.error('Error sending chat message:', error)
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
  }, [input, isLoading, messages, executedToolCalls, clientContext, threadId])

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
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={startNewChat}
            title="Start new chat"
            disabled={isLoading}
          >
            <RotateCcw className="h-4 w-4" />
            <span className="sr-only">Start new chat</span>
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="h-4 w-4" />
            <span className="sr-only">Close chat</span>
          </Button>
        </div>
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
                  {/* Show message content only if there are no tool calls */}
                  {/* When tool calls are present, the message will be shown by ToolCallRenderer */}
                  {(!message.toolCalls || message.toolCalls.length === 0) && message.content && (
                    <div className="text-sm">
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                          li: ({ children }) => <li className="ml-2">{children}</li>,
                          h1: ({ children }) => <h1 className="text-lg font-bold mb-2 mt-2 first:mt-0">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-base font-bold mb-2 mt-2 first:mt-0">{children}</h2>,
                          h3: ({ children }) => <h3 className="text-sm font-bold mb-1 mt-2 first:mt-0">{children}</h3>,
                          code: ({ children, className }) => {
                            const isInline = !className || !className.includes('language-')
                            return isInline ? (
                              <code className="bg-muted/50 px-1 py-0.5 rounded text-xs font-mono">{children}</code>
                            ) : (
                              <code className="text-xs font-mono">{children}</code>
                            )
                          },
                          pre: ({ children }) => (
                            <pre className="bg-muted/50 p-2 rounded text-xs font-mono overflow-x-auto mb-2 whitespace-pre">
                              {children}
                            </pre>
                          ),
                          blockquote: ({ children }) => (
                            <blockquote className="border-l-4 border-muted-foreground/30 pl-3 italic my-2">{children}</blockquote>
                          ),
                          a: ({ href, children }) => (
                            <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">
                              {children}
                            </a>
                          ),
                          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                          em: ({ children }) => <em className="italic">{children}</em>,
                          hr: () => <hr className="my-3 border-border" />,
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  )}
                  {/* Render tool calls with custom UI */}
              {message.toolCalls && message.toolCalls.length > 0 && (
                    <div className="flex flex-col gap-3">
                      {message.toolCalls.map((toolCall) => {
                    const isExecuted = executedToolCalls.has(toolCall.id)
                    
                    return (
                      <ToolCallRenderer
                        key={toolCall.id}
                        toolCall={toolCall}
                        isExecuted={isExecuted}
                        isLoading={isLoading}
                        onExecute={executeClientTool}
                        aiMessage={undefined} // Don't pass AI message - we use client-side messages instead
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

