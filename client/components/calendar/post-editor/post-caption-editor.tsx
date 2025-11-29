import { AITriggerButton } from "@/components/ai/ai-trigger-button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface PostCaptionEditorProps {
  caption: string
  onCaptionChange: (caption: string) => void
}

export function PostCaptionEditor({
  caption,
  onCaptionChange,
}: PostCaptionEditorProps) {
  const getAIPrompt = () => {
    if (caption && caption.trim().length > 0) {
      return "Help me edit this post";
    }
    return "Help me create a caption for this post";
  };

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
        <div className="absolute bottom-2 right-2">
          <AITriggerButton 
            message={getAIPrompt}
            shouldClear={false}
            className="h-8 w-8"
          />
        </div>
      </div>
      <div className="text-xs text-muted-foreground">{caption.length} characters</div>
    </div>
  )
}

