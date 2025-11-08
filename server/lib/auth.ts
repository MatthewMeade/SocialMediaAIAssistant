import type { Context } from "hono"
import type { User } from "@supabase/supabase-js"
import { supabase } from "./supabase"

type AuthResult = User | Response

export function isUser(result: AuthResult): result is User {
  return result !== null && typeof result === "object" && "id" in result && !("status" in result)
}

export async function requireAuth(c: Context): Promise<AuthResult> {
  const authHeader = c.req.header("Authorization")

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  const token = authHeader.substring(7)

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token)

  if (error || !user) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  return user
}

export async function canAccessCalendar(userId: string, calendarId: string): Promise<boolean> {
  const { data } = await supabase.from("calendars").select("id").eq("id", calendarId).eq("user_id", userId).single()

  return !!data
}
