import { createClient } from "../supabase/server"

export async function inviteMember(organizationId: string, email: string, role: "admin" | "member", invitedBy: string) {
  const supabase = await createClient()

  // Check if user already exists
  const { data: existingProfile } = await supabase.from("profiles").select("id").eq("email", email).single()

  if (existingProfile) {
    // User exists, add them directly as a member
    const { data, error } = await supabase
      .from("organization_members")
      .insert({
        organization_id: organizationId,
        user_id: existingProfile.id,
        role: role,
      })
      .select()
      .single()

    if (error) throw error
    return { type: "direct", data }
  } else {
    // User doesn't exist, create invitation
    const { data, error } = await supabase
      .from("organization_invitations")
      .insert({
        organization_id: organizationId,
        email: email,
        role: role,
        invited_by: invitedBy,
      })
      .select()
      .single()

    if (error) throw error
    return { type: "invitation", data }
  }
}

export async function removeMember(memberId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("organization_members").delete().eq("id", memberId)

  if (error) throw error
}

export async function getOrganizationMembers(organizationId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("organization_members")
    .select("*, profiles(*)")
    .eq("organization_id", organizationId)

  if (error) throw error
  return data
}
