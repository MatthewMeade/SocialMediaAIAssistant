import { Clock, CheckCircle, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Post } from "@/lib/types"

interface PostStatusBadgeProps {
  status: Post["status"]
}

export function PostStatusBadge({ status }: PostStatusBadgeProps) {
  const statusConfig = {
    draft: { label: "Draft", icon: Clock, className: "bg-muted text-muted-foreground" },
    awaiting_approval: { label: "Awaiting Approval", icon: Clock, className: "bg-yellow-500/10 text-yellow-600" },
    approved: { label: "Approved", icon: CheckCircle, className: "bg-green-500/10 text-green-600" },
    rejected: { label: "Rejected", icon: XCircle, className: "bg-red-500/10 text-red-600" },
    published: { label: "Published", icon: CheckCircle, className: "bg-blue-500/10 text-blue-600" },
  }

  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <div
      className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium", config.className)}
    >
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </div>
  )
}

