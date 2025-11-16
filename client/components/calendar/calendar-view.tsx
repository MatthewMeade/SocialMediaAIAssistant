import { useState, useEffect, startTransition } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { CalendarHeader } from "./calendar-header"
import { CalendarGrid } from "./calendar-grid"
import { PostEditor } from "./post-editor"
import { usePosts } from "@/lib/hooks/use-posts"
import { useAppContext } from "@/components/layout/app-layout"
import { useAppEvent } from "@/hooks/use-app-event"
// import { appEventBus } from "@/lib/event-bus" // Unused
import type { Post, User } from "@/lib/types"

interface CalendarViewProps {
  currentUser: User
  calendarId: string
  calendarSlug: string
  postToOpen?: string | null
}

export function CalendarView({ currentUser, calendarId, calendarSlug, postToOpen }: CalendarViewProps) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const { setClientContext } = useAppContext()

  const { posts = [], isLoading, createPost, updatePost, deletePost } = usePosts(calendarId)

  // 1. Set the page context when editor closes or when month changes (for RAG)
  // The AppLayout already calculates the base page from location
  // We only need to update when editor state or month changes
  useEffect(() => {
    if (!isEditorOpen) {
      // Clear any override and set back to calendar with current month
      setClientContext("calendar", {
        currentMonth: currentDate.getMonth(),
        currentYear: currentDate.getFullYear(),
      })
    }
  }, [isEditorOpen, setClientContext, currentDate])

  useEffect(() => {
    if (postToOpen) {
      const post = posts.find((p: Post) => p.id === postToOpen)
      if (post) {
        startTransition(() => {
          setSelectedPost(post)
          setIsEditorOpen(true)
          setClientContext("postEditor", { postId: post.id })
        })
        const params = new URLSearchParams(searchParams.toString())
        params.delete("post")
        navigate(`/${calendarSlug}/calendar?${params.toString()}`, { replace: true })
      }
    }
  }, [postToOpen, posts, searchParams, navigate, calendarSlug, setClientContext])

  const handlePreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))
  }

  const handleToday = () => {
    setCurrentDate(new Date())
  }

  const handleAddPost = async (date: Date) => {
    const tempId = `temp-${Date.now()}`
    const newPost = {
      id: tempId,
      calendarId,
      date,
      caption: "",
      images: [],
      platform: "instagram",
      status: "draft",
      authorId: currentUser.id,
      authorName: currentUser.name,
      comments: [],
    }
    
    // Save the post immediately so it has a real ID
    try {
      const { id: _id, ...postWithoutId } = newPost
      const savedPost = await createPost.mutateAsync(postWithoutId)
      setSelectedPost(savedPost)
      setIsEditorOpen(true)
      // Set context with the real post ID
      setClientContext("postEditor", { postId: savedPost.id })
    } catch (error) {
      // If save fails, still open editor with temp ID
      console.error("Failed to save post immediately:", error)
      setSelectedPost(newPost)
      setIsEditorOpen(true)
      setClientContext("postEditor", { postId: tempId })
    }
  }

  const handleEditPost = (post: Post) => {
    setSelectedPost(post)
    setIsEditorOpen(true)
    // 2. Set context to "postEditor" when modal opens
    setClientContext("postEditor", { postId: post.id })
  }

  const handleSavePost = async (post: Post) => {
    if (post.id && post.id !== "") {
      await updatePost.mutateAsync(post)
      setSelectedPost(post)
    } else {
      // For new posts, omit the id field
      const { id: _id, ...postWithoutId } = post
      const newPost = await createPost.mutateAsync(postWithoutId)
      setSelectedPost(newPost)
    }
  }

  const handleDeletePost = async (postId: string) => {
    await deletePost.mutateAsync(postId)
    setIsEditorOpen(false)
    setSelectedPost(null)
  }

  const handleCloseEditor = () => {
    setIsEditorOpen(false)
    setSelectedPost(null)
    // 3. Revert context back to "calendar" when modal closes
    setClientContext("calendar", {
      currentMonth: currentDate.getMonth(),
      currentYear: currentDate.getFullYear(),
    })
  }

  // Helper to parse date string (ISO, "today", "tomorrow", or day name)
  // Sets time to noon (12:00 PM) in local timezone to avoid timezone issues
  const parseDate = (dateStr: string): Date => {
    const lower = dateStr.toLowerCase().trim()
    
    // Helper to create a date at noon local time
    const createDateAtNoon = (year: number, month: number, day: number): Date => {
      const date = new Date(year, month, day, 12, 0, 0, 0)
      return date
    }
    
    if (lower === "today") {
      const today = new Date()
      return createDateAtNoon(today.getFullYear(), today.getMonth(), today.getDate())
    }
    
    if (lower === "tomorrow") {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      return createDateAtNoon(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate())
    }

    // Try to parse as ISO date (YYYY-MM-DD)
    // Parse manually to avoid timezone issues with new Date(dateStr)
    const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (isoMatch) {
      const [, year, month, day] = isoMatch
      return createDateAtNoon(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10))
    }

    // Try to parse as day name (e.g., "Monday", "monday")
    const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
    const dayIndex = dayNames.findIndex((day) => lower.includes(day))
    if (dayIndex !== -1) {
      const today = new Date()
      const currentDay = today.getDay()
      let daysUntil = dayIndex - currentDay
      if (daysUntil <= 0) {
        daysUntil += 7 // Next occurrence
      }
      const targetDate = new Date(today)
      targetDate.setDate(today.getDate() + daysUntil)
      return createDateAtNoon(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate())
    }

    // Default to today at noon if parsing fails
    const today = new Date()
    return createDateAtNoon(today.getFullYear(), today.getMonth(), today.getDate())
  }

  // Listen for create-post events from AI chat
  useAppEvent<{ date: string }>(
    "create-post",
    (event) => {
      const targetDate = parseDate(event.date)
      handleAddPost(targetDate)
    },
    [],
  )

  // Listen for open-post events from AI chat
  useAppEvent<{ postId: string }>(
    "open-post",
    (event) => {
      const post = posts.find((p: Post) => p.id === event.postId)
      if (post) {
        handleEditPost(post)
      }
    },
    [posts],
  )

  return (
    <div className="flex flex-col h-full relative">
      <CalendarHeader
        currentDate={currentDate}
        onPreviousMonth={handlePreviousMonth}
        onNextMonth={handleNextMonth}
        onToday={handleToday}
      />
      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">Loading posts...</p>
        </div>
      ) : (
        <CalendarGrid currentDate={currentDate} posts={posts} onAddPost={handleAddPost} onEditPost={handleEditPost} />
      )}
      {isEditorOpen && selectedPost && (
        <PostEditor
          post={selectedPost}
          currentUser={currentUser}
          onSave={handleSavePost}
          onDelete={handleDeletePost}
          onClose={handleCloseEditor}
        />
      )}
    </div>
  )
}
