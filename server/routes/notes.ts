import { Hono } from "hono"
import type { User } from "@supabase/supabase-js"
import { requireAuth, isUser, canAccessCalendar } from "../lib/auth"
import { supabase } from "../lib/supabase"
import { DocType, VectorStore } from "server/ai-service/vector-store"
import { Node } from 'slate'
import { convertSlateToText } from "server/lib/content-utils"

type Variables = {
  authResult: User
}

const app = new Hono<{ Variables: Variables }>()

app.use('*', requireAuth)

function mapNoteToResponse(note: any) {
  return {
    id: note.id,
    calendarId: note.calendar_id,
    title: note.title,
    content: note.content,
    createdAt: note.created_at,
    updatedAt: note.updated_at,
  }
}

app.get("/", async (c) => {
  const authResult = c.get('authResult')
  if (!isUser(authResult)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const user = authResult

  const calendarId = c.req.query("calendarId")

  if (!calendarId) {
    return c.json({ error: "Calendar ID required" }, 400)
  }

  const hasAccess = await canAccessCalendar(user.id, calendarId)
  if (!hasAccess) {
    return c.json({ error: "Forbidden" }, 403)
  }

  const { data: notes, error } = await supabase
    .from("notes")
    .select("*")
    .eq("calendar_id", calendarId)
    .order("updated_at", { ascending: false })

  if (error) {
    console.error("[notes] Error fetching notes:", error)
    return c.json({ error: error.message }, 500)
  }

  return c.json((notes || []).map(mapNoteToResponse))
})

app.post("/", async (c) => {
  const authResult = c.get('authResult')
  if (!isUser(authResult)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const user = authResult

  const body = await c.req.json()
  const { calendarId, title, content } = body

  if (!calendarId) {
    return c.json({ error: "Calendar ID required" }, 400)
  }

  if (!title) {
    return c.json({ error: "Title required" }, 400)
  }

  const hasAccess = await canAccessCalendar(user.id, calendarId)
  if (!hasAccess) {
    return c.json({ error: "Forbidden" }, 403)
  }

  const { data: note, error } = await supabase
    .from("notes")
    .insert({
      calendar_id: calendarId,
      title: title,
      content: content || null,
    })
    .select()
    .single()

  if (error) {
    console.error("[notes] Error creating note:", error)
    return c.json({ error: error.message }, 500)
  }

  try {
    const vectorStore = new VectorStore()
    vectorStore.upsertDocument(DocType.Note, {
      id: note.id,
      calendarId,
      content: convertSlateToText(note.content as Node[])
    })
  } catch (e) {
    console.error("Error upserting note vector db", { e, id: note.id })
  }

  return c.json(mapNoteToResponse(note))
})

app.put("/:id", async (c) => {
  const authResult = c.get('authResult')
  if (!isUser(authResult)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const user = authResult

  const noteId = c.req.param("id")
  const body = await c.req.json()
  const { title, content } = body

  // First, get the note to check calendar access
  const { data: existingNote, error: fetchError } = await supabase
    .from("notes")
    .select("calendar_id")
    .eq("id", noteId)
    .single()

  if (fetchError || !existingNote) {
    return c.json({ error: "Note not found" }, 404)
  }

  const hasAccess = await canAccessCalendar(user.id, existingNote.calendar_id)
  if (!hasAccess) {
    return c.json({ error: "Forbidden" }, 403)
  }

  const { data: note, error } = await supabase
    .from("notes")
    .update({
      title: title,
      content: content,
      updated_at: new Date().toISOString(),
    })
    .eq("id", noteId)
    .select()
    .single()

  try {
    const vectorStore = new VectorStore()
    vectorStore.upsertDocument(DocType.Note, {
      id: note.id,
      calendarId: note.calendar_id,
      content: convertSlateToText(note.content as Node[])
    })
  } catch (e) {
    console.error("Error upserting note vector db", { e, id: note.id })
  }

  if (error) {
    console.error("[notes] Error updating note:", error)
    return c.json({ error: error.message }, 500)
  }

  return c.json(mapNoteToResponse(note))
})

app.delete("/:id", async (c) => {
  const authResult = c.get('authResult')
  if (!isUser(authResult)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const user = authResult

  const noteId = c.req.param("id")

  const { data: existingNote, error: fetchError } = await supabase
    .from("notes")
    .select("calendar_id")
    .eq("id", noteId)
    .single()

      try {
    const vectorStore = new VectorStore()
    vectorStore.deleteDocument(DocType.Note, noteId)
  } catch (e) {
    console.error("Error deleting note vector db", { e, id: noteId})
  }

  if (fetchError || !existingNote) {
    return c.json({ error: "Note not found" }, 404)
  }

  const hasAccess = await canAccessCalendar(user.id, existingNote.calendar_id)
  if (!hasAccess) {
    return c.json({ error: "Forbidden" }, 403)
  }

  const { error } = await supabase
    .from("notes")
    .delete()
    .eq("id", noteId)

  if (error) {
    console.error("[notes] Error deleting note:", error)
    return c.json({ error: error.message }, 500)
  }

  return c.json({ success: true })
})

export default app

