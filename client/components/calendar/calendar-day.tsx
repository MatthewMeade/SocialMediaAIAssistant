import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { PostItem } from "./post-item"
import type { Post } from "@/lib/types"
import { cn } from "@/lib/utils"

interface CalendarDayProps {
  date: Date
  isCurrentMonth: boolean
  posts: Post[]
  onAddPost: (date: Date) => void
  onEditPost: (post: Post) => void
}

export function CalendarDay({ date, isCurrentMonth, posts, onAddPost, onEditPost }: CalendarDayProps) {
  const isToday = date.toDateString() === new Date().toDateString()

  const isPast = date < new Date(new Date().setHours(0, 0, 0, 0))

  return (
    <div
      className={cn(
        "group relative flex min-h-[120px] flex-col border-b border-r border-border bg-card last:border-r-0",
        !isCurrentMonth && "bg-muted/20",
        isPast && isCurrentMonth && "bg-muted/10",
      )}
    >
      <div className="flex items-center justify-between border-b border-border/50 px-3 py-2">
        <span
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium",
            isToday && "bg-primary text-primary-foreground",
            !isToday && isCurrentMonth && "text-foreground",
            !isToday && !isCurrentMonth && "text-muted-foreground",
          )}
        >
          {date.getDate()}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={() => onAddPost(date)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 space-y-1 overflow-auto p-2">
        {posts.map((post) => (
          <PostItem key={post.id} post={post} onClick={() => onEditPost(post)} />
        ))}
      </div>
    </div>
  )
}
