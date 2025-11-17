import { createClient } from "../supabase/server"
import type { Note } from "../../../shared/types"

export async function getNoteById(noteId: string): Promise<Note | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("id", noteId)
    .single()

  if (error || !data) {
    console.error("[v0] Error loading note:", error)
    return null
  }

  return {
    id: data.id,
    calendarId: data.calendar_id,
    title: data.title,
    content: data.content,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  }
}

