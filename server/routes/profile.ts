import { Hono } from "hono"
import { requireAuth, isUser } from "../lib/auth"
import { updateProfile, type ProfileUpdate } from "../lib/db/profiles"

const app = new Hono()

app.put("/", async (c) => {
  const authResult = await requireAuth(c)
  if (!isUser(authResult)) {
    return authResult
  }
  const user = authResult

  const body = await c.req.json()
  
  // Map the request body to ProfileUpdate format
  const updates: ProfileUpdate = {}
  if (body.name !== undefined) updates.name = body.name
  if (body.email !== undefined) updates.email = body.email
  if (body.bio !== undefined) updates.bio = body.bio
  if (body.avatar_url !== undefined) updates.avatar_url = body.avatar_url
  if (body.timezone !== undefined) updates.timezone = body.timezone
  if (body.language !== undefined) updates.language = body.language
  if (body.theme !== undefined) updates.theme = body.theme
  if (body.compact_mode !== undefined) updates.compact_mode = body.compact_mode

  try {
    const updatedProfile = await updateProfile(user.id, updates)
    return c.json(updatedProfile)
  } catch (error: any) {
    console.error("[v0] Error updating profile:", error)
    return c.json({ error: error.message || "Failed to update profile" }, 500)
  }
})

export default app

