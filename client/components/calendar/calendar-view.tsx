import { useState, useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { CalendarHeader } from "./calendar-header"
import { CalendarGrid } from "./calendar-grid"
import { PostEditor } from "./post-editor"
import { usePosts } from "@/lib/hooks/use-posts"
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

  const { posts = [], isLoading, createPost, updatePost, deletePost } = usePosts(calendarId)

  useEffect(() => {
    if (postToOpen) {
      const post = posts.find((p: Post) => p.id === postToOpen)
      if (post) {
        setSelectedPost(post)
        setIsEditorOpen(true)
        const params = new URLSearchParams(searchParams.toString())
        params.delete("post")
        navigate(`/${calendarSlug}/calendar?${params.toString()}`, { replace: true })
      }
    }
  }, [postToOpen, posts, searchParams, navigate, calendarSlug])

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
    setSelectedPost({
      id: "",
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
  }

  const handleEditPost = (post: Post) => {
    setSelectedPost(post)
    setIsEditorOpen(true)
  }

  const handleSavePost = async (post: Post) => {
    const oldPost = posts.find((p: Post) => p.id === post.id)

    if (post.id) {
      await updatePost.mutateAsync(post)
      setSelectedPost(post)
    } else {
      const newPost = await createPost.mutateAsync(post)
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
  }

  return (
    <div className="flex flex-col h-full">
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
