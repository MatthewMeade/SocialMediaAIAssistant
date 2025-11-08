import { useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { LibraryView } from "../../components/library/library-view"
import { supabase } from "../../lib/supabase/client"

export default function LibraryPage() {
  const { calendarSlug } = useParams()

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

  if (!calendarSlug || !calendar) {
    return <div>Loading...</div>
  }

  return <LibraryView calendarId={calendar.id} />
}

