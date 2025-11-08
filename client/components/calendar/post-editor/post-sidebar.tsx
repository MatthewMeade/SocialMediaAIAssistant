import { Send, CheckCircle, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PostCommentsSection } from "./post-comments-section"
import { formatDateTimeForInput, normalizeDate } from "./utils"
import type { Post } from "@/lib/types"

interface PostSidebarProps {
  post: Post
  currentUser: { id: string; name: string; email: string }
  onUpdate: (updates: Partial<Post>) => void
  onStatusChange: (status: Post["status"]) => void
  onAddComment: (content: string) => void
}

export function PostSidebar({
  post,
  currentUser,
  onUpdate,
  onStatusChange,
  onAddComment,
}: PostSidebarProps) {
  const isPastDate = normalizeDate(post.date) < new Date()

  const handleDateTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = new Date(e.target.value)
    onUpdate({ date: newDate })
  }

  return (
    <div className="w-80 border-l border-border bg-muted/20 flex flex-col min-h-0">
      <div className="p-4 space-y-4 border-b border-border shrink-0">
        <div className="space-y-2">
          <Label htmlFor="platform" className="text-xs">
            Platform
          </Label>
          <Select
            value={post.platform}
            onValueChange={(value: "instagram" | "twitter" | "linkedin") =>
              onUpdate({ platform: value })
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
            value={formatDateTimeForInput(post.date)}
            onChange={handleDateTimeChange}
            className="h-9"
          />
        </div>

        <div className="space-y-2">
          {post.status === "draft" && (
            <Button onClick={() => onStatusChange("awaiting_approval")} className="w-full gap-2" size="sm">
              <Send className="h-3.5 w-3.5" />
              Submit for Approval
            </Button>
          )}

          {post.status === "awaiting_approval" && (
            <>
              <Button
                variant="destructive"
                onClick={() => onStatusChange("rejected")}
                className="w-full gap-2"
                size="sm"
              >
                <XCircle className="h-3.5 w-3.5" />
                Reject
              </Button>
              <Button onClick={() => onStatusChange("approved")} className="w-full gap-2" size="sm">
                <CheckCircle className="h-3.5 w-3.5" />
                Approve
              </Button>
            </>
          )}

          {post.status === "approved" && (
            <Button onClick={() => onStatusChange("published")} className="w-full gap-2" size="sm">
              <CheckCircle className="h-3.5 w-3.5" />
              {isPastDate ? "Mark as Published" : "Publish Now"}
            </Button>
          )}

          {post.status === "rejected" && (
            <Button onClick={() => onStatusChange("draft")} className="w-full gap-2" size="sm">
              Move to Draft
            </Button>
          )}
        </div>
      </div>

      <PostCommentsSection post={post} onAddComment={onAddComment} />
    </div>
  )
}

