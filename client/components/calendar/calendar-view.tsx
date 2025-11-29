import { useState, useEffect, startTransition } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { CalendarHeader } from "./calendar-header"
import { CalendarGrid } from "./calendar-grid"
import { PostEditor } from "./post-editor"
import { usePosts } from "@/lib/hooks/use-posts"
import { useAppContext } from "@/components/layout/app-layout"
import { useAppEvent } from "@/hooks/use-app-event"
import { AppEvents } from "@/lib/events"
import { parseDate } from "./post-editor/utils"
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

  useEffect(() => {
    if (!isEditorOpen) {
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
    const newPost: Post = {
      id: tempId,
      calendarId,
      date,
      caption: "",
      images: [],
      platform: "instagram" as const,
      status: "draft" as const,
      authorId: currentUser.id,
      authorName: currentUser.name,
      comments: [],
    }
    
    try {
      const { id: _id, ...postWithoutId } = newPost
      const savedPost = await createPost.mutateAsync(postWithoutId)
      setSelectedPost(savedPost)
      setIsEditorOpen(true)
      setClientContext("postEditor", { postId: savedPost.id })
    } catch (error) {
      console.error("Failed to save post immediately:", error)
      setSelectedPost(newPost)
      setIsEditorOpen(true)
      setClientContext("postEditor", { postId: tempId })
    }
  }

  const handleEditPost = (post: Post) => {
    setSelectedPost(post)
    setIsEditorOpen(true)
    setClientContext("postEditor", { postId: post.id })
  }

  const handleSavePost = async (post: Post) => {
    if (post.id && post.id !== "") {
      await updatePost.mutateAsync(post)
      setSelectedPost(post)
    } else {
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
    setClientContext("calendar", {
      currentMonth: currentDate.getMonth(),
      currentYear: currentDate.getFullYear(),
    })
  }

  useAppEvent<{ date: string }>(
    AppEvents.CREATE_POST,
    (event) => {
      const targetDate = parseDate(event.date)
      handleAddPost(targetDate)
    },
    [],
  )

  useAppEvent<{ postId: string }>(
    AppEvents.OPEN_POST,
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
