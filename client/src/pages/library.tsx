import { useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { LibraryView } from "../../components/library/library-view"
import { supabase } from "../../lib/supabase/client"
import type { Calendar } from "../../lib/types"

export default function LibraryPage() {
  const { calendarSlug } = useParams()

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
      return {
        id: data.id,
        name: data.name,
        slug: data.slug,
        organizationId: data.organization_id ?? null,
        color: data.color,
        createdAt: new Date(data.created_at),
      } as Calendar
    },
    enabled: !!calendarSlug,
  })

  if (!calendarSlug || !calendar) {
    return <div>Loading...</div>
  }

  return <LibraryView calendarId={calendar.id} />
}

