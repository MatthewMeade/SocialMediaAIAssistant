import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Sparkles, Check, ImageIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { useMutation } from '@tanstack/react-query'
import { apiPost } from '@/lib/api-client'
import type { MediaItem } from '@/lib/types'
import { Spinner } from '@/components/ui/spinner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface ImageGeneratorPanelProps {
  calendarId: string
  postCaption: string
  isOpen: boolean
  onClose: () => void
  onImageGenerated: (mediaItem: MediaItem) => void
}

export function ImageGeneratorPanel({
  calendarId,
  postCaption,
  isOpen,
  onClose,
  onImageGenerated,
}: ImageGeneratorPanelProps) {
  const [prompt, setPrompt] = useState(postCaption)
  const [generatedMedia, setGeneratedMedia] = useState<MediaItem | null>(null)

  const {
    mutate: generate,
    isPending: isGenerating,
    error,
  } = useMutation({
    mutationFn: (newPrompt: string) =>
      apiPost<MediaItem>('/api/ai/generate-image', {
        calendarId,
        prompt: newPrompt,
      }),
    onSuccess: (mediaItem) => {
      setGeneratedMedia(mediaItem)
    },
    onError: (err) => {
      console.error('Error generating image:', err)
    },
  })

  const handleGenerate = () => {
    generate(prompt)
  }

  const handleApply = () => {
    if (generatedMedia) {
      onImageGenerated(generatedMedia)
      onClose()
    }
  }

  const handleClose = () => {
    setGeneratedMedia(null)
    setPrompt(postCaption)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Generate Image with AI
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="prompt">Prompt</Label>
            <Textarea
              id="prompt"
              placeholder="Describe the image you want to generate..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-32 resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Defaults to your post caption. Be descriptive!
            </p>
          </div>

          <Button
            onClick={handleGenerate}
            className="w-full gap-2"
            disabled={isGenerating}
          >
            {isGenerating ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {isGenerating ? 'Generating...' : 'Generate Image'}
          </Button>

          {isGenerating && (
            <div className="w-full aspect-square rounded-lg bg-muted border border-dashed flex items-center justify-center flex-col gap-2 animate-pulse">
              <ImageIcon className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Generating image...</p>
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive">
              Error: {error.message}
            </p>
          )}

          {generatedMedia && (
            <div className="space-y-3 pt-4 border-t border-border">
              <h4 className="text-sm font-medium text-foreground">
                Generated Image
              </h4>
              <Card className="overflow-hidden">
                <img
                  src={generatedMedia.url}
                  alt="AI generated"
                  className="w-full aspect-square object-cover"
                />
              </Card>
              <Button onClick={handleApply} className="w-full gap-2">
                <Check className="h-4 w-4" />
                Add Image to Post
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

