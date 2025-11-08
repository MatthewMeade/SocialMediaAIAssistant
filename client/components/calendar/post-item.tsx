import { cn } from "@/lib/utils"
import type { Post } from "@/lib/types"
import { Instagram, Twitter, Linkedin } from "lucide-react"

interface PostItemProps {
  post: Post
  onClick: () => void
}

export function PostItem({ post, onClick }: PostItemProps) {
  const time = post.date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })

  const platformIcons = {
    instagram: Instagram,
    twitter: Twitter,
    linkedin: Linkedin,
  }

  const Icon = platformIcons[post.platform]

  const statusColors = {
    draft: "border-l-muted-foreground",
    awaiting_approval: "border-l-yellow-500",
    approved: "border-l-green-500",
    rejected: "border-l-red-500",
    published: "border-l-blue-500",
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full rounded-md border border-border bg-card p-2 text-left transition-all hover:border-primary hover:shadow-sm",
        "flex items-start gap-2 border-l-4",
        statusColors[post.status],
      )}
    >
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-muted-foreground">{time}</div>
        <div className="mt-0.5 line-clamp-2 text-xs text-foreground">{post.caption || "No caption"}</div>
        {post.comments && post.comments.length > 0 && (
          <div className="mt-1 text-xs text-muted-foreground">
            {post.comments.length} {post.comments.length === 1 ? "comment" : "comments"}
          </div>
        )}
      </div>
    </button>
  )
}
