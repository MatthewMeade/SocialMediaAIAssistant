import { Hono } from "hono"

import type { User } from "@supabase/supabase-js"

import { requireAuth, isUser } from "../lib/auth"

import { supabase } from "../lib/supabase"

import { inviteMember, removeMember, getOrganizationMembers } from "../lib/db/organizations"



type Variables = {

  authResult: User

}



const app = new Hono<{ Variables: Variables }>()



// Middleware to load and validate user

app.use('*', requireAuth)



// Get the current user's organization

app.get("/", async (c) => {

  const authResult = c.get('authResult')

  if (!isUser(authResult)) {

    return c.json({ error: 'Unauthorized' }, 401)

  }

  const user = authResult



  try {

    const { data, error } = await supabase

      .from("organizations")

      .select("*")

      .eq("owner_id", user.id)

      .maybeSingle()

    

    if (error) throw error

    if (!data) return c.json({ error: "Organization not found" }, 404)



    return c.json({

      id: data.id,

      name: data.name,

      slug: data.slug,

      createdAt: data.created_at,

      ownerId: data.owner_id,

    })

  } catch (error: any) {

    console.error("[ORG_ROUTE] Error fetching organization:", error)

    return c.json({ error: error.message || "Failed to fetch organization" }, 500)

  }

})



// Get members of the user's organization

app.get("/members", async (c) => {

  const authResult = c.get('authResult')

  if (!isUser(authResult)) {

    return c.json({ error: 'Unauthorized' }, 401)

  }

  const user = authResult



  // First, get the user's organization

  const { data: org, error: orgError } = await supabase

    .from("organizations")

    .select("id")

    .eq("owner_id", user.id)

    .maybeSingle()



  if (orgError) return c.json({ error: orgError.message }, 500)

  if (!org) return c.json({ error: "Organization not found" }, 404)

  

  try {

    const members = await getOrganizationMembers(org.id)

    return c.json(members)

  } catch (error: any) {

    console.error("[ORG_ROUTE] Error fetching members:", error)

    return c.json({ error: error.message || "Failed to fetch members" }, 500)

  }

})



// Invite a new member

app.post("/members", async (c) => {

  const authResult = c.get('authResult')

  if (!isUser(authResult)) {

    return c.json({ error: 'Unauthorized' }, 401)

  }

  const user = authResult



  const { organizationId, email, role } = await c.req.json()



  // Verify user is owner of this org

  const { data: org, error: orgError } = await supabase

    .from("organizations")

    .select("id")

    .eq("id", organizationId)

    .eq("owner_id", user.id)

    .maybeSingle()

  

  if (orgError) return c.json({ error: orgError.message }, 500)

  if (!org) return c.json({ error: "Forbidden" }, 403)

  

  try {

    const result = await inviteMember(organizationId, email, role, user.id)

    return c.json(result)

  } catch (error: any) {

    console.error("[ORG_ROUTE] Error inviting member:", error)

    return c.json({ error: error.message || "Failed to invite member" }, 500)

  }

})



// Remove a member

app.delete("/members", async (c) => {

  const authResult = c.get('authResult')

  if (!isUser(authResult)) {

    return c.json({ error: 'Unauthorized' }, 401)

  }

  const user = authResult



  const { memberId } = c.req.query()



  if (!memberId) {

    return c.json({ error: "memberId is required" }, 400)

  }



  // Verify user is owner of the org this member belongs to

  const { data: member, error: memberError } = await supabase

    .from("organization_members")

    .select("organization_id")

    .eq("id", memberId)

    .single()

  

  if (memberError || !member) return c.json({ error: "Member not found" }, 404)



  const { data: org, error: orgError } = await supabase

    .from("organizations")

    .select("id")

    .eq("id", member.organization_id)

    .eq("owner_id", user.id)

    .maybeSingle()

  

  if (orgError) return c.json({ error: orgError.message }, 500)

  if (!org) return c.json({ error: "Forbidden" }, 403)



  try {

    await removeMember(memberId)

    return c.json({ success: true })

  } catch (error: any) {

    console.error("[ORG_ROUTE] Error removing member:", error)

    return c.json({ error: error.message || "Failed to remove member" }, 500)

  }

})



export default app

