import { useParams } from "react-router-dom"
import { BrandVoiceView } from "../../components/brand/brand-voice-view"
import { useCalendars } from "@/lib/hooks/use-calendars"

export default function BrandVoicePage() {
  const { calendarSlug } = useParams()
  const { calendars, isLoading } = useCalendars()

  const calendar = calendars.find((c) => c.slug === calendarSlug)

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (!calendarSlug || !calendar) {
    return <div>Calendar not found...</div>
  }

  return <BrandVoiceView calendarId={calendar.id} />
}

