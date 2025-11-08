import { createClient } from "./supabase/server"

export async function getAuthUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return user
}

export async function requireAuth() {
  const user = await getAuthUser()
  if (!user) {
    throw new Error("Unauthorized")
  }
  return user
}

// Check if user has access to a calendar
export async function canAccessCalendar(userId: string, calendarId: string) {
  const supabase = await createClient()

  // Get the calendar's organization
  const { data: calendar, error: calendarError } = await supabase
    .from("calendars")
    .select("organization_id")
    .eq("id", calendarId)
    .single()

  if (calendarError || !calendar) {
    return false
  }

  // Check if user is a member of the organization
  const { data: membership, error: memberError } = await supabase
    .from("organization_members")
    .select("id")
    .eq("organization_id", calendar.organization_id)
    .eq("user_id", userId)
    .single()

  return !memberError && !!membership
}

// Check if user has access to an organization
export async function canAccessOrganization(userId: string, organizationId: string) {
  const supabase = await createClient()

  const { data: membership, error } = await supabase
    .from("organization_members")
    .select("id, role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .single()

  return !error && !!membership
}

// Check if user is admin or owner of an organization
export async function isOrgAdmin(userId: string, organizationId: string) {
  const supabase = await createClient()

  const { data: membership, error } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .single()

  if (error || !membership) {
    return false
  }

  return membership.role === "admin" || membership.role === "owner"
}
