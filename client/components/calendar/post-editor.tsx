import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  X,
  Upload,
  Trash2,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Sparkles,
  ImageIcon,
} from "lucide-react"
import type { Post, User, Comment, BrandScore, BrandRule } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Avatar } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { BrandScorePanel } from "@/components/brand/brand-score-panel"
import { CaptionGeneratorPanel } from "@/components/ai/caption-generator-panel"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { apiGet, apiPost } from "@/lib/api-client"

interface PostEditorProps {
  post: Post
  currentUser: User
  onSave: (post: Post) => void
  onDelete: (postId: string) => void
  onClose: () => void
  brandRules: BrandRule[]
}

const calculateBrandScore = (caption: string, brandRules: BrandRule[]): BrandScore => {
  const enabledRules = brandRules.filter((rule) => rule.enabled)

  const hasEmojis = /[\u{1F300}-\u{1F9FF}]/u.test(caption)
  const hasCTA = /\b(share|comment|tag|tell us|let us know|drop|click|visit)\b/i.test(caption)
  const wordCount = caption.split(/\s+/).length
  const hasHashtags = /#OurBrand|#Innovation|#Community/i.test(caption)
  const isCasual = !/\b(utilize|leverage|synergy|paradigm)\b/i.test(caption)

  const ruleScores = enabledRules.map((rule) => {
    if (rule.id === "1" || rule.title.toLowerCase().includes("conversational")) {
      return {
        ruleId: rule.id,
        score: isCasual ? 90 : 45,
        feedback: isCasual
          ? "Great! Your tone is friendly and conversational."
          : "Try using simpler, more conversational language.",
      }
    } else if (rule.id === "2" || rule.title.toLowerCase().includes("emoji")) {
      return {
        ruleId: rule.id,
        score: hasEmojis ? 95 : 30,
        feedback: hasEmojis ? "Perfect emoji usage!" : "Consider adding 2-3 relevant emojis to increase engagement.",
      }
    } else if (
      rule.id === "3" ||
      rule.title.toLowerCase().includes("call-to-action") ||
      rule.title.toLowerCase().includes("cta")
    ) {
      return {
        ruleId: rule.id,
        score: hasCTA ? 85 : 40,
        feedback: hasCTA
          ? "Good call-to-action present."
          : "Add a question or prompt to encourage audience interaction.",
      }
    } else if (
      rule.id === "4" ||
      rule.title.toLowerCase().includes("concise") ||
      rule.title.toLowerCase().includes("word")
    ) {
      return {
        ruleId: rule.id,
        score: wordCount <= 150 ? 100 : Math.max(0, 100 - (wordCount - 150) * 2),
        feedback:
          wordCount <= 150
            ? "Perfect length!"
            : `Your post is ${wordCount} words. Try to keep it under 150 for better engagement.`,
      }
    } else if (rule.id === "5" || rule.title.toLowerCase().includes("hashtag")) {
      return {
        ruleId: rule.id,
        score: hasHashtags ? 90 : 35,
        feedback: hasHashtags
          ? "Brand hashtags included!"
          : "Don't forget to add our brand hashtags: #OurBrand #Innovation #Community",
      }
    } else {
      return {
        ruleId: rule.id,
        score: 75,
        feedback: "This rule is being evaluated.",
      }
    }
  })

  const overall =
    ruleScores.length > 0 ? Math.round(ruleScores.reduce((sum, r) => sum + r.score, 0) / ruleScores.length) : 0

  const suggestions = []
  if (enabledRules.some((r) => r.title.toLowerCase().includes("emoji")) && !hasEmojis) {
    suggestions.push("Add 2-3 relevant emojis to make your post more engaging")
  }
  if (
    enabledRules.some(
      (r) => r.title.toLowerCase().includes("call-to-action") || r.title.toLowerCase().includes("cta"),
    ) &&
    !hasCTA
  ) {
    suggestions.push("Include a call-to-action like 'What do you think?' or 'Share your experience'")
  }
  if (enabledRules.some((r) => r.title.toLowerCase().includes("hashtag")) && !hasHashtags) {
    suggestions.push("Add brand hashtags: #OurBrand #Innovation #Community")
  }
  if (
    enabledRules.some((r) => r.title.toLowerCase().includes("concise") || r.title.toLowerCase().includes("word")) &&
    wordCount > 150
  ) {
    suggestions.push("Shorten your post to under 150 words for better readability")
  }

  return { overall, rules: ruleScores, suggestions }
}

export function PostEditor({
  post,
  currentUser,
  onSave,
  onDelete,
  onClose,
  brandRules,
}: PostEditorProps) {
  const [editedPost, setEditedPost] = useState<Post>(post)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [newComment, setNewComment] = useState("")
  const [showBrandScore, setShowBrandScore] = useState(false)
  const [showCaptionGenerator, setShowCaptionGenerator] = useState(false)
  const [brandScore, setBrandScore] = useState<BrandScore>(calculateBrandScore(post.caption, brandRules))
  const [_replyingTo, setReplyingTo] = useState<string | null>(null) // Added state for replying to comments
  const [isUploading, setIsUploading] = useState(false)
  const [showMediaPicker, setShowMediaPicker] = useState(false)
  const [libraryMedia, setLibraryMedia] = useState<any[]>([])
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [showRemoteUpdate, setShowRemoteUpdate] = useState(false)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isInitialMount = useRef(true)
  const lastLocalUpdateRef = useRef<number>(Date.now())

  useEffect(() => {
    setEditedPost(post)
    setBrandScore(calculateBrandScore(post.caption, brandRules))
  }, [post, brandRules])

  useEffect(() => {
    setBrandScore(calculateBrandScore(editedPost.caption, brandRules))
  }, [editedPost.caption, brandRules])

  useEffect(() => {
    if (showMediaPicker && libraryMedia.length === 0) {
      loadLibraryMedia()
    }
  }, [showMediaPicker])

  const handleDateTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = new Date(e.target.value)
    setEditedPost({ ...editedPost, date: newDate })
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    const uploadedUrls: string[] = []

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("calendarId", editedPost.calendarId)

        const data = await apiPost<{ url: string }>("/api/upload", formData)
        uploadedUrls.push(data.url)
      }

      setEditedPost({ ...editedPost, images: [...editedPost.images, ...uploadedUrls] })
    } catch (error) {
      console.error("[v0] Error uploading images:", error)
      alert("Failed to upload images. Please try again.")
    } finally {
      setIsUploading(false)
    }
  }

  const handleRemoveImage = (index: number) => {
    const newImages = editedPost.images.filter((_, i) => i !== index)
    setEditedPost({ ...editedPost, images: newImages })
    if (currentImageIndex >= newImages.length && newImages.length > 0) {
      setCurrentImageIndex(newImages.length - 1)
    }
  }

  const loadLibraryMedia = async () => {
    setIsLoadingLibrary(true)
    try {
      const calendarId = editedPost.calendarId
      if (!calendarId) return

      try {
        const data = await apiGet<Array<{ id: string; url: string; filename: string }>>(
          `/api/media?calendarId=${calendarId}`,
        )
        setLibraryMedia(data)
      } catch (error) {
        // Media endpoint may not exist yet, fail silently
        console.error("[v0] Error loading library media:", error)
      }
    } catch (error) {
      console.error("[v0] Error loading library media:", error)
    } finally {
      setIsLoadingLibrary(false)
    }
  }

  const handleSelectFromLibrary = (url: string) => {
    setEditedPost({ ...editedPost, images: [...editedPost.images, url] })
    setShowMediaPicker(false)
  }

  const formatDateTimeForInput = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    const hours = String(date.getHours()).padStart(2, "0")
    const minutes = String(date.getMinutes()).padStart(2, "0")
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault()
    if (newComment.trim()) {
      const comment: Comment = {
        id: Date.now().toString(),
        postId: editedPost.id,
        userId: currentUser.id,
        userName: currentUser.name,
        content: newComment,
        createdAt: new Date(),
      }
      const updatedPost = {
        ...editedPost,
        comments: [...editedPost.comments, comment],
      }
      setEditedPost(updatedPost)
      onSave(updatedPost)
      setNewComment("")
      setReplyingTo(null) // Clear replying state
    }
  }

  const formatTime = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return "Just now"
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString()
  }

  const handleSubmitForApproval = async () => {
    const updatedPost = { ...editedPost, status: "awaiting_approval" as const }
    setEditedPost(updatedPost)
    await onSave(updatedPost)
  }

  const handleApprove = async () => {
    const updatedPost = { ...editedPost, status: "approved" as const }
    setEditedPost(updatedPost)
    await onSave(updatedPost)
  }

  const handleReject = async () => {
    const updatedPost = { ...editedPost, status: "rejected" as const }
    setEditedPost(updatedPost)
    await onSave(updatedPost)
  }

  const handlePublishNow = async () => {
    const updatedPost = { ...editedPost, status: "published" as const }
    setEditedPost(updatedPost)
    await onSave(updatedPost)
  }

  const handleMoveToDraft = async () => {
    const updatedPost = { ...editedPost, status: "draft" as const }
    setEditedPost(updatedPost)
    await onSave(updatedPost)
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

    setEditedPost({ ...editedPost, caption: improvedCaption })
  }

  const handleApplyCaption = (caption: string) => {
    setEditedPost({ ...editedPost, caption })
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600"
    if (score >= 50) return "text-yellow-600"
    return "text-red-600"
  }

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return "bg-green-500"
    if (score >= 50) return "bg-yellow-500"
    return "bg-red-500"
  }

  const isPastDate = editedPost.date < new Date()
  const isAuthor = currentUser.id === editedPost.authorId

  const getStatusBadge = () => {
    const statusConfig = {
      draft: { label: "Draft", icon: Clock, className: "bg-muted text-muted-foreground" },
      awaiting_approval: { label: "Awaiting Approval", icon: Clock, className: "bg-yellow-500/10 text-yellow-600" },
      approved: { label: "Approved", icon: CheckCircle, className: "bg-green-500/10 text-green-600" },
      rejected: { label: "Rejected", icon: XCircle, className: "bg-red-500/10 text-red-600" },
      published: { label: "Published", icon: CheckCircle, className: "bg-blue-500/10 text-blue-600" },
    }

    const config = statusConfig[editedPost.status]
    const Icon = config.icon

    return (
      <div
        className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium", config.className)}
      >
        <Icon className="h-3.5 w-3.5" />
        {config.label}
      </div>
    )
  }

  // Unused helper functions - kept for potential future use
  // const getSentimentColor = (sentiment: string) => {
  //   switch (sentiment) {
  //     case "positive":
  //       return "text-green-600 bg-green-50 dark:bg-green-950/30"
  //     case "negative":
  //       return "text-red-600 bg-red-50 dark:bg-red-950/30"
  //     default:
  //       return "text-gray-600 bg-gray-50 dark:bg-gray-950/30"
  //   }
  // }

  // const getSentimentIcon = (sentiment: string) => {
  //   switch (sentiment) {
  //     case "positive":
  //       return <ThumbsUp className="h-3 w-3" />
  //     case "negative":
  //       return <ThumbsDown className="h-3 w-3" />
  //     default:
  //       return <Minus className="h-3 w-3" />
  //   }
  // }

  // const isInboxComment = (comment: any) => {
  //   return comment.sentiment !== undefined
  // }

  const getCommentStats = () => {
    const comments = editedPost.comments || []
    const inboxComments = comments.filter((c: any) => c.sentiment !== undefined)
    const positive = inboxComments.filter((c: any) => c.sentiment === "positive").length
    const negative = inboxComments.filter((c: any) => c.sentiment === "negative").length
    const neutral = inboxComments.filter((c: any) => c.sentiment === "neutral").length
    return { total: inboxComments.length, positive, negative, neutral }
  }

  const commentStats = getCommentStats()

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

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }

    const postId = editedPost.id

    if (!postId) return

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(async () => {
      console.log("[v0] Auto-saving post changes...")
      setIsSaving(true)
      lastLocalUpdateRef.current = Date.now()

      try {
        await onSave(editedPost)
        setLastSaved(new Date())
      } catch (error) {
        console.error("[v0] Error auto-saving:", error)
      } finally {
        setIsSaving(false)
      }
    }, 500)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [
    editedPost.id,
    editedPost.caption,
    editedPost.platform,
    editedPost.date,
    editedPost.images,
    editedPost.status,
    editedPost,
    onSave,
  ])

  useEffect(() => {
    if (post.id === editedPost.id && !saveTimeoutRef.current) {
      setEditedPost(post)
      setBrandScore(calculateBrandScore(post.caption, brandRules))
    }
  }, [post])

  useEffect(() => {
    // Skip if this is the initial mount
    if (isInitialMount.current) {
      return
    }

    // Skip if we just saved (within last 2 seconds) - this is our own update
    const timeSinceLastUpdate = Date.now() - lastLocalUpdateRef.current
    if (timeSinceLastUpdate < 2000) {
      return
    }

    // Check if the post has actually changed
    if (
      post.caption !== editedPost.caption ||
      post.platform !== editedPost.platform ||
      post.status !== editedPost.status ||
      post.date.getTime() !== editedPost.date.getTime() ||
      JSON.stringify(post.images) !== JSON.stringify(editedPost.images)
    ) {
      console.log("[v0] Received remote update for post")

      // Update the edited post with remote changes
      setEditedPost(post)
      setBrandScore(calculateBrandScore(post.caption, brandRules))

      // Show notification that remote changes were received
      setShowRemoteUpdate(true)
      setTimeout(() => setShowRemoteUpdate(false), 3000)
    }
  }, [post])

  const handleClose = () => {
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="relative w-full max-w-6xl h-[85vh] rounded-lg border border-border bg-card shadow-lg flex flex-col">
        <div className="flex items-center justify-between border-b border-border px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-foreground">{post.id ? "Edit Post" : "New Post"}</h2>
            {getStatusBadge()}
            {post.id && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {isSaving ? (
                  <>
                    <div className="h-2 w-2 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <span>Saving...</span>
                  </>
                ) : lastSaved ? (
                  <>
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <span>{formatLastSaved()}</span>
                  </>
                ) : null}
              </div>
            )}
            {showRemoteUpdate && (
              <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 dark:bg-blue-950/30 px-2 py-1 rounded-full animate-in fade-in slide-in-from-top-2">
                <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                <span>Updated by {post.authorName}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {post.id && isAuthor && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onDelete(post.id)} className="text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Post
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button variant="ghost" size="icon" onClick={handleClose} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {!isAuthor && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <span className="text-muted-foreground">Created by:</span>{" "}
                <span className="font-medium text-foreground">{editedPost.authorName}</span>
              </div>
            )}

            <div className="space-y-3">
              <Label>Images</Label>

              {editedPost.images.length > 0 && (
                <div className="relative w-full aspect-video rounded-lg border border-border overflow-hidden bg-muted">
                  <img
                    src={editedPost.images[currentImageIndex] || "/placeholder.svg"}
                    alt={`Image ${currentImageIndex + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {editedPost.images.length > 1 && (
                    <>
                      <button
                        onClick={() =>
                          setCurrentImageIndex((prev) => (prev === 0 ? editedPost.images.length - 1 : prev - 1))
                        }
                        className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 backdrop-blur-sm hover:bg-background"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() =>
                          setCurrentImageIndex((prev) => (prev === editedPost.images.length - 1 ? 0 : prev + 1))
                        }
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 backdrop-blur-sm hover:bg-background"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-background/80 px-3 py-1 text-xs backdrop-blur-sm">
                        {currentImageIndex + 1} / {editedPost.images.length}
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="flex gap-2 flex-wrap">
                {editedPost.images.map((image, index) => (
                  <div
                    key={index}
                    className={cn(
                      "group relative h-16 w-16 cursor-pointer overflow-hidden rounded-lg border-2 transition-all",
                      currentImageIndex === index ? "border-primary" : "border-border hover:border-primary/50",
                    )}
                    onClick={() => setCurrentImageIndex(index)}
                  >
                    <img
                      src={image || "/placeholder.svg"}
                      alt={`Thumbnail ${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemoveImage(index)
                      }}
                      className="absolute right-1 top-1 rounded-full bg-destructive p-1 text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}

                {editedPost.images.length === 0 ? (
                  <div className="flex gap-2 w-full">
                    <label className="flex flex-1 h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 transition-colors hover:border-primary hover:bg-muted/50">
                      {isUploading ? (
                        <>
                          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mb-2" />
                          <span className="text-sm text-muted-foreground">Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                          <span className="text-sm text-muted-foreground">Upload new</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageUpload}
                        className="hidden"
                        disabled={isUploading}
                      />
                    </label>
                    <button
                      onClick={() => setShowMediaPicker(true)}
                      className="flex flex-1 h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 transition-colors hover:border-primary hover:bg-muted/50"
                    >
                      <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">Choose from library</span>
                    </button>
                  </div>
                ) : (
                  <>
                    <label className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 transition-colors hover:border-primary hover:bg-muted/50">
                      {isUploading ? (
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      ) : (
                        <Upload className="h-5 w-5 text-muted-foreground" />
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageUpload}
                        className="hidden"
                        disabled={isUploading}
                      />
                    </label>
                    <button
                      onClick={() => setShowMediaPicker(true)}
                      className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 transition-colors hover:border-primary hover:bg-muted/50"
                    >
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="caption">Caption</Label>
              <div className="relative">
                <Textarea
                  id="caption"
                  placeholder="Write your post caption..."
                  value={editedPost.caption}
                  onChange={(e) => setEditedPost({ ...editedPost, caption: e.target.value })}
                  rows={8}
                  className="resize-none pr-12"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowCaptionGenerator(!showCaptionGenerator)}
                  className="absolute bottom-2 right-2 h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                  title="Generate caption with AI"
                >
                  <Sparkles className="h-4 w-4" />
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">{editedPost.caption.length} characters</div>
            </div>

            <button
              onClick={() => setShowBrandScore(!showBrandScore)}
              className="w-full rounded-lg border border-border bg-card p-4 hover:bg-accent transition-colors text-left"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <div>
                    <h4 className="text-sm font-medium text-foreground">Brand Voice Score</h4>
                    <p className="text-xs text-muted-foreground">Click to see detailed analysis</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className={cn("text-2xl font-bold", getScoreColor(brandScore.overall))}>
                      {brandScore.overall}%
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {brandScore.overall >= 80 ? "Excellent" : brandScore.overall >= 50 ? "Good" : "Needs work"}
                    </div>
                  </div>
                  <div className="relative h-12 w-12">
                    <svg className="h-12 w-12 -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="16" fill="none" className="stroke-muted" strokeWidth="3" />
                      <circle
                        cx="18"
                        cy="18"
                        r="16"
                        fill="none"
                        className={getScoreBgColor(brandScore.overall)}
                        strokeWidth="3"
                        strokeDasharray={`${brandScore.overall} 100`}
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </button>

          </div>

          <div className="w-80 border-l border-border bg-muted/20 flex flex-col min-h-0">
            {showCaptionGenerator ? (
              <CaptionGeneratorPanel
                onApplyCaption={handleApplyCaption}
                onClose={() => setShowCaptionGenerator(false)}
              />
            ) : showBrandScore ? (
              <BrandScorePanel
                score={brandScore}
                rules={brandRules}
                onApplySuggestions={handleApplySuggestions}
                onClose={() => setShowBrandScore(false)}
              />
            ) : (
              <>
                <div className="p-4 space-y-4 border-b border-border shrink-0">
                  <div className="space-y-2">
                    <Label htmlFor="platform" className="text-xs">
                      Platform
                    </Label>
                    <Select
                      value={editedPost.platform}
                      onValueChange={(value: "instagram" | "twitter" | "linkedin") =>
                        setEditedPost({ ...editedPost, platform: value })
                      }
                    >
                      <SelectTrigger id="platform" className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="instagram">Instagram</SelectItem>
                        <SelectItem value="twitter">Twitter</SelectItem>
                        <SelectItem value="linkedin">LinkedIn</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="datetime" className="text-xs">
                      Date & Time
                    </Label>
                    <Input
                      id="datetime"
                      type="datetime-local"
                      value={formatDateTimeForInput(editedPost.date)}
                      onChange={handleDateTimeChange}
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-2">
                    {editedPost.status === "draft" && (
                      <>
                        <Button onClick={handleSubmitForApproval} className="w-full gap-2" size="sm">
                          <Send className="h-3.5 w-3.5" />
                          Submit for Approval
                        </Button>
                      </>
                    )}

                    {editedPost.status === "awaiting_approval" && (
                      <>
                        <Button variant="destructive" onClick={handleReject} className="w-full gap-2" size="sm">
                          <XCircle className="h-3.5 w-3.5" />
                          Reject
                        </Button>
                        <Button onClick={handleApprove} className="w-full gap-2" size="sm">
                          <CheckCircle className="h-3.5 w-3.5" />
                          Approve
                        </Button>
                      </>
                    )}

                    {editedPost.status === "approved" && (
                      <Button onClick={handlePublishNow} className="w-full gap-2" size="sm">
                        <CheckCircle className="h-3.5 w-3.5" />
                        {isPastDate ? "Mark as Published" : "Publish Now"}
                      </Button>
                    )}

                    {editedPost.status === "rejected" && (
                      <Button onClick={handleMoveToDraft} className="w-full gap-2" size="sm">
                        Move to Draft
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">
                      Team Comments {commentStats.total > 0 && `(${commentStats.total})`}
                    </h3>
                  </div>

                  <div className="space-y-3">
                    {commentStats.total === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-8">No team comments yet</p>
                    ) : (
                      editedPost.comments
                        .filter((c: any) => !c.sentiment)
                        .map((comment: any) => (
                          <div key={comment.id} className="rounded-lg bg-background p-3 space-y-2">
                            <div className="flex gap-2">
                              <Avatar className="h-7 w-7 shrink-0 bg-primary/10 flex items-center justify-center">
                                <span className="text-xs font-medium text-primary">
                                  {comment.userName.charAt(0).toUpperCase()}
                                </span>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-medium text-foreground">{comment.userName}</span>
                                  <span className="text-xs text-muted-foreground">{formatTime(comment.createdAt)}</span>
                                </div>
                                <p className="mt-1 text-xs text-foreground whitespace-pre-wrap">{comment.content}</p>
                              </div>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </div>

                <form onSubmit={handleAddComment} className="border-t border-border p-4 space-y-2 shrink-0">
                  <Textarea
                    placeholder="Add a team comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={2}
                    className="resize-none text-sm"
                  />
                  <Button type="submit" size="sm" disabled={!newComment.trim()} className="w-full gap-2">
                    <Send className="h-3.5 w-3.5" />
                    Comment
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>

      <Dialog open={showMediaPicker} onOpenChange={setShowMediaPicker}>
        <DialogContent className="sm:max-w-[800px] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Choose from Library</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[60vh] py-4">
            {isLoadingLibrary ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : libraryMedia.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ImageIcon className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No media in library yet</p>
                <p className="text-sm text-muted-foreground mt-1">Upload files to see them here</p>
              </div>
            ) : (
              <div className="grid gap-4 grid-cols-3 md:grid-cols-4">
                {libraryMedia.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelectFromLibrary(item.url)}
                    className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-accent hover:shadow-lg transition-all hover:border-primary"
                  >
                    <img
                      src={item.url || "/placeholder.svg"}
                      alt={item.filename}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white text-sm font-medium">Select</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
