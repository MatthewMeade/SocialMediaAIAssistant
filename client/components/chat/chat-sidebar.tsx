import { useState, useRef, useEffect, useCallback } from "react"
import type React from "react"
import { useNavigate, useParams } from "react-router-dom"
import { X, Send, Sparkles, Check, Calendar, FileText, Plus, RotateCcw, ThumbsUp, ThumbsDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { apiFetch } from "@/lib/api-client"
import { appEventBus } from "@/lib/event-bus"
import { AppEvents, ToolNames, TriggerAIChatPayload } from "@/lib/events"
import { ApiRoutes } from "@/lib/api-routes"
import { useAppContext } from "@/components/layout/app-layout"
import ReactMarkdown from "react-markdown"
import { langfuseWeb } from "@/lib/langfuse"
import { FeedbackDialog } from "./feedback-dialog"
import { useAppEvent } from "@/hooks/use-app-event"
import { useChatStream } from "@/hooks/use-chat-stream"

interface Message {
  role: "user" | "assistant" | "tool"
  content: string
  toolCalls?: ToolCall[]
  tool_call_id?: string
  name?: string
  traceId?: string
  feedbackStatus?: "submitted" | null
}

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
}

interface ToolCallUIProps {
  toolCall: ToolCall
  isExecuted: boolean
  isLoading: boolean
  onExecute: (toolCall: ToolCall) => void
  aiMessage?: string
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
    } catch (error) {
      console.debug('Invalid date format:', date, error)
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

const TOOL_CALL_MESSAGES: Record<string, string> = {
  [ToolNames.CREATE_POST]: "Let's get started! Click the button below to create and open the post editor.",
  [ToolNames.OPEN_POST]: "I'll help you open that post. Click the button below to view it in the editor.",
  [ToolNames.APPLY_CAPTION]: "I've generated a caption for your post. Review it below and click to apply it to your post.",
  [ToolNames.NAVIGATE]: "Let me take you to your calendar. Click the button below to navigate there.",
}

const toolComponentMap: Record<string, React.ComponentType<ToolCallUIProps>> = {
  [ToolNames.APPLY_CAPTION]: CaptionSuggestionCard,
  [ToolNames.CREATE_POST]: CreatePostCard,
  [ToolNames.OPEN_POST]: OpenPostCard,
  [ToolNames.NAVIGATE]: NavigationButton,
}

function ToolCallRenderer({ toolCall, isExecuted, isLoading, onExecute, aiMessage }: ToolCallUIProps) {
  const CardComponent = toolComponentMap[toolCall.name] || GenericToolCard

  const message = TOOL_CALL_MESSAGES[toolCall.name] || aiMessage

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
  const { clientContext } = useAppContext()

  const contextRef = useRef(clientContext)
  useEffect(() => {
    contextRef.current = clientContext
  }, [clientContext])

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

    if (initialDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, initialDelay))
    }

    const startTime = Date.now()

    while (Date.now() - startTime < maxWaitTime) {
      const currentContext = contextRef.current
      const result = checkFn(currentContext)

      if (result !== null && result !== undefined) {
        await new Promise(resolve => setTimeout(resolve, 50))
        return result
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval))
    }

    return checkFn(contextRef.current)
  }, [])

  const generateThreadId = (calendarId: string | null | undefined): string => {
    if (calendarId) {
      return `${calendarId}-${crypto.randomUUID()}`
    }
    return `default-${crypto.randomUUID()}`
  }

  const [threadId, setThreadId] = useState<string>(() => generateThreadId(clientContext.calendarId ?? undefined))

  const [streamingContent, setStreamingContent] = useState("")
  const [aiStatus, setAiStatus] = useState<string | null>(null)

  const { connect, disconnect } = useChatStream({
    threadId,
    onToken: (token) => setStreamingContent(prev => prev + token),
    onStatusChange: setAiStatus
  })

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hello! I'm your AI assistant. How can I help you with your social media content today?",
    },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false)
  const [targetTraceId, setTargetTraceId] = useState<string | null>(null)
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false)

  useEffect(() => {
    if (clientContext.calendarId) {
      setThreadId(generateThreadId(clientContext.calendarId))
    }
  }, [clientContext.calendarId])

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
    setStreamingContent("")
    setAiStatus(null)
    disconnect()
  }, [clientContext.calendarId, disconnect])
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

  const sendToolResult = useCallback(async (_toolCallId: string, _toolName: string, _result: string) => {
    const currentContext = contextRef.current
    const backendClientContext = {
      page: currentContext.page === 'postEditor' ? 'calendar' : currentContext.page,
      component: currentContext.page === 'postEditor' ? 'postEditor' : undefined,
      postId: currentContext.pageState?.postId || undefined,
      pageState: currentContext.pageState || undefined,
    }

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

    if (data.threadId && data.threadId !== threadId) {
      setThreadId(data.threadId)
    }

    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: data.response || "",
        toolCalls: data.toolCalls,
        traceId: data.traceId,
      },
    ])
  }, [threadId])

  const executeClientTool = useCallback(async (toolCall: ToolCall) => {
    if (executedToolCalls.has(toolCall.id)) {
      return
    }

    setExecutedToolCalls((prev) => new Set(prev).add(toolCall.id))
    
    setIsLoading(true)
    try {
      let result: string = ""

      switch (toolCall.name) {
        case ToolNames.NAVIGATE: {
          if (toolCall.name !== ToolNames.NAVIGATE) break
          const navigateArgs = toolCall.args as { label?: string; page?: string }
          appEventBus.dispatch(AppEvents.NAVIGATE_TO_CALENDAR, {
            label: navigateArgs.label,
          })

          if (calendarSlug) {
            navigate(`/${calendarSlug}/calendar`)
            result = "Navigated to calendar page"
          } else {
            result = "Navigation requested - please use the button"
          }
          break
        }

        case ToolNames.APPLY_CAPTION: {
          if (toolCall.name !== ToolNames.APPLY_CAPTION) break
          const applyCaptionArgs = toolCall.args as { postId: string; caption: string }
          const postId = clientContext.pageState?.postId || applyCaptionArgs.postId
          appEventBus.dispatch(AppEvents.APPLY_CAPTION, {
            postId: postId,
            caption: applyCaptionArgs.caption,
          })
          result = `Caption suggestion applied to post ${postId}`
          break
        }

        case ToolNames.CREATE_POST: {
          if (toolCall.name !== ToolNames.CREATE_POST) break
          const createPostArgs = toolCall.args as { date: string; label?: string }
          appEventBus.dispatch(AppEvents.CREATE_POST, {
            date: createPostArgs.date,
          })

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
          if (toolCall.name !== ToolNames.OPEN_POST) break
          const openPostArgs = toolCall.args as { postId: string; label?: string }
          appEventBus.dispatch(AppEvents.OPEN_POST, {
            postId: openPostArgs.postId,
          })
          result = `Open post requested for ${openPostArgs.postId}`
          break
        }

        default: {
          const _exhaustiveCheck: never = toolCall as never
          void _exhaustiveCheck
          throw new Error(`Unknown client-side tool: ${(toolCall as any).name}`)
        }
      }

      await sendToolResult(toolCall.id, toolCall.name, result)
    } catch (error) {
      console.error('Error executing tool call:', error)
      setExecutedToolCalls((prev) => {
        const newSet = new Set(prev)
        newSet.delete(toolCall.id)
        return newSet
      })
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

  const executeMessage = useCallback(async (msgContent: string) => {
    if (!msgContent.trim() || isLoading) return

    const userMessage: Message = { role: "user", content: msgContent.trim() }
    const newMessages = [...messages, userMessage]

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

    setMessages(newMessages)

    setStreamingContent("")
    setAiStatus("Thinking...")
    connect()
    
    setIsLoading(true)

    try {
      if (pendingToolCalls.length > 0) {
        setExecutedToolCalls((prev) => {
          const newSet = new Set(prev)
          pendingToolCalls.forEach((tc) => newSet.add(tc.id))
          return newSet
        })
      }

      const backendClientContext = {
        page: clientContext.page === 'postEditor' ? 'calendar' : clientContext.page,
        component: clientContext.page === 'postEditor' ? 'postEditor' : undefined,
        postId: clientContext.pageState?.postId || undefined,
        noteId: clientContext.pageState?.noteId || undefined,
        pageState: clientContext.pageState || undefined,
      }

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

      if (data.threadId && data.threadId !== threadId) {
        setThreadId(data.threadId)
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.response || "",
          toolCalls: data.toolCalls,
          traceId: data.traceId,
        },
      ])
    } catch (error) {
      console.error('Error sending chat message:', error)
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        },
      ])
    } finally {
      setIsLoading(false)
      setStreamingContent("")
      setAiStatus(null)
      disconnect()
    }
  }, [isLoading, messages, executedToolCalls, clientContext, threadId, connect, disconnect])

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return
    const msgContent = input.trim()
    setInput("")
    await executeMessage(msgContent)
  }, [input, isLoading, executeMessage])

  useAppEvent<TriggerAIChatPayload>(AppEvents.TRIGGER_AI_CHAT, (payload) => {
    const { message, shouldClear } = payload

    if (shouldClear) {
      startNewChat()
      setTimeout(() => executeMessage(message), 100)
    } else {
      executeMessage(message)
    }
  }, [startNewChat, executeMessage])

  const handlePositiveFeedback = async (traceId: string, index: number) => {
    setMessages((prev) =>
      prev.map((m, i) => (i === index ? { ...m, feedbackStatus: "submitted" } : m)),
    )

    try {
      await langfuseWeb.score({
        traceId: traceId,
        name: "user-feedback",
        value: 1,
        comment: "Thumbs up",
      })
    } catch (e) {
      console.error("Failed to send positive feedback", e)
    }
  }

  const onNegativeFeedbackClick = (traceId: string) => {
    setTargetTraceId(traceId)
    setFeedbackModalOpen(true)
  }

  const handleNegativeFeedbackSubmit = async (comment: string) => {
    if (!targetTraceId) return

    setIsSubmittingFeedback(true)
    try {
      await langfuseWeb.score({
        traceId: targetTraceId,
        name: "user-feedback",
        value: 0,
        comment: comment,
      })

      setMessages((prev) =>
        prev.map((m) =>
          m.traceId === targetTraceId ? { ...m, feedbackStatus: "submitted" } : m,
        ),
      )

      setFeedbackModalOpen(false)
      setTargetTraceId(null)
    } catch (e) {
      console.error("Error submitting feedback", e)
    } finally {
      setIsSubmittingFeedback(false)
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
          .filter((message) => message.role !== "tool")
          .map((message, index) => {
            const messageKey = message.toolCalls?.length 
              ? `msg-${message.toolCalls.map(tc => tc.id).join('-')}`
              : `msg-${index}-${message.role}-${message.content.substring(0, 20)}`
            
            return (
          <div
            key={messageKey}
            className={cn(
              "flex w-full group",
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
                      
                      {/* Feedback Controls */}
                      {message.role === "assistant" &&
                        message.traceId &&
                        !message.feedbackStatus && (
                          <div className="flex items-center justify-end gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-green-600"
                              onClick={() => handlePositiveFeedback(message.traceId!, index)}
                            >
                              <ThumbsUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-red-600"
                              onClick={() => onNegativeFeedbackClick(message.traceId!)}
                            >
                              <ThumbsDown className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}

                      {message.feedbackStatus === "submitted" && (
                        <p className="text-[10px] text-right text-muted-foreground mt-1">
                          Thanks for feedback!
                        </p>
                      )}
                    </div>
                  )}
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
                        aiMessage={undefined}
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
          <div className="flex w-full justify-start">
            <div className="max-w-[80%] rounded-lg px-4 py-2 bg-muted text-muted-foreground flex flex-col gap-2">
              {aiStatus && (
                <div className="flex items-center gap-2 text-xs font-medium text-primary/80 animate-pulse">
                  <Sparkles className="h-3 w-3" />
                  {aiStatus}
                </div>
              )}

              {streamingContent ? (
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
                    {streamingContent}
                  </ReactMarkdown>
                </div>
              ) : (
                !aiStatus && (
                  <div className="flex gap-1 h-6 items-center">
                    <div className="h-2 w-2 rounded-full bg-current animate-bounce" />
                    <div className="h-2 w-2 rounded-full bg-current animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="h-2 w-2 rounded-full bg-current animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                )
              )}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <FeedbackDialog
        isOpen={feedbackModalOpen}
        onClose={() => setFeedbackModalOpen(false)}
        onSubmit={handleNegativeFeedbackSubmit}
        isSubmitting={isSubmittingFeedback}
      />

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

