import { Hono } from "hono"
import { requireAuth, canAccessCalendar } from "../lib/auth"
import { supabase } from "../lib/supabase"

const app = new Hono()

function mapPostToResponse(post: any) {
  return {
    id: post.id,
    calendarId: post.calendar_id,
    date: post.date,
    caption: post.caption,
    images: post.images || [],
    platform: post.platform,
    status: post.status,
    authorId: post.author_id,
    authorName: post.author_name,
    createdAt: post.created_at,
    updatedAt: post.updated_at,
  }
}

app.get("/", async (c) => {
  const authResult = await requireAuth(c)
  if (!authResult || typeof authResult !== "object" || !("id" in authResult) || "status" in authResult) {
    return authResult as any
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

  const { data: posts, error } = await supabase
    .from("posts")
    .select("*")
    .eq("calendar_id", calendarId)
    .order("date", { ascending: true })

  if (error) {
    console.error("[v0] Error fetching posts:", error)
    return c.json({ error: error.message }, 500)
  }

  return c.json((posts || []).map(mapPostToResponse))
})

app.post("/", async (c) => {
  const authResult = await requireAuth(c)
  if (!authResult || typeof authResult !== "object" || !("id" in authResult) || "status" in authResult) {
    return authResult as any
  }
  const user = authResult

  const body = await c.req.json()
  const { calendarId, ...postData } = body

  if (!calendarId) {
    return c.json({ error: "Calendar ID required" }, 400)
  }

  const hasAccess = await canAccessCalendar(user.id, calendarId)
  if (!hasAccess) {
    return c.json({ error: "Forbidden" }, 403)
  }

  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      calendar_id: calendarId,
      date: postData.date,
      caption: postData.caption,
      images: postData.images,
      platform: postData.platform,
      status: postData.status,
      author_id: postData.authorId,
      author_name: postData.authorName,
    })
    .select()
    .single()

  if (error) {
    console.error("[v0] Error creating post:", error)
    return c.json({ error: error.message }, 500)
  }

  return c.json(mapPostToResponse(post))
})

app.put("/", async (c) => {
  const authResult = await requireAuth(c)
  if (!authResult || typeof authResult !== "object" || !("id" in authResult) || "status" in authResult) {
    return authResult as any
  }
  const user = authResult

  const body = await c.req.json()
  const { id, calendarId, ...postData } = body

  if (!id || !calendarId) {
    return c.json({ error: "Post ID and Calendar ID required" }, 400)
  }

  const hasAccess = await canAccessCalendar(user.id, calendarId)
  if (!hasAccess) {
    return c.json({ error: "Forbidden" }, 403)
  }

  const updateData: any = {}
  if (postData.date !== undefined) updateData.date = postData.date
  if (postData.caption !== undefined) updateData.caption = postData.caption
  if (postData.images !== undefined) updateData.images = postData.images
  if (postData.platform !== undefined) updateData.platform = postData.platform
  if (postData.status !== undefined) updateData.status = postData.status
  if (postData.authorId !== undefined) updateData.author_id = postData.authorId
  if (postData.authorName !== undefined) updateData.author_name = postData.authorName

  const { data: post, error } = await supabase
    .from("posts")
    .update(updateData)
    .eq("id", id)
    .eq("calendar_id", calendarId)
    .select()
    .single()

  if (error) {
    console.error("[v0] Error updating post:", error)
    return c.json({ error: error.message }, 500)
  }

  return c.json(mapPostToResponse(post))
})

app.delete("/", async (c) => {
  const authResult = await requireAuth(c)
  if (!authResult || typeof authResult !== "object" || !("id" in authResult) || "status" in authResult) {
    return authResult as any
  }
  const user = authResult

  const id = c.req.query("id")
  const calendarId = c.req.query("calendarId")

  if (!id || !calendarId) {
    return c.json({ error: "Post ID and Calendar ID required" }, 400)
  }

  const hasAccess = await canAccessCalendar(user.id, calendarId)
  if (!hasAccess) {
    return c.json({ error: "Forbidden" }, 403)
  }

  const { error } = await supabase.from("posts").delete().eq("id", id).eq("calendar_id", calendarId)

  if (error) {
    console.error("[v0] Error deleting post:", error)
    return c.json({ error: error.message }, 500)
  }

  return c.json({ success: true })
})

export default app
