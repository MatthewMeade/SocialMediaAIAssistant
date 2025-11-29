import { useParams, useSearchParams } from "react-router-dom"
import { CalendarView } from "../../components/calendar/calendar-view"
import { useAuth } from "../../lib/auth/context"
import { useCalendars } from "@/lib/hooks/use-calendars"

export default function CalendarPage() {
  const { calendarSlug } = useParams()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const { calendars, isLoading } = useCalendars()

  const calendar = calendars.find((c) => c.slug === calendarSlug)

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (!calendarSlug || !calendar || !user) {
    return <div>Calendar not found...</div>
  }

  const currentUser = {
    id: user.id,
    name: user.user_metadata?.name || user.email || "User",
    email: user.email || "",
  }

  return (
    <CalendarView
      currentUser={currentUser}
      calendarId={calendar.id}
      calendarSlug={calendarSlug}
      postToOpen={searchParams.get("post")}
    />
  )
}
