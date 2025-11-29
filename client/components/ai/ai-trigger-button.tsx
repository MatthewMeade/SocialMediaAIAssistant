import { Sparkles } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import type { VariantProps } from "class-variance-authority"
import { appEventBus } from "@/lib/event-bus"
import { AppEvents } from "@/lib/events"
import { cn } from "@/lib/utils"

type AITriggerButtonProps = React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & {
  message: string | (() => string) // Static string or dynamic generator
  shouldClear?: boolean
  icon?: React.ElementType
}

export function AITriggerButton({ 
  message, 
  shouldClear = false, 
  className, 
  children,
  icon: Icon = Sparkles,
  onClick,
  ...props 
}: AITriggerButtonProps) {
  
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    
    const messageText = typeof message === "function" ? message() : message

    appEventBus.dispatch(AppEvents.TRIGGER_AI_CHAT, {
      message: messageText,
      shouldClear
    })

    if (onClick) {
      onClick(e)
    }
  }

  return (
    <Button 
      variant="ghost" 
      size="icon" 
      className={cn("text-primary hover:text-primary hover:bg-primary/10", className)}
      onClick={handleClick}
      title="Ask AI"
      {...props}
    >
      <Icon className="h-4 w-4" />
      {children && <span className="ml-2">{children}</span>}
    </Button>
  )
}

