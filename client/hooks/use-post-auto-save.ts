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
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isInitialMount = useRef(true)
  const lastLocalUpdateRef = useRef<number>(Date.now())
  const lastSavedPostRef = useRef<string | null>(null)

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
      return
    }

    if (!post.id) return

    // Check if post actually changed from what we last saved
    const currentPostKey = getPostKey(post)
    if (currentPostKey === lastSavedPostRef.current) {
      return // No changes, don't save
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(async () => {
      const postKeyBeforeSave = getPostKey(post)
      
      console.log("[v0] Auto-saving post changes...")
      setIsSaving(true)
      lastLocalUpdateRef.current = Date.now()

      try {
        await onSave(post)
        setLastSaved(new Date())
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

