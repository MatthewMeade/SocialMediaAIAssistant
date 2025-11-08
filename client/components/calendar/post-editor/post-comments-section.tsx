import { useState } from "react"
import { Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar } from "@/components/ui/avatar"
import { formatTime } from "./utils"
import type { Post, Comment } from "@/lib/types"

interface PostCommentsSectionProps {
  post: Post
  onAddComment: (content: string) => void
}

export function PostCommentsSection({ post, onAddComment }: PostCommentsSectionProps) {
  const [newComment, setNewComment] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (newComment.trim()) {
      onAddComment(newComment)
      setNewComment("")
    }
  }

  const getCommentStats = () => {
    const comments = post.comments || []
    const inboxComments = comments.filter((c: any) => c.sentiment !== undefined)
    return { total: inboxComments.length }
  }

  const commentStats = getCommentStats()
  const teamComments = (post.comments || []).filter((c: any) => !c.sentiment)

  return (
    <>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">
            Team Comments {commentStats.total > 0 && `(${commentStats.total})`}
          </h3>
        </div>

        <div className="space-y-3">
          {teamComments.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No team comments yet</p>
          ) : (
            teamComments.map((comment: Comment) => (
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

      <form onSubmit={handleSubmit} className="border-t border-border p-4 space-y-2 shrink-0">
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
  )
}

