import { Hono } from "hono"

import type { User } from "@supabase/supabase-js"

import { requireAuth, isUser } from "../lib/auth"

import { getProfile, updateProfile, type ProfileUpdate } from "../lib/db/profiles"



type Variables = {

  authResult: User

}



const app = new Hono<{ Variables: Variables }>()



app.use('*', requireAuth)



app.get("/", async (c) => {

  const authResult = c.get('authResult')

  if (!isUser(authResult)) {

    return c.json({ error: 'Unauthorized' }, 401)

  }

  const user = authResult



  try {

    const profile = await getProfile(user.id)

    return c.json(profile)

  } catch (error: any) {

    console.error("Error fetching profile:", error)

    return c.json({ error: error.message || "Failed to fetch profile" }, 500)

  }

})



app.put("/", async (c) => {

  const authResult = c.get('authResult')

  if (!isUser(authResult)) {

    return c.json({ error: 'Unauthorized' }, 401)

  }

  const user = authResult



  const body = await c.req.json()

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

    console.error("Error updating profile:", error)

    return c.json({ error: error.message || "Failed to update profile" }, 500)

  }

})



export default app

