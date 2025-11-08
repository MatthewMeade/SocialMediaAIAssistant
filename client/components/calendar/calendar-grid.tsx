import { CalendarDay } from "./calendar-day"
import type { Post } from "@/lib/types"

interface CalendarGridProps {
  currentDate: Date
  posts: Post[]
  onAddPost: (date: Date) => void
  onEditPost: (post: Post) => void
}

export function CalendarGrid({ currentDate, posts, onAddPost, onEditPost }: CalendarGridProps) {
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  // Get first day of month and number of days
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const daysInMonth = lastDay.getDate()
  const startingDayOfWeek = firstDay.getDay()

  // Get days from previous month to fill the grid
  const previousMonth = new Date(year, month, 0)
  const daysInPreviousMonth = previousMonth.getDate()

  // Calculate total cells needed
  const totalCells = Math.ceil((daysInMonth + startingDayOfWeek) / 7) * 7

  const days = []

  // Previous month days
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    days.push({
      date: new Date(year, month - 1, daysInPreviousMonth - i),
      isCurrentMonth: false,
    })
  }

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({
      date: new Date(year, month, i),
      isCurrentMonth: true,
    })
  }

  // Next month days
  const remainingCells = totalCells - days.length
  for (let i = 1; i <= remainingCells; i++) {
    days.push({
      date: new Date(year, month + 1, i),
      isCurrentMonth: false,
    })
  }

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Week day headers */}
      <div className="grid grid-cols-7 border-b border-border bg-muted/30">
        {weekDays.map((day) => (
          <div
            key={day}
            className="border-r border-border px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground last:border-r-0"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid flex-1 grid-cols-7 grid-rows-[repeat(auto-fit,minmax(0,1fr))] overflow-auto">
        {days.map((day, index) => {
          const dayPosts = posts.filter((post) => {
            const postDate = new Date(post.date)
            return (
              postDate.getDate() === day.date.getDate() &&
              postDate.getMonth() === day.date.getMonth() &&
              postDate.getFullYear() === day.date.getFullYear()
            )
          })

          return (
            <CalendarDay
              key={index}
              date={day.date}
              isCurrentMonth={day.isCurrentMonth}
              posts={dayPosts}
              onAddPost={onAddPost}
              onEditPost={onEditPost}
            />
          )
        })}
      </div>
    </div>
  )
}
