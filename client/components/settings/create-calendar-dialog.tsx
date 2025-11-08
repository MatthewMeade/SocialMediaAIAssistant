import type React from "react"
import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface CreateCalendarDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreateCalendar: (data: { name: string; color: string }) => Promise<void>
}

const CALENDAR_COLORS = [
  "#3b82f6", // blue
  "#10b981", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
]

export function CreateCalendarDialog({ open, onOpenChange, onCreateCalendar }: CreateCalendarDialogProps) {
  const [name, setName] = useState("")
  const [color, setColor] = useState(CALENDAR_COLORS[0])
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (name && !isLoading) {
      setIsLoading(true)
      try {
        await onCreateCalendar({ name, color })
        setName("")
        setColor(CALENDAR_COLORS[0])
        onOpenChange(false)
      } catch (error) {
        console.error("Failed to create calendar:", error)
      } finally {
        setIsLoading(false)
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Calendar</DialogTitle>
          <DialogDescription>Create a new calendar to manage your social media posts.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="calendar-name">Calendar Name</Label>
            <Input
              id="calendar-name"
              placeholder="Instagram, Twitter, LinkedIn..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label>Calendar Color</Label>
            <div className="flex gap-2">
              {CALENDAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  disabled={isLoading}
                  className={`h-8 w-8 rounded-full transition-all disabled:opacity-50 ${
                    color === c ? "ring-2 ring-offset-2 ring-primary" : ""
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Calendar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
