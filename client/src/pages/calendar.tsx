import { useParams, useSearchParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { CalendarView } from "../../components/calendar/calendar-view"
import { useAuth } from "../../lib/auth/context"
import { supabase } from "../../lib/supabase/client"

export default function CalendarPage() {
  const { calendarSlug } = useParams()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()

  const { data: calendar } = useQuery<{ id: string; name: string; slug: string; color: string; created_at: string } | null>({
    queryKey: ["calendar", calendarSlug],
    queryFn: async () => {
      if (!calendarSlug) return null
      const { data, error } = await supabase
        .from("calendars")
        .select("*")
        .eq("slug", calendarSlug)
        .single()
      if (error) throw error
      return data as { id: string; name: string; slug: string; color: string; created_at: string } | null
    },
    enabled: !!calendarSlug,
  })

  if (!calendarSlug || !calendar || !user) {
    return <div>Loading...</div>
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
