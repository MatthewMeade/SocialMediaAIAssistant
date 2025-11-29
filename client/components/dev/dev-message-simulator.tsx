import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Sparkles } from "lucide-react"
import { apiPost } from "@/lib/api-client"
import { ApiRoutes } from "@/lib/api-routes"

interface DevMessageSimulatorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  calendarId: string
}

export function DevMessageSimulator({ open, onOpenChange, calendarId }: DevMessageSimulatorProps) {
  const [userName, setUserName] = useState("Test User")
  const [userEmail, setUserEmail] = useState("test@example.com")
  const [messageType, setMessageType] = useState<"comment" | "dm" | "mention">("comment")
  const [content, setContent] = useState("")
  const [platform, setPlatform] = useState<"instagram" | "twitter" | "linkedin">("instagram")
  const [sentiment, setSentiment] = useState<"positive" | "negative" | "neutral">("positive")
  const [postCaption, setPostCaption] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!content.trim() || !userName.trim()) return

    setIsSubmitting(true)
    try {
      await apiPost(ApiRoutes.INBOX, {
        calendar_id: calendarId,
        user_id: `dev_user_${Date.now()}`,
        user_name: userName,
        user_avatar: null,
        type: messageType,
        content,
        post_caption: messageType === "comment" ? postCaption || "Sample post" : null,
        platform,
        sentiment,
        sentiment_overridden: false,
        replied: false,
        liked: false,
      })

      setContent("")
      setPostCaption("")
      onOpenChange(false)
    } catch (error) {
      console.error("Failed to create message:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Dev: Simulate Incoming Message
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="userName">User Name</Label>
            <Input
              id="userName"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Enter user name..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="userEmail">User Email</Label>
            <Input
              id="userEmail"
              type="email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              placeholder="Enter user email..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="messageType">Message Type</Label>
              <Select value={messageType} onValueChange={(v: any) => setMessageType(v)}>
                <SelectTrigger id="messageType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="comment">Comment</SelectItem>
                  <SelectItem value="dm">Direct Message</SelectItem>
                  <SelectItem value="mention">Mention</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="platform">Platform</Label>
              <Select value={platform} onValueChange={(v: any) => setPlatform(v)}>
                <SelectTrigger id="platform">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="twitter">Twitter</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sentiment">Sentiment</Label>
            <Select value={sentiment} onValueChange={(v: any) => setSentiment(v)}>
              <SelectTrigger id="sentiment">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="positive">Positive</SelectItem>
                <SelectItem value="neutral">Neutral</SelectItem>
                <SelectItem value="negative">Negative</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {messageType === "comment" && (
            <div className="space-y-2">
              <Label htmlFor="postCaption">Post Caption (optional)</Label>
              <Input
                id="postCaption"
                value={postCaption}
                onChange={(e) => setPostCaption(e.target.value)}
                placeholder="Enter post caption..."
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="content">Message Content</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter message content..."
              className="min-h-[100px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !content.trim() || !userName.trim()}>
            {isSubmitting ? "Creating..." : "Create Message"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
