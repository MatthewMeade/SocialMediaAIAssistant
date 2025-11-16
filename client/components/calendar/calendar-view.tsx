import { useState, useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { CalendarHeader } from "./calendar-header"
import { CalendarGrid } from "./calendar-grid"
import { PostEditor } from "./post-editor"
import { usePosts } from "@/lib/hooks/use-posts"
import { useAppContext } from "@/components/layout/app-layout"
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

  // 1. Set the page context when editor closes (no Effect needed for initial load)
  // The AppLayout already calculates the base page from location
  // We only need to update when editor state changes
  useEffect(() => {
    if (!isEditorOpen) {
      // Clear any override and set back to calendar
      setClientContext("calendar", {
        currentMonth: currentDate.getMonth(),
      })
    }
  }, [isEditorOpen, setClientContext, currentDate])

  useEffect(() => {
    if (postToOpen) {
      const post = posts.find((p: Post) => p.id === postToOpen)
      if (post) {
        setSelectedPost(post)
        setIsEditorOpen(true)
        setClientContext("postEditor", { postId: post.id })
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

  const handleAddPost = (date: Date) => {
    const tempId = `temp-${Date.now()}`
    setSelectedPost({
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
    })
    setIsEditorOpen(true)
    // 2. Set context to "postEditor" when modal opens
    setClientContext("postEditor", { postId: tempId })
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
      const { id, ...postWithoutId } = post
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
    })
  }

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
