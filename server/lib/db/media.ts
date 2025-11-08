import { createClient } from "../supabase/server"

export interface MediaItem {
  id: string
  calendarId: string
  userId: string
  url: string
  filename: string
  size: number
  type: string
  createdAt: Date
}

export async function saveMedia(
  calendarId: string,
  userId: string,
  url: string,
  filename: string,
  size: number,
  type: string,
): Promise<MediaItem | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("media")
    .insert({
      calendar_id: calendarId,
      user_id: userId,
      url,
      filename,
      size,
      type,
    })
    .select()
    .single()

  if (error) {
    console.error("Error saving media:", error)
    return null
  }

  return {
    id: data.id,
    calendarId: data.calendar_id,
    userId: data.user_id,
    url: data.url,
    filename: data.filename,
    size: data.size,
    type: data.type,
    createdAt: new Date(data.created_at),
  }
}

export async function getMediaByCalendar(calendarId: string): Promise<MediaItem[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("media")
    .select("*")
    .eq("calendar_id", calendarId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching media:", error)
    return []
  }

  return data.map((item) => ({
    id: item.id,
    calendarId: item.calendar_id,
    userId: item.user_id,
    url: item.url,
    filename: item.filename,
    size: item.size,
    type: item.type,
    createdAt: new Date(item.created_at),
  }))
}

export async function deleteMedia(mediaId: string): Promise<boolean> {
  const supabase = await createClient()

  const { error } = await supabase.from("media").delete().eq("id", mediaId)

  if (error) {
    console.error("Error deleting media:", error)
    return false
  }

  return true
}
