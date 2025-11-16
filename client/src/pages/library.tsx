import { useParams } from "react-router-dom"
import { LibraryView } from "../../components/library/library-view"
import { useCalendars } from "@/lib/hooks/use-calendars"

export default function LibraryPage() {
  const { calendarSlug } = useParams()
  const { calendars, isLoading } = useCalendars()

  const calendar = calendars.find((c) => c.slug === calendarSlug)

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (!calendarSlug || !calendar) {
    return <div>Calendar not found...</div>
  }

  return <LibraryView calendarId={calendar.id} />
}

