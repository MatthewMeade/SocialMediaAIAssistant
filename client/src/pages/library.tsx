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

  if (!calendarSlug || !calendar) {
    return <div>Loading...</div>
  }

  return <LibraryView calendarId={calendar.id} />
}

