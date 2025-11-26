import { Sparkles } from "lucide-react"
import { Button, ButtonProps } from "@/components/ui/button"
import { appEventBus } from "@/lib/event-bus"
import { AppEvents } from "@/lib/events"
import { cn } from "@/lib/utils"

interface AITriggerButtonProps extends ButtonProps {
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
  ...props 
}: AITriggerButtonProps) {
  
  const handleClick = (e: React.MouseEvent) => {
    // Prevent bubbling if used inside other clickable elements
    e.stopPropagation();
    
    // Resolve message if it's a function
    const messageText = typeof message === "function" ? message() : message;

    appEventBus.dispatch(AppEvents.TRIGGER_AI_CHAT, {
      message: messageText,
      shouldClear
    });

    if (props.onClick) {
      props.onClick(e);
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

