import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { X, Sparkles, Check } from "lucide-react"
import { Card } from "@/components/ui/card"
import { useMutation } from "@tanstack/react-query"
import { apiPost } from "@/lib/api-client"
import type {
  CaptionGenerationResult,
  GeneratedCaption,
} from "@/lib/types"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import { getScoreColor } from "../calendar/post-editor/utils"

interface CaptionGeneratorPanelProps {
  calendarId: string
  existingCaption?: string
  onApplyCaption: (caption: string) => void
  onClose: () => void
}

type CaptionRequest = {
  topic: string
  keywords: string[]
  tone: string
  existingCaption?: string
}

export function CaptionGeneratorPanel({
  calendarId,
  existingCaption,
  onApplyCaption,
  onClose,
}: CaptionGeneratorPanelProps) {
  const [topic, setTopic] = useState("")
  const [keywords, setKeywords] = useState("")
  const [tone, setTone] = useState("professional")
  const [generatedCaptions, setGeneratedCaptions] = useState<GeneratedCaption[]>([])
  const [selectedCaption, setSelectedCaption] = useState<string | null>(null)

  const {
    mutate: generate,
    isPending,
  } = useMutation({
    mutationFn: (request: CaptionRequest) =>
      apiPost<CaptionGenerationResult>("/api/ai/generate-caption", {
        calendarId,
        request,
      }),
    onSuccess: (result) => {
      setGeneratedCaptions(result.captions)
      setSelectedCaption(result.bestCaption)
    },
    onError: (error) => {
      console.error("Error generating captions:", error)
      // You could set an error state here
    },
  })

  const handleGenerate = () => {
    const requestData: CaptionRequest = {
      topic,
      keywords: keywords.split(",").filter((k) => k.trim()),
      tone,
      existingCaption: existingCaption || undefined,
    }
    generate(requestData)
  }

  const handleApply = () => {
    if (selectedCaption) {
      onApplyCaption(selectedCaption)
      onClose()
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            {existingCaption ? "Refine Caption" : "Caption Generator"}
          </h3>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="topic" className="text-xs">
              What's your post about? {existingCaption && "(Optional)"}
            </Label>
            <Input
              id="topic"
              placeholder="e.g., New product launch, Company milestone..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="h-9"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="keywords" className="text-xs">
              Keywords (comma separated) {existingCaption && "(Optional)"}
            </Label>
            <Input
              id="keywords"
              placeholder="e.g., innovation, quality, customer-focused"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              className="h-9"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tone" className="text-xs">
              Tone
            </Label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger id="tone" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="casual">Casual</SelectItem>
                <SelectItem value="enthusiastic">Enthusiastic</SelectItem>
                <SelectItem value="informative">Informative</SelectItem>
                <SelectItem value="inspirational">Inspirational</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleGenerate}
            className="w-full gap-2"
            size="sm"
            disabled={isPending}
          >
            {isPending ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {isPending
              ? "Generating..."
              : existingCaption
                ? "Refine Caption"
                : "Generate Captions"}
          </Button>
        </div>

        {(isPending || generatedCaptions.length > 0) && (
          <div className="space-y-3 pt-4 border-t border-border">
            <h4 className="text-xs font-semibold text-foreground">
              Generated Captions
            </h4>
            {isPending && (
              <Card className="p-3 space-y-2 animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
              </Card>
            )}
            {generatedCaptions.map((captionData, index) => (
              <Card
                key={index}
                className={cn(
                  "p-3 cursor-pointer transition-all",
                  selectedCaption === captionData.caption
                    ? "border-primary bg-primary/5"
                    : "hover:border-primary/50",
                )}
                onClick={() => setSelectedCaption(captionData.caption)}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0",
                      selectedCaption === captionData.caption
                        ? "border-primary bg-primary"
                        : "border-muted-foreground",
                    )}
                  >
                    {selectedCaption === captionData.caption && (
                      <Check className="h-3 w-3 text-primary-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                      {captionData.caption}
                    </p>
                  </div>
                  {captionData.score && (
                    <div
                      className={cn(
                        "text-xs font-bold px-1.5 py-0.5 rounded-full",
                        getScoreColor(captionData.score.overall),
                      )}
                    >
                      {captionData.score.overall}%
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {selectedCaption && (
        <div className="border-t border-border p-4 shrink-0">
          <Button onClick={handleApply} className="w-full gap-2" size="sm">
            <Check className="h-4 w-4" />
            Apply Caption
          </Button>
        </div>
      )}
    </div>
  )
}
