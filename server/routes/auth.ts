import { Hono } from "hono"
import { supabaseAnon } from "../lib/supabase"

const app = new Hono()

app.post("/login", async (c) => {
  const { email, password } = await c.req.json()

  const { data, error } = await supabaseAnon.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return c.json({ error: error.message }, 400)
  }

  return c.json({
    user: data.user,
    session: data.session,
  })
})

app.post("/signup", async (c) => {
  const { email, password, name } = await c.req.json()

  const { data, error } = await supabaseAnon.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
      },
    },
  })

  if (error) {
    return c.json({ error: error.message }, 400)
  }

  return c.json({
    user: data.user,
    session: data.session,
  })
})

app.post("/logout", async (c) => {
  const authHeader = c.req.header("Authorization")

  if (authHeader && authHeader.startsWith("Bearer ")) {
    await supabaseAnon.auth.signOut()
  }

  return c.json({ success: true })
})

export default app
