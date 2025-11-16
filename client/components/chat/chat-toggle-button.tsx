import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ChatToggleButtonProps {
  onClick: () => void
  isOpen: boolean
}

export function ChatToggleButton({ onClick, isOpen }: ChatToggleButtonProps) {
  return (
    <Button
      onClick={onClick}
      size="icon"
      className={cn(
        "fixed bottom-6 right-6 z-[60] h-14 w-14 rounded-full shadow-lg transition-all hover:scale-110",
        isOpen && "bg-primary/90",
        isOpen && "hidden", // Hide button when chat is open
      )}
      aria-label={isOpen ? "Close AI chat" : "Open AI chat"}
    >
      <Sparkles className={cn("h-6 w-6 transition-transform", isOpen && "rotate-180")} />
    </Button>
  )
}

