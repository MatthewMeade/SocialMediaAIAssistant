import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"
import { Wand2 } from "lucide-react"

interface ImportRulesDialogProps {
  isOpen: boolean
  onClose: () => void
  onImport: (text: string) => Promise<void>
  isProcessing: boolean
}

export function ImportRulesDialog({
  isOpen,
  onClose,
  onImport,
  isProcessing,
}: ImportRulesDialogProps) {
  const [text, setText] = useState("")

  const handleImport = () => {
    if (text.trim()) {
      onImport(text)
    }
  }

  const handleClose = () => {
    if (!isProcessing) {
      setText("")
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Generate Rules from Text
          </DialogTitle>
          <DialogDescription>
            Paste your brand guidelines, style guide, or about page content below. AI will analyze it and extract actionable rules.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Textarea
            placeholder="Paste your brand documents here..."
            className="min-h-[300px] max-h-[400px] overflow-y-auto resize-none"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={isProcessing}
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!text.trim() || isProcessing}
            className="gap-2"
          >
            {isProcessing ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            {isProcessing ? "Analyzing..." : "Generate Rules"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

