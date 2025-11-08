import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CheckCircle, XCircle, MessageSquare, Clock, Check, X } from "lucide-react"
import type { Notification } from "@/lib/types"
import { cn } from "@/lib/utils"

interface NotificationPanelProps {
  notifications: Notification[]
  onNotificationClick: (notification: Notification) => void
  onMarkAsRead: (notificationId: string) => void
  onMarkAllAsRead: () => void
  onClose: () => void
}

export function NotificationPanel({
  notifications,
  onNotificationClick,
  onMarkAsRead,
  onMarkAllAsRead,
  onClose,
}: NotificationPanelProps) {
  const unreadCount = notifications.filter((n) => !n.read).length

  const getNotificationIcon = (type: Notification["type"]) => {
    switch (type) {
      case "post_approved":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "post_rejected":
        return <XCircle className="h-4 w-4 text-red-600" />
      case "comment_added":
        return <MessageSquare className="h-4 w-4 text-blue-600" />
      case "post_state_changed":
        return <Clock className="h-4 w-4 text-yellow-600" />
    }
  }

  const formatTime = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return "Just now"
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="flex h-full flex-col border-l border-border bg-card shadow-lg">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Notifications {unreadCount > 0 && `(${unreadCount})`}</h2>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={onMarkAllAsRead} className="h-7 text-xs">
              <Check className="mr-1 h-3 w-3" />
              Mark all read
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="rounded-full bg-muted p-3 mb-3">
              <Clock className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">No notifications</p>
            <p className="text-xs text-muted-foreground mt-1">You're all caught up!</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {notifications.map((notification) => (
              <button
                key={notification.id}
                onClick={() => {
                  onNotificationClick(notification)
                  if (!notification.read) {
                    onMarkAsRead(notification.id)
                  }
                }}
                className={cn(
                  "w-full px-4 py-3 text-left transition-colors hover:bg-muted/50",
                  !notification.read && "bg-primary/5",
                )}
              >
                <div className="flex gap-3">
                  <div className="mt-0.5 shrink-0">{getNotificationIcon(notification.type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground leading-relaxed">{notification.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatTime(notification.createdAt)}</p>
                  </div>
                  {!notification.read && <div className="mt-2 h-2 w-2 rounded-full bg-primary shrink-0" />}
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
