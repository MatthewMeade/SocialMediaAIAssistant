import { X, MoreVertical, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { PostStatusBadge } from "./post-status-badge"
import type { Post, User } from "@/lib/types"

interface PostEditorHeaderProps {
  post: Post
  currentUser: User
  isSaving: boolean
  lastSaved: Date | null
  showRemoteUpdate: boolean
  formatLastSaved: () => string | null
  onDelete: (postId: string) => void
  onClose: () => void
}

export function PostEditorHeader({
  post,
  currentUser,
  isSaving,
  lastSaved,
  showRemoteUpdate,
  formatLastSaved,
  onDelete,
  onClose,
}: PostEditorHeaderProps) {
  const isAuthor = currentUser.id === post.authorId

  return (
    <div className="flex items-center justify-between border-b border-border px-6 py-4 shrink-0">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold text-foreground">{post.id ? "Edit Post" : "New Post"}</h2>
        <PostStatusBadge status={post.status} />
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
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

