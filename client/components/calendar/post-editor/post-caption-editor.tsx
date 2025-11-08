import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface PostCaptionEditorProps {
  caption: string
  onCaptionChange: (caption: string) => void
  onOpenCaptionGenerator: () => void
}

export function PostCaptionEditor({
  caption,
  onCaptionChange,
  onOpenCaptionGenerator,
}: PostCaptionEditorProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="caption">Caption</Label>
      <div className="relative">
        <Textarea
          id="caption"
          placeholder="Write your post caption..."
          value={caption}
          onChange={(e) => onCaptionChange(e.target.value)}
          rows={8}
          className="resize-none pr-12"
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenCaptionGenerator}
          className="absolute bottom-2 right-2 h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
          title="Generate caption with AI"
        >
          <Sparkles className="h-4 w-4" />
        </Button>
      </div>
      <div className="text-xs text-muted-foreground">{caption.length} characters</div>
    </div>
  )
}

