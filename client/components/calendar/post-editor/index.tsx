import { useState, useEffect, useRef, useCallback } from "react"
import type { Post, User, Comment } from "@/lib/types"
import { BrandScorePanel } from "@/components/brand/brand-score-panel"
import { CaptionGeneratorPanel } from "@/components/ai/caption-generator-panel"
import { useBrandScore } from "@/hooks/use-brand-score"
import { usePostAutoSave } from "@/hooks/use-post-auto-save"
import { normalizeDate } from "./utils"
import { PostEditorHeader } from "./post-editor-header"
import { PostImageGallery } from "./post-image-gallery"
import { PostCaptionEditor } from "./post-caption-editor"
import { PostBrandScoreCard } from "./post-brand-score-card"
import { PostSidebar } from "./post-sidebar"

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
  const [showCaptionGenerator, setShowCaptionGenerator] = useState(false)

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

  // Sync editedPost with post prop on mount or when post.id changes
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
    let improvedCaption = editedPost.caption

    if (!/[\u{1F300}-\u{1F9FF}]/u.test(improvedCaption)) {
      improvedCaption = "✨ " + improvedCaption + " 🚀"
    }

    if (!/\b(share|comment|tag|tell us|let us know|drop|click|visit)\b/i.test(improvedCaption)) {
      improvedCaption += "\n\nWhat do you think? Share your thoughts below! 👇"
    }

    if (!/#OurBrand|#Innovation|#Community/i.test(improvedCaption)) {
      improvedCaption += "\n\n#OurBrand #Innovation #Community"
    }

    handleUpdate({ caption: improvedCaption })
  }

  const isAuthor = currentUser.id === editedPost.authorId

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
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
              onCaptionChange={(caption) => handleUpdate({ caption })}
              onOpenCaptionGenerator={() => setShowCaptionGenerator(true)}
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

          {showBrandScore && brandScore && (
            <div className="w-80 border-l border-border bg-card flex flex-col min-h-0">
              <BrandScorePanel
                score={brandScore}
                isLoading={isFetchingScore}
                onApplySuggestions={handleApplySuggestions}
                onClose={() => setShowBrandScore(false)}
              />
            </div>
          )}
        </div>
      </div>

      {showCaptionGenerator && (
        <CaptionGeneratorPanel
          onApplyCaption={(caption) => {
            handleUpdate({ caption })
            setShowCaptionGenerator(false)
          }}
          onClose={() => setShowCaptionGenerator(false)}
        />
      )}
    </div>
  )
}

