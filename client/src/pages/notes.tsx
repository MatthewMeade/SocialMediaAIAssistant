import { useParams } from "react-router-dom"
import { NotesView } from "../../components/notes/notes-view"
import { useCalendars } from "@/lib/hooks/use-calendars"

export default function NotesPage() {
  const { calendarSlug } = useParams()
  const { calendars, isLoading } = useCalendars()

  const calendar = calendars.find((c) => c.slug === calendarSlug)

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (!calendarSlug || !calendar) {
    return <div>Calendar not found...</div>
  }

  return <NotesView calendarId={calendar.id} />
}

