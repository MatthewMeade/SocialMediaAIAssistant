import { Hono } from "hono"
import { requireAuth } from "../lib/auth"
import { supabase } from "../lib/supabase"

const app = new Hono()

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

app.get("/", async (c) => {
  const authResult = await requireAuth(c)
  if (!authResult || typeof authResult !== "object" || !("id" in authResult) || "status" in authResult) {
    return authResult as any
  }
  const user = authResult

  const { data: calendars, error } = await supabase
    .from("calendars")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })

  if (error) {
    return c.json({ error: error.message }, 500)
  }

  const mappedCalendars = (calendars || []).map((calendar) => ({
    id: calendar.id,
    name: calendar.name,
    slug: calendar.slug,
    color: calendar.color,
    userId: calendar.user_id,
    organizationId: calendar.organization_id,
    createdAt: calendar.created_at,
    updatedAt: calendar.updated_at,
  }))

  return c.json(mappedCalendars)
})

app.post("/", async (c) => {
  const authResult = await requireAuth(c)
  if (!authResult || typeof authResult !== "object" || !("id" in authResult) || "status" in authResult) {
    return authResult as any
  }
  const user = authResult

  const body = await c.req.json()
  const { name, color } = body

  if (!name) {
    return c.json({ error: "Name is required" }, 400)
  }

  let slug = generateSlug(name)
  let slugExists = true
  let counter = 1

  while (slugExists) {
    const { data: existing } = await supabase
      .from("calendars")
      .select("id")
      .eq("user_id", user.id)
      .eq("slug", slug)
      .maybeSingle()

    if (!existing) {
      slugExists = false
    } else {
      slug = `${generateSlug(name)}-${counter}`
      counter++
    }
  }

  const { data: calendar, error } = await supabase
    .from("calendars")
    .insert({
      name,
      slug,
      color: color || "#3b82f6",
      user_id: user.id,
    })
    .select()
    .single()

  if (error) {
    return c.json({ error: error.message }, 500)
  }

  const mappedCalendar = {
    id: calendar.id,
    name: calendar.name,
    slug: calendar.slug,
    color: calendar.color,
    userId: calendar.user_id,
    organizationId: calendar.organization_id,
    createdAt: calendar.created_at,
    updatedAt: calendar.updated_at,
  }

  return c.json(mappedCalendar)
})

export default app
