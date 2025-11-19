import { Hono } from "hono"
import type { User } from "@supabase/supabase-js"
import { requireAuth, isUser, canAccessCalendar } from "../lib/auth"
import { supabase } from "../lib/supabase"
import { getBrandRules, saveBrandRule, deleteBrandRule, saveBrandRulesBulk } from "../lib/db/brand-voice"

type Variables = {
  authResult: User
}

const app = new Hono<{ Variables: Variables }>()

// Middleware to load and validate user
app.use('*', requireAuth)

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

  const rules = await getBrandRules(calendarId)
  return c.json(rules)
})

app.post("/", async (c) => {
  const authResult = c.get('authResult')
  if (!isUser(authResult)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const user = authResult

  const body = await c.req.json()
  const { calendarId, title, description, enabled } = body

  if (!calendarId || !title || !description) {
    return c.json({ error: "Calendar ID, title, and description are required" }, 400)
  }

  const hasAccess = await canAccessCalendar(user.id, calendarId)
  if (!hasAccess) {
    return c.json({ error: "Forbidden" }, 403)
  }

  const rule = await saveBrandRule({
    id: crypto.randomUUID(),
    calendarId,
    title,
    description,
    enabled: enabled ?? true,
  })

  if (!rule) {
    return c.json({ error: "Failed to create brand rule" }, 500)
  }

  return c.json(rule)
})

app.put("/", async (c) => {
  const authResult = c.get('authResult')
  if (!isUser(authResult)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const user = authResult

  const body = await c.req.json()
  const { id, calendarId, title, description, enabled } = body

  if (!id || !calendarId || !title || !description) {
    return c.json({ error: "ID, calendar ID, title, and description are required" }, 400)
  }

  const hasAccess = await canAccessCalendar(user.id, calendarId)
  if (!hasAccess) {
    return c.json({ error: "Forbidden" }, 403)
  }

  const rule = await saveBrandRule({
    id,
    calendarId,
    title,
    description,
    enabled: enabled ?? true,
  })

  if (!rule) {
    return c.json({ error: "Failed to update brand rule" }, 500)
  }

  return c.json(rule)
})

app.delete("/", async (c) => {
  const authResult = c.get('authResult')
  if (!isUser(authResult)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const user = authResult

  const ruleId = c.req.query("id")

  if (!ruleId) {
    return c.json({ error: "Rule ID required" }, 400)
  }

  // First get the rule to check calendar access
  const { data: rule, error: ruleError } = await supabase
    .from("brand_rules")
    .select("calendar_id")
    .eq("id", ruleId)
    .single()

  if (ruleError || !rule) {
    return c.json({ error: "Rule not found" }, 404)
  }

  const hasAccess = await canAccessCalendar(user.id, rule.calendar_id)
  if (!hasAccess) {
    return c.json({ error: "Forbidden" }, 403)
  }

  const success = await deleteBrandRule(ruleId)

  if (!success) {
    return c.json({ error: "Failed to delete brand rule" }, 500)
  }

  return c.json({ success: true })
})

app.post("/bulk", async (c) => {
  const authResult = c.get('authResult')
  if (!isUser(authResult)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const user = authResult

  const body = await c.req.json()
  const { calendarId, rules } = body

  if (!calendarId || !Array.isArray(rules)) {
    return c.json({ error: "Calendar ID and rules array are required" }, 400)
  }

  const hasAccess = await canAccessCalendar(user.id, calendarId)
  if (!hasAccess) {
    return c.json({ error: "Forbidden" }, 403)
  }

  const rulesToSave = rules.map((r: any) => ({
    id: crypto.randomUUID(),
    calendarId,
    title: r.title,
    description: r.description,
    enabled: true,
  }))

  const savedRules = await saveBrandRulesBulk(rulesToSave)
  return c.json(savedRules)
})

export default app

