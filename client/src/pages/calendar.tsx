import { useParams, useSearchParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { CalendarView } from "../../components/calendar/calendar-view"
import { useAuth } from "../../lib/auth/context"
import { supabase } from "../../lib/supabase/client"
import type { Calendar } from "../../lib/types"

export default function CalendarPage() {
  const { calendarSlug } = useParams()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()

  const { data: calendar } = useQuery<Calendar | null>({
    queryKey: ["calendar", calendarSlug],
    queryFn: async () => {
      if (!calendarSlug) return null
      const { data, error } = await supabase
        .from("calendars")
        .select("*")
        .eq("slug", calendarSlug)
        .single()
      if (error) throw error
      if (!data) return null
      // Transform database response to match Calendar type
      const dbData = data as any
      return {
        id: dbData.id,
        name: dbData.name,
        slug: dbData.slug,
        organizationId: dbData.organization_id ?? null,
        color: dbData.color,
        createdAt: new Date(dbData.created_at),
      } as Calendar
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
