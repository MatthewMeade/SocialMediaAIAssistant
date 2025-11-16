import { useState, useEffect, useRef } from "react"
import type { Post } from "@/lib/types"

interface UsePostAutoSaveOptions {
  post: Post
  onSave: (post: Post) => void
  debounceMs?: number
}

export function usePostAutoSave({ post, onSave, debounceMs = 500 }: UsePostAutoSaveOptions) {
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [showRemoteUpdate, setShowRemoteUpdate] = useState(false)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInitialMount = useRef(true)
  const lastLocalUpdateRef = useRef<number>(Date.now())
  const lastSavedPostRef = useRef<string | null>(null)
  const previousPostIdRef = useRef<string | null>(null)

  // Helper to create a stable string representation of post for comparison
  const getPostKey = (p: Post) => {
    const postDate = p.date instanceof Date ? p.date : new Date(p.date)
    return JSON.stringify({
      id: p.id,
      caption: p.caption,
      platform: p.platform,
      status: p.status,
      date: postDate.getTime(),
      images: p.images,
    })
  }

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      lastSavedPostRef.current = getPostKey(post)
      previousPostIdRef.current = post.id || null
      return
    }

    const currentPostKey = getPostKey(post)
    
    // If the post ID changed from empty to a real ID (new post was just created),
    // update the saved ref to the new key to prevent unnecessary saves
    const previousId = previousPostIdRef.current
    if ((!previousId || previousId === "") && post.id && post.id !== "") {
      // Post just got an ID after being created, update the saved ref
      lastSavedPostRef.current = currentPostKey
      previousPostIdRef.current = post.id
      return
    }
    
    // Update the previous ID ref
    previousPostIdRef.current = post.id || null

    // Check if post actually changed from what we last saved
    if (currentPostKey === lastSavedPostRef.current) {
      return // No changes, don't save
    }

    // For posts without an ID, we still want to save them (they'll be created)
    // The onSave handler should handle both create and update

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(async () => {
      const postKeyBeforeSave = getPostKey(post)
      
      console.log("[v0] Auto-saving post changes...", { postId: post.id, hasId: !!post.id })
      setIsSaving(true)
      lastLocalUpdateRef.current = Date.now()

      try {
        await onSave(post)
        setLastSaved(new Date())
        // Update with the current post key (which may have changed if it was a new post that got an ID)
        // The post prop will be updated by the parent component after save
        lastSavedPostRef.current = postKeyBeforeSave
      } catch (error) {
        console.error("[v0] Error auto-saving:", error)
      } finally {
        setIsSaving(false)
      }
    }, debounceMs)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [
    post.id,
    post.caption,
    post.platform,
    post.date,
    post.images,
    post.status,
    onSave,
  ])

  const formatLastSaved = () => {
    if (!lastSaved) return null
    const now = new Date()
    const diff = now.getTime() - lastSaved.getTime()
    const seconds = Math.floor(diff / 1000)

    if (seconds < 5) return "Saved just now"
    if (seconds < 60) return `Saved ${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    return `Saved ${minutes}m ago`
  }

  const checkForRemoteUpdate = (remotePost: Post) => {
    if (isInitialMount.current) {
      return false
    }

    const timeSinceLastUpdate = Date.now() - lastLocalUpdateRef.current
    if (timeSinceLastUpdate < 2000) {
      return false
    }

    const postDate = remotePost.date instanceof Date ? remotePost.date : new Date(remotePost.date)
    const editedPostDate = post.date instanceof Date ? post.date : new Date(post.date)
    
    const hasChanged = 
      remotePost.caption !== post.caption ||
      remotePost.platform !== post.platform ||
      remotePost.status !== post.status ||
      postDate.getTime() !== editedPostDate.getTime() ||
      JSON.stringify(remotePost.images) !== JSON.stringify(post.images)

    if (hasChanged) {
      setShowRemoteUpdate(true)
      setTimeout(() => setShowRemoteUpdate(false), 3000)
      return true
    }

    return false
  }

  return {
    isSaving,
    lastSaved,
    showRemoteUpdate,
    formatLastSaved,
    checkForRemoteUpdate,
  }
}

