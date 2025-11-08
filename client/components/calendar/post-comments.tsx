import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar } from "@/components/ui/avatar"
import { Send } from "lucide-react"
import type { Comment, User } from "@/lib/types"

interface PostCommentsProps {
  comments: Comment[]
  currentUser: User
  onAddComment: (content: string) => void
}

export function PostComments({ comments, onAddComment }: PostCommentsProps) {
  const [newComment, setNewComment] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (newComment.trim()) {
      onAddComment(newComment)
      setNewComment("")
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Comments {comments.length > 0 && `(${comments.length})`}
        </h3>
      </div>

      {/* Comments list */}
      <div className="space-y-3 max-h-64 overflow-y-auto">
        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No comments yet. Be the first to comment!</p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="flex gap-3 rounded-lg bg-muted/30 p-3">
              <Avatar className="h-8 w-8 shrink-0 bg-primary/10 flex items-center justify-center">
                <span className="text-xs font-medium text-primary">{comment.userName.charAt(0).toUpperCase()}</span>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium text-foreground">{comment.userName}</span>
                  <span className="text-xs text-muted-foreground">{formatTime(comment.createdAt)}</span>
                </div>
                <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">{comment.content}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add comment form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <Textarea
          placeholder="Add a comment..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          rows={3}
          className="resize-none"
        />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={!newComment.trim()} className="gap-2">
            <Send className="h-3.5 w-3.5" />
            Comment
          </Button>
        </div>
      </form>
    </div>
  )
}
