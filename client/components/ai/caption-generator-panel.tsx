import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { X, Sparkles, Check } from "lucide-react"
import { Card } from "@/components/ui/card"

interface CaptionGeneratorPanelProps {
  onApplyCaption: (caption: string) => void
  onClose: () => void
}

export function CaptionGeneratorPanel({ onApplyCaption, onClose }: CaptionGeneratorPanelProps) {
  const [topic, setTopic] = useState("")
  const [keywords, setKeywords] = useState("")
  const [tone, setTone] = useState("professional")
  const [generatedCaptions, setGeneratedCaptions] = useState<string[]>([])
  const [selectedCaption, setSelectedCaption] = useState<string | null>(null)

  const handleGenerate = () => {
    // Sample generated captions - will be replaced with AI later
    const sampleCaptions = [
      `🚀 Exciting update about ${topic || "our latest project"}! We've been working hard behind the scenes to bring you something special.\n\nKey highlights: ${keywords || "innovation, quality, excellence"}\n\nWhat do you think? Share your thoughts below! 👇\n\n#OurBrand #Innovation #Community`,

      `✨ Big news! ${topic || "Something amazing"} is here and we couldn't be more thrilled to share it with you.\n\nFocusing on: ${keywords || "growth, impact, results"}\n\nDrop a comment and let us know what you're most excited about! 💬\n\n#OurBrand #Innovation #Community`,

      `Hey everyone! 👋 We're excited to talk about ${topic || "this incredible opportunity"}.\n\n${keywords ? `Key points: ${keywords}` : "This is going to be game-changing!"}\n\nTag someone who needs to see this! 🎯\n\n#OurBrand #Innovation #Community`,
    ]

    setGeneratedCaptions(sampleCaptions)
    setSelectedCaption(null)
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
          <h3 className="text-sm font-semibold text-foreground">Caption Generator</h3>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="topic" className="text-xs">
              What's your post about?
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
              Keywords (comma separated)
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

          <Button onClick={handleGenerate} className="w-full gap-2" size="sm">
            <Sparkles className="h-4 w-4" />
            Generate Captions
          </Button>
        </div>

        {generatedCaptions.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-border">
            <h4 className="text-xs font-semibold text-foreground">Generated Captions</h4>
            {generatedCaptions.map((caption, index) => (
              <Card
                key={index}
                className={`p-3 cursor-pointer transition-all ${
                  selectedCaption === caption ? "border-primary bg-primary/5" : "hover:border-primary/50"
                }`}
                onClick={() => setSelectedCaption(caption)}
              >
                <div className="flex items-start gap-2">
                  <div
                    className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      selectedCaption === caption ? "border-primary bg-primary" : "border-muted-foreground"
                    }`}
                  >
                    {selectedCaption === caption && <Check className="h-3 w-3 text-primary-foreground" />}
                  </div>
                  <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed flex-1">{caption}</p>
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
