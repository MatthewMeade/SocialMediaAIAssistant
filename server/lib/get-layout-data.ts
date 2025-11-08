import { cache } from "react"
import { createClient } from "./supabase/server"

export const getLayoutData = cache(async (calendarSlug: string) => {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()

  const { data: calendars } = await supabase
    .from("calendars")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })

  const currentCalendar = calendars?.find((c) => c.slug === calendarSlug)

  return {
    user,
    profile,
    calendars,
    currentCalendar,
  }
})
