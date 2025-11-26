import { useState, useEffect, useRef, useCallback } from "react"
import type { Post, User, Comment } from "@/lib/types"
import { BrandScorePanel } from "@/components/brand/brand-score-panel"
import { useBrandScore } from "@/hooks/use-brand-score"
import { usePostAutoSave } from "@/hooks/use-post-auto-save"
import { useAppEvent } from "@/hooks/use-app-event"
import { normalizeDate } from "./utils"
import { PostEditorHeader } from "./post-editor-header"
import { PostImageGallery } from "./post-image-gallery"
import { PostCaptionEditor } from "./post-caption-editor"
import { PostBrandScoreCard } from "./post-brand-score-card"
import { PostSidebar } from "./post-sidebar"
import { useMutation } from "@tanstack/react-query"
import { apiPost } from "@/lib/api-client"
import { appEventBus } from "@/lib/event-bus"
import { AppEvents } from "@/lib/events"
import { ApiRoutes } from "@/lib/api-routes"

interface PostEditorProps {
  post: Post
  currentUser: User
  onSave: (post: Post) => void
  onDelete: (postId: string) => void
  onClose: () => void
}

export function PostEditor({
  post,
  currentUser,
  onSave,
  onDelete,
  onClose,
}: PostEditorProps) {
  const [editedPost, setEditedPost] = useState<Post>({
    ...post,
    date: normalizeDate(post.date),
  })
  const [showBrandScore, setShowBrandScore] = useState(false)

  const lastSyncedPostRef = useRef<string | null>(null)
  const lastSavedPostKeyRef = useRef<string | null>(null)
  const isInitialMount = useRef(true)

  // Helper to create a stable string representation of post for comparison
  const getPostKey = useCallback((p: Post) => {
    const postDate = p.date instanceof Date ? p.date : new Date(p.date)
    return JSON.stringify({
      id: p.id,
      caption: p.caption,
      platform: p.platform,
      status: p.status,
      date: postDate.getTime(),
      images: p.images,
    })
  }, [])

  // Track when we save so we can distinguish our own updates from remote ones
  const handleSaveWrapper = useCallback(async (postToSave: Post) => {
    lastSavedPostKeyRef.current = getPostKey(postToSave)
    await onSave(postToSave)
  }, [onSave, getPostKey])

  // Custom hooks
  const { brandScore, isFetchingScore, fetchScoreIfNeeded } = useBrandScore(
    editedPost.caption,
    editedPost.calendarId
  )
  const {
    isSaving,
    lastSaved,
    showRemoteUpdate,
    formatLastSaved,
    checkForRemoteUpdate,
  } = usePostAutoSave({
    post: editedPost,
    onSave: handleSaveWrapper,
  })

  // Mutation for applying suggestions
  const { mutate: applySuggestions, isPending: isApplyingSuggestions } =
    useMutation({
      mutationFn: (data: {
        caption: string
        suggestions: string[]
        calendarId: string
      }) => apiPost<{ newCaption: string }>(ApiRoutes.AI.APPLY_SUGGESTIONS, data),
      onSuccess: (data) => {
        handleUpdate({ caption: data.newCaption })
        // Trigger brand score fetch for the updated caption
        if (editedPost.calendarId) {
          fetchScoreIfNeeded(data.newCaption, editedPost.calendarId)
        }
      },
      onError: (error) => {
        console.error("Error applying suggestions:", error)
        // You could add a toast notification here
      },
    })

  // Dispatch event when post editor opens/closes
  useEffect(() => {
    // Dispatch open event when component mounts or post changes
    // Only dispatch if post has an ID (not a new post)
    if (post.id && post.id !== '') {
      appEventBus.dispatch(AppEvents.POST_EDITOR_OPEN, { postId: post.id })
    }

    return () => {
      // Dispatch close event when component unmounts
      if (post.id && post.id !== '') {
        appEventBus.dispatch(AppEvents.POST_EDITOR_CLOSE, {})
      }
    }
  }, [post.id])

  // Listen for caption application events from the AI chat
  useAppEvent<{ postId: string; caption: string }>(
    AppEvents.APPLY_CAPTION,
    (event) => {
      // Apply if this event is for the current post
      // For new posts, we accept any apply-caption event since there's only one post open
      // For existing posts, match by ID
      const isCurrentPost = event.postId === editedPost.id || 
                           editedPost.id.startsWith('temp-') ||
                           !editedPost.id // Also accept if post has no ID yet
      
      if (isCurrentPost) {
        handleUpdate({ caption: event.caption })
        // Trigger brand score fetch for the new caption
        if (editedPost.calendarId) {
          fetchScoreIfNeeded(event.caption, editedPost.calendarId)
        }
      }
    },
    [editedPost.id, editedPost.calendarId, fetchScoreIfNeeded],
  )

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      const normalizedPost = {
        ...post,
        date: normalizeDate(post.date),
      }
      setEditedPost(normalizedPost)
      lastSyncedPostRef.current = getPostKey(normalizedPost)
      lastSavedPostKeyRef.current = getPostKey(normalizedPost)
      return
    }

    const currentPostKey = getPostKey(post)
    
    // Skip if this is the same post we already have synced
    if (currentPostKey === lastSyncedPostRef.current) {
      return
    }

    // Check if this is our own save (the post key matches what we just saved)
    if (currentPostKey === lastSavedPostKeyRef.current) {
      // It's our own update, just sync the key without updating editedPost
      lastSyncedPostRef.current = currentPostKey
      lastSavedPostKeyRef.current = null // Clear after syncing
      return
    }

    // This is a remote update (not our own save)
    if (checkForRemoteUpdate(post)) {
      const normalizedPost = {
        ...post,
        date: normalizeDate(post.date),
      }
      setEditedPost(normalizedPost)
      lastSyncedPostRef.current = currentPostKey
      
      if (post.calendarId && post.caption) {
        fetchScoreIfNeeded(post.caption, post.calendarId)
      }
    } else {
      // Not a remote update, just sync the key
      lastSyncedPostRef.current = currentPostKey
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id, post.caption, post.platform, post.status, post.date, post.images])

  const handleUpdate = (updates: Partial<Post>) => {
    setEditedPost((prev) => ({ ...prev, ...updates }))
  }

  const handleStatusChange = async (status: Post["status"]) => {
    const updatedPost = { ...editedPost, status }
    setEditedPost(updatedPost)
    await onSave(updatedPost)
  }

  const handleAddComment = (content: string) => {
    const comment: Comment = {
      id: Date.now().toString(),
      postId: editedPost.id,
      userId: currentUser.id,
      userName: currentUser.name,
      content,
      createdAt: new Date(),
    }
    const updatedPost = {
      ...editedPost,
      comments: [...editedPost.comments, comment],
    }
    setEditedPost(updatedPost)
    onSave(updatedPost)
  }

  const handleApplySuggestions = () => {
    if (
      !brandScore ||
      !brandScore.suggestions ||
      brandScore.suggestions.length === 0
    )
      return

    applySuggestions({
      caption: editedPost.caption,
      suggestions: brandScore.suggestions,
      calendarId: editedPost.calendarId,
    })
  }

  const isAuthor = currentUser.id === editedPost.authorId

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="relative w-full max-w-6xl h-[85vh] rounded-lg border border-border bg-card shadow-lg flex flex-col">
        <PostEditorHeader
          post={editedPost}
          currentUser={currentUser}
          isSaving={isSaving}
          lastSaved={lastSaved}
          showRemoteUpdate={showRemoteUpdate}
          formatLastSaved={formatLastSaved}
          onDelete={onDelete}
          onClose={onClose}
        />

        <div className="flex flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {!isAuthor && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <span className="text-muted-foreground">Created by:</span>{" "}
                <span className="font-medium text-foreground">{editedPost.authorName}</span>
              </div>
            )}

            <PostImageGallery post={editedPost} onUpdate={handleUpdate} />

            <PostCaptionEditor
              caption={editedPost.caption}
              onCaptionChange={(caption) => {
                handleUpdate({ caption })
                // Trigger brand score recalculation when caption changes
                if (editedPost.calendarId && caption) {
                  fetchScoreIfNeeded(caption, editedPost.calendarId)
                }
              }}
            />

            <PostBrandScoreCard
              brandScore={brandScore}
              isFetchingScore={isFetchingScore}
              onToggle={() => setShowBrandScore(!showBrandScore)}
            />
          </div>

          {!showBrandScore && (
            <PostSidebar
              post={editedPost}
              currentUser={currentUser}
              onUpdate={handleUpdate}
              onStatusChange={handleStatusChange}
              onAddComment={handleAddComment}
            />
          )}

          {showBrandScore && brandScore && editedPost.calendarId && (
            <div className="w-80 border-l border-border bg-card flex flex-col min-h-0">
              <BrandScorePanel
                score={brandScore}
                calendarId={editedPost.calendarId}
                isLoading={isFetchingScore}
                isApplyingSuggestions={isApplyingSuggestions}
                onApplySuggestions={handleApplySuggestions}
                onClose={() => setShowBrandScore(false)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

