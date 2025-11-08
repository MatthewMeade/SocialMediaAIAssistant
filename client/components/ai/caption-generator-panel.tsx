import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { X, Sparkles, Check } from "lucide-react"
import { Card } from "@/components/ui/card"
import { useMutation } from "@tanstack/react-query"
import { apiPost } from "@/lib/api-client"
import type {
  CaptionGenerationResult,
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
  const [userInput, setUserInput] = useState("")
  const [generatedCaption, setGeneratedCaption] = useState<string | null>(null)
  const [captionScore, setCaptionScore] = useState<CaptionGenerationResult["score"]>(null)

  // Mutation for generating new captions
  const {
    mutate: generate,
    isPending: isGenerating,
  } = useMutation({
    mutationFn: (request: CaptionRequest) =>
      apiPost<CaptionGenerationResult>("/api/ai/generate-caption", {
        calendarId,
        request,
      }),
    onSuccess: (result) => {
      setGeneratedCaption(result.caption)
      setCaptionScore(result.score)
    },
    onError: (error) => {
      console.error("Error generating caption:", error)
    },
  })

  // Mutation for applying suggestions to existing caption
  const {
    mutate: applySuggestions,
    isPending: isApplying,
  } = useMutation({
    mutationFn: (data: {
      caption: string
      suggestions: string[]
      calendarId: string
    }) =>
      apiPost<{ newCaption: string }>("/api/ai/apply-suggestions", data),
    onSuccess: (result) => {
      setGeneratedCaption(result.newCaption)
      setCaptionScore(null) // No score returned from apply-suggestions
    },
    onError: (error) => {
      console.error("Error applying suggestions:", error)
    },
  })

  const handleGenerate = () => {
    if (existingCaption) {
      // Use apply-suggestions API when there's an existing caption
      // Convert user input into suggestions array
      const suggestions = userInput
        .split(/\n|,/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
      
      // If user didn't provide suggestions, use a default one
      if (suggestions.length === 0) {
        suggestions.push("Improve the caption")
      }

      applySuggestions({
        caption: existingCaption,
        suggestions,
        calendarId,
      })
    } else {
      // Use generate-caption API for new captions
      const requestData: CaptionRequest = {
        topic: userInput,
        keywords: [],
        tone: "professional",
      }
      generate(requestData)
    }
  }

  const isPending = isGenerating || isApplying

  const handleApply = () => {
    if (generatedCaption) {
      onApplyCaption(generatedCaption)
      onClose()
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            Caption Generator
          </h3>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="user-input" className="text-xs">
              {existingCaption
                ? "What would you like to change?"
                : "What's your post about?"}
            </Label>
            <Textarea
              id="user-input"
              placeholder={
                existingCaption
                  ? "e.g., Make it more professional, Add a call to action, Shorten the length..."
                  : "e.g., New product launch, Company milestone..."
              }
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              className="min-h-24 resize-none"
            />
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
              ? existingCaption
                ? "Applying changes..."
                : "Generating..."
              : existingCaption
                ? "Apply Changes"
                : "Generate Caption"}
          </Button>
        </div>

        {(isPending || generatedCaption) && (
          <div className="space-y-3 pt-4 border-t border-border">
            <h4 className="text-xs font-semibold text-foreground">
              {existingCaption ? "Updated Caption" : "Generated Caption"}
            </h4>
            {isPending && (
              <Card className="p-3 space-y-2 animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
              </Card>
            )}
            {generatedCaption && (
              <Card className="p-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                      {generatedCaption}
                    </p>
                  </div>
                  {captionScore && (
                    <div
                      className={cn(
                        "text-xs font-bold px-1.5 py-0.5 rounded-full shrink-0",
                        getScoreColor(captionScore.overall),
                      )}
                    >
                      {captionScore.overall}%
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>
        )}
      </div>

      {generatedCaption && (
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
